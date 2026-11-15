import { lines, linkedInterchanges, linkedStations, stations, terminusIds } from './network.js';
import geographic from './geography-data.json';
import { bezelGroups, bezelOutline, directionalKey, metroboardNetwork } from './metroboard.js';

const SVG = 'http://www.w3.org/2000/svg';
const fontScale = { standard: 1, large: 1.13, largest: 1.27 };

function element(name, attributes = {}, text) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

const lampRenderers = new WeakMap();
const longitudeScale = Math.cos(41 * Math.PI / 180);

function geographicProjection(routes, width, height, view) {
  const points = routes.flatMap(route => Object.values(geographic.routes[route.id].stops));
  const longitude = points.map(point => point[0] * longitudeScale);
  const latitude = points.map(point => point[1]);
  const [west, east] = [Math.min(...longitude), Math.max(...longitude)];
  const [south, north] = [Math.min(...latitude), Math.max(...latitude)];
  const paddingX = width < 560 ? 26 : 75;
  const paddingY = height < 520 ? 58 : 100;
  const scale = Math.min((width - paddingX) / Math.max(east - west, .004), (height - paddingY) / Math.max(north - south, .004)) * view.zoom;
  const centerX = (west + east) / 2;
  const centerY = (south + north) / 2;
  return ([lon, lat]) => [
    width / 2 + (lon * longitudeScale - centerX) * scale + view.x,
    height / 2 - (lat - centerY) * scale + view.y,
  ];
}

function pathData(points, closed = false) {
  return 'M' + points.map(point => point.map(value => value.toFixed(2)).join(',')).join('L') + (closed ? 'Z' : '');
}

function stationLens(svg, metroboard) {
  const defs = element('defs');
  const lens = element('radialGradient', metroboard
    ? { id: 'station-lens', cx: '42%', cy: '22%', r: '81%' }
    : { id: 'station-lens', cx: '37%', cy: '29%', r: '73%' });
  const tones = metroboard ? ['#0a0c0d', '#151719', '#4d5356'] : ['#594b3e', '#2e2822', '#15110f'];
  for (const [index, offset] of ['0%', '45%', '100%'].entries()) {
    lens.append(element('stop', { offset, 'stop-color': tones[index] }));
  }
  defs.append(lens);
  svg.append(defs);
}

function geography(svg, project) {
  for (const polygon of geographic.land) {
    svg.append(element('path', { d: polygon.map(ring => pathData(ring.map(project), true)).join(''),
      class: 'geographic-land', 'fill-rule': 'evenodd' }));
  }
  for (const coast of geographic.coast) {
    svg.append(element('path', { d: pathData(coast.map(project)), class: 'geographic-coast' }));
  }
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const landmarkOffsets = {
  'istanbul-airport': [[16, -22, 'start'], [0, -35, 'middle']],
  ataturk: [[10, -24, 'start'], [-62, -72, 'start'], [-65, 60, 'start'], [-65, 145, 'start']],
  mahmutbey: [[23, 0, 'start'], [34, -20, 'start'], [0, 48, 'middle']],
  yenibosna: [[18, 24, 'start'], [-20, 24, 'end'], [-40, 70, 'middle']],
  cobancesme: [[-14, -4, 'end']],
  taksim: [[13, -12, 'start']],
  sanayi: [[13, 17, 'start'], [-19, 24, 'end'], [-27, -93, 'middle']],
  'kayasehir-merkez': [[12, -23, 'start'], [19, 18, 'start']],
  'sancaktepe-hospital': [[6, -23, 'middle']],
  yildiztepe: [[-13, -4, 'end']],
};

function placeLabels(group, leaders, stops, project, paths, obstacles, layout, fontSize, detail) {
  const context = document.createElement('canvas').getContext('2d');
  const taken = [...obstacles];
  const routeSamples = [];
  for (const path of paths) {
    const length = path.getTotalLength();
    for (let step = 0; step < length; step += 7) routeSamples.push(path.getPointAtLength(step));
  }
  const stationBoxes = stops.flatMap(stop => {
    if (stop.boxes) return stop.boxes;
    const [x, y] = project(stop.id);
    return { x: x - 7, y: y - 7, w: 14, h: 14 };
  });

  stops.sort((a, b) => b.priority - a.priority).forEach((stop, index) => {
    if (detail === 'few' && stop.priority < 1) return;
    const [x, y] = project(stop.id);
    if (x < -20 || y < -20 || x > layout.width + 20 || y > layout.height + 20) return;
    const preferred = landmarkOffsets[stop.id];
    const size = fontSize * (preferred && detail === 'few' ? .83 : stop.priority >= 2 ? 1.06 : 1);
    const weight = stop.priority >= 2 ? 720 : 540;
    context.font = `${weight} ${size}px "DM Sans Variable", sans-serif`;
    const labels = (preferred || detail === 'all') && stop.shortName !== stop.name ? [stop.name, stop.shortName] : [stop.shortName];

    const offsetOptions = [
      [11, 0, 'start'], [-11, 0, 'end'], [0, -12 - size * 0.34, 'middle'],
      [0, 10 + size * 0.66, 'middle'],
    ];
    if (index % 2 === 0) [offsetOptions[0], offsetOptions[1]] = [offsetOptions[1], offsetOptions[0]];
    const extended = [
      [12, -14, 'start'], [-12, -14, 'end'], [12, 14, 'start'], [-12, 14, 'end'],
      [0, -27, 'middle'], [0, 27, 'middle'], [29, -17, 'start'], [-29, -17, 'end'],
      [29, 20, 'start'], [-29, 20, 'end'], [0, -43, 'middle'], [0, 43, 'middle'],
      [48, -27, 'start'], [-48, -27, 'end'], [48, 31, 'start'], [-48, 31, 'end'],
      [0, -64, 'middle'], [0, 64, 'middle'],
    ];

    for (const label of labels) {
      const metrics = context.measureText(label);
      const width = metrics.width;
      const ascent = metrics.fontBoundingBoxAscent ?? size;
      const descent = metrics.fontBoundingBoxDescent ?? size * 0.27;
      const fallback = preferred ? [54, 78, 102, 126].flatMap(reach => [
        [reach, -20, 'start'], [-reach, -20, 'end'], [reach, 20, 'start'], [-reach, 20, 'end'],
        [22, -reach, 'start'], [-22, -reach, 'end'], [22, reach, 'start'], [-22, reach, 'end'],
        [0, -reach, 'middle'], [0, reach, 'middle'],
      ]) : [];
      const offsets = stop.priority >= 2 ? [...offsetOptions, ...extended]
        : detail === 'all' ? [...offsetOptions, ...extended.slice(0, 4)] : offsetOptions;
      for (const [dx, dy, anchor] of [...(preferred || []), ...offsets, ...fallback]) {
        const shift = { start: 0, middle: width / 2, end: width }[anchor];
        const baseline = y + dy + size * 0.34;
        const box = { x: x + dx - shift - 4, y: baseline - ascent - 2, w: width + 8, h: ascent + descent + 4 };
        if (box.x < 9 || box.y < 8 || box.x + box.w > layout.width - 9 || box.y + box.h > layout.height - 8) continue;
        if (taken.some(other => intersects(box, other)) || stationBoxes.some(other => intersects(box, other))) continue;
        if (routeSamples.some(point => point.x > box.x && point.x < box.x + box.w && point.y > box.y && point.y < box.y + box.h)) continue;
        if (preferred || extended.some(offset => offset[0] === dx && offset[1] === dy && offset[2] === anchor)) {
          const edgeX = Math.max(box.x, Math.min(x, box.x + box.w));
          const edgeY = Math.max(baseline - size * .7, Math.min(y, baseline + 2));
          leaders.append(element('line', { x1: x, y1: y, x2: edgeX, y2: edgeY, class: 'label-leader' }));
        }
        group.append(element('text', {
          x: x + dx, y: baseline, 'text-anchor': anchor,
          'font-size': size, 'font-weight': weight, class: 'station-label', 'data-station-label': stop.id,
        }, label));
        taken.push(box);
        return;
      }
    }
  });
}

function drawBadge(svg, route, x, y, layout, metroboard, obstacles) {
  if (metroboard) {
    const w = route.id.length * 6 + 8;
    for (const [dx, dy] of [[12, 10], [-w - 12, 10], [12, -22], [-w - 12, -22], [-w / 2, 19], [-w / 2, -29]]) {
      const box = { x: x + dx, y: y + dy, w, h: 15 };
      if (box.x < 8 || box.y < 8 || box.x + w > layout.width - 8 || box.y + box.h > layout.height - 8
        || obstacles.some(other => intersects(box, other))) continue;
      const tag = element('g', { class: 'engraved-route' });
      tag.style.setProperty('--track-color', route.ink);
      tag.append(
        element('rect', { x: box.x, y: box.y, width: w, height: box.h, rx: 2 }),
        element('text', { x: box.x + w / 2, y: box.y + 10.7, 'text-anchor': 'middle' }, route.id),
      );
      svg.append(tag);
      return box;
    }
    return null;
  }
  const w = route.id.length * 8 + 15;
  const left = Math.max(8, Math.min(x - w / 2, layout.width - w - 8));
  const top = Math.max(8, y - 10);
  svg.append(
    element('rect', { x: left, y: top, width: w, height: 20, rx: 2.4, fill: route.ink }),
    element('text', { x: left + w / 2, y: top + 14, class: 'map-badge', 'text-anchor': 'middle' }, route.id),
  );
  return { x: left - 5, y: top - 4, w: w + 10, h: 28 };
}

function drawTracks(svg, tracks, metroboard) {
  return tracks.map(({ route, direction, segments }) => {
    const path = element('path', { d: segments.map(points => pathData(points)).join(''),
      stroke: route.ink, class: metroboard ? 'track engraved-track' : 'track geographic-track', 'data-route': route.id, 'data-mode': route.mode,
      'data-stops': [...route.stops, ...(route.branch || [])].join(' ') });
    if (direction) path.dataset.direction = direction;
    path.style.setProperty('--track-color', route.ink);
    svg.append(path);
    return path;
  });
}

function drawBezel(group, platforms, radius, transfer) {
  const outline = bezelOutline(platforms);
  const [x, y] = outline[0];
  const inset = radius + 1.2;
  const d = outline.length === 1 ? `M${x},${y}h.01` : pathData(outline, outline.length > 2);
  const housing = element('g', { 'data-bezel-platforms': platforms.flatMap(platform => platform.keys).join(' '),
    'data-bezel-type': transfer });
  housing.append(element('path', { d, 'stroke-width': 2 * (inset + .45), class: 'station-bezel-edge' }),
    element('path', { d, 'stroke-width': 2 * inset, class: 'station-bezel' }));
  group.append(housing);
  const xs = outline.map(point => point[0]);
  const ys = outline.map(point => point[1]);
  return { x: Math.min(...xs) - inset, y: Math.min(...ys) - inset,
    w: Math.max(...xs) - Math.min(...xs) + 2 * inset, h: Math.max(...ys) - Math.min(...ys) + 2 * inset };
}

function lampGlow(light, [x, y], radius) {
  light.append(
    element('circle', { cx: x, cy: y, r: radius * 2.8, class: 'lamp-bloom' }),
    element('circle', { cx: x, cy: y, r: radius * 1.78, class: 'lamp-halo' }),
    element('circle', { cx: x, cy: y, r: radius, class: 'lamp-core' }),
    element('circle', { cx: x - radius * .26, cy: y - radius * .26, r: radius * .33, class: 'lamp-glint' }),
  );
}

function drawDirectionalPlatform(lens, platform, radius, registerLight) {
  for (const { direction, point: [x, y] } of platform.lenses) {
    const keys = platform.keys.map(key => directionalKey(key, direction));
    // A one-way platform has no ambiguity about the observed train's direction.
    if (platform.route.loop) keys.push(...platform.keys);
    lens.append(element('circle', { cx: x, cy: y, r: radius, class: 'station-lens', 'data-direction': direction }));
    registerLight(keys, [x, y], radius, direction);
  }
  if (!platform.route.loop) registerLight(platform.keys, platform.lampCenter, radius * .51, 'neutral');
}

export function renderMap(container, selected, textSize, view, mode) {
  const layout = { width: container.clientWidth, height: container.clientHeight };
  if (layout.width < 50 || layout.height < 50) return;
  const visible = lines.filter(route => selected.includes(route.id));
  const metroboard = mode === 'metroboard';
  const project = geographicProjection(visible, layout.width, layout.height, view);
  const fontSize = (layout.width < 490 ? 9.4 : 12.2) * fontScale[textSize];
  const detail = layout.width < 560 && (!metroboard || view.zoom < 1.55) ? 'few' : 'all';
  const svg = element('svg', {
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    class: 'network-svg', role: 'img', 'aria-label': metroboard ? 'Metroboard view of Istanbul rail' : 'Geographic map of Istanbul rail',
    'aria-describedby': 'diagram-description',
  });
  svg.append(element('desc', { id: 'diagram-description' }, metroboard
    ? 'Istanbul rail diagram with straight links between station lamps. Station locations are derived from OpenStreetMap. Zoom in to inspect stations.'
    : 'Rail alignments and station locations are derived from OpenStreetMap. Separate station lamps indicate each direction. Zoom in to inspect the central network.'));
  stationLens(svg, metroboard);
  if (!metroboard) geography(svg, project);
  const { tracks, locations, lensRadius } = metroboardNetwork(visible, project, layout.width, view.zoom, !metroboard);
  const paths = drawTracks(svg, tracks, metroboard);

  const pointForLabel = id => locations.get(id)[0].point;
  const link = (first, second, key) => {
    const [[x1, y1], [x2, y2]] = [first, second];
    if (Math.hypot(x1 - x2, y1 - y2) < 1.5) return;
    svg.append(element('line', { x1, y1, x2, y2, class: 'walking-link', 'data-interchange-link': key }));
  };
  for (const [a, b] of linkedInterchanges) {
    if (locations.has(a) && locations.has(b)) link(pointForLabel(a), pointForLabel(b), a + ' ' + b);
  }
  const leaders = element('g', { 'aria-hidden': 'true' });
  const bezels = element('g', { 'aria-hidden': 'true' });
  svg.append(leaders);
  svg.append(bezels);
  const glow = element('g', { 'aria-hidden': 'true', class: 'station-glows' });
  const lamps = [];
  const renderedStops = [...locations].map(([id, platforms]) => {
    const stop = stations.get(id);
    const sharedM1 = platforms.length === 2 && platforms.every(({ route }) => ['M1A', 'M1B'].includes(route.id));
    const branch = platforms.some(({ route }) => route.branch?.[0] === id);
    const metro = (platforms.length > 1 && !sharedM1) || linkedStations.get(id).some(other => locations.has(other)) || branch;
    const rail = stop.connections.length > 0;
    const terminal = terminusIds.has(id);
    const group = element('g', { 'data-station': id, 'data-interchange': branch ? 'branch' : metro ? 'metro' : rail ? 'transit' : 'none' });
    group.append(element('title', {}, stop.name + ' · ' + [...new Set(
      platforms.flatMap(({ route, keys }) => keys ? keys.map(key => key.split('/')[0]) : [route.id]),
    )].join(', ')));
    const housings = bezelGroups(platforms, lensRadius);
    for (const [first] of housings.slice(1)) {
      const [base] = housings[0];
      const connector = element('line', { x1: base.point[0], y1: base.point[1], x2: first.point[0], y2: first.point[1],
        class: 'walking-link', 'data-interchange-link': id });
      if (Math.hypot(base.point[0] - first.point[0], base.point[1] - first.point[1]) >= 1.5) leaders.append(connector);
    }
    const transfer = metro || branch ? 'interchange' : rail ? 'transit' : 'station';
    const boxes = housings.map(housing => drawBezel(bezels, housing, lensRadius, transfer));
    for (const platform of platforms) {
      const { key } = platform;
      const lens = element('g', { 'data-platform': key });
      function registerLight(keys, point, radius, direction) {
        const light = element('g', { class: 'station-lamp', 'data-lamp-platform': keys[0], 'data-direction': direction });
        if (keys.length > 1) light.dataset.platformAliases = keys.slice(1).join(' ');
        lampGlow(light, point, radius);
        glow.append(light);
        lamps.push({ keys, group, light });
      }
      drawDirectionalPlatform(lens, platform, lensRadius, registerLight);
      group.append(lens);
    }
    svg.append(group);
    return { ...stop, boxes, priority: landmarkOffsets[id] ? 5 : terminal ? 3 : metro ? 2 : rail ? 1 : 0 };
  });

  svg.append(glow);
  lampRenderers.set(container, ({ solid, approaching }) => {
    const litStations = new Set();
    for (const { keys, group, light } of lamps) {
      const steadyColor = solid.get(keys.find(key => solid.has(key)));
      const approachColor = steadyColor ? undefined : approaching.get(keys.find(key => approaching.has(key)));
      const color = steadyColor ?? approachColor;
      light.classList.toggle('is-lit', Boolean(color));
      light.classList.toggle('is-approaching', Boolean(approachColor));
      if (color) {
        light.style.setProperty('--lamp-color', color);
        litStations.add(group);
      }
    }
    for (const { group } of lamps) group.toggleAttribute('data-lit', litStations.has(group));
  });

  const obstacles = [{ x: layout.width - 58, y: 0, w: 58, h: 50 }];
  const badges = visible.map(route => ({ route, point: project(geographic.routes[route.id].stops[route.badge?.[0] ?? route.stops.at(-1)]) }));
  const stationObstacles = renderedStops.flatMap(stop => stop.boxes);
  for (const { route, point: [x, y] } of badges) {
    if (x < 14 || y < 14 || x > layout.width - 14 || y > layout.height - 14) continue;
    const badge = metroboard ? drawBadge(svg, route, x, y, layout, true, [...obstacles, ...stationObstacles])
      : drawBadge(svg, route, x + 12, y + 17, layout);
    if (badge) obstacles.push(badge);
  }

  const labels = element('g', { 'aria-hidden': 'true' });
  svg.append(labels);
  container.replaceChildren(svg);
  placeLabels(labels, leaders, renderedStops, pointForLabel, paths, obstacles, layout, fontSize, detail);
}

export function paintStationLights(container, lamps) {
  lampRenderers.get(container)?.(lamps);
}
