const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasChanged, loginForm, readStats } = require('../coffee-fetcher.js');

// Shape matches what GetLoyaltyPanels actually returns (October 2026)

function panel(title, value, extra = {}) {
    return {
        title,
        value,
        icon: 'https://southafrica.blob.core.windows.net/content/sc/icons/local_cafe_blue.svg',
        id: null,
        isGiftable: false,
        giftPromptText: null,
        giftQtyIncrementRate: null,
        ...extra
    };
}

const PANELS = [
    panel('Total Site Visits', '164'),
    panel('Beverages Points Balance', '3'),
    panel('Free Beverages Redeemed', '26'),
    panel('Free Beverages Available', '6', { id: 'coffee', giftPromptText: 'Gift a free coffee', giftQtyIncrementRate: 1 })
];

test('readStats picks each stat by panel title', () => {
    assert.deepEqual(readStats(PANELS), { totalSiteVisits: 164, currentBalance: 3, freeBeveragesRedeemed: 26, freeBeveragesAvailable: 6 });
});

test('readStats does not depend on panel order', () => {
    assert.deepEqual(readStats([...PANELS].reverse()), { totalSiteVisits: 164, currentBalance: 3, freeBeveragesRedeemed: 26, freeBeveragesAvailable: 6 });
});

test('readStats names the missing panel and lists what it found', () => {
    assert.throws(
        () => readStats([panel('Total Site Visits', '164')]),
        /No "Beverages Points Balance" panel on the dashboard \(found: Total Site Visits=164\)/
    );
});

test('readStats rejects a non-numeric value', () => {
    assert.throws(() => readStats([panel('Total Site Visits', 'n/a'), panel('Beverages Points Balance', '0')]),
        /No "Total Site Visits" panel/);
});

test('readStats rejects a payload that is not a list', () => {
    assert.throws(() => readStats(null), /Unexpected response for GetLoyaltyPanels/);
});

test('loginForm sends a mobile number without the leading 0 or dial code', () => {
    const expected = { password: 'pw', dialCode: '+27', logonType: 2, typeValue: '821234567' };
    assert.deepEqual(loginForm('0821234567', 'pw'), expected);
    assert.deepEqual(loginForm('821234567', 'pw'), expected);
    assert.deepEqual(loginForm('+27 82 123 4567', 'pw'), expected);
});

test('loginForm sends an email as is', () => {
    assert.deepEqual(loginForm(' me@example.com ', 'pw'),
        { password: 'pw', dialCode: '+27', logonType: 1, typeValue: 'me@example.com' });
});

test('loginForm rejects a number that is not South African', () => {
    assert.throws(() => loginForm('12345', 'pw'), /South African mobile number/);
});

const STATS = { totalSiteVisits: 164, currentBalance: 3, freeBeveragesRedeemed: 26, freeBeveragesAvailable: 6 };

test('hasChanged ignores lastUpdated', () => {
    const stored = { ...STATS, lastUpdated: '2026-09-27T13:26:15.635Z', success: true };
    assert.equal(hasChanged(stored, STATS), false);
});

test('hasChanged notices any stat moving', () => {
    const stored = { ...STATS, lastUpdated: '2026-09-27T13:26:15.635Z', success: true };
    for (const field of Object.keys(STATS)) {
        assert.equal(hasChanged(stored, { ...STATS, [field]: STATS[field] + 1 }), true, field);
    }
});

test('hasChanged writes a file from before the free coffee stats, or none at all', () => {
    assert.equal(hasChanged({ totalSiteVisits: 164, currentBalance: 3, success: true }, STATS), true);
    assert.equal(hasChanged(null, STATS), true);
});
