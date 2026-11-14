import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveStationLights, MAX_OBSERVATION_AGE, parseTrackingSnapshot } from '../src/tracking.js';

const now = Date.parse('2026-11-11T19:00:00.000Z');
const time = offset => new Date(now + offset).toISOString();
const observation = (stationId, status, offset = 0) => ({
  stationId, lineId: 'M4', status, observedAt: time(offset),
});

test('fresh observations light reported stops and destinations on selected routes', () => {
  const snapshot = parseTrackingSnapshot({
    observedAt: time(0),
    coveredLines: ['M4'],
    positions: [
      observation('kadikoy', 'STOPPED_AT'),
      observation('acibadem', 'INCOMING_AT'),
      observation('unalan', 'IN_TRANSIT_TO'),
      observation('ayrilik', 'STOPPED_AT', -MAX_OBSERVATION_AGE),
      observation('goztepe', 'IN_TRANSIT_TO', -MAX_OBSERVATION_AGE),
      observation('kadikoy', 'INCOMING_AT'),
    ],
  }, now);
  const { solid, approaching } = liveStationLights(snapshot, ['M4'], now);
  assert.deepEqual([...solid.keys()], ['kadikoy']);
  assert.deepEqual([...approaching.keys()], ['acibadem', 'unalan']);
  for (const [selected, at] of [[['M2'], now], [['M4'], now + MAX_OBSERVATION_AGE]]) {
    const lights = liveStationLights(snapshot, selected, at);
    assert.equal(lights.solid.size + lights.approaching.size, 0);
  }
});

test('tracking rejects impossible timestamps, unknown status and invalid route-to-station mappings', () => {
  const data = { observedAt: time(0), coveredLines: ['M4'], positions: [] };
  assert.equal(parseTrackingSnapshot({ ...data, observedAt: time(20_000) }, now), null);
  assert.equal(parseTrackingSnapshot({ ...data, observedAt: '2026-02-31T09:00:00Z' }, now), null);
  assert.equal(parseTrackingSnapshot({ ...data, positions: [observation('kadikoy', 'ESTIMATED')] }, now), null);
  assert.equal(parseTrackingSnapshot({ ...data, positions: [observation('halkali', 'STOPPED_AT')] }, now), null);
});
