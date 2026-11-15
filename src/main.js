import '@fontsource-variable/dm-sans';
import '@fontsource-variable/geist-mono';
import './style.css';
import { lines, lineById, linkedStations, metroLines, stationRoutes, stations, transportModes } from './network.js';
import { paintStationLights, renderMap } from './map.js';
import { createNoticePoller } from './notices.js';
import { clockParts, formatFetch, formatPublication } from './time.js';
import { createTracker, isFresh, liveStationLights } from './tracking.js';
import { customScenarioTime, scenarioTimes, simulationFrame, simulationLamps } from './simulation.js';

const $ = id => document.getElementById(id);
const board = $('board');
const viewport = $('map-viewport');
const settingsButton = $('settings-toggle');
const mastheadActions = settingsButton.parentElement;
const mapCard = viewport.parentElement;
const mapOnlyInput = $('map-only');
const settings = $('settings-dialog');
const routeDialog = $('route-dialog');
const noticesDialog = $('notices-dialog');
const ids = lines.map(route => route.id);
const defaultSettings = { visible: metroLines.map(route => route.id), size: 'standard', finish: 'light',
  mapOnly: false, mapView: 'geographic', inTransit: 'pulsing', material: 'aluminum', grain: 'fine' };
const preferenceKey = 'istanbul-wallboard.preferences.v1';
const sizeOptions = ['standard', 'large', 'largest'];
const metalMaterials = ['aluminum', 'brass', 'copper'];
const metalGrains = ['fine', 'coarse', 'vertical', 'smooth'];
const operatorNotices = 'https://www.metro.istanbul/en/Announcement/All';

let storage;
try { storage = window.localStorage; } catch { storage = undefined; }

function loadPreferences() {
  try {
    const previous = JSON.parse(storage?.getItem(preferenceKey));
    const visible = ids.filter(id => previous?.visible?.includes(id));
    return {
      visible: visible.length ? visible : defaultSettings.visible,
      finish: previous?.finish === 'dark' ? 'dark' : 'light',
      mapOnly: previous?.mapOnly === true,
      mapView: previous?.mapView === 'metroboard' ? 'metroboard' : defaultSettings.mapView,
      inTransit: previous?.inTransit === 'solid' ? 'solid' : defaultSettings.inTransit,
      material: metalMaterials.includes(previous?.material) ? previous.material : defaultSettings.material,
      grain: metalGrains.includes(previous?.grain) ? previous.grain : defaultSettings.grain,
      size: sizeOptions.includes(previous?.size) ? previous.size : defaultSettings.size,
    };
  } catch {
    return { ...defaultSettings };
  }
}

let preferences = loadPreferences();
let latestNotice = { state: 'checking' };
let tracking = { state: 'unavailable' };
let lights = { solid: new Map(), approaching: new Map() };
let mapView = { zoom: 1, x: 0, y: 0 };
let simulation = null;
const simulationButton = $('simulation-toggle');
const scenarioSelect = $('simulation-scenario');
const customOptions = $('simulation-custom');
const customDay = $('simulation-day');
const customTime = $('simulation-time');
const customMessage = $('custom-time-message');
const approachLegend = $('approach-legend');
const lampLegendLabel = $('lamp-legend-label');

function html(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function routeBadge(route) {
  const badge = html('span', route.id, 'route-badge');
  badge.style.setProperty('--route', route.ink);
  return badge;
}

function sourceLink(url, label) {
  const link = html('a', label + ' ↗', 'dialog-source');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function closeButton(label) {
  const button = html('button', '×', 'icon-button close-button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.setAttribute('data-close', '');
  return button;
}

function dialogHeading(title, id, closer) {
  const heading = html('div', null, 'dialog-heading');
  const titleNode = html('h2', title);
  titleNode.id = id;
  heading.append(titleNode, closeButton(closer));
  return heading;
}

function stationList(route, stops) {
  const list = html('ol', null, 'route-stops');
  list.style.setProperty('--route', route.ink);
  for (const id of stops) {
    const station = stations.get(id);
    const row = html('li', route.stopNames?.[id] ?? station.name);
    const linked = linkedStations.get(id).flatMap(other => stationRoutes.get(other));
    const connectingLines = [...stationRoutes.get(id), ...linked]
      .filter(other => other.id !== route.id).map(other => other.id);
    const connections = [...new Set([...connectingLines, ...station.connections])];
    if (connections.length) {
      const badges = html('span', null, 'station-connections');
      badges.setAttribute('aria-label', 'Connections');
      badges.append(...connections.map(label => html('span', label, 'connection')));
      row.append(badges);
    }
    list.append(row);
  }
  return list;
}

function openRoute(route) {
  if (!preferences.visible.includes(route.id)) return;
  routeDialog.dataset.textSize = preferences.size;
  routeDialog.replaceChildren(
    dialogHeading(route.id + ' · ' + route.name, 'route-title', 'Close route details'),
    html('p', route.stops.length + (route.branch ? 1 : 0) + (route.loop ? ' stops · one-way loop' : ' stations'), 'dialog-note'),
    stationList(route, route.stops),
  );
  if (route.branch) {
    routeDialog.append(html('h3', 'Seyrantepe shuttle', 'route-subtitle'), stationList(route, route.branch));
  }
  routeDialog.append(sourceLink(route.source, 'Operator line information'));
  routeDialog.showModal();
}

const routeButtons = new Map();
const routeChecks = new Map();
const modeChecks = new Map();
const modeRoutes = new Map(transportModes.map(([mode]) => [mode, lines.filter(route => route.mode === mode)]));
for (const [mode, name] of transportModes) {
  const label = html('label', null, 'mode-option');
  const check = html('input');
  check.type = 'checkbox';
  label.append(check, html('span', name));
  $('transport-options').append(label);
  modeChecks.set(mode, check);
  check.addEventListener('change', () => {
    const chosen = new Set(preferences.visible);
    for (const route of modeRoutes.get(mode)) {
      if (check.checked) chosen.add(route.id);
      else chosen.delete(route.id);
    }
    setVisible([...chosen]);
  });
}

function setVisible(chosen) {
  $('selection-message').textContent = chosen.length ? '' : 'Keep at least one line visible.';
  if (chosen.length) {
    preferences.visible = chosen;
    mapView = { zoom: 1, x: 0, y: 0 };
  }
  applyPreferences();
}
for (const route of lines) {
  const button = html('button', null, 'route-button');
  button.type = 'button';
  button.setAttribute('aria-label', route.id + ' ' + route.name + ', show stations');
  button.setAttribute('aria-haspopup', 'dialog');
  const chevron = html('span', '›', 'route-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  button.append(routeBadge(route), html('span', route.name, 'route-endpoints'), chevron);
  button.addEventListener('click', () => openRoute(route));
  $('route-list').append(button);
  routeButtons.set(route.id, button);

  const label = html('label', null, 'line-option');
  const check = html('input');
  check.type = 'checkbox';
  check.value = route.id;
  check.setAttribute('aria-label', route.id + ' ' + route.name);
  label.append(check, routeBadge(route));
  $('line-options').append(label);
  routeChecks.set(route.id, check);
  check.addEventListener('change', () => {
    setVisible(ids.filter(id => routeChecks.get(id).checked));
  });
}

const sizeInputs = [...document.querySelectorAll('input[name="text-size"]')];
for (const radio of sizeInputs) {
  radio.addEventListener('change', () => {
    preferences.size = radio.value;
    applyPreferences();
  });
}

const finishInputs = [...document.querySelectorAll('input[name="finish"]')];
for (const radio of finishInputs) {
  radio.addEventListener('change', () => {
    preferences.finish = radio.value;
    applyPreferences();
  });
}

const mapViewInputs = [...document.querySelectorAll('input[name="map-view"]')];
for (const radio of mapViewInputs) {
  radio.addEventListener('change', () => {
    preferences.mapView = radio.value;
    applyPreferences();
  });
}

const materialInput = $('metal-material');
const grainInput = $('metal-grain');
for (const [input, preference] of [[materialInput, 'material'], [grainInput, 'grain']]) {
  input.addEventListener('change', () => {
    preferences[preference] = input.value;
    mapCard.dataset[preference] = input.value;
    savePreferences();
  });
}

const inTransitInputs = [...document.querySelectorAll('input[name="in-transit"]')];
for (const radio of inTransitInputs) {
  radio.addEventListener('change', () => {
    preferences.inTransit = radio.value;
    mapCard.dataset.inTransit = radio.value;
    savePreferences();
  });
}

mapOnlyInput.addEventListener('change', () => {
  preferences.mapOnly = mapOnlyInput.checked;
  applyPreferences();
});

let mapFrame;
function drawMapSoon() {
  cancelAnimationFrame(mapFrame);
  mapFrame = requestAnimationFrame(() => {
    renderMap(viewport, preferences.visible, preferences.size, mapView, preferences.mapView);
    paintStationLights(viewport, lights);
  });
}

function zoomMap(factor, anchorX = 0, anchorY = 0) {
  const zoom = Math.max(1, Math.min(12, mapView.zoom * factor));
  if (zoom === mapView.zoom) return;
  if (zoom === 1) {
    mapView = { zoom: 1, x: 0, y: 0 };
  } else {
    const ratio = zoom / mapView.zoom;
    mapView = { zoom, x: anchorX + (mapView.x - anchorX) * ratio, y: anchorY + (mapView.y - anchorY) * ratio };
  }
  drawMapSoon();
}

setTimeout(() => { $('map-attribution').hidden = true; }, 5000);
viewport.addEventListener('wheel', event => {
  event.preventDefault();
  const bounds = viewport.getBoundingClientRect();
  zoomMap(event.deltaY < 0 ? 1.16 : 1 / 1.16,
    event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
}, { passive: false });
viewport.addEventListener('keydown', event => {
  if (event.key === '+' || event.key === '=') zoomMap(1.55);
  else if (event.key === '-') zoomMap(1 / 1.55);
  else if (event.key === 'Home') {
    mapView = { zoom: 1, x: 0, y: 0 };
    drawMapSoon();
  }
  else {
    const offset = { ArrowLeft: [50, 0], ArrowRight: [-50, 0], ArrowUp: [0, 50], ArrowDown: [0, -50] }[event.key];
    if (!offset) return;
    mapView.x += offset[0];
    mapView.y += offset[1];
    drawMapSoon();
  }
  event.preventDefault();
});
let dragStart;
viewport.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return;
  dragStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', event => {
  if (dragStart?.id !== event.pointerId) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  viewport.style.setProperty('--pan-preview', `translate(${dx}px, ${dy}px)`);
});
function endDrag(event) {
  if (dragStart?.id !== event.pointerId) return;
  if (event.type === 'pointerup') {
    mapView.x += event.clientX - dragStart.x;
    mapView.y += event.clientY - dragStart.y;
  }
  dragStart = undefined;
  viewport.style.removeProperty('--pan-preview');
  drawMapSoon();
}
viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);

function savePreferences() {
  try { storage?.setItem(preferenceKey, JSON.stringify(preferences)); } catch { /* Keep preferences for this session. */ }
}

function applyPreferences() {
  board.dataset.textSize = preferences.size;
  board.toggleAttribute('data-map-only', preferences.mapOnly);
  mapCard.dataset.mapView = preferences.mapView;
  mapCard.dataset.material = preferences.material;
  mapCard.dataset.grain = preferences.grain;
  mapCard.dataset.inTransit = preferences.inTransit;
  $('metal-options').hidden = preferences.mapView !== 'metroboard';
  materialInput.value = preferences.material;
  grainInput.value = preferences.grain;
  $('station-legend-label').textContent = 'Station lamps';
  mapOnlyInput.checked = preferences.mapOnly;
  const actions = preferences.mapOnly ? mapCard : mastheadActions;
  if (settingsButton.parentElement !== actions) actions.append(settingsButton);
  document.documentElement.dataset.finish = preferences.finish;
  for (const radio of finishInputs) radio.checked = radio.value === preferences.finish;
  for (const radio of mapViewInputs) radio.checked = radio.value === preferences.mapView;
  for (const radio of inTransitInputs) radio.checked = radio.value === preferences.inTransit;
  for (const radio of sizeInputs) radio.checked = radio.value === preferences.size;
  const activeModes = new Set();
  for (const [mode, routes] of modeRoutes) {
    const count = routes.filter(route => preferences.visible.includes(route.id)).length;
    const check = modeChecks.get(mode);
    check.checked = count === routes.length;
    check.indeterminate = count > 0 && count < routes.length;
    if (count) activeModes.add(mode);
  }
  for (const [id, check] of routeChecks) {
    const visible = preferences.visible.includes(id);
    check.checked = visible;
    routeButtons.get(id).hidden = !activeModes.has(lineById.get(id).mode);
    routeButtons.get(id).setAttribute('aria-disabled', String(!visible));
    routeButtons.get(id).tabIndex = visible ? 0 : -1;
  }
  const count = preferences.visible.length;
  const listed = lines.filter(route => activeModes.has(route.mode)).length;
  const routeList = $('route-list');
  routeList.style.setProperty('--route-rows', listed);
  routeList.classList.toggle('many-routes', listed > 11);
  routeList.classList.toggle('few-routes', listed <= 5);
  $('line-count').textContent = count + ' of ' + listed;
  savePreferences();
  updateLights();
  drawMapSoon();
}

const resize = new ResizeObserver(drawMapSoon);
resize.observe(viewport);
document.fonts.ready.then(drawMapSoon);
applyPreferences();

function sameLights(previous, next) {
  return previous.size === next.size && [...next].every(([id, color]) => previous.get(id) === color);
}

function updateLights(now = Date.now()) {
  const { snapshot } = tracking;
  const state = simulation ? 'simulation'
    : tracking.state === 'live' && !isFresh(snapshot.observedAt, now) ? 'delayed'
      : tracking.state;
  const simulatedTime = simulation ? now + simulation.offset : 0;
  const trains = simulation ? simulationFrame(simulatedTime, preferences.visible) : null;
  const next = trains ? simulationLamps(trains, true)
    : liveStationLights(state === 'live' ? snapshot : null, preferences.visible, now, true);
  if (!sameLights(lights.solid, next.solid) || !sameLights(lights.approaching, next.approaching)) {
    lights = next;
    paintStationLights(viewport, lights);
  }
  const trackingElement = $('tracking');
  if (trackingElement.dataset.state !== state) trackingElement.dataset.state = state;
  const message = $('tracking-message');
  const modeledClock = state === 'simulation' ? clockParts(new Date(simulatedTime)) : null;
  const simulatedDay = simulation?.custom ? modeledClock.date.slice(0, 3) + ' ' : '';
  const label = state === 'simulation' ? 'Simulation · ' + simulatedDay + modeledClock.time + ' TRT'
      + (trains.length ? '' : ' · No active trains')
    : state === 'live' ? 'Live tracking · ' + snapshot.coveredLines.length + ' of ' + (snapshot.coveredLines.every(id => lineById.get(id).mode === 'metro') ? metroLines.length : ids.length) + ' lines'
      : state === 'delayed' ? 'Train tracking delayed' : 'Train tracking unavailable';
  if (message.textContent !== label) message.textContent = label;
  const mapStatus = $('map-mode-status');
  if (mapStatus.textContent !== label) mapStatus.textContent = label;
  if (mapStatus.dataset.state !== state) mapStatus.dataset.state = state;
  approachLegend.hidden = state !== 'simulation' && state !== 'live';
  const stopLabel = state === 'simulation' ? 'At station' : 'Confirmed stop';
  if (lampLegendLabel.textContent !== stopLabel) lampLegendLabel.textContent = stopLabel;
  if (state === 'live') trackingElement.title = 'Operator observation · ' + formatFetch(snapshot.observedAt) + ' TRT';
  else trackingElement.removeAttribute('title');
}

function syncSimulation() {
  updateLights();
  simulationButton.textContent = simulation ? 'Stop simulation' : 'Start simulation';
  simulationButton.setAttribute('aria-pressed', String(Boolean(simulation)));
  const custom = scenarioSelect.value === 'custom';
  customOptions.hidden = !custom;
  const invalid = custom && customScenarioTime(customDay.value, customTime.value) === null;
  simulationButton.disabled = invalid && !simulation;
  customMessage.textContent = invalid ? 'Enter a valid Istanbul time.' : '';
}

function selectedSimulationTime(now) {
  if (scenarioSelect.value === 'custom') return customScenarioTime(customDay.value, customTime.value);
  return scenarioTimes[scenarioSelect.value] ?? now;
}

simulationButton.addEventListener('click', () => {
  if (simulation) simulation = null;
  else {
    const now = Date.now();
    const selected = selectedSimulationTime(now);
    if (selected === null) return;
    simulation = { offset: selected - now, custom: scenarioSelect.value === 'custom' };
  }
  syncSimulation();
  settings.close();
});

function changeSimulationTime() {
  if (simulation) {
    const now = Date.now();
    const selected = selectedSimulationTime(now);
    if (selected !== null) {
      simulation.offset = selected - now;
      simulation.custom = scenarioSelect.value === 'custom';
    }
  }
  syncSimulation();
}
scenarioSelect.addEventListener('change', changeSimulationTime);
customDay.addEventListener('change', changeSimulationTime);
customTime.addEventListener('change', changeSimulationTime);

function updateClock() {
  const now = new Date();
  const parts = clockParts(now);
  const clock = $('clock-time');
  if (clock.textContent !== parts.time) clock.textContent = parts.time;
  clock.dateTime = now.toISOString();
  $('clock-seconds').textContent = parts.seconds;
  if ($('clock-date').textContent !== parts.date) $('clock-date').textContent = parts.date;
  updateLights(now.getTime());
}

let clockTimer;
function tickClock() {
  clearTimeout(clockTimer);
  updateClock();
  clockTimer = setTimeout(tickClock, 1000 - Date.now() % 1000 + 10);
}
tickClock();

const noticeStates = {
  checking: ['Checking', 'Checking the notice snapshot.'],
  published: ['Published', 'Published notices · current status unconfirmed.'],
  delayed: ['Delayed', 'Showing the last downloaded notices.'],
  unavailable: ['Unavailable', 'Notice updates are currently unavailable.'],
};

function displayNotices(record) {
  latestNotice = record;
  const [label, message] = noticeStates[record.state];
  $('notice-state').textContent = label;
  $('notice-state').dataset.state = record.state;
  $('service-message').textContent = message;

  const fetched = $('last-fetched');
  fetched.textContent = record.fetchedAt ? formatFetch(record.fetchedAt) : '—';
  if (record.fetchedAt) fetched.dateTime = new Date(record.fetchedAt).toISOString();
  else fetched.removeAttribute('datetime');

  const notice = record.snapshot?.notices[0];
  const preview = $('notice-preview');
  preview.replaceChildren();
  if (notice) {
    const teaser = html('div', null, 'notice-teaser');
    teaser.append(routeBadge(lineById.get(notice.lines[0])), html('span', notice.title));
    preview.append(teaser);
  }
}

function openNotices() {
  const { snapshot, state } = latestNotice;
  noticesDialog.replaceChildren(
    dialogHeading('Published service notices', 'notices-title', 'Close notices'),
    html('p', noticeStates[state][1], 'dialog-note'),
  );
  if (snapshot) {
    noticesDialog.append(html('p', 'Snapshot ' + formatPublication(snapshot.snapshotDate), 'dialog-note'));
    if (!snapshot.notices.length) noticesDialog.append(html('p', 'This snapshot contains no published notices.', 'dialog-note'));
    for (const notice of snapshot.notices) {
      const entry = html('article', null, 'notice-entry');
      const header = html('div', null, 'notice-entry-header');
      const date = html('time', formatPublication(notice.publishedDate));
      date.dateTime = notice.publishedDate;
      header.append(...notice.lines.map(id => routeBadge(lineById.get(id))), date);
      entry.append(header, html('h3', notice.title), html('p', notice.summary), sourceLink(notice.url, 'Original notice'));
      noticesDialog.append(entry);
    }
  }
  noticesDialog.append(sourceLink(operatorNotices, 'Metro İstanbul announcements'));
  noticesDialog.showModal();
}
$('notices-toggle').addEventListener('click', openNotices);

const poller = createNoticePoller({
  url: new URL('service-notices.json', document.baseURI),
  lineIds: ids,
  storage,
  onChange: displayNotices,
});
poller.start();

const tracker = createTracker({
  base: document.baseURI,
  onChange(state, snapshot) {
    tracking = { state, snapshot };
    updateLights();
  },
});
tracker.start();

const fullscreenButton = $('fullscreen-button');
function updateFullscreen() {
  fullscreenButton.disabled = !document.fullscreenEnabled;
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  $('fullscreen-message').textContent = document.fullscreenEnabled
    ? ''
    : 'Use your browser’s fullscreen or kiosk mode on this device.';
}
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('fullscreen-message').textContent = 'Fullscreen is unavailable in this browser window.';
  }
});
document.addEventListener('fullscreenchange', updateFullscreen);
updateFullscreen();

$('settings-toggle').addEventListener('click', () => {
  $('selection-message').textContent = '';
  settings.showModal();
});

for (const dialog of [settings, routeDialog, noticesDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', wakeControls);
}

let idleTimer;
function wakeControls() {
  board.classList.remove('controls-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => board.classList.add('controls-idle'), 6500);
}
for (const name of ['pointermove', 'pointerdown', 'keydown', 'focusin']) {
  window.addEventListener(name, wakeControls, { passive: true });
}
wakeControls();

window.addEventListener('online', poller.reconnect);
window.addEventListener('offline', poller.offline);
window.addEventListener('online', tracker.reconnect);
window.addEventListener('offline', tracker.offline);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tickClock();
    poller.resume();
    tracker.resume();
  }
});
window.addEventListener('pagehide', () => {
  poller.stop();
  tracker.stop();
  simulation = null;
  tracking = { state: 'unavailable' };
  syncSimulation();
  clearTimeout(clockTimer);
  clearTimeout(idleTimer);
  cancelAnimationFrame(mapFrame);
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  poller.start();
  tracker.start();
  tickClock();
  wakeControls();
  drawMapSoon();
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(error => {
      console.warn('Offline cache could not be installed.', error);
    });
  }, { once: true });
}
