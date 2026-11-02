// PC Health: My Computer is having a long day, and visitors can cheer it up.
//
// This is the small part every home page load runs: the Mood row in the
// identity block, and the maths it needs. The window itself
// (pc-health-window.js and its stylesheet) loads the first time it's opened.
// Nothing here talks to the API, so a visitor who never opens the window
// costs the Worker nothing.
//
// Mood = a baseline from my own week + a lift visitors share, 20 to 100.
// The baseline comes from data the GitHub Actions already refresh; the lift
// comes from the Worker in cf-mood/ (or this browser's own cheers, offline).

const PC_HEALTH_MIN = 20;
const PC_HEALTH_MAX = 100;
const PC_HEALTH_MAX_LIFT = 50;
const PC_HEALTH_HALF_LIFE_HOURS = 12;
const PC_HEALTH_HOUR_MS = 60 * 60 * 1000;
const PC_HEALTH_DAY_MS = 24 * PC_HEALTH_HOUR_MS;
const PC_HEALTH_STORAGE_KEY = 'pcHealth';

// Face, word and number always go together, never colour alone
const PC_HEALTH_BANDS = [
    { min: 90, state: 'Great day', face: 'great', line: 'Best uptime of my life.' },
    { min: 75, state: 'Happy', face: 'happy', line: 'Fans spinning, lights blinking. Good day.' },
    { min: 55, state: 'Content', face: 'content', line: 'All drivers loaded. No complaints.' },
    { min: 35, state: 'Okay', face: 'okay', line: 'Ticking along.' },
    { min: 20, state: 'Tired', face: 'tired', line: 'Running a bit slow today. Could use a hand.' }
];

// The PC's face at 16px, for the Mood row: its body, and a face per band,
// drawn on its screen (x 3-12, y 3-8). Fixed markup, never data.
const PC_HEALTH_ROW_BODY = '<rect x="1" y="1" width="14" height="11" fill="#000"/>' +
    '<rect x="2" y="2" width="12" height="9" fill="#d8d0b0"/>' +
    '<rect x="3" y="3" width="10" height="6" fill="#008080"/>' +
    '<rect x="12" y="10" width="1" height="1" fill="#00d000"/>' +
    '<rect x="6" y="12" width="4" height="1" fill="#000"/>' +
    '<rect x="3" y="13" width="10" height="3" fill="#000"/>' +
    '<rect x="4" y="13" width="8" height="2" fill="#d8d0b0"/>';
const PC_HEALTH_ROW_FACES = {
    great: [[4, 5, 1], [5, 4, 1], [6, 5, 1], [9, 5, 1], [10, 4, 1], [11, 5, 1], [4, 6, 8], [5, 7, 6]],
    happy: [[5, 4, 1], [10, 4, 1], [4, 6, 1], [11, 6, 1], [5, 7, 6]],
    content: [[5, 4, 1], [10, 4, 1], [5, 6, 1], [10, 6, 1], [6, 7, 4]],
    okay: [[5, 4, 1], [10, 4, 1], [6, 7, 4]],
    tired: [[4, 5, 2], [10, 5, 2], [7, 7, 2]]
};

function pcHealthRowFaceSvg(face) {
    const pixels = (PC_HEALTH_ROW_FACES[face] || PC_HEALTH_ROW_FACES.okay)
        .map(([x, y, width]) => `<rect x="${x}" y="${y}" width="${width}" height="1"/>`).join('');
    return `<svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" focusable="false">` +
        `${PC_HEALTH_ROW_BODY}<g fill="#fff">${pixels}</g></svg>`;
}

// The coffee stats, once coffee-simple.js has them
let pcHealthCoffee = null;

// --- Maths -------------------------------------------------------------------

function pcHealthWithin(isoTime, days, now) {
    const time = Date.parse(isoTime);
    return Number.isFinite(time) && now - time >= -PC_HEALTH_HOUR_MS && now - time <= days * PC_HEALTH_DAY_MS;
}

/**
 * How my week is going: 40, +15 if I bought a coffee in the last two days,
 * +10 if I watched an episode in the last seven.
 */
function pcHealthBaseline(coffee, watchedAt, now) {
    let baseline = 40;
    if (coffee && pcHealthWithin(coffee.lastVisitAt, 2, now)) baseline += 15;
    if (pcHealthWithin(watchedAt, 7, now)) baseline += 10;
    return baseline;
}

/** The lift `ageMs` later: it halves every half-life */
function pcHealthDecay(lift, ageMs, halfLifeHours) {
    if (!(lift > 0)) return 0;
    const capped = Math.min(lift, PC_HEALTH_MAX_LIFT);
    if (!(ageMs > 0)) return capped;
    return capped * Math.pow(0.5, ageMs / ((halfLifeHours || PC_HEALTH_HALF_LIFE_HOURS) * PC_HEALTH_HOUR_MS));
}

/** A cheer closes a share of the gap to the top, the same as the Worker */
function pcHealthApplyCheer(lift, gain) {
    const current = Math.min(Math.max(lift || 0, 0), PC_HEALTH_MAX_LIFT);
    return current + (PC_HEALTH_MAX_LIFT - current) * gain;
}

function pcHealthMood(baseline, lift) {
    return Math.min(Math.max(Math.round(baseline + lift), PC_HEALTH_MIN), PC_HEALTH_MAX);
}

function pcHealthBand(mood) {
    return PC_HEALTH_BANDS.find(band => mood >= band.min) || PC_HEALTH_BANDS[PC_HEALTH_BANDS.length - 1];
}

// --- What this browser remembers ------------------------------------------------
// Only ever kept here, never sent: the last mood seen (the lift, when, and
// when I last watched something), how many times you've cheered, the jokes
// you've heard, and when a resting PC said to come back.

function readPcHealthMemory() {
    try {
        const stored = JSON.parse(localStorage.getItem(PC_HEALTH_STORAGE_KEY));
        return stored && typeof stored === 'object' ? stored : {};
    } catch (e) {
        return {};
    }
}

function writePcHealthMemory(changes) {
    const memory = { ...readPcHealthMemory(), ...changes };
    try {
        localStorage.setItem(PC_HEALTH_STORAGE_KEY, JSON.stringify(memory));
    } catch (e) {
        // Private browsing or storage turned off: it just won't remember
    }
    return memory;
}

/** The lift this browser last saw, faded to now */
function pcHealthRememberedLift(memory, now) {
    const lift = Number(memory.lift);
    const at = Number(memory.at);
    if (!Number.isFinite(lift) || !Number.isFinite(at)) return 0;
    return pcHealthDecay(lift, now - at, Number(memory.halfLifeHours));
}

/** The mood as this browser knows it right now, without asking anyone */
function pcHealthCurrentMood(now = Date.now()) {
    const memory = readPcHealthMemory();
    const baseline = pcHealthBaseline(pcHealthCoffee, memory.watchedAt, now);
    return pcHealthMood(baseline, pcHealthRememberedLift(memory, now));
}

// --- The Mood row ----------------------------------------------------------------

function renderPcHealthRow() {
    const text = document.getElementById('pcHealthRowText');
    if (!text) return;
    const mood = pcHealthCurrentMood();
    const band = pcHealthBand(mood);
    text.textContent = `${band.state}, ${mood}%`;

    const face = document.getElementById('pcHealthRowFace');
    if (face && face.dataset.face !== band.face) {
        face.dataset.face = band.face;
        face.innerHTML = pcHealthRowFaceSvg(band.face);
    }
}

async function openPcHealthWindow() {
    const opener = document.activeElement;
    const [, loaded] = await Promise.all([
        loadStylesheet('css/pc-health.min.css'),
        loadScript('js/pc-health-window.min.js')
    ]);
    if (!loaded || typeof showPcHealthWindow !== 'function') return;
    showPcHealthWindow(opener);
}

document.addEventListener('DOMContentLoaded', () => {
    const row = document.getElementById('pcHealthRow');
    if (!row) return;

    row.hidden = false;
    renderPcHealthRow();
    document.getElementById('pcHealthCheck').addEventListener('click', openPcHealthWindow);

    if (typeof getCoffeeStats === 'function') {
        getCoffeeStats()
            .then(data => {
                pcHealthCoffee = data;
                renderPcHealthRow();
            })
            .catch(() => {
                // Coffee Analytics reports it; the mood just goes without
            });
    }
});
