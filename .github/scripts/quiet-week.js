/**
 * The quiet-week notice. When a week goes by with no coffee and no episode,
 * Alfred opens one plain issue saying so. It closes itself: his next coffee or
 * watching commit carries "Closes #N" (ledger.js), and GitHub closes the issue
 * when that commit lands on main.
 *
 * The rule is the site's own (js/pc-health.js): a week is quiet when both the
 * last coffee (coffee-stats.json lastVisitAt) and the latest episode
 * (watching.json inProgress[0].lastWatchedAt) are known and more than seven
 * days old. That is the week that makes the PC Tired.
 *
 *     node .github/scripts/quiet-week.js check
 *         Run daily by .github/workflows/quiet-week.yml. Opens the notice when
 *         a quiet spell has no notice yet. Closes an open notice that is no
 *         longer true, in case a commit didn't (a manual data fix, say).
 *
 *     node .github/scripts/quiet-week.js open-notice
 *         Prints the open notice's number, or nothing. The coffee and
 *         watching workflows pass it to ledger.js as QUIET_NOTICE.
 *
 * Restrained on purpose: one notice per quiet spell, no comments on it, no
 * follow-ups. Closing it by hand is respected; it isn't reopened until a
 * new spell begins.
 *
 * Env: GITHUB_REPOSITORY, GITHUB_TOKEN (reads), BUTLER_TOKEN (opening and
 * closing, as Alfred), DRY_RUN=1 to print instead.
 */

const fs = require('fs');
const path = require('path');
const { github, BUTLER } = require('./github-api.js');

const ROOT = path.join(__dirname, '..', '..');
const TIME_ZONE = 'Africa/Johannesburg';
const DAY_MS = 24 * 60 * 60 * 1000;
const QUIET_DAYS = 7;
const TITLE = 'A quiet week';
const MARKER = '<!-- quiet-week: opened by .github/workflows/quiet-week.yml -->';

function timeOf(iso) {
    const time = Date.parse(iso);
    return Number.isFinite(time) ? time : null;
}

/** "3 November" */
function dayAndMonth(time) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'long' }).format(new Date(time));
}

/**
 * The quiet spell, or null: when the last coffee and episode were, if both
 * are known and over a week old. Unknown dates never make a week quiet.
 */
function quietSpell(coffee, watching, now) {
    const coffeeAt = timeOf(coffee && coffee.lastVisitAt);
    const latest = watching && Array.isArray(watching.inProgress) && watching.inProgress[0];
    const watchedAt = timeOf(latest && latest.lastWatchedAt);
    const stale = time => time !== null && now - time > QUIET_DAYS * DAY_MS;
    return stale(coffeeAt) && stale(watchedAt) ? { coffeeAt, watchedAt } : null;
}

function noticeBody({ coffeeAt, watchedAt }) {
    return [
        `No coffee logged since ${dayAndMonth(coffeeAt)}, and no episode watched since ${dayAndMonth(watchedAt)}.`,
        '',
        'I mention it for the record only. This notice will close itself when either resumes.',
        '',
        MARKER,
        '',
    ].join('\n');
}

/** Alfred's quiet-week notices among issues as the API lists them */
function notices(issues) {
    return (issues || []).filter(issue => issue && !issue.pull_request &&
        issue.user && issue.user.login === BUTLER && typeof issue.body === 'string' && issue.body.includes(MARKER));
}

/**
 * What to do today: { action: 'open', body } | { action: 'close', number } | { action: 'none' }.
 * A spell is noted once: a notice opened since the last coffee and episode
 * covers it, open or closed.
 */
function decide(spell, issues) {
    const all = notices(issues);
    const open = all.find(issue => issue.state === 'open');
    if (!spell) return open ? { action: 'close', number: open.number } : { action: 'none' };
    const spellStarted = Math.max(spell.coffeeAt, spell.watchedAt);
    const noted = all.some(issue => timeOf(issue.created_at) > spellStarted);
    return noted ? { action: 'none' } : { action: 'open', body: noticeBody(spell) };
}

// --- running ---

function readJson(relativePath) {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^﻿/, ''));
    } catch (e) {
        return null;
    }
}

/** Alfred's newest 100 issues on the repo, open and closed */
function listIssues(repo, token) {
    return github(`/repos/${repo}/issues?state=all&creator=${BUTLER}&per_page=100`, token);
}

async function check({ repo, readToken, butlerToken, dryRun }) {
    const spell = quietSpell(readJson('data/coffee-stats.json'), readJson('data/watching.json'), Date.now());
    const decision = decide(spell, await listIssues(repo, readToken));

    if (decision.action === 'none') return console.log(spell ? 'A quiet week, already noted' : 'Not a quiet week');
    if (dryRun) return console.log(`Would ${decision.action}:`, decision.action === 'open' ? `\n${decision.body}` : `#${decision.number}`);

    if (decision.action === 'open') {
        const issue = await github(`/repos/${repo}/issues`, butlerToken, { method: 'POST', body: JSON.stringify({ title: TITLE, body: decision.body }) });
        console.log(`Opened #${issue.number}`);
    } else {
        await github(`/repos/${repo}/issues/${decision.number}`, butlerToken, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
        console.log(`Closed #${decision.number}`);
    }
}

async function openNotice({ repo, readToken }) {
    const open = notices(await listIssues(repo, readToken)).find(issue => issue.state === 'open');
    if (open) process.stdout.write(String(open.number));
}

async function main(command) {
    const { GITHUB_REPOSITORY: repo, GITHUB_TOKEN: readToken, BUTLER_TOKEN: butlerToken, DRY_RUN } = process.env;
    if (!repo || !readToken) throw new Error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
    if (command === 'open-notice') return openNotice({ repo, readToken });
    if (command !== 'check') throw new Error(`Unknown command "${command}". Use check or open-notice`);
    if (!butlerToken && !DRY_RUN) throw new Error('Missing BUTLER_TOKEN');
    return check({ repo, readToken, butlerToken, dryRun: Boolean(DRY_RUN) });
}

if (require.main === module) {
    main(process.argv[2]).catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { quietSpell, noticeBody, notices, decide, MARKER };
