import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

// Runs the worker in Node against a stubbed Turnstile siteverify endpoint.

const ENV = { CONTACT_EMAIL: 'hello@example.com', TURNSTILE_SECRET_KEY: 'secret' };
const PASS = { success: true, action: 'contact', hostname: 'andresmit.co.za' };

const realFetch = globalThis.fetch;
let siteverify;

beforeEach(() => {
  siteverify = { calls: [], response: () => Response.json(PASS) };
  globalThis.fetch = async (url, init) => {
    siteverify.calls.push({ url, form: Object.fromEntries(init.body) });
    return siteverify.response();
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function post(body, headers = {}) {
  return new Request('https://andresmit.co.za/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://andresmit.co.za', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('a verified token gets the email', async () => {
  const response = await worker.fetch(post({ token: 'good' }, { 'CF-Connecting-IP': '203.0.113.7' }), ENV);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { email: 'hello@example.com' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://andresmit.co.za');
  assert.deepEqual(siteverify.calls, [{
    url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    form: { secret: 'secret', response: 'good', remoteip: '203.0.113.7' },
  }]);
});

test('GET no longer hands out the email', async () => {
  const response = await worker.fetch(new Request('https://andresmit.co.za/api/contact'), ENV);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  assert.doesNotMatch(await response.text(), /hello@/);
});

test('a missing or malformed token is rejected without asking Turnstile', async () => {
  for (const body of ['not json', 'null', {}, { token: '' }, { token: 42 }, { token: 'x'.repeat(2049) }]) {
    const response = await worker.fetch(post(body), ENV);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(siteverify.calls.length, 0);
});

test('tokens Turnstile does not vouch for are rejected', async () => {
  const rejected = [
    { success: false, 'error-codes': ['invalid-input-response'] },
    { ...PASS, action: 'login' },
    { ...PASS, hostname: 'evil.example' },
  ];
  for (const outcome of rejected) {
    siteverify.response = () => Response.json(outcome);
    const response = await worker.fetch(post({ token: 'bad' }), ENV);
    assert.equal(response.status, 403, JSON.stringify(outcome));
    assert.doesNotMatch(await response.text(), /hello@/);
  }
});

test('Turnstile being down is a 502, not a pass', async () => {
  siteverify.response = () => new Response('oops', { status: 500 });
  assert.equal((await worker.fetch(post({ token: 'good' }), ENV)).status, 502);

  siteverify.response = () => { throw new TypeError('network error'); };
  assert.equal((await worker.fetch(post({ token: 'good' }), ENV)).status, 502);
});

test('missing secrets fail closed', async () => {
  assert.equal((await worker.fetch(post({ token: 'good' }), { CONTACT_EMAIL: 'hello@example.com' })).status, 500);
  assert.equal((await worker.fetch(post({ token: 'good' }), { TURNSTILE_SECRET_KEY: 'secret' })).status, 500);
});

test('CORS preflight allows the www site to POST JSON', async () => {
  const response = await worker.fetch(new Request('https://andresmit.co.za/api/contact', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://www.andresmit.co.za' },
  }), ENV);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://www.andresmit.co.za');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

test('other paths are not found', async () => {
  assert.equal((await worker.fetch(new Request('https://andresmit.co.za/api/other'), ENV)).status, 404);
});
