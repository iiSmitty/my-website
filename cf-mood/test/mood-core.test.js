import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, HOUR, MAX_LIFT, allowCheer, applyCheer, bandFor, dayKey, decay, nextDayStart, readConfig,
} from '../src/mood-core.js';

test('the lift halves every half-life', () => {
  assert.equal(decay(40, 0, 12), 40);
  assert.equal(decay(40, 12 * HOUR, 12), 20);
  assert.equal(decay(40, 24 * HOUR, 12), 10);
  assert.equal(decay(40, 6 * HOUR, 24), 40 * Math.pow(0.5, 0.25));
});

test('decay never goes below zero or above the cap, and copes with nonsense', () => {
  assert.equal(decay(0, HOUR, 12), 0);
  assert.equal(decay(-5, HOUR, 12), 0);
  assert.equal(decay(NaN, HOUR, 12), 0);
  assert.equal(decay(80, 0, 12), MAX_LIFT);
  // A timestamp from the future (a clock that moved back) doesn't grow it
  assert.equal(decay(30, -HOUR, 12), 30);
});

test('each cheer closes 8% of the gap to the top', () => {
  assert.equal(applyCheer(0, 0.08), 4);
  assert.equal(applyCheer(25, 0.08), 27);
  assert.ok(applyCheer(49.9, 0.08) < MAX_LIFT);
});

test('spam has less and less effect, and never passes the cap', () => {
  let lift = 0;
  let lastStep = Infinity;
  for (let i = 0; i < 1000; i++) {
    const next = applyCheer(lift, 0.08);
    assert.ok(next - lift <= lastStep);
    lastStep = next - lift;
    lift = next;
  }
  assert.ok(lift <= MAX_LIFT);
  assert.ok(lift > 49.99);
  assert.equal(applyCheer(500, 0.08), MAX_LIFT);
});

test('the per-minute cap lets 30 cheers through, then waits for the next minute', () => {
  const start = Date.UTC(2026, 10, 2, 10, 0, 0);
  let bucket = null;
  for (let i = 0; i < 30; i++) {
    const result = allowCheer(bucket, start + i * 1000, 30);
    assert.equal(result.allowed, true, `cheer ${i + 1}`);
    bucket = result.bucket;
  }
  assert.equal(allowCheer(bucket, start + 59999, 30).allowed, false);
  assert.equal(allowCheer(bucket, start + 60000, 30).allowed, true);
});

test('bands match the proposal, with a floor at Tired', () => {
  assert.equal(bandFor(0), 'Tired');
  assert.equal(bandFor(34), 'Tired');
  assert.equal(bandFor(35), 'Okay');
  assert.equal(bandFor(54), 'Okay');
  assert.equal(bandFor(55), 'Content');
  assert.equal(bandFor(74), 'Content');
  assert.equal(bandFor(75), 'Happy');
  assert.equal(bandFor(89), 'Happy');
  assert.equal(bandFor(90), 'Great day');
  assert.equal(bandFor(150), 'Great day');
});

test('days are UTC, to match when Cloudflare resets the free limits', () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 2, 23, 59)), 20261102);
  // 01:00 in Cape Town is still the day before in UTC
  assert.equal(dayKey(Date.parse('2026-11-03T01:00:00+02:00')), 20261102);
  assert.equal(nextDayStart(Date.UTC(2026, 10, 2, 13, 0)), Date.UTC(2026, 10, 3));
  assert.equal(nextDayStart(Date.UTC(2026, 10, 2)), Date.UTC(2026, 10, 3));
});

test('config falls back to the defaults, and keeps vars in range', () => {
  assert.deepEqual(readConfig({}), { enabled: true, halfLifeHours: 12, gain: 0.08, dailyCap: 40000, cheersPerMinute: 30 });
  assert.deepEqual(
    readConfig({ ENABLED: 'true', HALF_LIFE_HOURS: '24', GAIN: '0.1', DAILY_CAP: '1000', CHEERS_PER_MINUTE: '5' }),
    { enabled: true, halfLifeHours: 24, gain: 0.1, dailyCap: 1000, cheersPerMinute: 5 },
  );
  const silly = readConfig({ HALF_LIFE_HOURS: 'soon', GAIN: '7', DAILY_CAP: '-1', CHEERS_PER_MINUTE: '' });
  assert.equal(silly.halfLifeHours, 12);
  assert.equal(silly.gain, 0.5);
  assert.equal(silly.dailyCap, 1);
  assert.equal(silly.cheersPerMinute, 30);
});

test('only "false" turns it off', () => {
  assert.equal(readConfig({ ENABLED: 'false' }).enabled, false);
  assert.equal(readConfig({ ENABLED: ' FALSE ' }).enabled, false);
  assert.equal(readConfig({ ENABLED: false }).enabled, false);
  assert.equal(readConfig({ ENABLED: 'true' }).enabled, true);
  assert.equal(readConfig({ ENABLED: 'yes' }).enabled, true);
});

test('the five actions', () => {
  assert.deepEqual(ACTIONS, ['pat', 'coffee', 'joke', 'defrag', 'dust']);
});
