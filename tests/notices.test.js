import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoticePoller, POLL_INTERVAL, validateSnapshot } from '../src/notices.js';

const valid = {
  snapshotDate: '2026-11-11',
  notices: [{
    id: 'm7-example',
    lines: ['M7'],
    publishedDate: '2026-04-27',
    title: 'Mecidiyeköy repair works',
    summary: 'Published notice.',
    url: 'https://metro.istanbul/',
  }],
};
const lineIds = ['M7'];

test('notice validator rejects malformed and misleading replacements', () => {
  assert.deepEqual(validateSnapshot(valid, lineIds), valid);
  assert.equal(validateSnapshot({ ...valid, snapshotDate: '2026-02-31' }, lineIds), null);
  assert.equal(validateSnapshot({ ...valid, notices: [valid.notices[0], valid.notices[0]] }, lineIds), null);
  assert.equal(validateSnapshot({ ...valid, notices: [{ ...valid.notices[0], lines: ['M21'] }] }, lineIds), null);
  assert.equal(validateSnapshot({ ...valid, notices: [{ ...valid.notices[0], url: 'javascript:alert(1)' }] }, lineIds), null);
});

test('poller retries, preserves the success timestamp and deduplicates reconnects', async () => {
  const events = [];
  const timers = new Map();
  const cache = new Map();
  let now = 100_000;
  let calls = 0;
  let respond;
  const poller = createNoticePoller({
    url: 'https://wallboard.example/service-notices.json',
    lineIds,
    storage: { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) },
    onChange: state => events.push(state),
    now: () => now,
    schedule: (callback, delay) => {
      const key = Symbol();
      timers.set(key, { callback, delay });
      return key;
    },
    cancel: key => timers.delete(key),
    fetcher: (_url, { signal }) => {
      calls++;
      return new Promise((resolve, reject) => {
        respond = data => resolve({ ok: true, json: async () => data });
        signal.addEventListener('abort', reject, { once: true });
      });
    },
  });

  const drain = () => new Promise(resolve => setImmediate(resolve));
  const scheduledDelays = () => [...timers.values()].map(timer => timer.delay);
  const runTimer = async () => {
    const [key, timer] = timers.entries().next().value;
    timers.delete(key);
    now += timer.delay;
    return timer.callback();
  };

  poller.start();
  assert.equal(events.at(-1).state, 'checking');
  await poller.reconnect();
  await poller.reconnect();
  assert.equal(calls, 1);
  await runTimer();
  await drain();
  assert.equal(events.at(-1).state, 'unavailable');
  assert.deepEqual(scheduledDelays(), [30_000]);

  const retry = runTimer();
  respond(valid);
  await retry;
  const firstSuccess = events.at(-1).fetchedAt;
  assert.equal(events.at(-1).state, 'published');
  assert.deepEqual(scheduledDelays(), [POLL_INTERVAL]);

  const next = runTimer();
  respond({});
  await next;
  assert.equal(events.at(-1).state, 'delayed');
  assert.equal(events.at(-1).fetchedAt, firstSuccess);

  const recovery = poller.reconnect();
  for (let i = 0; i < 5; i++) await poller.reconnect();
  respond(valid);
  await recovery;
  assert.equal(calls, 4);
  assert.ok(events.at(-1).fetchedAt > firstSuccess);
  assert.deepEqual(scheduledDelays(), [POLL_INTERVAL]);

  poller.stop();
  assert.equal(timers.size, 0);
});
