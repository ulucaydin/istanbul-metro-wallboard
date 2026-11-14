import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metroLines, lineById } from '../src/network.js';
import { scenarioTimes, simulationFrame, simulationLamps } from '../src/simulation.js';

const all = metroLines.map(route => route.id);
test('weekend overnight serves only night lines, weekday overnight is quiet', () => {
  const closed = simulationFrame(Date.parse('2026-11-11T00:05:00Z'), all);
  assert.equal(closed.length, 0);
  const night = simulationFrame(scenarioTimes.night, all);
  assert.ok(night.length > 0);
  assert.ok(night.every(train => !['M3', 'M8', 'M9', 'M11'].includes(train.route)));
  assert.equal(simulationFrame(scenarioTimes.night, ['M11']).length, 0);
});

test('rush hour is busier than evenings and vehicles follow real adjacent stops', () => {
  const rush = simulationFrame(scenarioTimes.rush, all);
  const evening = simulationFrame(Date.parse('2026-11-11T19:20:00Z'), all);
  assert.ok(rush.length > evening.length);
  assert.ok(rush.some(train => train.phase === 'dwelling'));
  const moving = rush.filter(train => train.phase === 'moving');
  for (const train of moving) {
    const route = lineById.get(train.route);
    assert.ok([route.stops, route.branch].filter(Boolean).some(stops =>
      stops.includes(train.from) && stops.includes(train.to)
      && Math.abs(stops.indexOf(train.from) - stops.indexOf(train.to)) === 1));
    assert.equal(train.platform.split('/')[1], train.to);
  }
});

test('one train stays in the frame through departure, intermediate dwell and the terminal stop', () => {
  const at = offset => simulationFrame(scenarioTimes.rush + offset, ['M6']);
  const { id } = at(-1000).find(train => train.platform === 'M6/levent' && train.phase === 'dwelling');
  const position = offset => at(offset).find(train => train.id === id);
  assert.equal(position(0).phase, 'moving');
  assert.equal(position(0).platform, 'M6/nispetiye');
  for (let offset = 1000; offset < 455_000; offset += 1000) {
    const train = position(offset);
    assert.ok(train, `Train missing at ${offset} ms`);
  }
  assert.equal(position(120_000).platform, 'M6/nispetiye');
  assert.equal(position(140_000).from, 'nispetiye');
  assert.equal(position(140_000).platform, 'M6/etiler');
  assert.equal(position(420_000).platform, 'M6/hisarustu');
  assert.equal(position(455_000), undefined);
});

test('a steady lamp takes priority when another train is approaching that platform', () => {
  const train = { platform: 'M6/levent', color: '#ead870' };
  const stopped = { ...train, direction: 'forward', phase: 'dwelling' };
  const incoming = { ...train, direction: 'forward', phase: 'moving' };
  const opposite = { ...incoming, direction: 'reverse' };
  for (const trains of [[stopped, incoming, opposite], [opposite, incoming, stopped]]) {
    const geographic = simulationLamps(trains, false);
    assert.equal(geographic.solid.get(train.platform), train.color);
    assert.equal(geographic.approaching.size, 0);
    const metroboard = simulationLamps(trains, true);
    assert.equal(metroboard.solid.get(train.platform + '/forward'), train.color);
    assert.deepEqual([...metroboard.approaching], [[train.platform + '/reverse', train.color]]);
  }
});

test('an overnight departure keeps its identity across Istanbul midnight', () => {
  const midnight = Date.parse('2026-11-13T21:00:00Z');
  const staged = simulationFrame(midnight - 1000, ['M6']).find(train => train.platform === 'M6/levent' && train.phase === 'dwelling');
  const moving = simulationFrame(midnight + 1000, ['M6']).find(train => train.id === staged.id);
  assert.equal(moving.phase, 'moving');
  assert.equal(moving.from, 'levent');
});

test('additional services run modeled journeys and the Moda tram closes its loop', () => {
  for (const id of ['B1', 'T1', 'T2', 'T3', 'T4', 'T5', 'F1', 'F2', 'F3', 'F4', 'U3']) {
    const route = lineById.get(id);
    const journeys = [];
    for (let offset = 0; offset < 21 * 60_000; offset += 20_000) {
      journeys.push(...simulationFrame(scenarioTimes.rush + offset, [id]).filter(train => train.phase === 'moving'));
    }
    assert.ok(journeys.length, id);
    assert.ok(journeys.every(train => train.platform === id + '/' + train.to));
    if (route.loop) assert.ok(journeys.some(train => train.from === route.stops.at(-1) && train.to === route.stops[0]));
  }
});

test('an approaching Seyrantepe shuttle lights the separate Sanayi platform', () => {
  for (let offset = 0; offset < 15 * 60_000; offset += 10_000) {
    const train = simulationFrame(scenarioTimes.rush + offset, ['M2'])
      .find(train => train.from === 'seyrantepe' && train.to === 'sanayi');
    if (!train) continue;
    assert.equal(train.platform, 'M2/sanayi/shuttle');
    assert.equal(simulationLamps([train], true).approaching.get('M2/sanayi/shuttle/reverse'), train.color);
    return;
  }
  assert.fail('No approaching shuttle in the selected interval');
});
