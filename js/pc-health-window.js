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
    'I tried to tell a UDP joke, but I\'m not sure you got it.'
];

const PC_HEALTH_LINES = {
    loading: 'Checking on the other visitors...',
    off: 'Visitor cheers are switched off for now. I still appreciate it.',
    resting: 'I\'ve had a lot of visitors today and I need a rest. Come back tomorrow.',
    offline: 'Can\'t reach the network right now.',
    offlineCheered: 'Can\'t reach the network, but I still felt that.',
    greeting: 'Hello. It\'s been a long day of serving web pages.'
};

const PC_HEALTH_STATUS_TEXT = {
    loading: 'Connecting...',
    online: 'Shared with every visitor',
    offline: 'Working offline',
    resting: 'Resting until tomorrow',
    off: 'Just you and me'
};

// A beige CRT in pixel art, with a face for each band
const PC_HEALTH_ART_SVG = `
    <svg class="pc-health-svg" viewBox="0 0 32 32" width="128" height="128" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
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
            <rect x="13" y="14" width="6" height="1"/>
            <rect x="21" y="7" width="2" height="1"/><rect x="22" y="8" width="1" height="1"/><rect x="21" y="9" width="2" height="1"/>
        </g>
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

    const current = watching && watching.current;
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
    if (pcHealthState.status !== 'off') pcHealthState.status = 'loading';

    setPcHealthBubble(PC_HEALTH_LINES.greeting);
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
    // The mood it opened with is the one later changes are told against
    if (pcHealthState.band === null) pcHealthBandChange();
}

function closePcHealthWindow() {
    const win = pcHealthWindow();
    if (!win || win.hidden) return;

    WindowManager.close(win);
    clearInterval(pcHealthState.tick);
    pcHealthState.tick = null;
    pcHealthState.timers.forEach(clearTimeout);
    pcHealthState.timers = [];
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

    document.getElementById('pcHealthArt').dataset.face = band.face;
    document.getElementById('pcHealthState').textContent = band.state;
    document.getElementById('pcHealthPercent').textContent = `${mood}%`;
    document.getElementById('pcHealthLine').textContent = band.line;

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

// The little hop and heart, restarted even on quick cheers
function playPcHealthReaction(actionId) {
    const art = document.getElementById('pcHealthArt');
    art.classList.remove('is-cheered');
    art.dataset.action = actionId;
    void art.offsetWidth;
    art.classList.add('is-cheered');
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

    const reaction = action.reaction();
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
