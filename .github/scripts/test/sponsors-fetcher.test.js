const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    NoRetryError, coffeesFor, createGitHubClient, creditSponsors, describeChange, describeError, fetchSponsorships, saveCredits
} = require('../sponsors-fetcher.js');

// Shapes match what GitHub's GraphQL API returns for iiSmitty (November 2026)

function sponsorship(login, name, createdAt, privacyLevel = 'PUBLIC') {
    return { createdAt, privacyLevel, sponsorEntity: { login, name } };
}

function lifetimeValue(login, amountInCents) {
    return { amountInCents, sponsor: { login } };
}

const WILHELM = sponsorship('wkirschbaum', 'Wilhelm Kirschbaum', '2026-11-05T09:12:44Z');

// --- Coffees, never dollars --------------------------------------------------------

test('a lifetime amount is counted in coffees of about $2.50, to the nearest whole one', () => {
    assert.equal(coffeesFor(500), 2);
    assert.equal(coffeesFor(250), 1);
    assert.equal(coffeesFor(375), 2); // half a coffee rounds up
    assert.equal(coffeesFor(600), 2);
    assert.equal(coffeesFor(10000), 40);
});

test('every sponsor has bought at least one coffee', () => {
    assert.equal(coffeesFor(100), 1);
    assert.equal(coffeesFor(0), 1);
    assert.equal(coffeesFor(undefined), 1);
});

test('a sponsor is credited with coffees and no amount', () => {
    const [credit] = creditSponsors([WILHELM], [lifetimeValue('wkirschbaum', 500)]);
    assert.deepEqual(credit, { login: 'wkirschbaum', name: 'Wilhelm Kirschbaum', since: '2026-11', coffees: 2 });
});

test('a sponsor GitHub has no amount for yet still gets a coffee', () => {
    const [credit] = creditSponsors([WILHELM], []);
    assert.equal(credit.coffees, 1);
});

test('amounts are matched to sponsors whatever the case of their login', () => {
    const [credit] = creditSponsors([WILHELM], [lifetimeValue('WKirschbaum', 1250)]);
    assert.equal(credit.coffees, 5);
});

// What GitHub really answered for Wilhelm's $5 one-time sponsorship, in its
// probation: the tier's amount, and a null lifetime amount
test('a lifetime amount GitHub withholds falls back to the tier\'s amount', () => {
    const [credit] = creditSponsors([{ ...WILHELM, tier: { monthlyPriceInCents: 500 } }], [null]);
    assert.equal(credit.coffees, 2);
});

test('a lifetime amount, when GitHub gives one, wins over the tier\'s', () => {
    // A monthly sponsor's tier is one month; the lifetime amount is all of them
    const [credit] = creditSponsors([{ ...WILHELM, tier: { monthlyPriceInCents: 500 } }],
        [lifetimeValue('wkirschbaum', 3000)]);
    assert.equal(credit.coffees, 12);
});

// --- Privacy -------------------------------------------------------------------------

test('only public sponsors are credited', () => {
    const credits = creditSponsors([
        WILHELM,
        sponsorship('quietone', 'Quiet One', '2026-11-06T10:00:00Z', 'PRIVATE')
    ], [lifetimeValue('wkirschbaum', 500), lifetimeValue('quietone', 10000)]);
    assert.deepEqual(credits.map(credit => credit.login), ['wkirschbaum']);
});

test('a private sponsor\'s coffees count toward nothing', () => {
    const credits = creditSponsors([sponsorship('quietone', 'Quiet One', '2026-11-06T10:00:00Z', 'PRIVATE')],
        [lifetimeValue('quietone', 10000)]);
    assert.deepEqual(credits, []);
});

test('a sponsorship without a privacy level is treated as private', () => {
    const { privacyLevel, ...unknown } = WILHELM;
    assert.deepEqual(creditSponsors([unknown], []), []);
});

test('a sponsor whose account has been deleted is left out', () => {
    const ghost = { createdAt: '2026-11-01T00:00:00Z', privacyLevel: 'PUBLIC', sponsorEntity: null };
    assert.deepEqual(creditSponsors([ghost, WILHELM], []).map(credit => credit.login), ['wkirschbaum']);
});

test('the private sponsorships are never asked for, past ones are', async (t) => {
    const requests = fakeGitHub(t, () => page([], []));
    await fetchSponsorships(createGitHubClient('token'));
    const query = requests.map(request => request.body.query).find(text => text.includes('sponsorshipsAsMaintainer'));
    assert.match(query, /includePrivate: false/);
    assert.match(query, /activeOnly: false/);
});

// --- Order ---------------------------------------------------------------------------

test('sponsors are listed in the order they first sponsored, not by how much', () => {
    const credits = creditSponsors([
        sponsorship('latecomer', 'Late Comer', '2027-02-01T08:00:00Z'),
        WILHELM,
        sponsorship('middle', null, '2026-12-24T18:00:00Z')
    ], [lifetimeValue('latecomer', 50000), lifetimeValue('wkirschbaum', 500), lifetimeValue('middle', 250)]);
    assert.deepEqual(credits.map(credit => credit.login), ['wkirschbaum', 'middle', 'latecomer']);
    assert.deepEqual(credits.map(credit => credit.since), ['2026-11', '2026-12', '2027-02']);
});

test('two sponsors who started at the same moment keep a steady order', () => {
    const at = '2026-11-05T09:12:44Z';
    const credits = creditSponsors([sponsorship('zed', null, at), sponsorship('amy', null, at)], []);
    assert.deepEqual(credits.map(credit => credit.login), ['amy', 'zed']);
});

test('a sponsor listed twice is credited once, from their first sponsorship', () => {
    const credits = creditSponsors([
        sponsorship('wkirschbaum', 'Wilhelm Kirschbaum', '2027-03-01T00:00:00Z'),
        WILHELM
    ], [lifetimeValue('wkirschbaum', 1000)]);
    assert.equal(credits.length, 1);
    assert.equal(credits[0].since, '2026-11');
    assert.equal(credits[0].coffees, 4);
});

test('a sponsor with no name is credited by login', () => {
    const [credit] = creditSponsors([sponsorship('nameless', null, '2026-11-05T00:00:00Z')], []);
    assert.equal(credit.name, null);
    assert.equal(describeChange(null, [credit]), '☕ Our first patron, sir: @nameless. The credits roll at last.');
});

// --- Writing only what changed -------------------------------------------------------

const CREDIT = { login: 'wkirschbaum', name: 'Wilhelm Kirschbaum', since: '2026-11', coffees: 2 };
const NOW = new Date('2026-11-12T06:00:00.000Z');

function tempDataPath(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sponsors-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return path.join(dir, 'sponsors.json');
}

test('the file is written when the credits change, with coffees and no amounts', (t) => {
    const dataPath = tempDataPath(t);
    const message = saveCredits(dataPath, null, [CREDIT], NOW);

    assert.equal(message, '☕ Our first patron, sir: Wilhelm Kirschbaum. The credits roll at last.');
    const written = fs.readFileSync(dataPath, 'utf8');
    assert.deepEqual(JSON.parse(written), { lastUpdated: '2026-11-12T06:00:00.000Z', sponsors: [CREDIT] });
    assert.doesNotMatch(written, /amount|cents|\$|USD/i);
    assert.ok(written.endsWith('\n'));
});

test('a run with no change leaves the file alone', (t) => {
    const dataPath = tempDataPath(t);
    const stored = { lastUpdated: '2026-11-05T06:00:00.000Z', sponsors: [CREDIT] };
    fs.writeFileSync(dataPath, JSON.stringify(stored));

    assert.equal(saveCredits(dataPath, stored, [{ ...CREDIT }], NOW), null);
    assert.equal(fs.readFileSync(dataPath, 'utf8'), JSON.stringify(stored));
});

test('no sponsors at all, and none before, is no change either', (t) => {
    const dataPath = tempDataPath(t);
    const stored = { lastUpdated: '2026-11-05T06:00:00.000Z', sponsors: [] };
    assert.equal(saveCredits(dataPath, stored, [], NOW), null);
    assert.equal(fs.existsSync(dataPath), false);
});

// --- Commit messages -----------------------------------------------------------------

test('a new patron after the first is welcomed by name', () => {
    const newcomer = { login: 'second', name: 'Second Patron', since: '2026-12', coffees: 1 };
    assert.equal(describeChange({ sponsors: [CREDIT] }, [CREDIT, newcomer]),
        '☕ A new patron: Second Patron. I shall add them to the credits, sir.');
});

test('a sponsor buying another round is noticed', () => {
    assert.equal(describeChange({ sponsors: [CREDIT] }, [{ ...CREDIT, coffees: 4 }]),
        '☕ Wilhelm Kirschbaum has stood you another round, sir. 4 cappuccinos and counting.');
});

test('any other change, like a sponsor going private, is a tidy-up', () => {
    assert.equal(describeChange({ sponsors: [CREDIT] }, []), '☕ The credits have been tidied, sir.');
    assert.equal(describeChange({ sponsors: [CREDIT] }, [{ ...CREDIT, name: 'Wilhelm K.' }]),
        '☕ The credits have been tidied, sir.');
});

test('a name with a line break still makes a one-line message', () => {
    assert.equal(describeChange(null, [{ ...CREDIT, name: 'Wilhelm\nKirschbaum' }]),
        '☕ Our first patron, sir: Wilhelm Kirschbaum. The credits roll at last.');
});

// --- Talking to GitHub ---------------------------------------------------------------

/** One page of each connection: `sponsorships` and `values` are its nodes */
function page(sponsorships, values, next = null) {
    const pageInfo = { hasNextPage: next !== null, endCursor: next };
    return {
        sponsorshipsAsMaintainer: { pageInfo, nodes: sponsorships },
        lifetimeReceivedSponsorshipValues: { pageInfo, nodes: values }
    };
}

/** Stands in for the GraphQL API: `answer` gets each request's variables and returns the user, or a Response */
function fakeGitHub(t, answer) {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        const body = JSON.parse(init.body);
        requests.push({ url, init, body });
        const result = answer(body.variables, body.query);
        // A copy, as both lists are asked for at once and a body reads only once
        if (result instanceof Response) return result.clone();
        if (result instanceof Error) throw result;
        const field = body.query.includes('sponsorshipsAsMaintainer') ? 'sponsorshipsAsMaintainer' : 'lifetimeReceivedSponsorshipValues';
        return Response.json({ data: { user: { [field]: result[field] } } });
    });
    return requests;
}

test('every page of both lists is read, following the cursor', async (t) => {
    const second = sponsorship('second', 'Second Patron', '2026-12-01T00:00:00Z');
    const requests = fakeGitHub(t, ({ after }) => after === null
        ? page([WILHELM], [lifetimeValue('wkirschbaum', 500)], 'cursor-1')
        : page([second], [lifetimeValue('second', 250)]));

    const { sponsorships, lifetimeValues } = await fetchSponsorships(createGitHubClient('token'));
    assert.equal(sponsorships.length, 2);
    assert.equal(lifetimeValues.length, 2);
    assert.equal(requests.length, 4);
    assert.ok(requests.every(request => request.body.variables.login === 'iiSmitty'));
    assert.deepEqual(requests.map(request => request.body.variables.after).sort(), ['cursor-1', 'cursor-1', null, null]);
    assert.equal(requests[0].url, 'https://api.github.com/graphql');
    assert.equal(requests[0].init.headers.authorization, 'bearer token');
});

test('a token missing read:user is not retried', async (t) => {
    fakeGitHub(t, () => Response.json({
        errors: [{ type: 'INSUFFICIENT_SCOPES', message: "The 'createdAt' field requires one of the following scopes: ['read:user']" }]
    }));
    await assert.rejects(fetchSponsorships(createGitHubClient('token')), (error) => {
        assert.ok(error instanceof NoRetryError);
        assert.match(error.message, /read:user/);
        return true;
    });
});

test('a bad or expired token is not retried', async (t) => {
    fakeGitHub(t, () => Response.json({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' }));
    await assert.rejects(fetchSponsorships(createGitHubClient('token')), NoRetryError);
});

test('other failures can be retried', async (t) => {
    for (const failure of [
        new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
        new Response('{"message":"API rate limit exceeded"}', { status: 403, statusText: 'Forbidden' }),
        Response.json({ errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }),
        Response.json({ data: { user: null } }),
        new TypeError('fetch failed')
    ]) {
        fakeGitHub(t, () => failure);
        await assert.rejects(fetchSponsorships(createGitHubClient('token')), (error) => !(error instanceof NoRetryError));
        t.mock.restoreAll();
    }
});

test('a network failure keeps the reason fetch hides in its cause', async (t) => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.github.com'), { code: 'ENOTFOUND' });
    fakeGitHub(t, () => new TypeError('fetch failed', { cause }));
    await assert.rejects(fetchSponsorships(createGitHubClient('token')), (error) => {
        assert.equal(describeError(error),
            'POST /graphql failed: fetch failed: getaddrinfo ENOTFOUND api.github.com (ENOTFOUND)');
        return true;
    });
});
