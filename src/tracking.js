import { lineById, stationRoutes } from './network.js';

export const TRACKING_INTERVAL = 10_000;
export const MAX_OBSERVATION_AGE = 45_000;
const CLOCK_TOLERANCE = 5_000;
const SOURCE_TIMEOUT = 7_000;
const knownStatuses = new Set(['STOPPED_AT', 'INCOMING_AT', 'IN_TRANSIT_TO']);

function parseTime(value) {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) return NaN;
  const date = new Date(value);
  const normalized = match[1] + '.' + (match[2] || '').padEnd(3, '0') + 'Z';
  return Number.isFinite(date.getTime()) && date.toISOString() === normalized ? date.getTime() : NaN;
}

export function isFresh(time, now) {
  return Number.isFinite(time) && time <= now + CLOCK_TOLERANCE && now - time < MAX_OBSERVATION_AGE;
}

export function parseTrackingSnapshot(data, now) {
  if (!data || !Array.isArray(data.coveredLines) || !data.coveredLines.length
    || !data.coveredLines.every(id => lineById.has(id)) || !Array.isArray(data.positions) || data.positions.length > 1500) {
    return null;
  }
  const observedAt = parseTime(data.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > now + CLOCK_TOLERANCE) return null;
  const coveredLines = [...new Set(data.coveredLines)];
  const positions = [];
  for (const position of data.positions) {
    if (!position || !knownStatuses.has(position.status) || !coveredLines.includes(position.lineId)
      || !stationRoutes.get(position.stationId)?.some(route => route.id === position.lineId)) {
      return null;
    }
    const time = parseTime(position.observedAt);
    if (!Number.isFinite(time) || time > observedAt + CLOCK_TOLERANCE) return null;
    if (isFresh(time, now)) positions.push({ ...position, time });
  }
  return { observedAt, coveredLines, positions };
}

export function liveStationLights(snapshot, selected, now, byPlatform = false) {
  const solid = new Map();
  const approaching = new Map();
  if (!snapshot || !isFresh(snapshot.observedAt, now)) return { solid, approaching };
  // Within each state, the newest observation determines the color at a shared station.
  const observations = [...snapshot.positions].sort((a, b) => b.time - a.time);
  for (const { stationId, lineId, status, time } of observations) {
    const key = byPlatform ? lineId + '/' + stationId : stationId;
    const lamps = status === 'STOPPED_AT' ? solid : approaching;
    if (selected.includes(lineId) && isFresh(time, now) && !lamps.has(key)) {
      lamps.set(key, lineById.get(lineId).color);
    }
  }
  for (const key of solid.keys()) approaching.delete(key);
  return { solid, approaching };
}

export function createTracker({ base, onChange }) {
  let enabled;
  let active;
  let timer;
  let running = false;
  let nextAt = 0;
  let previousSnapshot;
  let hasFreshSnapshot = false;
  let failures = 0;

  async function json(path, signal) {
    const response = await fetch(new URL(path, base), { signal, cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('Tracking source response ' + response.status);
    return response.json();
  }

  async function refresh() {
    if (!running || active || enabled === false) return;
    clearTimeout(timer);
    const request = new AbortController();
    active = request;
    const deadline = setTimeout(() => request.abort(), SOURCE_TIMEOUT);
    let interval = TRACKING_INTERVAL;
    try {
      if (enabled === undefined) {
        const config = await json('tracking-config.json', request.signal);
        if (active !== request || !running) return;
        if (typeof config?.enabled !== 'boolean') throw new Error('Invalid tracking configuration');
        enabled = config.enabled;
        if (!enabled) {
          onChange('unavailable');
          return;
        }
      }
      const payload = await json('station-occupancy.json', request.signal);
      if (active !== request || !running) return;
      const now = Date.now();
      const snapshot = parseTrackingSnapshot(payload, now);
      if (!snapshot || (previousSnapshot && snapshot.observedAt < previousSnapshot.observedAt)) {
        throw new Error('Invalid or out-of-order station occupancy');
      }
      previousSnapshot = snapshot;
      failures = 0;
      if (isFresh(snapshot.observedAt, now)) {
        hasFreshSnapshot = true;
        onChange('live', snapshot);
      } else {
        onChange('delayed');
      }
    } catch {
      if (active !== request || !running) return;
      onChange(hasFreshSnapshot ? 'delayed' : 'unavailable');
      interval = Math.min(60_000, TRACKING_INTERVAL * 2 ** Math.min(failures++, 3));
    } finally {
      clearTimeout(deadline);
      if (active === request) {
        active = undefined;
        if (running && enabled !== false) {
          nextAt = Date.now() + interval;
          timer = setTimeout(refresh, interval);
        }
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void refresh();
    },
    reconnect: refresh,
    resume() {
      if (Date.now() >= nextAt) void refresh();
    },
    offline() {
      active?.abort();
      if (running) onChange(hasFreshSnapshot ? 'delayed' : 'unavailable');
    },
    stop() {
      running = false;
      clearTimeout(timer);
      active?.abort();
      active = undefined;
    },
  };
}
