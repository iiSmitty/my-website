/**
 * Alfred notices late nights. When the owner pushes a commit made between
 * 22:00 and 04:59 SAST, Alfred comments on it, at most once a week.
 *
 * Run by .github/workflows/late-night.yml on every push to main. It reads the
 * push from the event payload and posts as Alfred with BUTLER_TOKEN, a classic
 * token from the waynemanor-butler account with only the public_repo scope.
 * Reads use the workflow's own GITHUB_TOKEN.
 *
 * He only remarks on what the timestamps show: the time, the night of the
 * week, and how many late nights this week. Nothing here can affect a data
 * workflow; the worst a failure does is skip a comment.
 *
 * Env: GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER, GITHUB_EVENT_PATH,
 * GITHUB_TOKEN, BUTLER_TOKEN, and DRY_RUN=1 to print the comment instead.
 */

const fs = require('fs');
const { github, BUTLER } = require('./github-api.js');

const TIME_ZONE = 'Africa/Johannesburg';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LATE_FROM = 22;          // a night runs from 22:00
const LATE_UNTIL = 5;          // to 04:59 the next morning
const QUIET_FOR_DAYS = 7;      // at most one comment a week
const PATTERN_NIGHTS = 3;      // this many late nights in a week gets mentioned

const EVENING = [
    t => `${t}, sir. I'll leave the hall light on.`,
    t => `${t}. Most of the house has turned in, sir.`,
    t => `${t}. I have wound the clocks and locked the doors, sir.`,
];
const SMALL_HOURS = [
    t => `It is ${t}, sir. The repository will still be here in the morning.`,
    t => `${t}. Tomorrow has technically begun, sir.`,
    t => `${t}. I have locked up everywhere but here.`,
];
const BEFORE_DAWN = [
    t => `${t}. The birds will be up before long, sir.`,
    t => `${t}. At this point it is an early start, sir.`,
];

// --- time ---

function sast(time) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(time)).map(part => [part.type, part.value]));
    return { hour: Number(parts.hour), clock: `${parts.hour}:${parts.minute}` };
}

function isLate(time) {
    const { hour } = sast(time);
    return hour >= LATE_FROM || hour < LATE_UNTIL;
}

/** The night a late time belongs to, named by its evening: 01:00 on Saturday is Friday night */
function nightOf(time) {
    const evening = new Date(time - LATE_UNTIL * HOUR_MS);
    const format = options => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, ...options }).format(evening);
    return { key: format({ year: 'numeric', month: '2-digit', day: '2-digit' }), weekday: new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long' }).format(evening) };
}

function ordinal(n) {
    const teen = n % 100 >= 11 && n % 100 <= 13;
    return `${n}${teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
}

// --- deciding ---

/**
 * The owner's latest late commit in a push, or null. Commits from Alfred and
 * other automation never count, nor commits already pushed on another branch.
 */
function latestLateCommit(commits, owner) {
    const own = (commits || []).filter(commit => commit && commit.distinct !== false &&
        commit.author && commit.author.username === owner && Number.isFinite(Date.parse(commit.timestamp)) &&
        isLate(Date.parse(commit.timestamp)));
    if (!own.length) return null;
    return own.reduce((latest, commit) => (Date.parse(commit.timestamp) > Date.parse(latest.timestamp) ? commit : latest));
}

/** Has Alfred commented in the last week? `comments` as the commit comments API returns them */
function spokeRecently(comments, now) {
    return (comments || []).some(comment => comment && comment.user && comment.user.login === BUTLER &&
        now - Date.parse(comment.created_at) < QUIET_FOR_DAYS * DAY_MS);
}

/** Distinct late nights among these commit times, in the week before `now` */
function lateNightsThisWeek(times, now) {
    const nights = new Set(times
        .filter(time => Number.isFinite(time) && now - time < QUIET_FOR_DAYS * DAY_MS && isLate(time))
        .map(time => nightOf(time).key));
    return nights.size;
}

/** Stable per commit, so a re-run says the same thing */
function pick(pool, sha) {
    return pool[parseInt(String(sha).slice(0, 6), 16) % pool.length || 0];
}

function remark(time, sha, nights) {
    const { hour, clock } = sast(time);
    const { weekday } = nightOf(time);
    if (nights >= PATTERN_NIGHTS) return `${clock}, and the ${ordinal(nights)} late night this week. I mention it only for the record.`;
    if (weekday === 'Friday' || weekday === 'Saturday') return `A ${weekday} night, and ${clock}. I shan't ask.`;
    if (hour >= LATE_FROM) return pick(EVENING, sha)(clock);
    if (hour < 3) return pick(SMALL_HOURS, sha)(clock);
    return pick(BEFORE_DAWN, sha)(clock);
}

// --- GitHub ---

/** Every commit comment in the repo. There are few: at most one a week from Alfred. */
async function allCommitComments(repo, token) {
    const comments = [];
    for (let page = 1; ; page++) {
        const batch = await github(`/repos/${repo}/comments?per_page=100&page=${page}`, token);
        comments.push(...batch);
        if (batch.length < 100) return comments;
    }
}

async function main() {
    const { GITHUB_REPOSITORY: repo, GITHUB_REPOSITORY_OWNER: owner, GITHUB_EVENT_PATH: eventPath, GITHUB_TOKEN: readToken, BUTLER_TOKEN: butlerToken, DRY_RUN } = process.env;
    if (!repo || !owner || !eventPath || !readToken) throw new Error('Missing GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER, GITHUB_EVENT_PATH or GITHUB_TOKEN');
    if (!butlerToken && !DRY_RUN) throw new Error('Missing BUTLER_TOKEN');

    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const commit = latestLateCommit(event.commits, owner);
    if (!commit) return console.log('No late commits in this push');

    const now = Date.now();
    if (spokeRecently(await allCommitComments(repo, readToken), now)) {
        return console.log(`Late commit ${commit.id.slice(0, 7)}, but Alfred has already spoken this week`);
    }

    const since = new Date(now - QUIET_FOR_DAYS * DAY_MS).toISOString();
    const recent = await github(`/repos/${repo}/commits?author=${encodeURIComponent(owner)}&since=${since}&per_page=100`, readToken);
    const times = recent.map(item => Date.parse(item.commit && item.commit.author && item.commit.author.date));
    times.push(Date.parse(commit.timestamp)); // in case the API hasn't caught up with the push
    const body = remark(Date.parse(commit.timestamp), commit.id, lateNightsThisWeek(times, now));

    if (DRY_RUN) return console.log(`Would comment on ${commit.id.slice(0, 7)}: ${body}`);
    await github(`/repos/${repo}/commits/${commit.id}/comments`, butlerToken, { method: 'POST', body: JSON.stringify({ body }) });
    console.log(`Commented on ${commit.id.slice(0, 7)}: ${body}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { isLate, nightOf, latestLateCommit, spokeRecently, lateNightsThisWeek, remark };
