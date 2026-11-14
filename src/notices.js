export const POLL_INTERVAL = 10 * 60 * 1000;
const FIRST_RETRY = 30 * 1000;
const FETCH_TIMEOUT = 8 * 1000;
const CACHE_KEY = 'istanbul-wallboard.notices.v1';

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

function isHttpLink(url) {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSnapshot(data, lineIds) {
  if (!data || !validDay(data.snapshotDate) || !Array.isArray(data.notices) || data.notices.length > 30) return null;
  const ids = new Set();
  for (const notice of data.notices) {
    if (!notice || typeof notice.id !== 'string' || !notice.id || ids.has(notice.id)
      || !Array.isArray(notice.lines) || !notice.lines.length || !notice.lines.every(id => lineIds.includes(id))
      || !validDay(notice.publishedDate) || notice.publishedDate > data.snapshotDate
      || typeof notice.title !== 'string' || !notice.title.trim() || notice.title.length > 140
      || typeof notice.summary !== 'string' || !notice.summary.trim() || notice.summary.length > 600
      || !isHttpLink(notice.url)) return null;
    ids.add(notice.id);
  }
  return { ...data, notices: [...data.notices].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate)) };
}

function readCache(storage, lineIds) {
  try {
    const record = JSON.parse(storage.getItem(CACHE_KEY));
    const snapshot = validateSnapshot(record?.snapshot, lineIds);
    if (snapshot && Number.isFinite(record.fetchedAt) && record.fetchedAt > 0) {
      return { snapshot, fetchedAt: record.fetchedAt };
    }
  } catch {
    // A blocked or corrupt cache must not prevent a network fetch.
  }
  return null;
}

export function createNoticePoller({
  url, lineIds, storage, onChange, fetcher = fetch,
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
}) {
  let current = readCache(storage, lineIds);
  let timer;
  let active;
  let nextAt = 0;
  let failures = 0;
  let running = false;

  function emit(state) {
    onChange({ state, snapshot: current?.snapshot, fetchedAt: current?.fetchedAt });
  }

  function queue(delay) {
    if (!running) return;
    nextAt = now() + delay;
    timer = schedule(refresh, delay);
  }

  async function refresh() {
    if (!running || active) return;
    cancel(timer);
    const request = new AbortController();
    active = request;
    const deadline = schedule(() => request.abort(), FETCH_TIMEOUT);
    let delay = POLL_INTERVAL;
    try {
      const response = await fetcher(url, { cache: 'no-store', signal: request.signal, redirect: 'error' });
      if (!response.ok) throw new Error('Notice response ' + response.status);
      const snapshot = validateSnapshot(await response.json(), lineIds);
      if (!snapshot) throw new Error('Invalid notice snapshot');
      if (active !== request || !running) return;
      current = { snapshot, fetchedAt: now() };
      try {
        storage.setItem(CACHE_KEY, JSON.stringify(current));
      } catch {
        // The in-memory snapshot still covers outages in this tab.
      }
      failures = 0;
      emit('published');
    } catch {
      if (active !== request || !running) return;
      delay = Math.min(POLL_INTERVAL, FIRST_RETRY * 2 ** Math.min(failures++, 5));
      emit(current ? 'delayed' : 'unavailable');
    } finally {
      cancel(deadline);
      if (active === request) {
        active = undefined;
        queue(delay);
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      emit(current ? 'delayed' : 'checking');
      void refresh();
    },
    reconnect: refresh,
    resume() {
      if (now() >= nextAt) void refresh();
    },
    offline() {
      if (running) emit(current ? 'delayed' : 'unavailable');
    },
    stop() {
      running = false;
      cancel(timer);
      active?.abort();
      active = undefined;
    },
  };
}
