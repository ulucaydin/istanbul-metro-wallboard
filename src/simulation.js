import { lines, stations } from './network.js';
import geographic from './geography-data.json' with { type: 'json' };
import { directionalKey } from './metroboard.js';

const minute = 60;
const day = 86_400;
const istanbulOffset = 3 * 3600;
const terminalDwell = 35;
const nightLines = new Set(['M1A', 'M1B', 'M2', 'M4', 'M5', 'M6', 'M7']);
// Nominal end-to-end minutes, followed by modeled peak, daytime and evening headways.
const service = {
  M1A: [35, 6, 9, 13], M1B: [25, 6, 9, 13], M2: [32, 4, 6, 10],
  M3: [44, 7, 9, 14], M4: [52, 5, 8, 12], M5: [50, 5, 8, 12],
  M6: [7, 5, 9, 12], M7: [36, 6, 9, 13], M8: [26, 7, 10, 14],
  M9: [26, 9, 12, 16], M11: [57, 15, 15, 15],
  B1: [108, 15, 15, 15], U3: [20, 20, 20, 20],
  T1: [65, 4, 7, 10], T2: [15, 20, 20, 25], T3: [20, 10, 12, 15],
  T4: [45, 5, 8, 12], T5: [32, 5, 8, 12],
  F1: [2.5, 4, 5, 8], F2: [1.5, 5, 5, 8], F3: [2.5, 7, 7, 10], F4: [2.5, 5, 6, 9],
};

export const scenarioTimes = {
  rush: Date.parse('2026-11-11T05:20:00Z'),
  night: Date.parse('2026-11-14T22:20:00Z'),
};

export function customScenarioTime(day, time) {
  if (!/^[0-6]$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minuteValue] = time.split(':').map(Number);
  // 9 November 2026 was Monday. Istanbul is UTC+3 for these modeled dates.
  return Date.UTC(2026, 10, 9 + Number(day), hour - 3, minuteValue);
}

function journey(route, stops, duration, reverse, shuttle) {
  const ordered = reverse ? [...stops].reverse() : stops;
  const dwells = ordered.map((id, index) => {
    if (index === 0 || index === ordered.length - 1) return terminalDwell;
    return stations.get(id).connections.length ? 29 : 23;
  });
  const distances = new Map();
  for (const [from, to, points] of geographic.routes[route.id].edges) {
    const distance = points.slice(1).reduce((sum, [lon, lat], index) => {
      const [previousLon, previousLat] = points[index];
      return sum + Math.hypot((lon - previousLon) * .754, lat - previousLat) * 111_000;
    }, 0);
    distances.set(from + '/' + to, distance);
    distances.set(to + '/' + from, distance);
  }
  const weights = ordered.slice(1).map((id, index) => {
    // A floor keeps very short segments from consuming less than a few seconds.
    return Math.sqrt(Math.max(100, distances.get(ordered[index] + '/' + id)));
  });
  function allocate(first, last, minutes, boundaryDwell = 0) {
    const travel = minutes * minute - dwells.slice(first + 1, last).reduce((sum, dwell) => sum + dwell, 0) - boundaryDwell;
    const stretch = weights.slice(first, last);
    const totalWeight = stretch.reduce((sum, weight) => sum + weight, 0);
    return stretch.map(weight => weight * travel / totalWeight);
  }

  const end = ordered.length - 1;
  let runs;
  if (route.id === 'M1A' || route.id === 'M1B') {
    const otogar = ordered.indexOf('otogar');
    const firstHalf = reverse ? duration - 14 : 14;
    // Otogar separates the shared trunk from the two branches.
    runs = [...allocate(0, otogar, firstHalf, reverse ? dwells[otogar] : 0),
      ...allocate(otogar, end, duration - firstHalf, reverse ? 0 : dwells[otogar])];
  } else if (route.id === 'M11') {
    const airport = ordered.indexOf('istanbul-airport');
    const firstHalf = reverse ? 30 : 27;
    runs = [...allocate(0, airport, firstHalf), ...allocate(airport, end, duration - firstHalf, dwells[airport])];
  } else if (route.id === 'B1') {
    const [first, second] = ['b-sirkeci', 'uskudar'].map(id => ordered.indexOf(id)).sort((a, b) => a - b);
    const travelWeights = weights.reduce((sum, weight) => sum + weight, 0) - weights[first];
    const before = (duration - 4) * weights.slice(0, first).reduce((sum, weight) => sum + weight, 0) / travelWeights;
    runs = [...allocate(0, first, before), ...allocate(first, second, 4, dwells[first]),
      ...allocate(second, end, duration - before - 4, dwells[second])];
  } else {
    runs = allocate(0, end, duration);
  }
  let elapsed = 0;
  const segments = ordered.map((stationId, index) => {
    const segment = {
      stationId,
      arrival: index === 0 ? -terminalDwell : elapsed,
      departure: index === 0 ? 0 : elapsed + dwells[index],
    };
    elapsed = segment.departure + (runs[index] ?? 0);
    return segment;
  });
  return { route, segments, reverse, shuttle };
}

const patterns = lines.flatMap(route => (route.loop ? [false] : [false, true]).flatMap(reverse => {
  const stops = route.loop ? [...route.stops, route.stops[0]] : route.stops;
  const patterns = [journey(route, stops, service[route.id][0], reverse, false)];
  if (route.branch) patterns.push(journey(route, route.branch, 3, reverse, true));
  if (route.id === 'B1') {
    const core = stops.slice(stops.indexOf('atakoy'), stops.indexOf('b-pendik') + 1);
    patterns.push({ ...journey(route, core, 63, reverse, false), shortTurn: true });
  }
  return patterns;
}));

function departures(pattern, weekday) {
  const { route: { id }, reverse, shuttle, shortTurn } = pattern;
  if (id === 'M11' || id === 'B1') {
    let first = id === 'M11' ? (reverse ? 360 : 355) : 360 + (reverse ? 2 : 0);
    if (shortTurn) {
      const through = patterns.find(other => other.route.id === 'B1' && other.reverse === reverse && !other.shortTurn);
      const arrival = through.segments.find(stop => stop.stationId === pattern.segments[0].stationId).arrival;
      first += (arrival / minute + 7.5) % 15;
    }
    const last = id === 'M11' ? (reverse ? 1425 : 1435) : 1380 + ([5, 6].includes(weekday) ? 30 : 0);
    const times = [];
    for (let time = first; time <= last; time += 15) times.push(time * minute);
    return times;
  }
  const weekdayPeak = weekday > 0 && weekday < 6;
  const [, peak, daytime, evening] = service[id];
  const times = [];
  if (nightLines.has(id) && (weekday === 6 || weekday === 0)) {
    for (let time = 0; time < 360; time += 30) times.push(time * minute + (reverse ? 180 : 0) + (id === 'M1B' ? 900 : 0));
  }
  const phase = (reverse && !id.startsWith('F') ? 70 : 0) + (id === 'M1B' ? 180 : 0) + (shuttle ? 90 : 0);
  const [open, close] = ({
    T2: [420, 1350], T3: [420, 1320],
    F2: [weekday === 0 ? 450 : 420, 1365], F3: [480, 1320], U3: [360, 1380],
  })[id] ?? [360, 1440];
  for (let time = open * minute + phase; time < close * minute;) {
    times.push(time);
    const hours = time / 3600;
    const rush = weekdayPeak && ((hours >= 7 && hours < 9.5) || (hours >= 16.5 && hours < 19.5));
    const interval = rush ? peak : hours >= 21 || hours < 7 ? evening : daytime + (weekdayPeak ? 0 : 1);
    time += (shuttle ? Math.max(9, interval) : interval) * minute;
  }
  return times;
}

const timetable = patterns.map(pattern => Array.from({ length: 7 }, (_, weekday) => departures(pattern, weekday)));

function firstAfter(schedule, cutoff) {
  let first = 0;
  let last = schedule.length;
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    if (schedule[middle] <= cutoff) first = middle + 1;
    else last = middle;
  }
  return first;
}

export function simulationFrame(epochMs, selected) {
  const absolute = epochMs / 1000 + istanbulOffset;
  const date = Math.floor(absolute / day);
  const seconds = absolute - date * day;
  const weekday = new Date(date * day * 1000).getUTCDay();
  const trains = [];
  const visible = new Set(selected);
  patterns.forEach((pattern, index) => {
    const { route, segments, shuttle, reverse } = pattern;
    if (!visible.has(route.id)) return;
    const end = segments.at(-1).departure;
    const firstDay = seconds >= day - terminalDwell ? -1 : 0;
    for (let daysAgo = firstDay; daysAgo <= 1; daysAgo++) {
      const time = seconds + daysAgo * day;
      const schedule = timetable[index][(weekday - daysAgo + 7) % 7];
      const first = firstAfter(schedule, time - end);
      for (let trip = first; trip < schedule.length; trip++) {
        const departure = schedule[trip];
        const age = time - departure;
        if (age < -terminalDwell) break;
        if (age >= end) continue;
        const stopIndex = segments.findLastIndex(stop => stop.arrival <= age);
        const stop = segments[stopIndex];
        const dwelling = age < stop.departure;
        const indicatedStop = dwelling ? stop.stationId : segments[stopIndex + 1].stationId;
        const platform = route.id + '/' + indicatedStop + (shuttle && indicatedStop === 'sanayi' ? '/shuttle' : '');
        const train = { id: index + ':' + (date - daysAgo) + ':' + departure, route: route.id,
          color: route.color, direction: reverse ? 'reverse' : 'forward', platform };
        if (dwelling) {
          trains.push({ ...train, phase: 'dwelling', station: stop.stationId });
        } else {
          trains.push({ ...train, phase: 'moving', from: stop.stationId, to: indicatedStop });
        }
      }
    }
  });
  return trains;
}

export function simulationLamps(trains, directional) {
  const solid = new Map();
  const approaching = new Map();
  for (const train of trains) {
    const key = directional ? directionalKey(train.platform, train.direction) : train.platform;
    const lamps = train.phase === 'dwelling' ? solid : approaching;
    lamps.set(key, train.color);
  }
  // A train at the platform takes precedence over one approaching it.
  for (const key of solid.keys()) approaching.delete(key);
  return { solid, approaching };
}
