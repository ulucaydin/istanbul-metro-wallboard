import { sharedTrunk } from './network.js';
import geographic from './geography-data.json' with { type: 'json' };

const m1Branches = new Set(['M1A', 'M1B']);
const trunkStops = new Set(sharedTrunk);

export const directionalKey = (platform, direction) => `${platform}/${direction}`;

function unit(x, y) {
  const length = Math.hypot(x, y);
  return length ? [x / length, y / length] : [0, 0];
}

function heading([x, y], [nextX, nextY]) {
  return unit(nextX - x, nextY - y);
}

function shifted([x, y], [dx, dy], amount) {
  return [x - dy * amount, y + dx * amount];
}

function placeLenses(platform, occupied, radius, separation) {
  const tangent = unit(...platform.tangent);
  const directions = platform.route.loop ? [['forward', 0]] : [['forward', separation], ['reverse', -separation]];
  const lensesAt = point => directions.map(([direction, offset]) => ({ direction, point: shifted(point, tangent, offset) }));
  const clears = lenses => lenses.every(({ point: [x, y] }) => occupied.every(([ox, oy]) =>
    Math.hypot(x - ox, y - oy) >= 2 * radius + .35));
  let center = platform.point;
  let lenses = lensesAt(center);
  // Pack only platforms of the same station. The underlying station anchors stay geographic.
  for (let ring = 1; !clears(lenses); ring++) {
    for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8;
      const distance = ring * radius / 2;
      const candidate = [platform.point[0] + Math.cos(angle) * distance, platform.point[1] + Math.sin(angle) * distance];
      const offsetLenses = lensesAt(candidate);
      if (!clears(offsetLenses)) continue;
      center = candidate;
      lenses = offsetLenses;
      break;
    }
  }
  occupied.push(...lenses.map(lens => lens.point));
  platform.lampCenter = center;
  platform.lenses = lenses;
}

export function metroboardNetwork(routes, project, width, zoom) {
  const lensRadius = width < 560 ? Math.min(2.35, 1.45 + .4 * (zoom - 1)) : 2.65;
  const separation = lensRadius + .7;
  const locations = new Map();
  const tracks = [];
  const sharedRails = new Set();

  function addPlatform(route, id, point, shuttle = false) {
    const group = locations.get(id) ?? [];
    const key = route.id + '/' + id + (shuttle ? '/shuttle' : '');
    const shared = m1Branches.has(route.id) && trunkStops.has(id);
    const common = shared && group.find(platform => m1Branches.has(platform.route.id)
      && platform.point[0] === point[0] && platform.point[1] === point[1]);
    if (common) {
      common.keys.push(key);
      return common;
    }
    const platform = { route, key, keys: [key], point, tangent: [0, 0] };
    group.push(platform);
    locations.set(id, group);
    return platform;
  }

  const routeEdges = routes.map(route => {
    const geo = geographic.routes[route.id];
    const platforms = new Map(Object.entries(geo.stops).map(([id, point]) => [id, addPlatform(route, id, project(point))]));
    const segments = geo.edges.map(([from, to, coordinates]) => {
      const start = route.branch?.[0] === from && route.branch[1] === to
        ? addPlatform(route, from, project(coordinates[0]), true) : platforms.get(from);
      const end = platforms.get(to);
      const [dx, dy] = heading(start.point, end.point);
      for (const platform of [start, end]) {
        platform.tangent[0] += dx;
        platform.tangent[1] += dy;
      }
      return { from, to, start, end };
    });
    return { route, segments };
  });

  for (const group of locations.values()) {
    const occupied = [];
    for (const platform of group) placeLenses(platform, occupied, lensRadius, separation);
  }

  for (const { route, segments } of routeEdges) {
    const forward = [];
    const reverse = [];
    for (const { from, to, start, end } of segments) {
      if (start.keys.length > 1 && end.keys.length > 1 && m1Branches.has(route.id)) {
        const shared = from + '/' + to;
        if (sharedRails.has(shared)) continue;
        sharedRails.add(shared);
      }
      forward.push([start.lenses[0].point, end.lenses[0].point]);
      if (!route.loop) reverse.push([start.lenses[1].point, end.lenses[1].point]);
    }
    tracks.push({ route, direction: 'forward', segments: forward });
    if (reverse.length) tracks.push({ route, direction: 'reverse', segments: reverse });
  }
  return { locations, tracks, lensRadius };
}

export function bezelGroups(platforms, radius) {
  const groups = [];
  for (const platform of platforms) {
    // Nearby platforms fit under one bezel. Keep longer walking connections visible.
    const group = groups.find(items => items.every(other => Math.hypot(
      other.point[0] - platform.point[0], other.point[1] - platform.point[1],
    ) <= radius * 4));
    if (group) group.push(platform);
    else groups.push([platform]);
  }
  return groups;
}

export function bezelOutline(platforms) {
  const points = platforms.flatMap(platform => platform.lenses.map(lens => lens.point))
    .sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  const turn = ([ax, ay], [bx, by], [cx, cy]) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const side = sorted => {
    const hull = [];
    for (const point of sorted) {
      while (hull.length >= 2 && turn(hull.at(-2), hull.at(-1), point) <= 0) hull.pop();
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  return points.length < 3 ? points : [...side(points), ...side(points.reverse())];
}
