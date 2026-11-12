/**
 * Fetches who has sponsored me on GitHub Sponsors and writes
 * data/sponsors.json for the coffees in Coffee Analytics (js/sponsors.js).
 *
 * Makes two kinds of call to GitHub's GraphQL API, a page of 100 at a time:
 *
 *  1. sponsorshipsAsMaintainer(activeOnly: false): every sponsorship I've
 *     ever had, so one-time and past sponsors are credited too
 *  2. lifetimeReceivedSponsorshipValues: how much each sponsor has paid in all
 *
 * The file says how many coffees each sponsor has bought me, never how much
 * they paid. Amounts are turned into coffees here (coffeesFor below), so no
 * dollar amount is ever committed. Sponsors are listed in the order they
 * first sponsored, earliest first, and the page shows them in that order.
 *
 * Only public sponsorships are credited. Private ones are left out of the
 * query itself (includePrivate: false), so they never leave GitHub, and are
 * filtered out again by privacyLevel in case that ever changes. They count
 * toward nothing on the site, not even an anonymous total: with a handful of
 * sponsors, "+1 private patron" appearing in a dated commit could be enough
 * to tell who it was.
 *
 * The file is only written when the credits change, so a quiet run doesn't
 * commit (and redeploy) the site. Any failure exits non-zero before writing,
 * so the site keeps showing the last good data.
 *
 * The token: the Actions GITHUB_TOKEN can't read sponsorships, so the
 * workflow passes a personal access token as SPONSORS_TOKEN. A classic token
 * of my account with only the read:user scope is enough. Without read:user
 * GitHub refuses createdAt and privacyLevel (INSUFFICIENT_SCOPES), and
 * quietly returns null for every lifetime amount. It has to be my account's
 * token, because only the maintainer can see those amounts. No repo access is
 * needed; the workflow commits with its own GITHUB_TOKEN.
 *
 * Usage: SPONSORS_TOKEN=... node .github/scripts/sponsors-fetcher.js
 */

const fs = require('fs');
const path = require('path');

const SPONSORABLE = 'iiSmitty';
const GRAPHQL_API = 'https://api.github.com/graphql';
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'sponsors.json');
const PAGE_SIZE = 100;

// What a coffee costs, in US cents: a cappuccino with wings (a takeaway
// cappuccino) is about R45, which is about $2.50. Rounded to the nearest
// whole coffee, so $5 buys two.
const COFFEE_PRICE_CENTS = 250;

// GitHub's API asks every client to name itself in the User-Agent
const USER_AGENT = 'andresmit.co.za-sponsors-fetcher';

const SPONSORSHIPS_QUERY = `
query ($login: String!, $after: String) {
  user(login: $login) {
    sponsorshipsAsMaintainer(first: ${PAGE_SIZE}, after: $after, includePrivate: false, activeOnly: false,
                             orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        privacyLevel
        sponsorEntity {
          ... on User { login name }
          ... on Organization { login name }
        }
      }
    }
  }
}`;

const LIFETIME_VALUES_QUERY = `
query ($login: String!, $after: String) {
  user(login: $login) {
    lifetimeReceivedSponsorshipValues(first: ${PAGE_SIZE}, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        amountInCents
        sponsor {
          ... on User { login }
          ... on Organization { login }
        }
      }
    }
  }
}`;

// --- API client ----------------------------------------------------------------

/**
 * A failure that retrying won't fix, such as a missing, expired or
 * under-scoped token. The workflow only retries other failures.
 */
class NoRetryError extends Error {}
const NO_RETRY_EXIT_CODE = 2;

const SCOPE_HINT = 'SPONSORS_TOKEN needs to be a classic token of iiSmitty with the read:user scope';

function createGitHubClient(token) {
    const headers = {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': USER_AGENT
    };

    return async function query(text, variables) {
        let response;
        try {
            response = await fetch(GRAPHQL_API, { method: 'POST', headers, body: JSON.stringify({ query: text, variables }) });
        } catch (error) {
            // A network failure (DNS, TLS, a refused connection); kept as the cause
            throw new Error('POST /graphql failed', { cause: error });
        }
        const body = await response.text();
        let json = null;
        try {
            json = JSON.parse(body);
        } catch (e) {
            // Not JSON; reported below
        }

        // A bad or expired token. (A 403 can be a rate limit, so it's retried.)
        if (response.status === 401) {
            throw new NoRetryError(`GitHub refused the token: ${response.status} ${response.statusText}. ${SCOPE_HINT}`);
        }
        if (!response.ok || !json) {
            const detail = body.replace(/\s+/g, ' ').slice(0, 200);
            throw new Error(`POST /graphql failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }
        // GraphQL reports errors with a 200
        if (Array.isArray(json.errors) && json.errors.length) {
            const messages = json.errors.map(error => error && error.message).filter(Boolean).join('; ');
            if (json.errors.some(error => error && error.type === 'INSUFFICIENT_SCOPES')) {
                throw new NoRetryError(`${SCOPE_HINT}: ${messages}`);
            }
            throw new Error(`GraphQL error: ${messages}`);
        }
        return json.data;
    };
}

/** Every node of one of the user's connections, following the cursor page by page */
async function allNodes(query, text, field) {
    const nodes = [];
    let after = null;
    for (;;) {
        const data = await query(text, { login: SPONSORABLE, after });
        const connection = data && data.user && data.user[field];
        if (!connection || !Array.isArray(connection.nodes)) {
            throw new Error(`Unexpected GraphQL response for ${field}`);
        }
        nodes.push(...connection.nodes);
        if (!connection.pageInfo || !connection.pageInfo.hasNextPage) return nodes;
        after = connection.pageInfo.endCursor;
    }
}

async function fetchSponsorships(query) {
    const [sponsorships, lifetimeValues] = await Promise.all([
        allNodes(query, SPONSORSHIPS_QUERY, 'sponsorshipsAsMaintainer'),
        allNodes(query, LIFETIME_VALUES_QUERY, 'lifetimeReceivedSponsorshipValues')
    ]);
    return { sponsorships, lifetimeValues };
}

// --- Crediting the sponsors ---------------------------------------------------------

/**
 * A lifetime amount as coffees, to the nearest whole one. Every sponsor has
 * bought at least one, however small the amount (or if GitHub has no amount
 * for them yet, as with a payment still going through).
 */
function coffeesFor(amountInCents) {
    const cents = Number.isFinite(amountInCents) ? amountInCents : 0;
    return Math.max(1, Math.round(cents / COFFEE_PRICE_CENTS));
}

// Logins are case-insensitive on GitHub
const loginKey = login => login.toLowerCase();

/** Each sponsor's lifetime amount in cents, by login */
function amountsByLogin(lifetimeValues) {
    if (!Array.isArray(lifetimeValues)) throw new Error('Unexpected response for lifetimeReceivedSponsorshipValues');
    // GitHub answers a token without read:user with a null in place of each
    // amount, rather than an error. Crediting everyone with one coffee would
    // quietly be wrong, so stop instead.
    if (lifetimeValues.some(value => value === null)) {
        throw new NoRetryError(`GitHub hid the sponsorship amounts. ${SCOPE_HINT}`);
    }
    const amounts = new Map();
    for (const value of lifetimeValues) {
        const login = value.sponsor && value.sponsor.login;
        if (login) amounts.set(loginKey(login), value.amountInCents);
    }
    return amounts;
}

/**
 * The public sponsors, in the order they first sponsored, each with the
 * coffees they've bought. `since` is the month they first sponsored, which is
 * all the page shows.
 */
function creditSponsors(sponsorships, lifetimeValues) {
    if (!Array.isArray(sponsorships)) throw new Error('Unexpected response for sponsorshipsAsMaintainer');
    const amounts = amountsByLogin(lifetimeValues);

    // Earliest sponsorship per sponsor, should GitHub ever list one twice
    const earliest = new Map();
    for (const sponsorship of sponsorships) {
        // A null sponsorEntity is an account that has since been deleted
        const entity = sponsorship && sponsorship.sponsorEntity;
        if (!entity || !entity.login || sponsorship.privacyLevel !== 'PUBLIC') continue;
        const startedAt = Date.parse(sponsorship.createdAt);
        if (Number.isNaN(startedAt)) throw new Error(`No start date for @${entity.login}'s sponsorship`);

        const key = loginKey(entity.login);
        const seen = earliest.get(key);
        if (!seen || startedAt < seen.startedAt) earliest.set(key, { entity, startedAt });
    }

    return [...earliest.entries()]
        // Oldest first; the login breaks a tie, so the order never flips between runs
        .sort(([keyA, a], [keyB, b]) => a.startedAt - b.startedAt || keyA.localeCompare(keyB))
        .map(([key, { entity, startedAt }]) => ({
            login: entity.login,
            name: entity.name || null,
            since: new Date(startedAt).toISOString().slice(0, 7),
            coffees: coffeesFor(amounts.get(key))
        }));
}

// --- Change detection ------------------------------------------------------------

function storedSponsors(data) {
    return data && Array.isArray(data.sponsors) ? data.sponsors : [];
}

const displayName = sponsor => sponsor.name || `@${sponsor.login}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * An in-character commit message for what changed, or null when nothing did.
 * Alfred commits the coffee stats and the Videos folder too.
 */
function describeChange(stored, nextSponsors) {
    const before = storedSponsors(stored);
    if (JSON.stringify(before) === JSON.stringify(nextSponsors)) return null;

    const known = new Map(before.map(sponsor => [loginKey(sponsor.login), sponsor]));
    const newcomers = nextSponsors.filter(sponsor => !known.has(loginKey(sponsor.login)));
    const another = nextSponsors.find(sponsor => {
        const old = known.get(loginKey(sponsor.login));
        return old && sponsor.coffees > old.coffees;
    });

    let message;
    if (newcomers.length && before.length === 0) {
        message = `☕ Our first patron, sir: ${displayName(newcomers[0])}. The credits roll at last.`;
    } else if (newcomers.length) {
        message = `☕ A new patron: ${displayName(newcomers[0])}. I shall add them to the credits, sir.`;
    } else if (another) {
        message = `☕ ${displayName(another)} has stood you another round, sir. ` +
            `${plural(another.coffees, 'cappuccino', 'cappuccinos')} and counting.`;
    } else {
        message = '☕ The credits have been tidied, sir.';
    }

    // Names come from GitHub; keep the message to one line
    return message.replace(/[\r\n]+/g, ' ');
}

// --- Main ----------------------------------------------------------------------------

/**
 * An error's message followed by the chain of causes behind it. fetch reports
 * every network failure as just "fetch failed", with the actual reason in its
 * cause.
 */
function describeError(error) {
    const parts = [];
    for (let e = error; e !== undefined && e !== null && parts.length < 5; e = e.cause) {
        if (!(e instanceof Error)) {
            parts.push(String(e));
            break;
        }
        const code = typeof e.code === 'string' ? e.code : '';
        parts.push(e.message && code ? `${e.message} (${code})` : e.message || code || e.name);
    }
    return parts.join(': ');
}

function readStored() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
        return null; // first run
    }
}

/**
 * Writes the file if the credits changed, and returns the commit message for
 * the change, or null when there was none. `now` is a Date.
 */
function saveCredits(dataPath, stored, sponsors, now) {
    const message = describeChange(stored, sponsors);
    if (!message) return null;
    fs.writeFileSync(dataPath, JSON.stringify({ lastUpdated: now.toISOString(), sponsors }, null, 2) + '\n');
    return message;
}

async function main() {
    const token = process.env.SPONSORS_TOKEN;
    if (!token) {
        console.error('Missing required environment variable: SPONSORS_TOKEN');
        process.exit(NO_RETRY_EXIT_CODE);
    }

    const { sponsorships, lifetimeValues } = await fetchSponsorships(createGitHubClient(token));
    const sponsors = creditSponsors(sponsorships, lifetimeValues);
    console.log(`${plural(sponsors.length, 'public sponsor', 'public sponsors')}`);

    const message = saveCredits(DATA_PATH, readStored(), sponsors, new Date());
    if (!message) {
        console.log('No change in the credits');
        return;
    }
    console.log(message);
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `message=${message}\n`);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(describeError(error));
        process.exit(error instanceof NoRetryError ? NO_RETRY_EXIT_CODE : 1);
    });
}

module.exports = {
    COFFEE_PRICE_CENTS, NoRetryError, coffeesFor, createGitHubClient, creditSponsors, describeChange,
    describeError, fetchSponsorships, saveCredits
};
