// The PC Health mood maths, with no Cloudflare imports so Node can test it.
// The Worker (worker.js) and its Durable Object call these; the browser has
// its own copy of the decay and bands in js/pc-health.js.

// What a visitor can do. The server only ever stores and returns these IDs;
// the words for them live in the page.
export const ACTIONS = ['pat', 'coffee', 'joke', 'defrag', 'dust'];

// The shared lift is 0 to 50, on top of a baseline of 40 to 65 that the page
// works out from my own data. The page clamps the sum to 20 to 100.
export const MAX_LIFT = 50;

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Defaults, and how far the Worker's vars may move them
const SETTINGS = {
  HALF_LIFE_HOURS: { fallback: 12, min: 0.25, max: 24 * 7 },
  GAIN: { fallback: 0.08, min: 0.001, max: 0.5 },
  DAILY_CAP: { fallback: 40000, min: 1, max: 100000 },
  // Each accepted cheer writes two rows. 30 a minute for a whole day is 86,400
  // rows, under the free plan's 100,000 Durable Object rows written a day, so
  // a script cheering nonstop can't use up the writes and stop the mood.
  CHEERS_PER_MINUTE: { fallback: 30, min: 1, max: 30 },
};

function setting(env, name) {
  const { fallback, min, max } = SETTINGS[name];
  const raw = env && env[name];
  const value = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

/**
 * The Worker's vars, as numbers in a sensible range. A var that's missing or
 * not a number falls back to its default, so a typo can't break the mood.
 * ENABLED is on unless it's set to "false" (a string or a boolean).
 */
export function readConfig(env = {}) {
  return {
    enabled: String(env.ENABLED).trim().toLowerCase() !== 'false',
    halfLifeHours: setting(env, 'HALF_LIFE_HOURS'),
    gain: setting(env, 'GAIN'),
    dailyCap: Math.round(setting(env, 'DAILY_CAP')),
    cheersPerMinute: Math.round(setting(env, 'CHEERS_PER_MINUTE')),
  };
}

/**
 * The lift `ageMs` after it was stored: it halves every half-life. Worked
 * out when it's read, so nothing has to wake up to fade it.
 */
export function decay(lift, ageMs, halfLifeHours) {
  if (!(lift > 0)) return 0;
  if (!(ageMs > 0)) return Math.min(lift, MAX_LIFT);
  return Math.min(lift, MAX_LIFT) * Math.pow(0.5, ageMs / (halfLifeHours * HOUR));
}

/**
 * One cheer closes a share of the gap to the top, so each one counts for a
 * little less than the last, and the lift can never pass MAX_LIFT.
 */
export function applyCheer(lift, gain) {
  const current = Math.min(Math.max(lift || 0, 0), MAX_LIFT);
  return current + (MAX_LIFT - current) * gain;
}

/**
 * A fixed one-minute window of accepted cheers, shared by every visitor.
 * Returns whether this cheer counts, and the window to keep.
 */
export function allowCheer(bucket, now, perMinute) {
  const start = Math.floor(now / MINUTE) * MINUTE;
  const count = bucket && bucket.start === start ? bucket.count : 0;
  if (count >= perMinute) return { allowed: false, bucket: { start, count } };
  return { allowed: true, bucket: { start, count: count + 1 } };
}

// The bands the page shows. Kept here too so the tests pin the ranges.
export const BANDS = [
  { min: 90, state: 'Great day' },
  { min: 75, state: 'Happy' },
  { min: 55, state: 'Content' },
  { min: 35, state: 'Okay' },
  { min: 20, state: 'Tired' },
];

export function clampMood(mood) {
  return Math.min(Math.max(Math.round(mood), 20), 100);
}

export function bandFor(mood) {
  const value = clampMood(mood);
  return BANDS.find((band) => value >= band.min).state;
}

/**
 * The UTC day, as a number like 20261102. Days are UTC because Cloudflare's
 * free daily limits reset at 00:00 UTC, and the daily cap protects them.
 */
export function dayKey(now) {
  const date = new Date(now);
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

/** When the next UTC day starts, in ms */
export function nextDayStart(now) {
  return (Math.floor(now / DAY) + 1) * DAY;
}
