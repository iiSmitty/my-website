const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quietSpell, noticeBody, notices, decide, MARKER } = require('../quiet-week.js');

const at = iso => Date.parse(iso);

const coffee = lastVisitAt => ({ totalSiteVisits: 161, lastVisitAt });
const watching = (...times) => ({ inProgress: times.map((lastWatchedAt, i) => ({ title: `Show ${i}`, traktId: i + 1, lastWatchedAt })) });

// Shaped like GET /repos/{repo}/issues
function notice(number, state, createdAt, login = 'waynemanor-butler', body = `Text.\n\n${MARKER}\n`) {
    return { number, state, created_at: createdAt, user: { login }, body };
}

const spell = { coffeeAt: at('2026-11-03T08:00:00Z'), watchedAt: at('2026-11-02T19:00:00Z') };

// --- the rule ---

test('quiet when both the last coffee and the latest episode are over a week old', () => {
    const now = at('2026-11-12T17:00:00Z');
    assert.deepEqual(quietSpell(coffee('2026-11-03T08:00:00Z'), watching('2026-11-02T19:00:00Z'), now), spell);
});

test('a recent coffee or a recent episode keeps the week from being quiet', () => {
    const now = at('2026-11-12T17:00:00Z');
    assert.equal(quietSpell(coffee('2026-11-10T08:00:00Z'), watching('2026-11-02T19:00:00Z'), now), null);
    assert.equal(quietSpell(coffee('2026-11-03T08:00:00Z'), watching('2026-11-11T19:00:00Z'), now), null);
});

test('the latest episode is the first show in progress, as on the site', () => {
    const now = at('2026-11-12T17:00:00Z');
    assert.equal(quietSpell(coffee('2026-11-03T08:00:00Z'), watching('2026-11-11T19:00:00Z', '2026-10-01T19:00:00Z'), now), null);
});

test('unknown dates never make a week quiet', () => {
    const now = at('2027-01-01T17:00:00Z');
    assert.equal(quietSpell(coffee(undefined), watching('2026-11-02T19:00:00Z'), now), null);
    assert.equal(quietSpell(coffee('2026-11-03T08:00:00Z'), { inProgress: [] }, now), null);
    assert.equal(quietSpell(null, null, now), null);
});

test('exactly seven days is not yet quiet', () => {
    const now = at('2026-11-10T08:00:00Z');
    assert.equal(quietSpell(coffee('2026-11-03T08:00:00Z'), watching('2026-11-02T19:00:00Z'), now), null);
});

// --- the notice ---

test('the notice says when, in SAST, and nothing more', () => {
    assert.equal(noticeBody(spell),
        'No coffee logged since 3 November, and no episode watched since 2 November.\n\n' +
        'I mention it for the record only. This notice will close itself when either resumes.\n\n' +
        `${MARKER}\n`);
});

test('only Alfred\'s marked issues are notices', () => {
    const found = notices([
        notice(1, 'open', '2026-11-10T17:00:00Z'),
        notice(2, 'open', '2026-11-10T17:00:00Z', 'iiSmitty'),
        notice(3, 'open', '2026-11-10T17:00:00Z', 'waynemanor-butler', 'Something else'),
        { ...notice(4, 'open', '2026-11-10T17:00:00Z'), pull_request: {} },
    ]);
    assert.deepEqual(found.map(issue => issue.number), [1]);
});

// --- deciding ---

test('a quiet spell with no notice gets one', () => {
    const decision = decide(spell, []);
    assert.equal(decision.action, 'open');
    assert.equal(decision.body, noticeBody(spell));
});

test('a spell is noted once, open or closed by hand', () => {
    assert.deepEqual(decide(spell, [notice(12, 'open', '2026-11-10T17:00:00Z')]), { action: 'none' });
    assert.deepEqual(decide(spell, [notice(12, 'closed', '2026-11-10T17:00:00Z')]), { action: 'none' });
});

test('a notice from an earlier spell doesn\'t cover a new one', () => {
    assert.equal(decide(spell, [notice(9, 'closed', '2026-09-20T17:00:00Z')]).action, 'open');
});

test('an open notice that is no longer true is closed', () => {
    assert.deepEqual(decide(null, [notice(12, 'open', '2026-11-10T17:00:00Z')]), { action: 'close', number: 12 });
});

test('not quiet and nothing open: nothing to do', () => {
    assert.deepEqual(decide(null, [notice(12, 'closed', '2026-11-10T17:00:00Z')]), { action: 'none' });
    assert.deepEqual(decide(null, []), { action: 'none' });
});
