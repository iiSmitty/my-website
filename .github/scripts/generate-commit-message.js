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

const freeCoffeeLines = [
    'Reward claimed. Even the Dark Knight needs his espresso.',
    'A free cup, redeemed. Crime-fighting is thirsty work, sir.',
    'The card resets. Ten visits, one reward — a tidy bit of accounting.',
    'Complimentary brew secured. Master Wayne always did appreciate the small victories.',
    'A reward well earned, sir. I shall have the Batmobile warmed up.',
    'Free coffee acquired. The only heist Gotham permits.',
    'Ten stamps, one cup, no charge. Justice, of a caffeinated sort.',
    'The loyalty card comes good. Even vigilantes deserve a perk now and then.',
    'Redeemed at last. I do hope it was a flat white, Master Wayne.',
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

function buildMessage(oldStats, newStats) {
    const oldTotal = Number(oldStats.totalSiteVisits) || 0;
    const newTotal = Number(newStats.totalSiteVisits) || 0;
    const oldBal = Number(oldStats.currentBalance) || 0;
    const newBal = Number(newStats.currentBalance) || 0;

    // 1. Free coffee earned — balance dropped (e.g. 9 -> 0).
    if (newBal < oldBal) {
        return `☕ ${pick(freeCoffeeLines)}`;
    }

    // 2. Milestone visit — crossed a multiple of MILESTONE_STEP.
    if (Math.floor(newTotal / MILESTONE_STEP) > Math.floor(oldTotal / MILESTONE_STEP)) {
        const milestone = Math.floor(newTotal / MILESTONE_STEP) * MILESTONE_STEP;
        return `☕ ${pick(milestoneLines)(milestone)}`;
    }

    // 3. Balance ticked up.
    if (newBal > oldBal) {
        return `☕ ${pick(balanceUpLines)(newBal)}`;
    }

    // 4. Total moved but balance flat (or any other forward change).
    if (newTotal > oldTotal) {
        return `☕ ${pick(totalUpLines)(newTotal)}`;
    }

    return `☕ ${pick(fallbackLines)}`;
}

const message = buildMessage(readOld(), readNew());
process.stdout.write(message);
