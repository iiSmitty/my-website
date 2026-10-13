/**
 * Fetches my Seattle Coffee loyalty stats and writes data/coffee-stats.json
 * for Coffee Analytics (js/coffee-simple.js).
 *
 * Talks to the loyalty portal's API directly, making the same three calls as
 * the portal at seattle.loyalty-electronicline.com:
 *
 *  1. PreAuthentication: looks up the programme from the portal's hostname
 *  2. Authentication/Login: trades the credentials for a session token
 *  3. Dashboard/GetLoyaltyPanels: the stat cards shown on the dashboard
 *
 * The file is only written when one of the stats changes, so a quiet run
 * doesn't commit (and redeploy) the site. Any failure exits non-zero before
 * writing, so the site keeps showing the last good data.
 *
 * Usage: SEATTLE_COFFEE_USERNAME=... SEATTLE_COFFEE_PASSWORD=... node .github/scripts/coffee-fetcher.js
 */

const fs = require('fs');
const path = require('path');

const PORTAL_API = 'https://loyaltyportal-api.electronicline.com';
const PORTAL_HOST = 'seattle.loyalty-electronicline.com';
// The portal sends this with every request (configDbName in its environment)
const CONFIG_DB_NAME = 'loyalty_portal';
// The login form's dial code options are +27 and +264; my number is South African
const DIAL_CODE = '+27';
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'coffee-stats.json');

// Dashboard panel titles -> fields in coffee-stats.json
const PANELS = {
    totalSiteVisits: 'Total Site Visits',
    // Progress (out of 10) toward the next free coffee
    currentBalance: 'Beverages Points Balance',
    freeBeveragesRedeemed: 'Free Beverages Redeemed',
    // Earned but not yet claimed
    freeBeveragesAvailable: 'Free Beverages Available'
};

// --- API client ----------------------------------------------------------------

/**
 * The portal wraps every response as { code, message, payload }, and reports
 * failures in `code` and `message` even when the HTTP status is 200.
 */
async function call(method, pathname, { headers = {}, body } = {}) {
    const response = await fetch(`${PORTAL_API}${pathname}`, {
        method,
        headers: { accept: 'application/json', 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch (e) {
        // Not JSON; reported below
    }
    if (!response.ok || !json || json.code !== 200) {
        const detail = (json && json.message) || text.replace(/\s+/g, ' ').slice(0, 200);
        throw new Error(`${method} ${pathname} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
    }
    return json.payload;
}

/**
 * Mirrors the portal's login form. A phone number is sent without its dial
 * code or leading 0 (logonType 2); an email is sent as is (logonType 1).
 */
function loginForm(username, password) {
    const trimmed = username.trim();
    if (trimmed.includes('@')) {
        return { password, dialCode: DIAL_CODE, logonType: 1, typeValue: trimmed };
    }

    let mobile = trimmed.replace(/[\s-]/g, '');
    if (mobile.startsWith(DIAL_CODE)) mobile = mobile.slice(DIAL_CODE.length);
    if (mobile.startsWith('0')) mobile = mobile.slice(1);
    if (!/^\d{9}$/.test(mobile)) {
        throw new Error('SEATTLE_COFFEE_USERNAME must be an email or a South African mobile number');
    }
    return { password, dialCode: DIAL_CODE, logonType: 2, typeValue: mobile };
}

async function fetchPanels(username, password) {
    const programme = await call('GET', `/api/PreAuthentication?host=${PORTAL_HOST}`);
    const headers = {
        ProgrammeShortcode: programme.code,
        ProgrammeId: String(programme.programId),
        'x-db-name': CONFIG_DB_NAME
    };

    // The portal base64-encodes the form; it isn't encryption
    const privateData = Buffer.from(JSON.stringify(loginForm(username, password))).toString('base64');
    const session = await call('POST', '/api/Authentication/Login', { headers, body: { privateData } });
    const token = session && session.isLoggedOn && session.userModel && session.userModel.token;
    if (!token) throw new Error('Login did not return a session token');

    return call('GET', '/api/Dashboard/GetLoyaltyPanels', { headers: { ...headers, ElpToken: token } });
}

// --- Reading the stats ------------------------------------------------------------

/** Picks the stats out of the dashboard panels, matching on their titles */
function readStats(panels) {
    if (!Array.isArray(panels)) throw new Error('Unexpected response for GetLoyaltyPanels');

    const stats = {};
    for (const [field, title] of Object.entries(PANELS)) {
        const panel = panels.find(p => p && p.title === title);
        const value = panel ? Number.parseInt(panel.value, 10) : NaN;
        if (Number.isNaN(value)) {
            const seen = panels.map(p => p && `${p.title}=${p.value}`).join(', ');
            throw new Error(`No "${title}" panel on the dashboard (found: ${seen || 'none'})`);
        }
        stats[field] = value;
    }
    return stats;
}

function hasChanged(stored, stats) {
    return !stored || Object.keys(PANELS).some(field => stored[field] !== stats[field]);
}

// --- Main ----------------------------------------------------------------------------

function readStored() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (e) {
        return null; // first run
    }
}

async function main() {
    const username = process.env.SEATTLE_COFFEE_USERNAME;
    const password = process.env.SEATTLE_COFFEE_PASSWORD;
    if (!username || !password) {
        console.error('Missing required environment variables: SEATTLE_COFFEE_USERNAME, SEATTLE_COFFEE_PASSWORD');
        process.exit(1);
    }

    const stats = readStats(await fetchPanels(username, password));
    console.log('Coffee stats:', stats);

    if (!hasChanged(readStored(), stats)) {
        console.log('No change in the stats');
        return;
    }

    const next = { ...stats, lastUpdated: new Date().toISOString(), success: true };
    fs.writeFileSync(DATA_PATH, JSON.stringify(next, null, 2));
    console.log('Stats changed, file updated');
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { hasChanged, loginForm, readStats };
