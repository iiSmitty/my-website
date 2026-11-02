// PC Health API for andresmit.co.za (routed at andresmit.co.za/api/mood*).
//
// Visitors cheer up My Computer from the PC Health window (js/pc-health-window.js).
// Their cheers lift its mood for everyone, and the lift fades with a half-life.
// One Durable Object holds the shared state, so cheers that arrive together
// are applied one after the other and none are lost.
//
//   GET  /api/mood          the shared mood: { lift, at, halfLifeHours, today, total, last }
//   POST /api/mood/cheer    { "action": "coffee", "first": true } -> the same, plus accepted
//   GET  /api/mood/stats    anonymous daily totals for the last 30 days
//   GET  /api/mood/health   { ok: true }, without touching the Durable Object
//
// Nothing here reads, stores or logs an IP address, a header or anything else
// about a visitor. The only things stored are the lift and counts per action.
//
// Vars (wrangler.jsonc): ENABLED, HALF_LIFE_HOURS, GAIN, DAILY_CAP, CHEERS_PER_MINUTE

import {
  ACTIONS,
  allowCheer,
  applyCheer,
  dayKey,
  decay,
  nextDayStart,
  readConfig,
} from './mood-core.js';

const ALLOWED_ORIGINS = [
  'https://andresmit.co.za',
  'https://www.andresmit.co.za',
];

// {"action":"defrag","first":true} is 32 bytes; anything much bigger isn't ours
const MAX_BODY_BYTES = 64;

// The one Durable Object every visitor shares
const OBJECT_NAME = 'pc';

// Requests the Durable Object counts toward the daily cap are saved at least
// this often, so the count survives the object being evicted. A cheer saves
// it anyway, in the row it already writes.
const SAVE_REQUESTS_EVERY = 100;

const STATS_DAYS = 30;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function resting(until) {
  const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  return json({ resting: true, until }, 429, { 'Retry-After': String(seconds) });
}

/**
 * The body as text, or null if it's bigger than `limit` bytes. Reads no more
 * than that, whatever Content-Length claims.
 */
async function readSmallBody(request, limit) {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > limit) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** A cheer from a `{ action, first }` body, or null if it isn't one */
function parseCheer(text) {
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && ACTIONS.includes(body.action)) {
      return { action: body.action, first: body.first === true };
    }
  } catch {
    // Not JSON
  }
  return null;
}

/**
 * The Worker. Made by a function so each test gets its own, with nothing
 * remembered from the last one.
 */
export function createWorker() {
  // Once the Durable Object says it's resting, this copy of the Worker answers
  // for it until the next UTC day, without spending a Durable Object request
  let restingUntil = 0;

  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      const config = readConfig(env);

      if (pathname === '/api/mood/health') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' });
        }
        return json({ ok: true, enabled: config.enabled });
      }

      const routes = {
        '/api/mood': { method: 'GET', path: '/snapshot' },
        '/api/mood/stats': { method: 'GET', path: '/stats' },
        '/api/mood/cheer': { method: 'POST', path: '/cheer' },
      };
      const route = routes[pathname];
      if (!route) {
        return json({ error: 'not_found' }, 404);
      }

      // The off switch: answer before touching the Durable Object
      if (!config.enabled) {
        return json({ error: 'disabled' }, 503);
      }

      if (request.method !== route.method) {
        return json({ error: 'method_not_allowed' }, 405, { Allow: route.method });
      }

      let body;
      if (route.method === 'POST') {
        // The page posts from its own origin. Anything else isn't the page.
        if (!ALLOWED_ORIGINS.includes(request.headers.get('Origin'))) {
          return json({ error: 'forbidden' }, 403);
        }
        const text = await readSmallBody(request, MAX_BODY_BYTES);
        if (text === null) {
          return json({ error: 'too_large' }, 413);
        }
        const cheer = parseCheer(text);
        if (!cheer) {
          return json({ error: 'invalid_request' }, 400);
        }
        body = JSON.stringify(cheer);
      }

      if (Date.now() < restingUntil) {
        return resting(restingUntil);
      }

      let response;
      try {
        const stub = env.PC_MOOD.get(env.PC_MOOD.idFromName(OBJECT_NAME));
        response = await stub.fetch(`https://pc-mood${route.path}`, { method: route.method, body });
      } catch {
        return json({ error: 'unavailable' }, 503);
      }

      const result = await response.json();
      if (result.resting) {
        restingUntil = result.until;
        return resting(result.until);
      }
      return json(result, response.status);
    },
  };
}

export default createWorker();

/**
 * The shared mood. SQLite storage, two tables:
 *
 *   state  one row: the lift and when it was set, the all-time total, and
 *          the last accepted action and when
 *   days   one row per UTC day: accepted cheers per action, how many page
 *          loads cheered at least once, cheers that found the lift faded,
 *          and requests (for the daily cap)
 *
 * An accepted cheer writes two rows, one in each. A day's counts are in one
 * row rather than a row per action, so a cheer never writes more than that.
 * A plain class with fetch(), rather than RPC, so Node can test it.
 */
export class PcMood {
  constructor(ctx, env) {
    this.sql = ctx.storage.sql;
    this.config = readConfig(env);
    // The per-minute window and today's request count live in memory. Both
    // are only for slowing floods, and a flood keeps the object in memory.
    this.bucket = null;
    this.day = null;
    this.state = null;

    this.sql.exec(`CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lift REAL NOT NULL,
      at INTEGER NOT NULL,
      total INTEGER NOT NULL,
      last_action TEXT,
      last_at INTEGER
    )`);
    const counts = ACTIONS.map((action) => `${action} INTEGER NOT NULL DEFAULT 0`).join(',\n      ');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS days (
      day INTEGER PRIMARY KEY,
      ${counts},
      first_cheers INTEGER NOT NULL DEFAULT 0,
      cold_cheers INTEGER NOT NULL DEFAULT 0,
      requests INTEGER NOT NULL DEFAULT 0
    )`);
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    // Read the body before anything else, so the rest runs without a break
    // in which another request could slip in
    const cheer = pathname === '/cheer' ? await request.json() : null;
    const now = Date.now();

    const day = this.countRequest(now);
    if (day.requests > this.config.dailyCap) {
      return json({ resting: true, until: nextDayStart(now) }, 429);
    }

    if (pathname === '/cheer') {
      return json(this.cheer(cheer, now));
    }
    if (pathname === '/stats') {
      return json({ days: this.stats() });
    }
    return json(this.snapshot(now));
  }

  loadState() {
    if (!this.state) {
      const row = this.sql.exec('SELECT lift, at, total, last_action, last_at FROM state WHERE id = 1').toArray()[0];
      this.state = row
        ? { lift: row.lift, at: row.at, total: row.total, lastAction: row.last_action, lastAt: row.last_at }
        : { lift: 0, at: 0, total: 0, lastAction: null, lastAt: null };
    }
    return this.state;
  }

  countRequest(now) {
    const key = dayKey(now);
    if (!this.day || this.day.key !== key) {
      const row = this.sql.exec('SELECT requests FROM days WHERE day = ?', key).toArray()[0];
      const requests = row ? row.requests : 0;
      this.day = { key, requests, saved: requests };
    }
    this.day.requests++;

    const crossedCap = this.day.requests === this.config.dailyCap + 1;
    if (crossedCap || this.day.requests - this.day.saved >= SAVE_REQUESTS_EVERY) {
      this.sql.exec(
        `INSERT INTO days (day, requests) VALUES (?, ?)
         ON CONFLICT(day) DO UPDATE SET requests = excluded.requests`,
        key, this.day.requests,
      );
      this.day.saved = this.day.requests;
    }
    return this.day;
  }

  cheer({ action, first }, now) {
    if (!ACTIONS.includes(action)) {
      return { ...this.snapshot(now), accepted: false };
    }

    const { allowed, bucket } = allowCheer(this.bucket, now, this.config.cheersPerMinute);
    this.bucket = bucket;
    if (!allowed) {
      // Over the per-minute cap: not counted, though it still plays in the page
      return { ...this.snapshot(now), accepted: false };
    }

    const state = this.loadState();
    const faded = decay(state.lift, now - state.at, this.config.halfLifeHours);
    const lift = applyCheer(faded, this.config.gain);

    this.sql.exec(
      `INSERT INTO state (id, lift, at, total, last_action, last_at) VALUES (1, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET lift = excluded.lift, at = excluded.at, total = total + 1,
         last_action = excluded.last_action, last_at = excluded.last_at`,
      lift, now, action, now,
    );
    // `action` is one of ACTIONS, checked above, so it's safe as a column name
    this.sql.exec(
      `INSERT INTO days (day, ${action}, first_cheers, cold_cheers, requests) VALUES (?, 1, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET ${action} = ${action} + 1,
         first_cheers = first_cheers + excluded.first_cheers,
         cold_cheers = cold_cheers + excluded.cold_cheers,
         requests = excluded.requests`,
      this.day.key, first ? 1 : 0, faded < 1 ? 1 : 0, this.day.requests,
    );
    this.day.saved = this.day.requests;
    this.state = { lift, at: now, total: state.total + 1, lastAction: action, lastAt: now };

    return { ...this.snapshot(now), accepted: true };
  }

  snapshot(now) {
    const state = this.loadState();
    const row = this.sql.exec(`SELECT ${ACTIONS.join(', ')} FROM days WHERE day = ?`, dayKey(now)).toArray()[0];
    const today = Object.fromEntries(ACTIONS.map((action) => [action, row ? row[action] : 0]));
    const lift = decay(state.lift, now - state.at, this.config.halfLifeHours);

    return {
      // Faded to now, so the page can fade it further from when it arrives
      lift: Math.round(lift * 1000) / 1000,
      at: now,
      halfLifeHours: this.config.halfLifeHours,
      today,
      total: state.total,
      last: state.lastAction ? { action: state.lastAction, at: state.lastAt } : null,
    };
  }

  stats() {
    const rows = this.sql.exec(
      `SELECT day, ${ACTIONS.join(', ')}, first_cheers, cold_cheers, requests FROM days ORDER BY day DESC LIMIT ?`,
      STATS_DAYS,
    ).toArray();
    return rows.map((row) => ({
      day: String(row.day).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      cheers: Object.fromEntries(ACTIONS.map((action) => [action, row[action]])),
      firstCheers: row.first_cheers,
      coldCheers: row.cold_cheers,
      // Today's count is in memory, and only saved every so often
      requests: this.day && row.day === this.day.key ? this.day.requests : row.requests,
    }));
  }
}
