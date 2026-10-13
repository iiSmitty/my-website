const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMessage } = require('../generate-commit-message.js');

const BEFORE = { totalSiteVisits: 164, currentBalance: 0, freeBeveragesRedeemed: 26, freeBeveragesAvailable: 6 };

// Each case runs many times, because every message is picked at random from a pool
function messages(oldStats, newStats) {
    return Array.from({ length: 50 }, () => buildMessage(oldStats, newStats));
}

test('a redeemed free coffee is announced with the new count', () => {
    for (const message of messages(BEFORE, { ...BEFORE, freeBeveragesRedeemed: 27, freeBeveragesAvailable: 5 })) {
        assert.match(message, /^☕ /);
        assert.match(message, /27/);
    }
});

test('a free coffee banked is an earned reward, not a redemption', () => {
    const earned = messages(BEFORE, { ...BEFORE, totalSiteVisits: 165, currentBalance: 0, freeBeveragesAvailable: 7 });
    const wrapped = messages({ ...BEFORE, currentBalance: 9 }, { ...BEFORE, totalSiteVisits: 165, currentBalance: 0 });
    for (const message of [...earned, ...wrapped]) {
        assert.doesNotMatch(message, /redeem|claimed|cashed/i);
        assert.doesNotMatch(message, /\d+\/10|visits/);
    }
});

test('a file from before the free coffee stats does not count as a redemption', () => {
    const { freeBeveragesRedeemed, freeBeveragesAvailable, ...old } = BEFORE;
    for (const message of messages(old, BEFORE)) {
        assert.doesNotMatch(message, /redeem|claimed|cashed/i);
    }
});

test('a stamp toward the next reward shows the balance', () => {
    for (const message of messages(BEFORE, { ...BEFORE, totalSiteVisits: 165, currentBalance: 2 })) {
        assert.match(message, /2\/10|2 of 10/);
    }
});
