import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lines, metroLines, lineById, linkedInterchanges, sharedTrunk, stationRoutes, stations } from '../src/network.js';
import { clockParts } from '../src/time.js';
import geographic from '../src/geography-data.json' with { type: 'json' };

test('all metro routes reference defined stations in the expected counts', () => {
  const counts = { M1A: 18, M1B: 13, M2: 16, M3: 20, M4: 23, M5: 24, M6: 4, M7: 17, M8: 13, M9: 14, M11: 15 };
  assert.deepEqual(metroLines.map(route => route.id), Object.keys(counts));
  assert.equal(new Set(metroLines.flatMap(route => [...route.stops, ...(route.branch ?? [])])).size, 157);
  for (const route of metroLines) {
    const stationIds = new Set([...route.stops, ...(route.branch || [])]);
    assert.equal(stationIds.size, counts[route.id], route.id);
    for (const id of stationIds) assert.ok(stations.has(id), id);
  }
});

test('shared tracks, extensions and interchanges preserve real topology', () => {
  for (const id of ['M1A', 'M1B']) assert.deepEqual(lineById.get(id).stops.slice(0, 8), sharedTrunk);
  assert.equal(sharedTrunk.at(-1), 'otogar');
  assert.deepEqual(lineById.get('M2').branch, ['sanayi', 'seyrantepe']);
  assert.ok(!lineById.get('M2').stops.includes('seyrantepe'));
  assert.deepEqual(lineById.get('M5').stops.slice(-4), ['samandira', 'veysel-karani', 'hasanpasa', 'sultanbeyli']);
  assert.deepEqual(lineById.get('M11').stops.slice(-5), ['ibn-haldun', 'kayasehir', 'olimpiyatkoy', 'halkali-stadi', 'halkali']);
  for (const [station, routes] of [
    ['yenikapi', ['M1A', 'M1B', 'M2']], ['gayrettepe', ['M2', 'M11']],
    ['mahmutbey', ['M3', 'M7']], ['dudullu', ['M5', 'M8']], ['kozyatagi', ['M4', 'M8']],
    ['bostanci-m4', ['M4']], ['bostanci-m8', ['M8']],
  ]) assert.deepEqual(stationRoutes.get(station).filter(route => route.mode === 'metro').map(route => route.id), routes);
  assert.deepEqual(linkedInterchanges.slice(0, 2), [['kayasehir', 'kayasehir-merkez'], ['olimpiyatkoy', 'olimpiyat']]);
});

test('clock crosses midnight in Istanbul independently of host time', () => {
  assert.deepEqual(clockParts(new Date('2026-11-11T20:59:59Z')), { time: '23:59', seconds: '59', date: 'Wed 11 Nov' });
  assert.deepEqual(clockParts(new Date('2026-11-11T21:00:00Z')), { time: '00:00', seconds: '00', date: 'Thu 12 Nov' });
});

test('requested network count, continuous M3 and exact M9 interchange order', () => {
  const listedStops = metroLines.reduce((sum, line) => sum + new Set([...line.stops, ...(line.branch ?? [])]).size, 0);
  assert.equal(listedStops - sharedTrunk.length, 169);
  assert.deepEqual(lineById.get('M3').stops.slice(0, 13), [
    'bakirkoy', 'ozgurluk', 'incirli', 'haznedar', 'ilkyuva', 'yildiztepe', 'molla-gurani',
    'kirazli', 'yenimahalle-m3', 'mahmutbey', 'istoc', 'ikitelli', 'turgut-ozal',
  ]);
  assert.equal(lineById.get('M7').stops.at(-1), 'mahmutbey');
  assert.deepEqual(lineById.get('M9').stops.slice(0, 4), ['atakoy', 'yenibosna', 'cobancesme', 'cumhuriyet']);
  assert.deepEqual(stationRoutes.get('yenibosna').filter(route => route.mode === 'metro').map(route => route.id), ['M1A', 'M9']);
  assert.deepEqual(stationRoutes.get('cobancesme').map(route => route.id), ['M9']);
  const m9 = geographic.routes.M9.stops;
  assert.ok(m9.cobancesme[1] > m9.yenibosna[1]);
  assert.ok(m9.atakoy[1] < m9.yenibosna[1]);
  assert.deepEqual(lineById.get('M5').stops.slice(17, 21), ['sarigazi', 'sancaktepe-hospital', 'sancaktepe', 'samandira']);
  assert.deepEqual(lineById.get('M11').stops.slice(5, 9), ['ihsaniye', 'istanbul-airport', 'kargo', 'tasoluk']);
});

test('additional rail routes have complete stop lists and a mapped node for every stop', () => {
  const counts = { B1: 43, T1: 31, T2: 5, T3: 11, T4: 22, T5: 14, F1: 2, F2: 2, F3: 2, F4: 2, U3: 8 };
  for (const route of lines.filter(route => route.mode !== 'metro')) {
    assert.equal(new Set(route.stops).size, counts[route.id], route.id);
    assert.ok(route.stops.every(id => stations.has(id)), route.id);
  }
  assert.deepEqual(lineById.get('B1').stops.slice(12, 16), ['yenikapi', 'b-sirkeci', 'uskudar', 'ayrilik']);
  assert.equal(lineById.get('T3').loop, true);
  assert.deepEqual(lineById.get('F2').stops, ['t-karakoy', 't-tunel']);
});

test('geographic routes connect their published stop order and preserve real-world landmarks', () => {
  for (const route of lines) {
    const geo = geographic.routes[route.id];
    assert.deepEqual(new Set(Object.keys(geo.stops)), new Set([...route.stops, ...(route.branch ?? [])]));
    const sequences = [route.loop ? [...route.stops, route.stops[0]] : route.stops, ...(route.branch ? [route.branch] : [])];
    assert.deepEqual(geo.edges.map(([from, to]) => [from, to]), sequences.flatMap(sequence =>
      sequence.slice(1).map((stop, index) => [sequence[index], stop])));
    for (const [from, to, coordinates] of geo.edges) {
      assert.ok(coordinates.length >= 2);
      for (const [id, point] of [[from, coordinates[0]], [to, coordinates.at(-1)]]) {
        if (route.id === 'M2' && id === 'sanayi' && to === 'seyrantepe') continue;
        assert.ok(Math.hypot(...point.map((value, axis) => value - geo.stops[id][axis])) < .000002, route.id + '/' + id);
      }
    }
  }
  const routes = geographic.routes;
  assert.ok(routes.T3.stops['t-moda'][1] < routes.M4.stops.kadikoy[1]);
  assert.ok(routes.B1.stops['b-sirkeci'][0] < routes.B1.stops.uskudar[0]);
  assert.ok(routes.B1.stops['b-gebze'][0] > routes.B1.stops['b-tersane'][0]);
  assert.ok(routes.U3.stops['u-yenikapi'][1] < routes.B1.stops.yenikapi[1]);
  assert.ok(routes.T1.stops['t-laleli'][0] > routes.T1.stops['t-aksaray'][0]);
});
