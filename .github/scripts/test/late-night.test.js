const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLate, nightOf, latestLateCommit, spokeRecently, lateNightsThisWeek, remark } = require('../late-night.js');

const at = iso => Date.parse(iso);

// Shaped like a push event's commits (timestamps carry the committer's offset)
function commit(id, timestamp, username = 'iiSmitty', distinct = true) {
    return { id, timestamp, distinct, author: { name: 'Someone', username } };
}

test('late is 22:00 to 04:59 SAST', () => {
    assert.equal(isLate(at('2026-11-16T21:59:00+02:00')), false);
    assert.equal(isLate(at('2026-11-16T22:00:00+02:00')), true);
    assert.equal(isLate(at('2026-11-17T02:14:00+02:00')), true);
    assert.equal(isLate(at('2026-11-17T04:59:00+02:00')), true);
    assert.equal(isLate(at('2026-11-17T05:00:00+02:00')), false);
});

test('late is judged in SAST whatever offset the commit carries', () => {
    assert.equal(isLate(at('2026-11-16T20:30:00Z')), true);      // 22:30 SAST
    assert.equal(isLate(at('2026-11-16T22:30:00+02:00')), true);
    assert.equal(isLate(at('2026-11-16T22:30:00+04:00')), false); // 20:30 SAST
});

test('a night is named by its evening', () => {
    assert.deepEqual(nightOf(at('2026-11-21T01:10:00+02:00')), { key: '2026-11-20', weekday: 'Friday' });
    assert.deepEqual(nightOf(at('2026-11-20T23:10:00+02:00')), { key: '2026-11-20', weekday: 'Friday' });
});

test('the latest of the owner\'s late commits in the push', () => {
    const picked = latestLateCommit([
        commit('a1', '2026-11-16T22:10:00+02:00'),
        commit('b2', '2026-11-17T01:30:00+02:00'),
        commit('c3', '2026-11-17T09:00:00+02:00'),
    ], 'iiSmitty');
    assert.equal(picked.id, 'b2');
});

test('automation, other people and commits already pushed elsewhere never count', () => {
    assert.equal(latestLateCommit([
        commit('a1', '2026-11-17T01:30:00+02:00', 'waynemanor-butler'),
        commit('b2', '2026-11-17T01:30:00+02:00', 'someone-else'),
        commit('c3', '2026-11-17T01:30:00+02:00', 'iiSmitty', false),
        { id: 'd4', timestamp: '2026-11-17T01:30:00+02:00', author: { name: 'No account' } },
    ], 'iiSmitty'), null);
});

test('a daytime push, or none at all, gives nothing', () => {
    assert.equal(latestLateCommit([commit('a1', '2026-11-16T15:00:00+02:00')], 'iiSmitty'), null);
    assert.equal(latestLateCommit(undefined, 'iiSmitty'), null);
});

test('at most once a week, counting only Alfred\'s comments', () => {
    const now = at('2026-11-20T23:00:00+02:00');
    assert.equal(spokeRecently([{ user: { login: 'waynemanor-butler' }, created_at: '2026-11-15T00:00:00Z' }], now), true);
    assert.equal(spokeRecently([{ user: { login: 'waynemanor-butler' }, created_at: '2026-11-13T00:00:00Z' }], now), false);
    assert.equal(spokeRecently([{ user: { login: 'iiSmitty' }, created_at: '2026-11-20T00:00:00Z' }], now), false);
    assert.equal(spokeRecently([], now), false);
});

test('late nights this week are counted as nights, not commits', () => {
    const now = at('2026-11-21T01:00:00+02:00');
    const times = [
        '2026-11-13T23:00:00+02:00', // more than a week ago
        '2026-11-16T22:30:00+02:00', // Monday night
        '2026-11-17T00:40:00+02:00', // still Monday night
        '2026-11-18T14:00:00+02:00', // daytime
        '2026-11-19T23:15:00+02:00', // Thursday night
        '2026-11-21T00:55:00+02:00', // Friday night
    ].map(at);
    assert.equal(lateNightsThisWeek(times, now), 3);
});

test('the evening, the small hours and before dawn each have their own lines', () => {
    assert.match(remark(at('2026-11-17T22:40:00+02:00'), 'aaaaaa', 1), /^22:40[,.] /);
    assert.match(remark(at('2026-11-18T02:14:00+02:00'), '000000', 1), /^It is 02:14, sir\. The repository will still be here in the morning\.$/);
    assert.match(remark(at('2026-11-18T03:52:00+02:00'), '000000', 1), /^03:52\. The birds will be up before long, sir\.$/);
});

test('the line is the same for the same commit', () => {
    const time = at('2026-11-17T23:05:00+02:00');
    assert.equal(remark(time, 'f37ecd1', 1), remark(time, 'f37ecd1', 1));
});

test('Friday and Saturday nights', () => {
    assert.equal(remark(at('2026-11-21T01:10:00+02:00'), '000000', 1), 'A Friday night, and 01:10. I shan\'t ask.');
    assert.equal(remark(at('2026-11-21T23:20:00+02:00'), '000000', 1), 'A Saturday night, and 23:20. I shan\'t ask.');
});

test('a third late night in a week is mentioned, for the record', () => {
    assert.equal(remark(at('2026-11-19T23:15:00+02:00'), '000000', 3), '23:15, and the 3rd late night this week. I mention it only for the record.');
});
