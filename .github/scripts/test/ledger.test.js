const { test } = require('node:test');
const assert = require('node:assert/strict');
const { record, composeMessage, emptyLedger, ordinal, monthKey } = require('../ledger.js');

const DAY = 24 * 60 * 60 * 1000;
const at = iso => Date.parse(iso);

// Shapes match data/coffee-stats.json, watching.json and sponsors.json (November 2026)
function coffee(visits, lastVisitAt, extra = {}) {
    return { totalSiteVisits: visits, currentBalance: visits % 10, freeBeveragesRedeemed: 31, freeBeveragesAvailable: 1, lastVisitAt, ...extra };
}

function show(traktId, title, watched, aired, lastWatchedAt) {
    return { title, traktId, episode: { season: 1, number: watched }, watched, aired, lastWatchedAt };
}

function body(message) {
    return message.split('\n\n')[1];
}

// --- the message ---

test('the message is the subject, one paragraph of remarks, then trailers', () => {
    assert.equal(
        composeMessage('☕ Card stamped.', ['One.', 'Two.'], [['Ledger', '162 visits'], ['Entry', '24']]),
        '☕ Card stamped.\n\nOne. Two.\n\nLedger: 162 visits\nEntry: 24\n'
    );
});

test('no remarks leaves just the subject and the trailers', () => {
    assert.equal(composeMessage('☕ Tidied.', [], [['Entry', '3']]), '☕ Tidied.\n\nEntry: 3\n');
});

test('text from outside stays on one line', () => {
    assert.equal(composeMessage('📼 A\nB watched.', [], [['Watching', 'Line\none 3/9']]), '📼 A B watched.\n\nWatching: Line one 3/9\n');
});

test('ordinals', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal),
        ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
});

test('months are SAST: 23:30 UTC on 31 October is November in Johannesburg', () => {
    assert.equal(monthKey(at('2026-10-31T23:30:00Z')), '2026-11');
});

// --- entries ---

test('the entry number runs across all three sources', () => {
    const { ledger, message } = record('sponsors', {
        ledger: { entries: 2 }, before: null, after: { sponsors: [] }, now: at('2026-11-16T08:00:00Z'),
        subject: '☕ Tidied.', context: { entriesElsewhere: 20 },
    });
    assert.equal(ledger.entries, 3);
    assert.match(message, /\nEntry: 23\n$/);
});

test('every 50th entry, a word about himself comes first', () => {
    const { message } = record('sponsors', {
        ledger: { entries: 9 }, before: null, after: { sponsors: [] }, now: at('2026-11-16T08:00:00Z'),
        subject: '☕ Tidied.', context: { entriesElsewhere: 40 },
    });
    assert.equal(body(message), 'My 50th entry in this log, sir. I keep a copy.');
});

test('the ledger passed in is left alone', () => {
    const ledger = { entries: 1, visitsByMonth: { '2026-11': 1 }, longestGap: null };
    const copy = JSON.parse(JSON.stringify(ledger));
    record('coffee', {
        ledger, before: coffee(160, '2026-11-10T08:00:00Z'), after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x',
    });
    assert.deepEqual(ledger, copy);
});

test('a missing or partial ledger starts from empty', () => {
    const { ledger } = record('watching', { ledger: { entries: 4 }, before: null, after: {}, now: Date.now(), subject: 'x' });
    assert.deepEqual(ledger, { ...emptyLedger('watching'), entries: 5 });
});

// --- coffee ---

test('a visit: the month count, with the ledger and card as trailers', () => {
    const { ledger, message } = record('coffee', {
        ledger: { entries: 17, visitsByMonth: { '2026-11': 2 }, longestGap: { days: 30, endedAt: '2026-01-05T08:00:00Z' } },
        before: coffee(160, '2026-11-10T08:00:00Z'), after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: '☕ A fresh visit logged — 1/10.', context: { entriesElsewhere: 5 },
    });
    assert.equal(message, '☕ A fresh visit logged — 1/10.\n\nThe 3rd visit this month.\n\nLedger: 161 visits, 31 free, 1 in reserve\nCard: 1/10\nEntry: 23\n');
    assert.equal(ledger.visitsByMonth['2026-11'], 3);
});

test('a visit after a week away is mentioned', () => {
    const { message } = record('coffee', {
        ledger: { visitsByMonth: {}, longestGap: { days: 30, endedAt: '2026-01-05T08:00:00Z' } },
        before: coffee(160, '2026-11-01T08:00:00Z'), after: coffee(161, '2026-11-12T09:00:00Z'),
        now: at('2026-11-12T09:00:00Z'), subject: 'x',
    });
    assert.equal(body(message), 'The first visit in 11 days. The 1st visit this month.');
});

test('the longest gap on record is noted and remembered', () => {
    const { ledger, message } = record('coffee', {
        ledger: { visitsByMonth: {}, longestGap: { days: 9, endedAt: '2026-01-05T08:00:00Z' } },
        before: coffee(160, '2026-10-20T08:00:00Z'), after: coffee(161, '2026-11-12T08:00:00Z'),
        now: at('2026-11-12T08:00:00Z'), subject: 'x',
    });
    assert.match(body(message), /^The first visit in 23 days, the longest gap in my records\./);
    assert.deepEqual(ledger.longestGap, { days: 23, endedAt: '2026-11-12T08:00:00.000Z' });
});

test('several visits in one report, and overtaking last month', () => {
    const { message } = record('coffee', {
        ledger: { visitsByMonth: { '2026-10': 5, '2026-11': 4 } },
        before: coffee(158, '2026-11-13T08:00:00Z'), after: coffee(160, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x',
    });
    assert.equal(body(message), '2 visits since my last report. That makes 6 this month, already more than all of October.');
});

test('overtaking last month is only said once', () => {
    const { message } = record('coffee', {
        ledger: { visitsByMonth: { '2026-10': 5, '2026-11': 6 } },
        before: coffee(160, '2026-11-13T08:00:00Z'), after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x',
    });
    assert.equal(body(message), 'The 7th visit this month.');
});

test('a free cup redeemed without a visit adds no remark', () => {
    const { ledger, message } = record('coffee', {
        ledger: { visitsByMonth: { '2026-11': 2 } },
        before: coffee(161, '2026-11-14T08:00:00Z', { freeBeveragesRedeemed: 30, freeBeveragesAvailable: 2 }),
        after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-15T08:00:00Z'), subject: '☕ Free coffee #31 acquired.',
    });
    assert.equal(message, '☕ Free coffee #31 acquired.\n\nLedger: 161 visits, 31 free, 1 in reserve\nCard: 1/10\nEntry: 1\n');
    assert.deepEqual(ledger.visitsByMonth, { '2026-11': 2 });
});

test('the very first data file is not a visit', () => {
    const { message } = record('coffee', { ledger: null, before: null, after: coffee(161), now: Date.now(), subject: 'x' });
    assert.equal(body(message).startsWith('Ledger:'), true);
});

// --- watching ---

const firstSeen = '2026-10-01T08:00:00.000Z';

test('episodes are counted from what the ledger last saw, per show', () => {
    const { ledger, message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 60, firstSeenAt: '2026-11-10T08:00:00Z', firstWatched: 60 } } },
        before: { inProgress: [show(1399, 'House', 60, 177, '2026-11-08T20:00:00Z')] },
        after: { inProgress: [show(1399, 'House', 62, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: '📼 House S3E16 watched.',
    });
    assert.equal(ledger.episodesByMonth['2026-11'], 2);
    assert.equal(ledger.shows[1399].watched, 62);
    assert.equal(message, '📼 House S3E16 watched.\n\n2 episodes this month so far.\n\nWatching: House 62/177\nEntry: 1\n');
});

test('a show that drops out of the list and comes back is not counted twice', () => {
    const ledger = { shows: { 1399: { title: 'House', watched: 62, firstSeenAt: firstSeen, firstWatched: 50 } }, episodesByMonth: { '2026-11': 2 } };
    const { ledger: next } = record('watching', {
        ledger, before: { inProgress: [] },
        after: { inProgress: [show(1399, 'House', 63, 177, '2026-11-20T20:00:00Z')] },
        now: at('2026-11-23T02:00:00Z'), subject: 'x',
    });
    assert.equal(next.episodesByMonth['2026-11'], 3);
});

test('episodes count in the month they were watched', () => {
    const { ledger } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 60, firstSeenAt: firstSeen, firstWatched: 50 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 61, 177, '2026-10-31T20:00:00Z')] },
        now: at('2026-11-02T02:00:00Z'), subject: 'x',
    });
    assert.deepEqual(ledger.episodesByMonth, { '2026-10': 1 });
});

test('a finished series counts its last episodes and adds to the tally', () => {
    const { ledger, message } = record('watching', {
        ledger: { seriesFinished: 1, shows: { 155536: { title: 'Reacher', watched: 30, firstSeenAt: firstSeen, firstWatched: 24 } } },
        before: { inProgress: [show(155536, 'Reacher', 30, 32, '2026-09-10T19:00:00Z')], previous: null },
        after: { inProgress: [], previous: { title: 'Reacher', traktId: 155536, episodes: 32, finishedAt: '2026-09-16T19:00:00Z' } },
        now: at('2026-09-21T02:00:00Z'), subject: '📼 Reacher finished.',
    });
    assert.equal(ledger.seriesFinished, 2);
    assert.equal(ledger.shows[155536], undefined);
    assert.deepEqual(ledger.episodesByMonth, { '2026-09': 2 });
    assert.equal(body(message), 'The 2nd series finished since I began keeping count. 2 episodes this month so far.');
});

test('a busy week, and no coffee to go with it', () => {
    const { message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 60, firstSeenAt: '2026-11-10T08:00:00Z', firstWatched: 60 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 66, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x', context: { coffee: { lastVisitAt: '2026-11-03T08:00:00Z' } },
    });
    assert.match(body(message), /^6 episodes since my last report, and no coffee since 3 November\./);
});

test('a busy week with recent coffee says nothing about coffee', () => {
    const { message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 60, firstSeenAt: '2026-11-10T08:00:00Z', firstWatched: 60 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 66, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x', context: { coffee: { lastVisitAt: '2026-11-14T08:00:00Z' } },
    });
    assert.match(body(message), /^6 episodes since my last report\. /);
});

test('a forecast once the ledger has watched a show long enough', () => {
    // 12 episodes in 6 weeks (2 a week), 115 to go: about 57 weeks
    const { message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 61, firstSeenAt: '2026-10-05T02:00:00Z', firstWatched: 50 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 62, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x',
    });
    assert.match(body(message), /^At the present rate, House concludes in December 2027\. I have pencilled it in\./);
});

test('no forecast from too little to go on', () => {
    const { message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 61, firstSeenAt: '2026-11-01T02:00:00Z', firstWatched: 50 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 62, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x',
    });
    assert.doesNotMatch(body(message), /present rate/);
});

test('a show seen for the first time is remembered from where it stands', () => {
    const { ledger } = record('watching', {
        ledger: null, before: {}, after: { inProgress: [show(285631, 'The Celebrity Traitors', 4, 9, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x',
    });
    assert.deepEqual(ledger.shows[285631], { title: 'The Celebrity Traitors', watched: 4, firstSeenAt: '2026-11-16T02:00:00.000Z', firstWatched: 4 });
});

// --- sponsors ---

test('another coffee from a patron', () => {
    const { message } = record('sponsors', {
        ledger: null, before: { sponsors: [{ login: 'a', coffees: 2 }] }, after: { sponsors: [{ login: 'a', coffees: 3 }] },
        now: Date.now(), subject: '☕ Another round.', context: { coffee: { freeBeveragesRedeemed: 31 } },
    });
    assert.equal(message, '☕ Another round.\n\nThat makes 3 coffees from patrons in all.\n\nPatrons: 1, 3 coffees stood\nEntry: 1\n');
});

test('patrons overtaking the loyalty card is noted once', () => {
    const overtaking = record('sponsors', {
        ledger: null, before: { sponsors: [{ login: 'a', coffees: 31 }] }, after: { sponsors: [{ login: 'a', coffees: 32 }] },
        now: Date.now(), subject: 'x', context: { coffee: { freeBeveragesRedeemed: 31 } },
    });
    assert.match(body(overtaking.message), /more coffees than the loyalty card has given away\. I make no comment\./);

    const after = record('sponsors', {
        ledger: null, before: { sponsors: [{ login: 'a', coffees: 32 }] }, after: { sponsors: [{ login: 'a', coffees: 33 }] },
        now: Date.now(), subject: 'x', context: { coffee: { freeBeveragesRedeemed: 31 } },
    });
    assert.equal(body(after.message), 'That makes 33 coffees from patrons in all.');
});

test('at most two remarks', () => {
    const { message } = record('coffee', {
        ledger: { entries: 9, visitsByMonth: { '2026-10': 2, '2026-11': 2 }, longestGap: { days: 3 } },
        before: coffee(158, '2026-10-20T08:00:00Z'), after: coffee(160, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x', context: { entriesElsewhere: 40 },
    });
    assert.equal(body(message), 'My 50th entry in this log, sir. I keep a copy. The first visit in 25 days, the longest gap in my records.');
});

// --- the quiet-week notice ---

test('a visit during a quiet-week notice closes it, plainly', () => {
    const { message } = record('coffee', {
        ledger: { visitsByMonth: {}, longestGap: { days: 88 } },
        before: coffee(160, '2026-11-01T08:00:00Z'), after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: '☕ A fresh visit logged — 1/10.', context: { quietNotice: 12 },
    });
    assert.equal(message,
        '☕ A fresh visit logged — 1/10.\n\nThe first visit in 13 days. Normal service resumes, sir.\n\nCloses #12\n\n' +
        'Ledger: 161 visits, 31 free, 1 in reserve\nCard: 1/10\nEntry: 1\n');
});

test('an episode during a quiet-week notice closes it', () => {
    const { message } = record('watching', {
        ledger: { shows: { 1399: { title: 'House', watched: 62, firstSeenAt: '2026-11-10T08:00:00Z', firstWatched: 62 } } },
        before: {}, after: { inProgress: [show(1399, 'House', 63, 177, '2026-11-15T20:00:00Z')] },
        now: at('2026-11-16T02:00:00Z'), subject: 'x', context: { quietNotice: 7 },
    });
    assert.match(message, /\n\n1 episode this month so far\. Normal service resumes, sir\.\n\nCloses #7\n\n/);
});

test('a change that is not a coffee or an episode leaves the notice open', () => {
    const redeemed = record('coffee', {
        ledger: null, before: coffee(161, '2026-11-01T08:00:00Z', { freeBeveragesRedeemed: 30 }), after: coffee(161, '2026-11-01T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x', context: { quietNotice: 12 },
    });
    const patron = record('sponsors', {
        ledger: null, before: { sponsors: [] }, after: { sponsors: [{ login: 'a', coffees: 1 }] },
        now: at('2026-11-14T08:00:00Z'), subject: 'x', context: { quietNotice: 12 },
    });
    for (const { message } of [redeemed, patron]) {
        assert.doesNotMatch(message, /Closes|Normal service/);
    }
});

test('no notice, no closing line', () => {
    const { message } = record('coffee', {
        ledger: null, before: coffee(160, '2026-11-13T08:00:00Z'), after: coffee(161, '2026-11-14T08:00:00Z'),
        now: at('2026-11-14T08:00:00Z'), subject: 'x', context: { quietNotice: null },
    });
    assert.doesNotMatch(message, /Closes|Normal service/);
});
