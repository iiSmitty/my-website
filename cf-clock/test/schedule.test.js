import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { jobsDue, SCHEDULE } from '../src/schedule.js';

const WORKFLOWS = new URL('../../.github/workflows/', import.meta.url);

// 23 November 2026 is a Monday
const at = (day, hour, minute = 0) => Date.UTC(2026, 10, day, hour, minute);
const due = (time) => jobsDue(time).map((job) => job.workflow);

test('each workflow is due at its hour (UTC)', () => {
  assert.deepEqual(due(at(24, 2)), ['update-watching.yml']);
  assert.deepEqual(due(at(24, 6)), ['update-sponsors.yml']);
  assert.deepEqual(due(at(24, 8)), ['update-coffee-stats.yml']);
  assert.deepEqual(due(at(24, 12)), ['update-coffee-stats.yml']);
  assert.deepEqual(due(at(24, 16)), ['update-coffee-stats.yml']);
  assert.deepEqual(due(at(24, 17)), ['quiet-week.yml']);
});

test('Spotify only runs on Mondays', () => {
  assert.deepEqual(due(at(23, 0)), ['spotify-data-update.yml']);
  for (let day = 24; day <= 29; day++) assert.deepEqual(due(at(day, 0)), [], `day ${day}`);
});

test('nothing is due in the other hours', () => {
  const busy = new Set([0, 2, 6, 8, 12, 16, 17]);
  for (let hour = 0; hour < 24; hour++) {
    if (!busy.has(hour)) assert.deepEqual(due(at(24, hour)), [], `hour ${hour}`);
  }
});

test('a late wake-up still counts as its hour', () => {
  assert.deepEqual(due(at(24, 2, 59)), ['update-watching.yml']);
});

test('every scheduled workflow exists and can be started by the clock', () => {
  const files = new Set(readdirSync(WORKFLOWS));
  for (const job of SCHEDULE) {
    assert.ok(files.has(job.workflow), `${job.workflow} exists`);
    const yaml = readFileSync(new URL(job.workflow, WORKFLOWS), 'utf8');
    assert.match(yaml, /^\s*workflow_dispatch:/m, `${job.workflow} has workflow_dispatch`);
    for (const input of Object.keys(job.inputs ?? {})) {
      assert.match(yaml, new RegExp(`^\\s+${input}:`, 'm'), `${job.workflow} declares input ${input}`);
    }
  }
});

test('no workflow keeps a GitHub schedule of its own, so nothing runs twice', () => {
  for (const file of readdirSync(WORKFLOWS)) {
    const yaml = readFileSync(new URL(file, WORKFLOWS), 'utf8');
    assert.doesNotMatch(yaml, /^\s*schedule:/m, `${file} has no schedule`);
  }
});
