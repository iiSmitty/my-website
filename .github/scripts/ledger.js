/**
 * Alfred's ledger: what he remembers between commits, and the commit body he
 * writes from it.
 *
 * Each data workflow (coffee, watching, sponsors) commits as Alfred with a
 * one-line subject. This adds a memory. Before committing, the workflow runs
 *
 *     node .github/scripts/ledger.js <coffee|watching|sponsors> "<subject>"
 *
 * which compares the data file at HEAD with the freshly fetched one, updates
 * data/ledger/<source>.json, and prints the full commit message: the subject,
 * a remark or two drawn from the ledger, and trailers. The workflow commits
 * the ledger file alongside the data.
 *
 * One ledger file per source, so each workflow only ever writes its own and
 * two pushes close together can't conflict. The ledger is only ever updated
 * by a commit that was happening anyway. If anything here fails, the workflow
 * falls back to the subject alone and leaves the ledger as it was: a joke
 * never costs a data update.
 *
 * Everything in the ledger is worked out from the data files; nothing is
 * invented. Times are SAST.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LEDGER_DIR = path.join(ROOT, 'data', 'ledger');
const SOURCES = {
    coffee: 'data/coffee-stats.json',
    watching: 'data/watching.json',
    sponsors: 'data/sponsors.json',
};

const TIME_ZONE = 'Africa/Johannesburg';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REMARKS = 2;
const ENTRY_MILESTONE = 50;      // a word about himself every 50th entry
const NOTABLE_GAP_DAYS = 7;      // a visit after a week or more away gets mentioned
const BATCH_EPISODES = 5;        // as do this many episodes in one report
const NO_COFFEE_DAYS = 7;        // the same quiet week as the site's PC Health
const PACE_MIN_DAYS = 28;        // watch a show this long before forecasting it
const PACE_MIN_EPISODES = 4;     // and see at least this much progress

// --- small helpers ---

function isCount(n) {
    return Number.isInteger(n) && n >= 0;
}

function timeOf(iso) {
    const time = Date.parse(iso);
    return Number.isFinite(time) ? time : null;
}

function plural(n, one, many = `${one}s`) {
    return `${n} ${n === 1 ? one : many}`;
}

function ordinal(n) {
    const teen = n % 100 >= 11 && n % 100 <= 13;
    const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${suffix}`;
}

function sastParts(time, options) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options }).format(new Date(time));
}

/** "2026-11", the month in SAST */
function monthKey(time) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).format(new Date(time)).slice(0, 7);
}

function previousMonthKey(key) {
    const [year, month] = key.split('-').map(Number);
    return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** "October", for a month key */
function monthName(key) {
    return sastParts(Date.parse(`${key}-15T12:00:00Z`), { month: 'long' });
}

/** "3 November" */
function dayAndMonth(time) {
    return sastParts(time, { day: 'numeric', month: 'long' });
}

/** "March 2028" */
function monthAndYear(time) {
    return sastParts(time, { month: 'long', year: 'numeric' });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

/** Text from outside (titles, names) stays on its line */
function oneLine(text) {
    return String(text).replace(/\s+/g, ' ').trim();
}

// --- empty ledgers ---

function emptyLedger(source) {
    if (source === 'coffee') return { entries: 0, visitsByMonth: {}, longestGap: null };
    if (source === 'watching') return { entries: 0, episodesByMonth: {}, seriesFinished: 0, shows: {} };
    return { entries: 0 };
}

/** A ledger as read from disk, with anything missing filled in */
function normalise(source, ledger) {
    return { ...emptyLedger(source), ...(ledger && typeof ledger === 'object' ? clone(ledger) : {}) };
}

// --- coffee ---

/**
 * The portal has no visit history, so a visit is a rise in totalSiteVisits,
 * timed by lastVisitAt (when the run first saw it, within a day).
 */
function recordCoffee(ledger, before, after, now) {
    const remarks = [];
    const oldVisits = before && isCount(before.totalSiteVisits) ? before.totalSiteVisits : null;
    const newVisits = after && isCount(after.totalSiteVisits) ? after.totalSiteVisits : null;
    const visits = oldVisits !== null && newVisits !== null && newVisits > oldVisits ? newVisits - oldVisits : 0;

    if (visits > 0) {
        const visitAt = timeOf(after.lastVisitAt) || now;
        const month = monthKey(visitAt);
        const lastMonth = previousMonthKey(month);
        const thisMonthBefore = ledger.visitsByMonth[month] || 0;
        const thisMonth = thisMonthBefore + visits;
        ledger.visitsByMonth[month] = thisMonth;

        const previousVisitAt = timeOf(before.lastVisitAt);
        const gapDays = previousVisitAt !== null ? Math.floor((visitAt - previousVisitAt) / DAY_MS) : null;
        const record = gapDays !== null && (!ledger.longestGap || gapDays > ledger.longestGap.days);
        if (record) ledger.longestGap = { days: gapDays, endedAt: new Date(visitAt).toISOString() };

        if (record && gapDays >= NOTABLE_GAP_DAYS) {
            remarks.push(`The first visit in ${gapDays} days, the longest gap in my records.`);
        } else if (gapDays !== null && gapDays >= NOTABLE_GAP_DAYS) {
            remarks.push(`The first visit in ${gapDays} days.`);
        }
        if (visits > 1) remarks.push(`${plural(visits, 'visit')} since my last report.`);

        const lastMonthTotal = ledger.visitsByMonth[lastMonth] || 0;
        if (lastMonthTotal > 0 && thisMonthBefore <= lastMonthTotal && thisMonth > lastMonthTotal) {
            remarks.push(`That makes ${thisMonth} this month, already more than all of ${monthName(lastMonth)}.`);
        } else {
            remarks.push(`The ${ordinal(thisMonth)} visit this month.`);
        }
    }

    const trailers = [];
    const ledgerLine = [
        newVisits !== null && plural(newVisits, 'visit'),
        isCount(after && after.freeBeveragesRedeemed) && `${after.freeBeveragesRedeemed} free`,
        isCount(after && after.freeBeveragesAvailable) && `${after.freeBeveragesAvailable} in reserve`,
    ].filter(Boolean).join(', ');
    if (ledgerLine) trailers.push(['Ledger', ledgerLine]);
    if (isCount(after && after.currentBalance)) trailers.push(['Card', `${after.currentBalance}/10`]);
    return { remarks, trailers };
}

// --- watching ---

/** Where a show will be done at the rate seen since the ledger first saw it */
function forecast(memory, show, now) {
    if (!memory || !isCount(show.aired) || !isCount(show.watched) || show.watched >= show.aired) return null;
    const days = (now - timeOf(memory.firstSeenAt)) / DAY_MS;
    const progress = show.watched - memory.firstWatched;
    if (!(days >= PACE_MIN_DAYS) || progress < PACE_MIN_EPISODES) return null;
    const perDay = progress / days;
    return now + ((show.aired - show.watched) / perDay) * DAY_MS;
}

/**
 * Trakt reports progress per show, weekly, for the few shows in progress, so
 * the ledger remembers every show it has seen: a show that drops out of the
 * list and comes back isn't counted twice. Episodes count in the month they
 * were watched (the show's lastWatchedAt).
 */
function recordWatching(ledger, before, after, now, context = {}) {
    const remarks = [];
    const shows = (after && Array.isArray(after.inProgress) ? after.inProgress : []).filter(show => show && show.traktId);
    let episodes = 0;

    const count = (n, at) => {
        if (!(n > 0)) return;
        episodes += n;
        const month = monthKey(timeOf(at) || now);
        ledger.episodesByMonth[month] = (ledger.episodesByMonth[month] || 0) + n;
    };

    // A series that moved from in progress to finished: its last episodes, then the count
    const finished = after && after.previous;
    const finishedBefore = before && before.previous;
    if (finished && finished.traktId && !(finishedBefore && finishedBefore.traktId === finished.traktId)) {
        const memory = ledger.shows[finished.traktId];
        if (memory && isCount(finished.episodes)) count(finished.episodes - memory.watched, finished.finishedAt);
        delete ledger.shows[finished.traktId];
        ledger.seriesFinished += 1;
        remarks.push(`The ${ordinal(ledger.seriesFinished)} series finished since I began keeping count.`);
    }

    let latest = null; // the show with the newest progress this report
    for (const show of shows) {
        if (!isCount(show.watched)) continue;
        const memory = ledger.shows[show.traktId];
        const progress = memory ? show.watched - memory.watched : show.watched;
        count(progress, show.lastWatchedAt);
        if (progress > 0 && (!latest || (timeOf(show.lastWatchedAt) || 0) > (timeOf(latest.lastWatchedAt) || 0))) latest = show;
        ledger.shows[show.traktId] = memory
            ? { ...memory, title: oneLine(show.title), watched: show.watched }
            : { title: oneLine(show.title), watched: show.watched, firstSeenAt: new Date(now).toISOString(), firstWatched: show.watched };
    }

    if (episodes >= BATCH_EPISODES) {
        const coffeeAt = timeOf(context.coffee && context.coffee.lastVisitAt);
        const dry = coffeeAt !== null && now - coffeeAt > NO_COFFEE_DAYS * DAY_MS;
        remarks.push(`${plural(episodes, 'episode')} since my last report${dry ? `, and no coffee since ${dayAndMonth(coffeeAt)}` : ''}.`);
    }

    if (latest) {
        const done = forecast(ledger.shows[latest.traktId], latest, now);
        if (done) remarks.push(`At the present rate, ${oneLine(latest.title)} concludes in ${monthAndYear(done)}. I have pencilled it in.`);
    }

    const month = monthKey(now);
    if (episodes > 0 && ledger.episodesByMonth[month]) {
        remarks.push(`${plural(ledger.episodesByMonth[month], 'episode')} this month so far.`);
    }

    const trailers = shows
        .filter(show => isCount(show.watched) && isCount(show.aired))
        .map(show => ['Watching', `${oneLine(show.title)} ${show.watched}/${show.aired}`]);
    return { remarks, trailers };
}

// --- sponsors ---

function patronCoffees(data) {
    const sponsors = data && Array.isArray(data.sponsors) ? data.sponsors : [];
    return sponsors.reduce((sum, sponsor) => sum + (isCount(sponsor && sponsor.coffees) ? sponsor.coffees : 0), 0);
}

function recordSponsors(ledger, before, after, now, context = {}) {
    const remarks = [];
    const was = patronCoffees(before);
    const is = patronCoffees(after);
    const card = context.coffee && context.coffee.freeBeveragesRedeemed;

    if (is > was) {
        if (isCount(card) && is > card && was <= card) {
            remarks.push('Patrons have now stood you more coffees than the loyalty card has given away. I make no comment.');
        } else {
            remarks.push(`That makes ${plural(is, 'coffee')} from patrons in all.`);
        }
    }

    const patrons = after && Array.isArray(after.sponsors) ? after.sponsors.length : 0;
    return { remarks, trailers: [['Patrons', `${patrons}, ${plural(is, 'coffee')} stood`]] };
}

// --- the entry ---

const RECORDERS = { coffee: recordCoffee, watching: recordWatching, sponsors: recordSponsors };

/**
 * One entry in the ledger: the updated ledger and the full commit message.
 * `context.entriesElsewhere` is the other sources' entry counts, so the entry
 * number runs across all of Alfred's commits. Pure: nothing is read or written.
 */
function record(source, { ledger, before, after, now, subject, context = {} }) {
    const next = normalise(source, ledger);
    next.entries += 1;
    const entry = next.entries + (context.entriesElsewhere || 0);

    const { remarks, trailers } = RECORDERS[source](next, before || null, after || null, now, context);
    if (entry % ENTRY_MILESTONE === 0) remarks.unshift(`My ${ordinal(entry)} entry in this log, sir. I keep a copy.`);
    trailers.push(['Entry', String(entry)]);

    return { ledger: next, message: composeMessage(subject, remarks.slice(0, MAX_REMARKS), trailers) };
}

/** Subject, a blank line, the remarks as one paragraph, a blank line, the trailers */
function composeMessage(subject, remarks, trailers) {
    const parts = [oneLine(subject)];
    if (remarks.length) parts.push(remarks.join(' '));
    if (trailers.length) parts.push(trailers.map(([key, value]) => `${key}: ${oneLine(value)}`).join('\n'));
    return parts.join('\n\n') + '\n';
}

// --- reading and writing ---

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
        return null;
    }
}

function readCommitted(relativePath) {
    try {
        const raw = execSync(`git show HEAD:${relativePath}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        return JSON.parse(raw.replace(/^﻿/, ''));
    } catch (e) {
        return null; // a new file
    }
}

function ledgerPath(source) {
    return path.join(LEDGER_DIR, `${source}.json`);
}

function main(source, subject) {
    if (!RECORDERS[source]) throw new Error(`Unknown source "${source}". Use one of: ${Object.keys(SOURCES).join(', ')}`);
    if (!subject) throw new Error('No subject given');

    const entriesElsewhere = Object.keys(SOURCES)
        .filter(other => other !== source)
        .reduce((sum, other) => sum + (normalise(other, readJson(ledgerPath(other))).entries || 0), 0);

    const { ledger, message } = record(source, {
        ledger: readJson(ledgerPath(source)),
        before: readCommitted(SOURCES[source]),
        after: readJson(path.join(ROOT, SOURCES[source])),
        now: Date.now(),
        subject,
        context: { entriesElsewhere, coffee: readJson(path.join(ROOT, SOURCES.coffee)) },
    });

    // Last, so a failure above leaves the ledger untouched
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
    fs.writeFileSync(ledgerPath(source), JSON.stringify(ledger, null, 2) + '\n');
    process.stdout.write(message);
}

if (require.main === module) {
    try {
        main(process.argv[2], process.argv[3]);
    } catch (error) {
        console.error(`The ledger could not be written: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { record, recordCoffee, recordWatching, recordSponsors, composeMessage, emptyLedger, normalise, ordinal, monthKey };
