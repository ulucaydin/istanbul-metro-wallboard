import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../src/network.js';
import { bezelGroups, metroboardNetwork } from '../src/metroboard.js';
import geographic from '../src/geography-data.json' with { type: 'json' };

test('every engraved lane is straight between its directional station lenses', () => {
  for (const [width, scale] of [[390, 450], [1920, 2100]]) {
    const { locations, tracks, lensRadius } = metroboardNetwork(lines,
      ([lon, lat]) => [(lon - 28.5) * scale, (41.3 - lat) * scale / .754], width, 1);
    const segments = new Map(tracks.map(track => [track.route.id + '/' + track.direction, track.segments]));
    for (const route of lines) {
      const forward = [];
      const reverse = [];
      for (const [from, to] of geographic.routes[route.id].edges) {
        const shuttle = route.id === 'M2' && from === 'sanayi' && to === 'seyrantepe';
        const start = locations.get(from).find(platform => platform.keys.includes(route.id + '/' + from + (shuttle ? '/shuttle' : '')));
        const end = locations.get(to).find(platform => platform.keys.includes(route.id + '/' + to));
        if (route.id === 'M1B' && start.keys.length > 1 && end.keys.length > 1) continue;
        forward.push([start.lenses[0].point, end.lenses[0].point]);
        if (!route.loop) reverse.push([start.lenses[1].point, end.lenses[1].point]);
      }
      assert.deepEqual(segments.get(route.id + '/forward'), forward);
      assert.deepEqual(segments.get(route.id + '/reverse') ?? [], reverse);
    }
    for (const [id, platforms] of locations) {
      const lenses = platforms.flatMap(platform => platform.lenses.map(lens => lens.point));
      lenses.forEach(([x, y], index) => {
        for (const [otherX, otherY] of lenses.slice(index + 1)) {
          assert.ok(Math.hypot(x - otherX, y - otherY) >= 2 * lensRadius, id);
        }
      });
    }
    assert.equal(locations.get('aksaray').filter(platform => platform.keys.includes('M1A/aksaray')).length, 1);
    assert.deepEqual(locations.get('aksaray')[0].keys, ['M1A/aksaray', 'M1B/aksaray']);
    assert.equal(locations.get('otogar').length, 2);
    assert.equal(bezelGroups(locations.get('sanayi'), lensRadius)[0].length, 2);
  }
});

test('geographic rails preserve mapped curves and meet directional station lamps', () => {
  const project = ([lon, lat]) => [(lon - 28.5) * 2100, (41.3 - lat) * 2100 / .754];
  const { locations, tracks } = metroboardNetwork(lines, project, 1920, 1, true);
  const segments = new Map(tracks.map(track => [track.route.id + '/' + track.direction, track.segments]));
  for (const route of lines) {
    const forward = segments.get(route.id + '/forward');
    const reverse = segments.get(route.id + '/reverse') ?? [];
    let index = 0;
    for (const [from, to, coordinates] of geographic.routes[route.id].edges) {
      const shuttle = route.id === 'M2' && from === 'sanayi' && to === 'seyrantepe';
      const start = locations.get(from).find(platform => platform.keys.includes(route.id + '/' + from + (shuttle ? '/shuttle' : '')));
      const end = locations.get(to).find(platform => platform.keys.includes(route.id + '/' + to));
      if (route.id === 'M1B' && start.keys.length > 1 && end.keys.length > 1) continue;
      assert.equal(forward[index].length, coordinates.length, route.id + ' ' + from);
      assert.deepEqual(forward[index][0], start.lenses[0].point);
      assert.deepEqual(forward[index].at(-1), end.lenses[0].point);
      if (!route.loop) {
        assert.deepEqual(reverse[index][0], start.lenses[1].point);
        assert.deepEqual(reverse[index].at(-1), end.lenses[1].point);
      }
      index++;
    }
    assert.equal(forward.length, index);
    assert.equal(reverse.length, route.loop ? 0 : index);
  }
  assert.deepEqual(locations.get('aksaray')[0].keys, ['M1A/aksaray', 'M1B/aksaray']);
  assert.ok(locations.get('sanayi').some(platform => platform.key === 'M2/sanayi/shuttle'));
});
