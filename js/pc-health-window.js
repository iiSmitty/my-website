// PC Health window: cheer up My Computer.
//
// Loaded by openPcHealthWindow() (pc-health.js) the first time it opens, from
// the Mood row, the desktop icon or the Start menu.
//
// Every word on screen is written here and set with textContent. The API
// (cf-mood/) only ever sends action IDs and numbers, so there's nothing a
// visitor can put on the page.
//
// It never needs the network to work. data/features.json says whether to
// share cheers at all; if the API is off, resting, slow or down, the PC still
// reacts and remembers the cheer in this browser.

const PC_HEALTH_API = '/api/mood';
const PC_HEALTH_TIMEOUT_MS = 3000;
// Ask for the shared mood on open, and when the tab comes back, at most this often
const PC_HEALTH_REFRESH_MS = 60 * 1000;
// Re-draw the fading mood and the "3 hours ago"s this often, while it's open
const PC_HEALTH_TICK_MS = 10 * 1000;
// The buttons rest this long after a cheer
const PC_HEALTH_COOLDOWN_MS = 1200;
const PC_HEALTH_DEFRAG_MS = 2000;
// The same gain as the Worker's default, for cheers it can't hear
const PC_HEALTH_LOCAL_GAIN = 0.08;
// Other visitors' cheers are summed up for screen readers at most this often
const PC_HEALTH_SUMMARY_MS = 60 * 1000;

const PC_HEALTH_ACTIONS = [
    {
        id: 'pat', label: 'Pat the case', one: 'a pat', many: 'pats',
        reaction: () => 'Whirr. That\'s the spot, just above the floppy drive.'
    },
    {
        id: 'coffee', label: 'Pour a coffee', one: 'a coffee', many: 'coffees',
        reaction: () => {
            const visits = pcHealthCoffee && Number(pcHealthCoffee.totalSiteVisits);
            return visits > 0
                ? `André's loyalty card says ${visits.toLocaleString()} visits. Mine says one. Thank you.`
                : 'André has a loyalty card for these. Mine says one visit. Thank you.';
        }
    },
    {
        id: 'joke', label: 'Tell a joke', one: 'a joke', many: 'jokes',
        reaction: () => nextPcHealthJoke()
    },
    {
        id: 'defrag', label: 'Run Defrag', one: 'a defrag', many: 'defrags',
        reaction: () => 'All my clusters are in a row. I feel organised.'
    },
    {
        id: 'dust', label: 'Dust the fan', one: 'a dust-off', many: 'dust-offs',
        reaction: () => 'Ahh. I can hear myself think again. It was mostly crumbs.'
    }
];

// Not repeated in a browser until it has heard them all
const PC_HEALTH_JOKES = [
    'Why did the PC go to the doctor? It had a virus. Turned out to be a screensaver.',
    'I asked the printer for some space. It said PC LOAD LETTER, which I am choosing to take as a yes.',
    'There are 10 kinds of computers: the ones that understand binary and the ones that need a pat.',
    'My clock is stuck in 1995. Honestly, great year.',
    'I tried to tell a UDP joke, but I\'m not sure you got it.',
    'I\'d tell you a joke about my RAM, but I forgot it.',
    'Why was the computer cold? It left its Windows open.',
    'Why don\'t keyboards sleep? They work two shifts.',
    'I\'m not slow. I\'m thinking at 33.6 kbps.',
    'A SQL query walks into a bar, goes up to two tables and asks: may I join you?',
    'Why do programmers prefer dark mode? Light attracts bugs.',
    'How many programmers does it take to change a light bulb? None. That\'s a hardware problem.',
    'My password is "incorrect", so whenever I forget it, I get told.',
    'Knock knock. Who\'s there? (A very long pause.) Dial-up.',
    'I asked the floppy drive how it was. It said it couldn\'t take more than 1.44 megabytes of this.',
    'Why did the PC sneeze? It caught a cold boot.',
    'My screensaver and I go way back. It really knows how to fill a silence.',
    'What\'s a computer\'s favourite snack? Microchips. Dip optional.',
    'I wanted to be a laptop when I grew up. Never got over the desk job.',
    'The Y2K bug and I still talk. It keeps calling me Grandpa from 1900.'
];

const PC_HEALTH_LINES = {
    loading: 'Checking on the other visitors...',
    off: 'Visitor cheers are switched off for now. I still appreciate it.',
    resting: 'I\'ve had a lot of visitors today and I need a rest. Come back tomorrow.',
    offline: 'Can\'t reach the network right now.',
    offlineCheered: 'Can\'t reach the network, but I still felt that.',
    woken: 'Huh? Oh, hello!'
};

// What it says when the window opens, by the time of day in Cape Town
function pcHealthGreeting(now) {
    if (pcHealthIsDozing(now)) {
        return `Zzz... It's ${pcHealthCapeTown(now).time} in Cape Town, so I'm dozing. Any of these buttons will wake me.`;
    }
    return {
        night: 'Still up? Me too. Someone woke me a minute ago.',
        morning: 'Morning. Still warming up the CRT.',
        afternoon: 'Hello. It\'s been a long day of serving web pages.',
        evening: 'Evening. Winding down after a long day of serving web pages.'
    }[pcHealthPartOfDay(now)];
}

const PC_HEALTH_STATUS_TEXT = {
    loading: 'Connecting...',
    online: 'Shared with every visitor',
    offline: 'Working offline',
    resting: 'Resting until tomorrow',
    off: 'Just you and me'
};

// A beige CRT in pixel art, with a face for each band, and the faces it
// pulls while it reacts to a cheer (data-react). The .pc-health-pc group is
// what moves; props (a mug, steam, dust, Defrag's blocks, static) are drawn
// into .pc-health-props by the scenes further down.
const PC_HEALTH_ART_SVG = `
    <svg class="pc-health-svg" viewBox="0 0 32 32" width="128" height="128" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
        <g class="pc-health-pc">
        <g class="pc-health-body">
            <rect x="3" y="2" width="26" height="21" fill="#000"/>
            <rect x="4" y="3" width="24" height="19" fill="#d8d0b0"/>
            <rect x="4" y="3" width="24" height="1" fill="#fff"/>
            <rect x="4" y="3" width="1" height="19" fill="#fff"/>
            <rect x="27" y="4" width="1" height="18" fill="#8c8468"/>
            <rect x="5" y="21" width="23" height="1" fill="#8c8468"/>
            <rect x="7" y="5" width="18" height="13" fill="#5c5848"/>
            <rect x="8" y="6" width="16" height="11" fill="#008080"/>
            <rect x="9" y="7" width="3" height="1" fill="#2aa6a6"/>
            <rect x="24" y="19" width="2" height="1" fill="#004800"/>
            <rect x="24" y="19" width="2" height="1" class="pc-health-led" fill="#00d000"/>
            <rect x="18" y="19" width="4" height="1" fill="#8c8468"/>
            <rect x="12" y="23" width="8" height="2" fill="#000"/>
            <rect x="13" y="23" width="6" height="1" fill="#b0a888"/>
            <rect x="7" y="25" width="18" height="4" fill="#000"/>
            <rect x="8" y="25" width="16" height="3" fill="#d8d0b0"/>
            <rect x="8" y="25" width="16" height="1" fill="#fff"/>
            <rect x="8" y="27" width="16" height="1" fill="#8c8468"/>
        </g>
        <g class="pc-face pc-face--great" fill="#fff">
            <g class="pc-eyes">
                <rect x="10" y="10" width="1" height="1"/><rect x="11" y="9" width="2" height="1"/><rect x="13" y="10" width="1" height="1"/>
                <rect x="18" y="10" width="1" height="1"/><rect x="19" y="9" width="2" height="1"/><rect x="21" y="10" width="1" height="1"/>
            </g>
            <rect x="10" y="12" width="12" height="1"/><rect x="11" y="13" width="10" height="1"/><rect x="12" y="14" width="8" height="1"/>
            <rect x="9" y="12" width="1" height="1" fill="#ff9ec0"/><rect x="22" y="12" width="1" height="1" fill="#ff9ec0"/>
        </g>
        <g class="pc-face pc-face--happy" fill="#fff">
            <g class="pc-eyes"><rect x="11" y="9" width="2" height="2"/><rect x="19" y="9" width="2" height="2"/></g>
            <rect x="10" y="12" width="1" height="1"/><rect x="21" y="12" width="1" height="1"/>
            <rect x="11" y="13" width="1" height="1"/><rect x="20" y="13" width="1" height="1"/>
            <rect x="12" y="14" width="8" height="1"/>
        </g>
        <g class="pc-face pc-face--content" fill="#fff">
            <g class="pc-eyes"><rect x="11" y="9" width="2" height="2"/><rect x="19" y="9" width="2" height="2"/></g>
            <rect x="11" y="13" width="1" height="1"/><rect x="20" y="13" width="1" height="1"/>
            <rect x="12" y="14" width="8" height="1"/>
        </g>
        <g class="pc-face pc-face--okay" fill="#fff">
            <g class="pc-eyes"><rect x="11" y="9" width="2" height="2"/><rect x="19" y="9" width="2" height="2"/></g>
            <rect x="12" y="14" width="8" height="1"/>
        </g>
        <g class="pc-face pc-face--tired" fill="#fff">
            <rect x="11" y="10" width="2" height="1"/><rect x="19" y="10" width="2" height="1"/>
            <rect class="pc-health-tired-mouth" x="13" y="14" width="6" height="1"/>
            <g class="pc-health-yawn">
                <rect x="14" y="12" width="4" height="1"/><rect x="14" y="13" width="1" height="2"/>
                <rect x="17" y="13" width="1" height="2"/><rect x="14" y="15" width="4" height="1"/>
            </g>
            <rect x="21" y="7" width="2" height="1"/><rect x="22" y="8" width="1" height="1"/><rect x="21" y="9" width="2" height="1"/>
        </g>
        <g class="pc-face pc-face--asleep" fill="#fff">
            <rect x="10" y="12" width="3" height="1"/><rect x="19" y="12" width="3" height="1"/>
            <rect x="15" y="14" width="2" height="1"/>
            <g class="pc-health-zzz">
                <rect x="20" y="6" width="4" height="1"/><rect x="22" y="7" width="1" height="1"/>
                <rect x="21" y="8" width="1" height="1"/><rect x="20" y="9" width="4" height="1"/>
            </g>
        </g>
        <g class="pc-face pc-face--patted" fill="#fff">
            <rect x="10" y="10" width="1" height="1"/><rect x="11" y="9" width="2" height="1"/><rect x="13" y="10" width="1" height="1"/>
            <rect x="18" y="10" width="1" height="1"/><rect x="19" y="9" width="2" height="1"/><rect x="21" y="10" width="1" height="1"/>
            <rect x="10" y="12" width="1" height="1"/><rect x="21" y="12" width="1" height="1"/>
            <rect x="11" y="13" width="1" height="1"/><rect x="20" y="13" width="1" height="1"/>
            <rect x="12" y="14" width="8" height="1"/>
            <rect x="9" y="12" width="1" height="1" fill="#ff9ec0"/><rect x="22" y="12" width="1" height="1" fill="#ff9ec0"/>
        </g>
        <g class="pc-face pc-face--sip" fill="#fff">
            <rect x="10" y="10" width="1" height="1"/><rect x="11" y="9" width="2" height="1"/><rect x="13" y="10" width="1" height="1"/>
            <rect x="18" y="10" width="1" height="1"/><rect x="19" y="9" width="2" height="1"/><rect x="21" y="10" width="1" height="1"/>
            <rect x="15" y="13" width="2" height="2"/>
        </g>
        <g class="pc-face pc-face--wired" fill="#fff">
            <rect x="10" y="8" width="3" height="3"/><rect x="19" y="8" width="3" height="3"/>
            <rect x="11" y="9" width="1" height="1" fill="#008080"/><rect x="20" y="9" width="1" height="1" fill="#008080"/>
            <rect x="11" y="13" width="10" height="2"/>
            <rect x="13" y="13" width="1" height="2" fill="#008080"/><rect x="16" y="13" width="1" height="2" fill="#008080"/><rect x="19" y="13" width="1" height="2" fill="#008080"/>
        </g>
        <g class="pc-face pc-face--laugh" fill="#fff">
            <rect x="10" y="10" width="1" height="1"/><rect x="11" y="9" width="2" height="1"/><rect x="13" y="10" width="1" height="1"/>
            <rect x="18" y="10" width="1" height="1"/><rect x="19" y="9" width="2" height="1"/><rect x="21" y="10" width="1" height="1"/>
            <rect x="11" y="12" width="10" height="2"/><rect x="12" y="14" width="8" height="1"/>
            <rect x="14" y="14" width="4" height="1" fill="#ff6a8a"/>
            <rect x="9" y="12" width="1" height="1" fill="#ff9ec0"/><rect x="22" y="12" width="1" height="1" fill="#ff9ec0"/>
        </g>
        <g class="pc-face pc-face--ahh" fill="#fff">
            <rect x="10" y="9" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/><rect x="10" y="11" width="1" height="1"/>
            <rect x="21" y="9" width="1" height="1"/><rect x="20" y="10" width="1" height="1"/><rect x="21" y="11" width="1" height="1"/>
            <rect x="15" y="13" width="2" height="2"/>
        </g>
        <g class="pc-face pc-face--sneeze" fill="#fff">
            <rect x="10" y="9" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/><rect x="10" y="11" width="1" height="1"/>
            <rect x="21" y="9" width="1" height="1"/><rect x="20" y="10" width="1" height="1"/><rect x="21" y="11" width="1" height="1"/>
            <rect x="12" y="13" width="8" height="2"/>
        </g>
        <rect class="pc-health-scan" x="8" y="6" width="16" height="1" fill="#fff"/>
        </g>
        <g class="pc-health-props"></g>
    </svg>`;

const pcHealthState = {
    status: 'loading',
    shared: false,
    // data/watching.json and data/spotify-data.json, when they've loaded
    watchedAt: null,
    watchedTitle: null,
    track: null,
    // The last answer from the API
    server: null,
    // Today's counts when the window opened, and the cheers of yours the
    // API counted since, to tell other visitors' cheers apart
    openedToday: null,
    ownAccepted: {},
    cheeredOffline: false,
    lastRefresh: 0,
    lastSummary: '',
    lastSummaryAt: 0,
    band: null,
    coolingUntil: 0,
    timers: [],
    // The scene playing on the PC (see Scenes), and the face last drawn, to
    // notice when the mood changes
    sceneTimers: [],
    staticPending: false,
    drawnFace: null,
    // Off while the window opens, so the shared mood arriving isn't static
    moodSettled: false,
    tick: null,
    returnFocus: null,
    // Sent with this page load's first counted cheer, to measure how many
    // visits cheer at all. Nothing identifies the visit.
    firstSent: false
};

// --- Helpers -----------------------------------------------------------------

function pcHealthReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pcHealthWindow() {
    return document.getElementById('pcHealthWindow');
}

function pcHealthIsOpen() {
    const win = pcHealthWindow();
    return Boolean(win && !win.hidden);
}

function pcHealthAction(id) {
    return PC_HEALTH_ACTIONS.find(action => action.id === id);
}

// "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago"
function pcHealthAgo(time, now) {
    const minutes = Math.floor((now - time) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}

function nextPcHealthJoke() {
    const memory = readPcHealthMemory();
    let seen = Array.isArray(memory.jokesSeen) ? memory.jokesSeen.filter(i => i >= 0 && i < PC_HEALTH_JOKES.length) : [];
    let unseen = PC_HEALTH_JOKES.map((joke, index) => index).filter(index => !seen.includes(index));
    if (unseen.length === 0) {
        seen = [];
        unseen = PC_HEALTH_JOKES.map((joke, index) => index);
    }
    const pick = unseen[Math.floor(Math.random() * unseen.length)];
    writePcHealthMemory({ jokesSeen: seen.concat(pick) });
    return PC_HEALTH_JOKES[pick];
}

function pcHealthSum(counts) {
    return PC_HEALTH_ACTIONS.reduce((total, action) => total + (Number(counts && counts[action.id]) || 0), 0);
}

// --- Talking to the API ----------------------------------------------------------

/**
 * One call to the API. Resolves to its JSON, or null for anything that isn't
 * a proper answer: a timeout, a network error, a Cloudflare error page, the
 * site's own 404 when the Worker isn't there.
 */
async function pcHealthRequest(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PC_HEALTH_TIMEOUT_MS);
    try {
        const response = await fetch(PC_HEALTH_API + path, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            signal: controller.signal
        });
        const json = await response.json();
        if (!json || typeof json !== 'object') return null;
        if (json.resting === true || json.error === 'disabled') return json;
        if (!response.ok || !Number.isFinite(json.lift)) return null;
        return json;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Takes in an answer from the API. Returns whether it was a usable one. */
function applyPcHealthAnswer(answer) {
    if (!answer) {
        pcHealthState.status = 'offline';
        return false;
    }
    if (answer.error === 'disabled') {
        pcHealthState.status = 'off';
        return false;
    }
    if (answer.resting) {
        const until = Number(answer.until);
        writePcHealthMemory({ restingUntil: Number.isFinite(until) ? until : Date.now() + PC_HEALTH_DAY_MS });
        pcHealthState.status = 'resting';
        return false;
    }

    const today = {};
    PC_HEALTH_ACTIONS.forEach(action => {
        today[action.id] = Math.max(0, Number(answer.today && answer.today[action.id]) || 0);
    });
    const last = answer.last && pcHealthAction(answer.last.action) && Number.isFinite(answer.last.at)
        ? { action: answer.last.action, at: answer.last.at }
        : null;

    // A new UTC day, or the window just opened: count other visitors from here
    if (!pcHealthState.openedToday || pcHealthSum(today) < pcHealthSum(pcHealthState.openedToday)) {
        pcHealthState.openedToday = today;
        pcHealthState.ownAccepted = {};
    }

    pcHealthState.server = { today, total: Math.max(0, Number(answer.total) || 0), last };
    pcHealthState.status = 'online';

    // The lift was faded to the server's clock; from here this browser fades
    // it from now, by its own clock
    writePcHealthMemory({
        lift: Math.min(Math.max(answer.lift, 0), PC_HEALTH_MAX_LIFT),
        at: Date.now(),
        halfLifeHours: Number(answer.halfLifeHours) > 0 ? Number(answer.halfLifeHours) : PC_HEALTH_HALF_LIFE_HOURS
    });
    return true;
}

function pcHealthCanCall() {
    if (!pcHealthState.shared) return false;
    const restingUntil = Number(readPcHealthMemory().restingUntil);
    if (Number.isFinite(restingUntil) && Date.now() < restingUntil) {
        pcHealthState.status = 'resting';
        return false;
    }
    return pcHealthState.status !== 'off';
}

async function refreshPcHealth() {
    if (!pcHealthCanCall()) {
        renderPcHealth();
        return;
    }
    pcHealthState.lastRefresh = Date.now();
    applyPcHealthAnswer(await pcHealthRequest(''));
    renderPcHealth();
    announcePcHealthOthers();
    announcePcHealthBand();
}

// --- Static data ------------------------------------------------------------------

async function pcHealthJson(url) {
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch (e) {
        return null;
    }
}

async function loadPcHealthData() {
    const [features, watching, spotify] = await Promise.all([
        pcHealthJson('data/features.json'),
        pcHealthJson('data/watching.json'),
        pcHealthJson('data/spotify-data.json')
    ]);

    // Anything but a clear yes stays local
    pcHealthState.shared = Boolean(features && features.pcHealthShared === true);
    if (!pcHealthState.shared) pcHealthState.status = 'off';

    // The series I watched most recently comes first
    const current = watching && Array.isArray(watching.inProgress) && watching.inProgress[0];
    if (current && typeof current.lastWatchedAt === 'string') {
        pcHealthState.watchedAt = current.lastWatchedAt;
        pcHealthState.watchedTitle = typeof current.title === 'string' ? current.title : null;
        // So the Mood row can count it on the next visit, before this loads
        writePcHealthMemory({ watchedAt: current.lastWatchedAt });
    }

    const track = spotify && Array.isArray(spotify.topTracks) && spotify.topTracks[0];
    if (track && typeof track.name === 'string' && typeof track.artist === 'string') {
        pcHealthState.track = { name: track.name, artist: track.artist };
    }
}

// --- The window ---------------------------------------------------------------------

function buildPcHealthWindow() {
    const win = makeElement('div', 'win95-window pc-health-window');
    win.id = 'pcHealthWindow';
    win.hidden = true;
    win.tabIndex = -1;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-labelledby', 'pcHealthTitle');

    win.innerHTML = `
        <div class="win95-title-bar" id="pcHealthTitleBar">
            <div class="win95-title" id="pcHealthTitle"><span class="PcHealthIcon_16x16"></span>PC Health</div>
            <div class="win95-buttons">
                <button class="win95-button win95-minimize" type="button" tabindex="-1" aria-hidden="true">_</button>
                <button class="win95-button win95-maximize" type="button" tabindex="-1" aria-hidden="true">&#9633;</button>
                <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
            </div>
        </div>

        <div class="pc-health-body">
            <div class="pc-health-top">
                <div class="pc-health-art" id="pcHealthArt">
                    ${PC_HEALTH_ART_SVG}
                    <span class="pc-health-heart" aria-hidden="true"></span>
                    <svg class="pc-health-ha" viewBox="0 0 7 5" width="21" height="15" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
                        <g fill="#000"><rect x="0" y="0" width="1" height="5"/><rect x="2" y="0" width="1" height="5"/><rect x="1" y="2" width="1" height="1"/>
                        <rect x="4" y="1" width="1" height="4"/><rect x="6" y="1" width="1" height="4"/><rect x="5" y="0" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/></g>
                    </svg>
                </div>
                <div class="pc-health-readout">
                    <div class="pc-health-state"><span id="pcHealthState"></span> <span class="pc-health-percent" id="pcHealthPercent"></span></div>
                    <div class="pc-health-meter" id="pcHealthMeter" role="meter" aria-label="Mood"
                         aria-valuemin="${PC_HEALTH_MIN}" aria-valuemax="${PC_HEALTH_MAX}">
                        <div class="pc-health-meter-fill" id="pcHealthMeterFill"></div>
                    </div>
                    <p class="pc-health-line" id="pcHealthLine"></p>
                    <p class="pc-health-humming" id="pcHealthHumming" hidden></p>
                </div>
            </div>

            <div class="pc-health-bubble" id="pcHealthBubble"></div>
            <div class="pc-health-defrag" id="pcHealthDefrag" hidden>
                <div class="pc-health-defrag-title">Defragmenting Drive C</div>
                <div class="pc-health-defrag-bar" role="progressbar" aria-label="Defragmenting Drive C"
                     aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="pc-health-defrag-fill" id="pcHealthDefragFill"></div>
                </div>
            </div>

            <fieldset class="pc-health-actions">
                <legend>Cheer it up</legend>
                <div class="pc-health-buttons" id="pcHealthButtons"></div>
            </fieldset>

            <fieldset class="pc-health-lately">
                <legend>Lately</legend>
                <p id="pcHealthTraces"></p>
                <p id="pcHealthLife" hidden></p>
            </fieldset>

            <div class="pc-health-live" id="pcHealthLive" role="status"></div>
        </div>

        <div class="pc-health-statusbar">
            <span id="pcHealthMode"></span>
            <span id="pcHealthYours"></span>
        </div>`;

    const buttons = win.querySelector('#pcHealthButtons');
    PC_HEALTH_ACTIONS.forEach(action => {
        const button = makeElement('button', 'win95-btn pc-health-action', action.label);
        button.type = 'button';
        button.dataset.action = action.id;
        button.addEventListener('click', () => cheerPcHealth(action.id));
        buttons.appendChild(button);
    });

    document.body.appendChild(win);

    win.querySelector('.win95-close').addEventListener('click', closePcHealthWindow);
    // Esc closes it when it has focus, not every window on the desktop
    win.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePcHealthWindow();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pcHealthIsOpen() &&
            Date.now() - pcHealthState.lastRefresh >= PC_HEALTH_REFRESH_MS) {
            refreshPcHealth();
        }
    });

    WindowManager.register(win);
    return win;
}

async function showPcHealthWindow(opener) {
    const win = pcHealthWindow() || buildPcHealthWindow();
    const wasOpen = WindowManager.open(win);
    win.focus({ preventScroll: true });
    if (wasOpen) return;

    pcHealthState.returnFocus = opener && opener !== document.body && !win.contains(opener) ? opener : null;
    pcHealthState.openedToday = null;
    pcHealthState.ownAccepted = {};
    pcHealthState.lastSummary = '';
    pcHealthState.cheeredOffline = false;
    pcHealthState.band = null;
    pcHealthState.drawnFace = null;
    pcHealthState.moodSettled = false;
    if (pcHealthState.status !== 'off') pcHealthState.status = 'loading';

    setPcHealthBubble(pcHealthGreeting(Date.now()));
    renderPcHealth();
    centerInViewport(win);

    clearInterval(pcHealthState.tick);
    pcHealthState.tick = setInterval(() => {
        renderPcHealth();
        announcePcHealthBand();
    }, PC_HEALTH_TICK_MS);

    await loadPcHealthData();
    if (!pcHealthIsOpen()) return;
    renderPcHealth();
    await refreshPcHealth();
    // The mood it opened with is the one later changes are told against,
    // and shown against
    if (pcHealthState.band === null) pcHealthBandChange();
    pcHealthState.moodSettled = true;
}

function closePcHealthWindow() {
    const win = pcHealthWindow();
    if (!win || win.hidden) return;

    WindowManager.close(win);
    clearInterval(pcHealthState.tick);
    pcHealthState.tick = null;
    pcHealthState.timers.forEach(clearTimeout);
    pcHealthState.timers = [];
    stopPcHealthScene();
    stopPcHealthDrive();
    pcHealthState.coolingUntil = 0;
    setPcHealthCooling(false);
    document.getElementById('pcHealthDefrag').hidden = true;
    renderPcHealthRow();

    const target = pcHealthState.returnFocus;
    if (target && target.isConnected) target.focus();
}

// --- Drawing ---------------------------------------------------------------------------

function pcHealthWindowMood(now = Date.now()) {
    const memory = readPcHealthMemory();
    const watchedAt = pcHealthState.watchedAt || memory.watchedAt;
    return pcHealthMood(pcHealthBaseline(pcHealthCoffee, watchedAt, now), pcHealthRememberedLift(memory, now));
}

function pcHealthTracesText(now) {
    const status = pcHealthState.status;
    if (status === 'off') return PC_HEALTH_LINES.off;
    if (status === 'resting') return PC_HEALTH_LINES.resting;
    if (status === 'loading') return PC_HEALTH_LINES.loading;
    if (status === 'offline' || !pcHealthState.server) {
        return pcHealthState.cheeredOffline ? PC_HEALTH_LINES.offlineCheered : PC_HEALTH_LINES.offline;
    }

    const { today, last } = pcHealthState.server;
    const count = pcHealthSum(today);
    const parts = [count === 0 ? 'No cheers yet today.' : `${count.toLocaleString()} ${count === 1 ? 'cheer' : 'cheers'} today.`];
    if (last) {
        parts.push(`Last one: ${pcHealthAction(last.action).one}, ${pcHealthAgo(last.at, now)}.`);
    }
    return parts.join(' ');
}

// Bits of my own week, so a lone visitor still finds a PC with a life
function pcHealthLifeText(now) {
    const parts = [];
    const visit = pcHealthCoffee && Date.parse(pcHealthCoffee.lastVisitAt);
    if (Number.isFinite(visit)) parts.push(`André last had a coffee ${pcHealthAgo(visit, now)}.`);
    const watched = Date.parse(pcHealthState.watchedAt);
    if (Number.isFinite(watched) && pcHealthState.watchedTitle) {
        parts.push(`Last episode: ${pcHealthState.watchedTitle}, ${pcHealthAgo(watched, now)}.`);
    }
    return parts.join(' ');
}

function renderPcHealth() {
    if (!pcHealthWindow()) return;
    const now = Date.now();
    const mood = pcHealthWindowMood(now);
    const band = pcHealthBand(mood);

    // Face, word and number together. Dozing changes the face and the line,
    // never the word or the number.
    const dozing = pcHealthIsDozing(now);
    const face = pcHealthFace(band, now);
    if (pcHealthState.moodSettled && pcHealthState.drawnFace && face !== pcHealthState.drawnFace && pcHealthIsOpen()) {
        playPcHealthStatic();
    }
    pcHealthState.drawnFace = face;
    document.getElementById('pcHealthArt').dataset.face = face;
    document.getElementById('pcHealthState').textContent = band.state;
    document.getElementById('pcHealthPercent').textContent = `${mood}%`;
    document.getElementById('pcHealthLine').textContent = dozing
        ? `Dozing. It's ${pcHealthCapeTown(now).time} in Cape Town.`
        : band.line;

    const meter = document.getElementById('pcHealthMeter');
    meter.setAttribute('aria-valuenow', String(mood));
    meter.setAttribute('aria-valuetext', `${band.state}, ${mood}%`);
    const share = (mood - PC_HEALTH_MIN) / (PC_HEALTH_MAX - PC_HEALTH_MIN);
    document.getElementById('pcHealthMeterFill').style.transform = `scaleX(${share})`;

    const humming = document.getElementById('pcHealthHumming');
    humming.hidden = !pcHealthState.track;
    if (pcHealthState.track) {
        humming.textContent = `Humming: ${pcHealthState.track.name} by ${pcHealthState.track.artist}.`;
    }

    document.getElementById('pcHealthTraces').textContent = pcHealthTracesText(now);
    const life = pcHealthLifeText(now);
    const lifeElement = document.getElementById('pcHealthLife');
    lifeElement.hidden = !life;
    lifeElement.textContent = life;

    document.getElementById('pcHealthMode').textContent = PC_HEALTH_STATUS_TEXT[pcHealthState.status];
    const cheers = Number(readPcHealthMemory().cheers) || 0;
    document.getElementById('pcHealthYours').textContent = cheers === 0
        ? 'You haven\'t cheered me up yet.'
        : `You've cheered me up ${cheers.toLocaleString()} ${cheers === 1 ? 'time' : 'times'}.`;

    renderPcHealthRow();
}

function setPcHealthBubble(text) {
    document.getElementById('pcHealthBubble').textContent = text;
}

function setPcHealthCooling(cooling) {
    document.querySelectorAll('#pcHealthButtons .pc-health-action').forEach(button => {
        if (cooling) {
            button.setAttribute('aria-disabled', 'true');
        } else {
            button.removeAttribute('aria-disabled');
        }
    });
}

// Each cheer's own reaction, restarted even on quick cheers. The scene
// moves the PC; is-cheered starts what CSS draws around it (a pat's heart, a
// joke's "HA").
function playPcHealthReaction(actionId) {
    const art = document.getElementById('pcHealthArt');
    art.classList.remove('is-cheered');
    art.dataset.action = actionId;
    void art.offsetWidth;
    art.classList.add('is-cheered');
    playPcHealthScene(PC_HEALTH_SCENES[actionId]());
}

// --- Scenes ---------------------------------------------------------------------------
// A scene is a list of frames, like a flip book: at `t` ms the PC pulls
// `face` (data-react; none means its mood's own face), stands at `move` (an
// SVG transform, in pixels of the 32x32 art), has `props` drawn around it,
// and with `busy` its disk light flickers. The last frame only marks the end.
// Everything is fixed markup built from the pixel lists below, never data.
// Under reduced motion no scene plays, so the PC just keeps its mood's face.

const PC_HEALTH_MUG = [[0, 0, 5, 6, '#000'], [1, 1, 3, 4, '#c8352c'], [1, 1, 3, 1, '#5a3412'], [1, 2, 1, 2, '#e8796f'],
    [5, 1, 2, 1, '#000'], [6, 2, 1, 2, '#000'], [5, 4, 2, 1, '#000']];
const PC_HEALTH_STEAM = [[[1, -2], [2, -4], [1, -6]], [[2, -2], [1, -4], [2, -6]], [[1, -3], [2, -5], [1, -7]], [[2, -3], [1, -5], [2, -7]]];
// Dust blown out of the fan's vent, frame by frame
const PC_HEALTH_DUST = [
    [[19, 20], [21, 20]],
    [[18, 21], [20, 21], [21, 21], [22, 20]],
    [[17, 22], [21, 22], [23, 21], [24, 21], [25, 20]],
    [[16, 24], [22, 23], [26, 22], [28, 21]],
    [[15, 26], [24, 25], [30, 23]]
];
// Defrag's map fills the screen, 14 x 7 clusters
const PC_HEALTH_MAP = { x: 9, y: 8, cols: 14, rows: 7 };
const PC_HEALTH_CLUSTER_COLOURS = ['', '#0000a8', '#e00000', '#fff'];
const PC_HEALTH_NOISE_COLOURS = ['#fff', '#c0c0c0', '#5c5848', '#2aa6a6'];

function pcHealthPixels(list, dx = 0, dy = 0, fill = '') {
    return list.map(([x, y, w = 1, h = 1, colour = fill]) =>
        `<rect x="${x + dx}" y="${y + dy}" width="${w}" height="${h}"${colour ? ` fill="${colour}"` : ''}/>`).join('');
}

const pcHealthMug = x => pcHealthPixels(PC_HEALTH_MUG, x, 23);
const pcHealthSteam = i => `<g opacity="${i > 7 ? 0.5 : 0.9}">${pcHealthPixels(PC_HEALTH_STEAM[i % PC_HEALTH_STEAM.length], 0, 23, '#fff')}</g>`;
const pcHealthDust = i => `<g opacity="${1 - i / 6}">${pcHealthPixels(PC_HEALTH_DUST[i], 0, 0, '#6f6a5a')}</g>`;

/** A hop: up two pixels and back, from `t` */
function pcHealthHop(t, face) {
    return [0, -1, -2, -1, 0].map((y, i) => ({ t: t + i * 125, face, move: `translate(0 ${y})` }));
}

const PC_HEALTH_SCENES = {
    // Happy closed eyes and a blush, and a double wiggle (the heart is CSS)
    pat: () => [
        ...[-3, 0, 3, 0, -3, 0, 3, 0].map((angle, i) => ({ t: i * 110, face: 'patted', move: `rotate(${angle} 16 29)` })),
        { t: 880, face: 'patted' },
        { t: 1300 }
    ],

    // A mug slides in and steams while it takes a sniff, slides away, and
    // the caffeine kicks in
    coffee: () => [
        ...[-9, -5, 0].map((x, i) => ({ t: i * 90, props: pcHealthMug(x) })),
        ...Array.from({ length: 10 }, (_, i) => ({ t: 270 + i * 140, face: 'sip', props: pcHealthMug(0) + pcHealthSteam(i) })),
        ...[-5, -9].map((x, i) => ({ t: 1670 + i * 90, face: 'sip', props: pcHealthMug(x) })),
        { t: 1850, face: 'wired', busy: true },
        ...Array.from({ length: 16 }, (_, i) => ({
            t: 2100 + i * 50, face: 'wired', busy: true, move: `translate(${i % 2 ? 1 : -1} ${i % 4 === 1 ? -1 : 0})`
        })),
        { t: 2900, face: 'wired' },
        ...pcHealthHop(3250, 'great'),
        { t: 3875, face: 'great' },
        { t: 4200 }
    ],

    // Laughing bounces (the "HA" is CSS)
    joke: () => [
        ...Array.from({ length: 8 }, (_, i) => ({ t: i * 120, face: 'laugh', move: i % 2 ? '' : 'translate(0 -1)' })),
        { t: 960, face: 'laugh' },
        { t: 1300 }
    ],

    // Defrag's map plays while the progress bar runs (pcHealthDefragScene);
    // this is the PC once it's finished
    defrag: () => [...pcHealthHop(0, 'happy'), { t: 625, face: 'happy' }, { t: 1100 }],

    // A puff of dust from the vent, "ah... ah...", and a sneeze that blows
    // out the rest
    dust: () => [
        ...PC_HEALTH_DUST.map((frame, i) => ({ t: i * 130, props: pcHealthDust(i) })),
        { t: 650 },
        ...[0, -1, 0, -1].map((y, i) => ({ t: 850 + i * 260, face: 'ahh', move: `translate(0 ${y})` })),
        ...[[0, -3], [-1, -1], [1, 0], [-1, 0], [0, 0]].map(([x, y], i) => ({
            t: 1890 + i * 70, face: 'sneeze', move: `translate(${x} ${y})`, props: pcHealthDust(i)
        })),
        { t: 2240, face: 'sneeze' },
        { t: 2540, face: 'happy' },
        { t: 3240 }
    ]
};

/**
 * Defrag's map on the PC's own screen: scattered clusters, some fragmented
 * (red), packed to the front one by one, each lit white as it lands.
 */
function pcHealthDefragScene(duration) {
    const { x, y, cols, rows } = PC_HEALTH_MAP;
    const cells = Array.from({ length: cols * rows }, () => {
        const r = Math.random();
        return r < 0.42 ? 0 : r < 0.75 ? 1 : 2;
    });

    // Every move: the last used cluster into the first free one. Then the
    // fragmented ones still in place are tidied.
    const steps = [];
    const sim = cells.slice();
    for (let to = 0, from = sim.length - 1; to < from; to++) {
        if (sim[to] !== 0) continue;
        while (from > to && sim[from] === 0) from--;
        if (from <= to) break;
        steps.push([from, to]);
        sim[to] = 1;
        sim[from] = 0;
    }
    sim.forEach((cell, i) => { if (cell === 2) steps.push([i, i]); });

    const draw = (lit) => cells.map((cell, i) => {
        const colour = PC_HEALTH_CLUSTER_COLOURS[lit.includes(i) ? 3 : cell];
        return colour ? pcHealthPixels([[x + (i % cols), y + Math.floor(i / cols)]], 0, 0, colour) : '';
    }).join('');

    const count = 40;
    const perFrame = Math.max(1, Math.ceil(steps.length / count));
    const frames = [{ t: 0, face: 'blank', busy: true, props: draw([]) }];
    for (let f = 1; f <= count; f++) {
        const lit = [];
        steps.splice(0, perFrame).forEach(([from, to]) => {
            cells[from] = 0;
            cells[to] = 1;
            lit.push(to);
        });
        frames.push({ t: Math.round(((duration - 100) * f) / count), face: 'blank', busy: true, props: draw(lit) });
    }
    // It ends when the PC reacts to the finished Defrag (at `duration`)
    frames.push({ t: duration - 50, face: 'blank', props: draw([]) }, { t: duration + 500 });
    return frames;
}

/** A burst of static on the screen, then the new face */
function pcHealthStaticScene() {
    const frames = [];
    for (let f = 0; f < 5; f++) {
        const pixels = [];
        for (let y = 6; y < 17; y++) {
            for (let x = 8; x < 24; x++) {
                if (Math.random() < 0.55) {
                    pixels.push([x, y, 1, 1, PC_HEALTH_NOISE_COLOURS[Math.floor(Math.random() * PC_HEALTH_NOISE_COLOURS.length)]]);
                }
            }
        }
        frames.push({ t: f * 60, face: 'blank', props: pcHealthPixels(pixels) });
    }
    frames.push({ t: 300 });
    return frames;
}

function drawPcHealthFrame({ face, move, props, busy }) {
    const art = document.getElementById('pcHealthArt');
    if (face) {
        art.dataset.react = face;
    } else {
        delete art.dataset.react;
    }
    art.classList.toggle('is-busy', Boolean(busy));
    art.querySelector('.pc-health-pc').setAttribute('transform', move || '');
    art.querySelector('.pc-health-props').innerHTML = props || '';
}

function stopPcHealthScene() {
    pcHealthState.sceneTimers.forEach(clearTimeout);
    pcHealthState.sceneTimers = [];
    pcHealthState.staticPending = false;
    const art = document.getElementById('pcHealthArt');
    if (!art) return;
    drawPcHealthFrame({});
    art.classList.remove('is-acting');
}

function playPcHealthScene(frames) {
    // A mood change still waiting for its static waits for this scene instead
    const pending = pcHealthState.staticPending;
    stopPcHealthScene();
    pcHealthState.staticPending = pending;
    if (pcHealthReducedMotion() || !frames.length) return;

    // is-acting pauses the idle animations (glances, the yawn) meanwhile
    document.getElementById('pcHealthArt').classList.add('is-acting');
    const last = frames.length - 1;
    frames.forEach((frame, i) => {
        // The first frame straight away, so the mood's face doesn't flash between scenes
        if (i === 0 && frame.t === 0 && i < last) {
            drawPcHealthFrame(frame);
            return;
        }
        pcHealthState.sceneTimers.push(setTimeout(() => {
            if (i < last) {
                drawPcHealthFrame(frame);
                return;
            }
            // A mood change during the scene gets its static once it's over
            const pending = pcHealthState.staticPending;
            stopPcHealthScene();
            if (pending) playPcHealthScene(pcHealthStaticScene());
        }, frame.t));
    });
}

/** The mood changed: static, now or once the PC finishes reacting */
function playPcHealthStatic() {
    if (pcHealthState.sceneTimers.length) {
        pcHealthState.staticPending = true;
    } else {
        playPcHealthScene(pcHealthStaticScene());
    }
}

// --- Announcements -------------------------------------------------------------------
// One status region, and one message at a time, so nothing cuts off anything
// else. Your own cheer is read out straight away, with the mood if it changed
// band. Other visitors' cheers are summed up at most once a minute, with your
// next cheer or when the window refreshes.

function announcePcHealth(text) {
    const live = document.getElementById('pcHealthLive');
    if (!live || !text) return;
    // The same words again still need reading out
    live.textContent = live.textContent === text ? `${text} ` : text;
}

function pcHealthBandChange() {
    const state = pcHealthBand(pcHealthWindowMood()).state;
    if (state === pcHealthState.band) return '';
    const first = pcHealthState.band === null;
    pcHealthState.band = state;
    return first ? '' : `Mood: ${state}.`;
}

function announcePcHealthBand() {
    if (!pcHealthIsOpen()) return;
    const change = pcHealthBandChange();
    if (change) announcePcHealth(change);
}

function pcHealthOthersSummary() {
    const { server, openedToday, ownAccepted } = pcHealthState;
    if (!server || !openedToday) return '';
    const parts = PC_HEALTH_ACTIONS.map(action => {
        const others = server.today[action.id] - openedToday[action.id] - (ownAccepted[action.id] || 0);
        return others > 0 ? `${others.toLocaleString()} ${others === 1 ? action.one.replace(/^an? /, '') : action.many}` : '';
    }).filter(Boolean);
    return parts.length ? `Since you opened: ${parts.join(', ')}.` : '';
}

/** Other visitors' cheers, if there are new ones and it's been a minute */
function takePcHealthSummary() {
    const summary = pcHealthOthersSummary();
    const now = Date.now();
    if (!summary || summary === pcHealthState.lastSummary || now - pcHealthState.lastSummaryAt < PC_HEALTH_SUMMARY_MS) {
        return '';
    }
    pcHealthState.lastSummary = summary;
    pcHealthState.lastSummaryAt = now;
    return summary;
}

function announcePcHealthOthers() {
    if (!pcHealthIsOpen()) return;
    const summary = takePcHealthSummary();
    if (summary) announcePcHealth(summary);
}

// --- Cheering -------------------------------------------------------------------------

// --- Defrag's hard drive ----------------------------------------------------------------
// While Defrag runs you hear the drive at work: a low spin, and the heads
// seeking, a tick at a time and in bursts. Wilhelm Kirschbaum's idea.
// Synthesised like Skype's sounds, so there's no file to download. It only
// ever starts from the Run Defrag click, stays quiet, and stops the moment
// the window closes.

const PC_HEALTH_DRIVE_VOLUME = 0.25;
let pcHealthAudio = null;
let pcHealthDriveOut = null;

function playPcHealthDrive(duration) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || duration <= 0) return;

    try {
        pcHealthAudio = pcHealthAudio || new AudioContextClass();
        const ctx = pcHealthAudio;
        if (ctx.state === 'suspended') ctx.resume();
        stopPcHealthDrive();

        const out = ctx.createGain();
        out.gain.value = PC_HEALTH_DRIVE_VOLUME;
        out.connect(ctx.destination);
        pcHealthDriveOut = out;

        const start = ctx.currentTime + 0.02;
        const end = start + duration / 1000;

        // The spindle: a low hum that fades in and out
        const spin = ctx.createOscillator();
        const spinLevel = ctx.createGain();
        spin.type = 'triangle';
        spin.frequency.value = 120;
        spinLevel.gain.setValueAtTime(0, start);
        spinLevel.gain.linearRampToValueAtTime(0.06, start + 0.15);
        spinLevel.gain.setValueAtTime(0.06, end - 0.15);
        spinLevel.gain.linearRampToValueAtTime(0, end);
        spin.connect(spinLevel).connect(out);
        spin.start(start);
        spin.stop(end + 0.05);

        // A seek: a 12 ms burst of noise that dies away fast
        const tick = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.012), ctx.sampleRate);
        const samples = tick.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 3);
        }

        for (let t = start + 0.05; t < end - 0.05;) {
            // Mostly single ticks, sometimes a burst of them
            const burst = Math.random() < 0.35 ? 3 + Math.floor(Math.random() * 6) : 1;
            for (let i = 0; i < burst && t < end - 0.05; i++) {
                const source = ctx.createBufferSource();
                const tone = ctx.createBiquadFilter();
                const level = ctx.createGain();
                source.buffer = tick;
                tone.type = 'bandpass';
                tone.frequency.value = 1800 + Math.random() * 1800;
                tone.Q.value = 1.5;
                level.gain.value = 0.4 + Math.random() * 0.5;
                source.connect(tone).connect(level).connect(out);
                source.start(t);
                t += 0.012 + Math.random() * 0.02;
            }
            t += 0.03 + Math.random() * 0.12;
        }
    } catch (e) {
        // Sound is a nice-to-have
    }
}

/** Silences the drive at once; anything still scheduled plays to nothing */
function stopPcHealthDrive() {
    if (!pcHealthDriveOut) return;
    pcHealthDriveOut.disconnect();
    pcHealthDriveOut = null;
}

function runPcHealthDefrag(done) {
    const panel = document.getElementById('pcHealthDefrag');
    const bar = panel.querySelector('[role="progressbar"]');
    const fill = document.getElementById('pcHealthDefragFill');
    const steps = 10;
    const duration = pcHealthReducedMotion() ? 0 : PC_HEALTH_DEFRAG_MS;

    const show = step => {
        const percent = Math.round((step / steps) * 100);
        bar.setAttribute('aria-valuenow', String(percent));
        fill.style.transform = `scaleX(${step / steps})`;
    };

    if (duration === 0) {
        show(steps);
        done();
        return;
    }

    panel.hidden = false;
    show(0);
    playPcHealthScene(pcHealthDefragScene(duration));
    playPcHealthDrive(duration);
    for (let step = 1; step <= steps; step++) {
        pcHealthState.timers.push(setTimeout(() => {
            show(step);
            if (step === steps) {
                panel.hidden = true;
                done();
            }
        }, (duration / steps) * step));
    }
}

async function cheerPcHealth(actionId) {
    const action = pcHealthAction(actionId);
    const now = Date.now();
    if (!action || now < pcHealthState.coolingUntil) return;

    const duration = action.id === 'defrag' && !pcHealthReducedMotion() ? PC_HEALTH_DEFRAG_MS : 0;
    pcHealthState.coolingUntil = now + Math.max(PC_HEALTH_COOLDOWN_MS, duration);
    setPcHealthCooling(true);
    pcHealthState.timers.push(setTimeout(() => setPcHealthCooling(false), Math.max(PC_HEALTH_COOLDOWN_MS, duration)));

    // It always counts here, whatever the network says
    const memory = readPcHealthMemory();
    writePcHealthMemory({
        lift: pcHealthApplyCheer(pcHealthRememberedLift(memory, now), PC_HEALTH_LOCAL_GAIN),
        at: now,
        halfLifeHours: Number(memory.halfLifeHours) > 0 ? Number(memory.halfLifeHours) : PC_HEALTH_HALF_LIFE_HOURS,
        cheers: (Number(memory.cheers) || 0) + 1
    });

    // A cheer at night wakes it for a while
    const woken = pcHealthIsDozing(now);
    if (pcHealthPartOfDay(now) === 'night') wakePcHealth(now);

    const reaction = [woken ? PC_HEALTH_LINES.woken : '', action.reaction()].filter(Boolean).join(' ');
    const react = () => {
        playPcHealthReaction(action.id);
        setPcHealthBubble(reaction);
        renderPcHealth();
        announcePcHealth([reaction, pcHealthBandChange(), takePcHealthSummary()].filter(Boolean).join(' '));
    };

    if (action.id === 'defrag') {
        // Sent once Defrag finishes, so its result is heard before any news
        // from the network. Closing the window part way stops both.
        setPcHealthBubble('Defragmenting Drive C...');
        await new Promise(resolve => runPcHealthDefrag(() => {
            react();
            resolve();
        }));
    } else {
        react();
    }

    if (!pcHealthCanCall()) {
        renderPcHealth();
        return;
    }

    const body = { action: action.id };
    if (!pcHealthState.firstSent) body.first = true;
    const answer = await pcHealthRequest('/cheer', body);
    const wasOffline = pcHealthState.status === 'offline' && pcHealthState.cheeredOffline;

    if (applyPcHealthAnswer(answer)) {
        pcHealthState.cheeredOffline = false;
        if (answer.accepted === true) {
            pcHealthState.firstSent = true;
            pcHealthState.ownAccepted[action.id] = (pcHealthState.ownAccepted[action.id] || 0) + 1;
        }
    } else if (pcHealthState.status === 'offline') {
        pcHealthState.cheeredOffline = true;
    }

    if (!pcHealthIsOpen()) return;
    renderPcHealth();

    // Going offline or resting is news. Said with the reaction, in one
    // message, in case the reaction was cut off by it.
    if (pcHealthState.status === 'offline' && !wasOffline) {
        announcePcHealth(`${reaction} ${PC_HEALTH_LINES.offlineCheered}`);
    } else if (pcHealthState.status === 'resting') {
        announcePcHealth(`${reaction} ${PC_HEALTH_LINES.resting}`);
    }
}
