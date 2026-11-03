import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/worker.js';
import { fakeNamespace } from './fake-durable-object.js';
import { HOUR, MINUTE } from '../src/mood-core.js';

// Runs the Worker and its Durable Object in Node, against an in-memory SQLite
// database standing in for the object's storage.

const NOW = Date.UTC(2026, 10, 2, 10, 0, 0);

function setup(t, vars = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const env = { ENABLED: 'true', HALF_LIFE_HOURS: '12', GAIN: '0.08', DAILY_CAP: '40000', CHEERS_PER_MINUTE: '30', ...vars };
  env.PC_MOOD = fakeNamespace(env);
  const worker = createWorker();
  const call = (request) => worker.fetch(request, env);
  const tick = (ms) => t.mock.timers.tick(ms);
  return { env, call, tick, namespace: env.PC_MOOD };
}

function get(path = '/api/mood', init = {}) {
  return new Request(`https://andresmit.co.za${path}`, init);
}

function cheer(body, headers = {}) {
  return new Request('https://andresmit.co.za/api/mood/cheer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://andresmit.co.za', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const NONE = { pat: 0, coffee: 0, joke: 0, defrag: 0, dust: 0 };

test('a new PC has no lift and no cheers', async (t) => {
  const { call, namespace } = setup(t);
  const response = await call(get());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await response.json(), { lift: 0, at: NOW, halfLifeHours: 12, today: NONE, total: 0, last: null });
  // Every visitor shares the one object
  assert.deepEqual(namespace.names, ['pc']);
});

test('a cheer lifts the mood and is counted', async (t) => {
  const { call } = setup(t);
  const response = await call(cheer({ action: 'coffee', first: true }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    lift: 4, at: NOW, halfLifeHours: 12,
    today: { ...NONE, coffee: 1 }, total: 1,
    last: { action: 'coffee', at: NOW },
    accepted: true,
  });
});

test('the lift fades with the half-life, worked out when read', async (t) => {
  const { call, tick, namespace } = setup(t, { GAIN: '0.5' });
  await call(cheer({ action: 'pat' }));
  assert.equal((await (await call(get())).json()).lift, 25);

  tick(12 * HOUR);
  const later = await (await call(get())).json();
  assert.equal(later.lift, 12.5);
  assert.equal(later.at, NOW + 12 * HOUR);

  // Nothing was written to fade it: only the one cheer's rows
  const writes = namespace.storage.statements.filter((sql) => /^INSERT/.test(sql));
  assert.equal(writes.length, 2);
});

test('a cheer adds to what is left of the lift, not to what it was', async (t) => {
  const { call, tick } = setup(t, { GAIN: '0.5' });
  await call(cheer({ action: 'pat' }));
  tick(12 * HOUR);
  const body = await (await call(cheer({ action: 'dust' }))).json();
  // 25 faded to 12.5, then half of the gap to 50
  assert.equal(body.lift, 31.25);
  assert.equal(body.total, 2);
});

test('state survives the object being evicted', async (t) => {
  const { call, namespace } = setup(t);
  await call(cheer({ action: 'joke' }));
  await call(cheer({ action: 'joke' }));
  namespace.restart();

  const body = await (await call(get())).json();
  assert.equal(body.total, 2);
  assert.deepEqual(body.today, { ...NONE, joke: 2 });
  assert.deepEqual(body.last, { action: 'joke', at: NOW });
});

test('counts start again each UTC day, and the total keeps going', async (t) => {
  const { call, tick } = setup(t);
  await call(cheer({ action: 'defrag' }));
  tick(14 * HOUR); // 00:00 UTC the next day
  const body = await (await call(get())).json();
  assert.deepEqual(body.today, NONE);
  assert.equal(body.total, 1);
  assert.deepEqual(body.last, { action: 'defrag', at: NOW });
});

test('over 30 cheers a minute are not counted', async (t) => {
  const { call, tick } = setup(t);
  for (let i = 0; i < 30; i++) {
    assert.equal((await (await call(cheer({ action: 'pat' }))).json()).accepted, true);
  }
  const over = await (await call(cheer({ action: 'pat' }))).json();
  assert.equal(over.accepted, false);
  assert.equal(over.today.pat, 30);

  tick(MINUTE);
  assert.equal((await (await call(cheer({ action: 'pat' }))).json()).accepted, true);
});

test('past the daily cap it rests until the next UTC day, and stops asking the object', async (t) => {
  const { call, tick, namespace } = setup(t, { DAILY_CAP: '3' });
  for (let i = 0; i < 3; i++) {
    assert.equal((await call(get())).status, 200);
  }

  const tomorrow = Date.UTC(2026, 10, 3);
  const response = await call(get());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), String(14 * 60 * 60));
  assert.deepEqual(await response.json(), { resting: true, until: tomorrow });

  // The Worker remembers, so further calls don't reach the object
  const asked = namespace.names.length;
  assert.equal((await call(cheer({ action: 'coffee' }))).status, 429);
  assert.equal(namespace.names.length, asked);

  tick(tomorrow - NOW);
  assert.equal((await call(get())).status, 200);
});

test('the daily count survives the object being evicted', async (t) => {
  // Saved with every cheer, and every 100 requests in between
  const { call, namespace } = setup(t, { DAILY_CAP: '2' });
  await call(cheer({ action: 'pat' }));
  await call(cheer({ action: 'pat' }));
  namespace.restart();
  assert.equal((await call(get())).status, 429);
});

test('a cheer from another site is refused', async (t) => {
  const { call, namespace } = setup(t);
  for (const origin of ['https://evil.example', 'http://andresmit.co.za', 'null']) {
    const response = await call(cheer({ action: 'pat' }, { Origin: origin }));
    assert.equal(response.status, 403, origin);
  }
  const noOrigin = new Request('https://andresmit.co.za/api/mood/cheer', { method: 'POST', body: '{"action":"pat"}' });
  assert.equal((await call(noOrigin)).status, 403);
  assert.deepEqual(namespace.names, []);
});

test('www is allowed too', async (t) => {
  const { call } = setup(t);
  assert.equal((await call(cheer({ action: 'pat' }, { Origin: 'https://www.andresmit.co.za' }))).status, 200);
});

test('only the five actions are accepted', async (t) => {
  const { call, namespace } = setup(t);
  for (const body of [{ action: '<script>' }, { action: 'hug' }, {}, [], 'not json', '"pat"', { action: ['pat'] }]) {
    const response = await call(cheer(body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(await response.json(), { error: 'invalid_request' });
  }
  assert.deepEqual(namespace.names, []);
});

test('a body over 64 bytes is refused, whatever Content-Length says', async (t) => {
  const { call } = setup(t);
  const big = JSON.stringify({ action: 'pat', padding: 'x'.repeat(64) });
  assert.equal((await call(cheer(big))).status, 413);

  // A stream with no length is cut off at the limit
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(40))); },
  });
  const chunked = new Request('https://andresmit.co.za/api/mood/cheer', {
    method: 'POST', headers: { Origin: 'https://andresmit.co.za' }, body: stream, duplex: 'half',
  });
  assert.equal((await call(chunked)).status, 413);
});

test('extra fields are ignored, and only first: true counts as first', async (t) => {
  const { call, namespace } = setup(t);
  await call(cheer({ action: 'pat', first: 'yes', name: 'bob' }));
  await call(cheer({ action: 'pat', first: true }));
  const row = namespace.storage.db.prepare('SELECT * FROM days').get();
  assert.equal(row.pat, 2);
  assert.equal(row.first_cheers, 1);
  // Nothing else about the visitor is stored anywhere
  const columns = namespace.storage.db.prepare("SELECT name FROM pragma_table_info('state') UNION ALL SELECT name FROM pragma_table_info('days')").all().map((c) => c.name);
  assert.deepEqual(columns.sort(), [
    'at', 'coffee', 'cold_cheers', 'day', 'defrag', 'dust', 'first_cheers', 'id', 'joke', 'last_action', 'last_at', 'lift', 'pat', 'requests', 'total',
  ]);
});

test('cheers that find the lift faded are counted, to tune the half-life', async (t) => {
  const { call, tick, namespace } = setup(t);
  await call(cheer({ action: 'pat' }));      // from nothing: cold
  await call(cheer({ action: 'pat' }));      // lift is 4: warm
  tick(2 * 24 * HOUR);                       // two days on, 4.3 has faded to 0.27
  await call(cheer({ action: 'coffee' }));   // cold again
  const rows = namespace.storage.db.prepare('SELECT day, cold_cheers FROM days ORDER BY day').all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [{ day: 20261102, cold_cheers: 1 }, { day: 20261104, cold_cheers: 1 }]);
});

test('stats lists anonymous daily totals, newest first', async (t) => {
  const { call, tick } = setup(t);
  await call(cheer({ action: 'pat', first: true }));
  tick(24 * HOUR);
  await call(cheer({ action: 'coffee', first: true }));
  await call(cheer({ action: 'coffee' }));

  const body = await (await call(get('/api/mood/stats'))).json();
  assert.deepEqual(body.days, [
    { day: '2026-11-03', cheers: { ...NONE, coffee: 2 }, firstCheers: 1, coldCheers: 0, requests: 3 },
    { day: '2026-11-02', cheers: { ...NONE, pat: 1 }, firstCheers: 1, coldCheers: 1, requests: 1 },
  ]);
});

test('the wrong method is refused', async (t) => {
  const { call } = setup(t);
  const postToRead = await call(get('/api/mood', { method: 'POST', headers: { Origin: 'https://andresmit.co.za' }, body: '{}' }));
  assert.equal(postToRead.status, 405);
  assert.equal(postToRead.headers.get('Allow'), 'GET');

  const getToCheer = await call(get('/api/mood/cheer'));
  assert.equal(getToCheer.status, 405);
  assert.equal(getToCheer.headers.get('Allow'), 'POST');
});

test('anything else under the route is not found', async (t) => {
  const { call } = setup(t);
  for (const path of ['/api/mood/', '/api/moodx', '/api/mood/cheer/extra']) {
    assert.equal((await call(get(path))).status, 404, path);
  }
});

test('switched off, it answers 503 without touching the object', async (t) => {
  const { call, namespace } = setup(t, { ENABLED: 'false' });
  const response = await call(get());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'disabled' });
  assert.equal((await call(cheer({ action: 'pat' }))).status, 503);
  assert.deepEqual(namespace.names, []);
});

test('health answers without the object, on or off', async (t) => {
  const { call, namespace } = setup(t);
  const response = await call(get('/api/mood/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, enabled: true });
  assert.deepEqual(namespace.names, []);

});

test('health says when it is switched off', async (t) => {
  const { call } = setup(t, { ENABLED: 'false' });
  assert.deepEqual(await (await call(get('/api/mood/health'))).json(), { ok: true, enabled: false });
});

test('an object that fails is reported as unavailable, not a crash', async (t) => {
  const { call, env } = setup(t);
  env.PC_MOOD.get = () => ({ fetch: async () => { throw new Error('Durable Object reset'); } });
  const response = await call(get());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
});

test('an object that answers with something other than JSON is unavailable, not a crash', async (t) => {
  const { call, env } = setup(t);
  env.PC_MOOD.get = () => ({ fetch: async () => new Response('Internal error', { status: 500 }) });
  const response = await call(get());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'unavailable' });
});
