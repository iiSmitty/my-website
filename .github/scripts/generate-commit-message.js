/**
 * Generates an in-character "Alfred Pennyworth" commit message for coffee-stats
 * updates, based on what actually changed between the committed file and the
 * freshly scraped working-tree file.
 *
 * Old values come from the last commit (git show HEAD:data/coffee-stats.json),
 * new values from the working tree. Prints a single line to stdout for use as
 * `git commit -m "$(node ... )"`. Always prints *something* — never throws.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'coffee-stats.json');
const MILESTONE_STEP = 50; // special line every 50th visit (200, 250, 300, ...)

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function parseJson(raw) {
    return JSON.parse(raw.replace(/^﻿/, '')); // tolerate a stray BOM
}

function readNew() {
    try {
        return parseJson(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

function readOld() {
    try {
        const raw = execSync('git show HEAD:data/coffee-stats.json', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
        });
        return parseJson(raw);
    } catch (e) {
        return {}; // no prior commit / first run
    }
}

// --- message pools (Alfred is the committer, so first person works) ---

// A free coffee earned: ten points on the card, banked for later
const freeCoffeeLines = [
    'The card resets. Ten points, one reward — a tidy bit of accounting.',
    'Complimentary brew secured. Master Wayne always did appreciate the small victories.',
    'A reward well earned, sir. I shall have the Batmobile warmed up.',
    'The loyalty card comes good. Even vigilantes deserve a perk now and then.',
    'Another free cup in the bank, sir. I shall guard it with my life.',
    'Ten points, one reward banked. Prudent as ever, Master Wayne.',
];

// A banked free coffee actually drunk
const redeemedLines = [
    (n) => `Master Wayne has cashed in a free coffee. That makes ${n}, sir.`,
    (n) => `Reward claimed — free cup #${n}. Even the Dark Knight needs his espresso.`,
    (n) => `A free cup, redeemed. Crime-fighting is thirsty work, sir. (${n} and counting.)`,
    (n) => `Free coffee #${n} acquired. The only heist Gotham permits.`,
    (n) => `Ten stamps, one cup, no charge. Free coffee #${n} — justice, of a caffeinated sort.`,
    (n) => `Redeemed at last: free cup #${n}. I do hope it was a flat white, Master Wayne.`,
];

const milestoneLines = [
    (v) => `Visit #${v} — a milestone worthy of the Batcave records.`,
    (v) => `${v} visits and counting. I shall note it in the ledger, sir.`,
    (v) => `Visit #${v}. Even Gotham's finest don't show such dedication.`,
    (v) => `${v}th cup of loyalty logged. Master Wayne would be proud.`,
    (v) => `${v} visits. A streak the Joker himself couldn't disrupt.`,
    (v) => `Visit #${v} — I've filed it alongside the case histories.`,
    (v) => `${v} and climbing. Wayne Manor runs on far less, I assure you.`,
    (v) => `A round ${v}, sir. Allow me a moment of quiet pride.`,
];

const balanceUpLines = [
    (b) => `A fresh visit logged — ${b}/10. The usual, I presume?`,
    (b) => `Another brew on the books — ${b}/10 toward the next reward.`,
    (b) => `${b}/10, sir. Steadily closing in on a complimentary cup.`,
    (b) => `Card stamped — ${b}/10. Patience is a virtue, even with caffeine.`,
    (b) => `${b}/10. The path to a free cup is paved one visit at a time.`,
    (b) => `Stamp acquired — ${b}/10. I'll keep watch over the count.`,
    (b) => `${b} of 10, Master Wayne. The reward draws ever nearer.`,
    (b) => `Logged: ${b}/10. A most disciplined caffeine campaign.`,
];

const totalUpLines = [
    (t) => `Another brew on the books — ${t} visits and counting.`,
    (t) => `Visit tally now at ${t}. The roastery thanks you, sir.`,
    (t) => `${t} visits logged. A most reliable habit, if I may say.`,
    (t) => `The count stands at ${t}. Consistency befitting a Wayne.`,
    (t) => `${t} visits on record. The barista knows your order by heart.`,
    (t) => `Tally updated to ${t}, sir. All accounted for.`,
];

const fallbackLines = [
    'Coffee stats refreshed. All in order, sir.',
    'The ledger is up to date. Carry on.',
    'Records updated. Nothing further to report, Master Wayne.',
    'The books are balanced and the coffee is accounted for.',
];

// True when both files have the field and it went up. A file from before the
// free coffee stats were recorded has neither free coffee field.
function rose(oldStats, newStats, field) {
    return Number.isFinite(oldStats[field]) && Number.isFinite(newStats[field]) &&
        newStats[field] > oldStats[field];
}

function buildMessage(oldStats, newStats) {
    const oldTotal = Number(oldStats.totalSiteVisits) || 0;
    const newTotal = Number(newStats.totalSiteVisits) || 0;
    const oldBal = Number(oldStats.currentBalance) || 0;
    const newBal = Number(newStats.currentBalance) || 0;

    // 1. Free coffee redeemed.
    if (rose(oldStats, newStats, 'freeBeveragesRedeemed')) {
        return `☕ ${pick(redeemedLines)(newStats.freeBeveragesRedeemed)}`;
    }

    // 2. Free coffee earned — balance wrapped (e.g. 9 -> 0) or one more banked.
    if (newBal < oldBal || rose(oldStats, newStats, 'freeBeveragesAvailable')) {
        return `☕ ${pick(freeCoffeeLines)}`;
    }

    // 3. Milestone visit — crossed a multiple of MILESTONE_STEP.
    if (Math.floor(newTotal / MILESTONE_STEP) > Math.floor(oldTotal / MILESTONE_STEP)) {
        const milestone = Math.floor(newTotal / MILESTONE_STEP) * MILESTONE_STEP;
        return `☕ ${pick(milestoneLines)(milestone)}`;
    }

    // 4. Balance ticked up.
    if (newBal > oldBal) {
        return `☕ ${pick(balanceUpLines)(newBal)}`;
    }

    // 5. Total moved but balance flat (or any other forward change).
    if (newTotal > oldTotal) {
        return `☕ ${pick(totalUpLines)(newTotal)}`;
    }

    return `☕ ${pick(fallbackLines)}`;
}

if (require.main === module) {
    process.stdout.write(buildMessage(readOld(), readNew()));
}

module.exports = { buildMessage };
