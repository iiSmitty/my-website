// Contact API for andresmit.co.za (routed at andresmit.co.za/api/contact).
//
// POST /api/contact with { token } from a Cloudflare Turnstile widget returns
// { email }. The address is only handed out for a token Turnstile vouches for,
// so it never reaches scrapers or anyone just reading the page source.
//
// Secrets: CONTACT_EMAIL, TURNSTILE_SECRET_KEY

const ALLOWED_ORIGINS = [
  'https://andresmit.co.za',
  'https://www.andresmit.co.za',
];
const ALLOWED_HOSTNAMES = ALLOWED_ORIGINS.map((origin) => new URL(origin).hostname);

// Must match the action the page renders the widget with (js/decrypt.js)
const TURNSTILE_ACTION = 'contact';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Turnstile tokens are at most 2048 characters
const MAX_TOKEN_LENGTH = 2048;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        ...headers,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

    const url = new URL(request.url);
    if (url.pathname !== '/api/contact') {
      return new Response('Not found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, { 'Allow': 'POST, OPTIONS' });
    }

    if (!env.CONTACT_EMAIL || !env.TURNSTILE_SECRET_KEY) {
      return json({ error: 'not_configured' }, 500);
    }

    const token = await readToken(request);
    if (!token) {
      return json({ error: 'invalid_request' }, 400);
    }

    let outcome;
    try {
      outcome = await verifyTurnstile(token, request.headers.get('CF-Connecting-IP'), env.TURNSTILE_SECRET_KEY);
    } catch {
      return json({ error: 'verification_unavailable' }, 502);
    }

    // A token solved for another action or on another site doesn't count
    if (!outcome.success || outcome.action !== TURNSTILE_ACTION || !ALLOWED_HOSTNAMES.includes(outcome.hostname)) {
      return json({ error: 'verification_failed' }, 403);
    }

    return json({ email: env.CONTACT_EMAIL });
  },
};

/** The Turnstile token from a `{ token }` JSON body, or null if there isn't a usable one. */
async function readToken(request) {
  try {
    const { token } = await request.json();
    if (typeof token === 'string' && token.length > 0 && token.length <= MAX_TOKEN_LENGTH) {
      return token;
    }
  } catch {
    // Not JSON, or not an object
  }
  return null;
}

/** Ask Turnstile whether the token is genuine. Throws if Turnstile can't be reached. */
async function verifyTurnstile(token, remoteIp, secret) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) {
    body.append('remoteip', remoteIp);
  }

  const response = await fetch(SITEVERIFY_URL, { method: 'POST', body });
  if (!response.ok) {
    throw new Error(`siteverify returned ${response.status}`);
  }
  return response.json();
}
