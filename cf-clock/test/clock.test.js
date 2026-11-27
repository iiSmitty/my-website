import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, runDue, ATTEMPTS, REF, REPOSITORY } from '../src/clock.js';

const WATCHING_HOUR = Date.UTC(2026, 10, 24, 2);
const QUIET_HOUR = Date.UTC(2026, 10, 24, 3);
const env = { GITHUB_TOKEN: 'test-token' };

// A fetch that answers from a list, one status per call, and records the calls
function fakeFetch(...statuses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const status = statuses.length > 1 ? statuses.shift() : statuses[0];
    if (status instanceof Error) throw status;
    return new Response(status === 204 ? null : 'nope', { status });
  };
  return { fn, calls };
}

const quiet = { sleep: async () => {} };

test('starts the due workflow on main', async (t) => {
  t.mock.method(console, 'log', () => {});
  const fetch = fakeFetch(204);
  assert.deepEqual(await runDue(WATCHING_HOUR, env, { ...quiet, fetch: fetch.fn }), ['update-watching.yml']);
  assert.equal(fetch.calls.length, 1);
  const [call] = fetch.calls;
  assert.equal(call.url, `https://api.github.com/repos/${REPOSITORY}/actions/workflows/update-watching.yml/dispatches`);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.authorization, 'Bearer test-token');
  assert.ok(call.init.headers['user-agent']);
  assert.deepEqual(call.body, { ref: REF });
});

test('passes inputs when the job has them', async () => {
  const fetch = fakeFetch(204);
  await dispatch({ workflow: 'update-coffee-stats.yml', inputs: { scheduled: 'true' } }, 'tok', { ...quiet, fetch: fetch.fn });
  assert.deepEqual(fetch.calls[0].body, { ref: REF, inputs: { scheduled: 'true' } });
});

test('does nothing in an hour with nothing due, even without a token', async () => {
  const fetch = fakeFetch(204);
  assert.deepEqual(await runDue(QUIET_HOUR, {}, { ...quiet, fetch: fetch.fn }), []);
  assert.equal(fetch.calls.length, 0);
});

test('a missing token fails loudly when something is due', async () => {
  await assert.rejects(runDue(WATCHING_HOUR, {}, quiet), /GITHUB_TOKEN/);
});

test('retries when GitHub is busy or unreachable, then succeeds', async () => {
  const fetch = fakeFetch(502, new Error('connection reset'), 204);
  const waits = [];
  await dispatch({ workflow: 'quiet-week.yml' }, 'tok', { fetch: fetch.fn, sleep: async (ms) => waits.push(ms) });
  assert.equal(fetch.calls.length, 3);
  assert.equal(waits.length, 2);
});

test('gives up after the last attempt', async () => {
  const fetch = fakeFetch(503);
  await assert.rejects(dispatch({ workflow: 'quiet-week.yml' }, 'tok', { ...quiet, fetch: fetch.fn }), /503/);
  assert.equal(fetch.calls.length, ATTEMPTS);
});

test('does not retry a refusal that will not fix itself', async () => {
  const fetch = fakeFetch(401);
  await assert.rejects(dispatch({ workflow: 'quiet-week.yml' }, 'tok', { ...quiet, fetch: fetch.fn }), /401/);
  assert.equal(fetch.calls.length, 1);
});

test('one failure still starts the rest, then throws', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const schedule = [
    { workflow: 'a.yml', hours: [2] },
    { workflow: 'b.yml', hours: [2] },
  ];
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return new Response(null, { status: url.includes('/a.yml/') ? 404 : 204 });
  };
  await assert.rejects(runDue(WATCHING_HOUR, env, { ...quiet, fetch, schedule }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /a\.yml: GitHub answered 404/);
    return true;
  });
  assert.equal(calls.length, 2);
});
