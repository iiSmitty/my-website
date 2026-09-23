// Skype 2014 Easter Egg
// A friend's old Skype contact export still had my 2014 profile in it. This
// brings that contact card back as a Win95 window.
//
// Two ways in:
//  - Desktop: double-click the Recycle Bin (wired up in program-icons.js).
//  - Anywhere, touch included: click/tap the "Visitors" counter in the status
//    bar. A "has come online" notification pops up; open it to see the profile.
//
// Nothing is built until it's first needed: the stylesheet, avatar and DOM
// only load on the first trigger, so the home page doesn't pay for them.

const SKYPE_PROFILE = {
    skypeName: 'andrez.smit',
    displayName: 'André Smit',
    mood: 'Always Happy :)',
    aboutMe: 'I don\'t need to "GET A LIFE." I\'m a gamer. I have lots of lives!',
    country: 'South Africa (za)',
    language: 'English (en)',
    avatar: 'images/skype-avatar.jpg',
    // 1:1 chat stats from the export (every message was mine)
    messageCount: 8,
    firstMessage: new Date(2014, 6, 27, 13, 48),
    lastMessage: new Date(2014, 7, 3, 18, 0)
};

// The phone numbers are deliberately NOT here. The profile had them, but
// contact details stay behind the Cloudflare Worker (see decrypt.js), so the
// card only ever shows them redacted.

const SKYPE_STARTING_LIVES = 3;
const SKYPE_MAX_LIVES = 99;
const SKYPE_TOAST_DURATION = 10000;

let skypeLives = SKYPE_STARTING_LIVES;
let skypeStylesPromise = null;
let skypeToastTimer = null;
let skypeChatTimers = [];
let skypeReturnFocus = null;
let skypeAudioContext = null;

// Small presence badge (green tick) used on the avatar and the notification
const SKYPE_PRESENCE_SVG = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" fill="#7fba00" stroke="#ffffff" stroke-width="2"/>
        <path d="M4.6 8.3l2.2 2.2 4.5-4.6" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const SKYPE_LOGO_SVG = `
    <svg class="skype-logo" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="8" cy="8" r="7.5" fill="#00aff0"/>
        <text x="8" y="12" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="11" fill="#ffffff">S</text>
    </svg>`;

// --- Helpers ---------------------------------------------------------------

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Load the egg's stylesheet on first use. Resolves even if it fails, so the
// window still opens (unstyled) rather than not at all.
function loadSkypeStyles() {
    if (!skypeStylesPromise) {
        skypeStylesPromise = new Promise(resolve => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/skype.min.css';
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    }
    return skypeStylesPromise;
}

function playSkypeSound(type) {
    try {
        const sound = new Audio(`sounds/win95-${type}.mp3`);
        sound.volume = 0.5;
        sound.play().catch(() => {});
    } catch (e) {
        // Sound is a nice-to-have
    }
}

// A tiny chiptune arpeggio for collecting an extra life, synthesised so there's
// no audio file to download.
function playExtraLifeSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        skypeAudioContext = skypeAudioContext || new AudioContextClass();
        if (skypeAudioContext.state === 'suspended') skypeAudioContext.resume();

        const now = skypeAudioContext.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
            const oscillator = skypeAudioContext.createOscillator();
            const gain = skypeAudioContext.createGain();
            const start = now + i * 0.07;

            oscillator.type = 'square';
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.05, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

            oscillator.connect(gain).connect(skypeAudioContext.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.12);
        });
    } catch (e) {
        // Sound is a nice-to-have
    }
}

// DD/MM/YYYY HH:MM, the South African format used elsewhere on the site
function formatSkypeDateTime(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSkypeDate(date) {
    return formatSkypeDateTime(date).split(' ')[0];
}

// "12 years, 1 month" between two dates
function describeTimeAway(since, now) {
    let months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
    if (now.getDate() < since.getDate()) months--;

    const years = Math.floor(months / 12);
    months = months % 12;

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    return parts.length ? parts.join(', ') : 'A little while';
}

// Same "bring to front" behaviour as the other desktop windows
function bringSkypeWindowToFront(skypeWindow) {
    document.querySelectorAll('.win95-window').forEach(win => {
        win.style.zIndex = 10;
    });
    skypeWindow.style.zIndex = 100;
}

function centerSkypeWindow(skypeWindow) {
    const rect = skypeWindow.getBoundingClientRect();
    skypeWindow.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + 'px';
    skypeWindow.style.top = Math.max(8, (window.innerHeight - rect.height) / 2) + 'px';
}

// --- "Has come online" notification ----------------------------------------

function buildSkypeToast() {
    const toast = document.createElement('div');
    toast.className = 'skype-toast';
    toast.id = 'skypeToast';
    toast.hidden = true;
    toast.innerHTML = `
        <div class="win95-title-bar">
            <div class="win95-title">${SKYPE_LOGO_SVG} Skype</div>
            <div class="win95-buttons">
                <button class="win95-button win95-close" type="button" aria-label="Dismiss notification">&times;</button>
            </div>
        </div>
        <button class="skype-toast-body" type="button">
            <span class="skype-toast-avatar">
                <img src="${SKYPE_PROFILE.avatar}" alt="" width="40" height="40">
                <span class="skype-presence" aria-hidden="true">${SKYPE_PRESENCE_SVG}</span>
            </span>
            <span class="skype-toast-text">
                <span><b>${SKYPE_PROFILE.displayName}</b> has come online</span>
                <span class="skype-toast-mood">${SKYPE_PROFILE.mood}</span>
                <span class="skype-toast-link">View profile</span>
            </span>
        </button>`;
    document.body.appendChild(toast);

    toast.querySelector('.win95-close').addEventListener('click', hideSkypeToast);
    toast.querySelector('.skype-toast-body').addEventListener('click', function () {
        hideSkypeToast();
        openSkypeWindow(skypeReturnFocus);
    });

    // Don't auto-dismiss while someone is reading or interacting with it
    toast.addEventListener('mouseenter', () => clearTimeout(skypeToastTimer));
    toast.addEventListener('focusin', () => clearTimeout(skypeToastTimer));
    toast.addEventListener('mouseleave', scheduleSkypeToastHide);
    toast.addEventListener('focusout', scheduleSkypeToastHide);

    return toast;
}

function scheduleSkypeToastHide() {
    clearTimeout(skypeToastTimer);
    skypeToastTimer = setTimeout(hideSkypeToast, SKYPE_TOAST_DURATION);
}

async function showSkypeToast(options = {}) {
    skypeReturnFocus = options.returnFocus || null;
    await loadSkypeStyles();

    const toast = document.getElementById('skypeToast') || buildSkypeToast();
    toast.hidden = false;
    playSkypeSound('access');
    scheduleSkypeToastHide();

    // Keyboard users land on the notification so Enter opens it
    if (options.focus) {
        toast.querySelector('.skype-toast-body').focus({ preventScroll: true });
    }
}

function hideSkypeToast() {
    clearTimeout(skypeToastTimer);
    const toast = document.getElementById('skypeToast');
    if (!toast || toast.hidden) return;

    const hadFocus = toast.contains(document.activeElement);
    toast.hidden = true;
    if (hadFocus && skypeReturnFocus && skypeReturnFocus.isConnected) {
        skypeReturnFocus.focus();
    }
}

// --- Profile window ---------------------------------------------------------

function buildSkypeWindow() {
    const profile = SKYPE_PROFILE;
    const skypeWindow = document.createElement('div');
    skypeWindow.className = 'win95-window skype-window';
    skypeWindow.id = 'skypeWindow';
    skypeWindow.hidden = true;
    skypeWindow.tabIndex = -1;
    skypeWindow.setAttribute('role', 'dialog');
    skypeWindow.setAttribute('aria-labelledby', 'skypeWindowTitle');

    skypeWindow.innerHTML = `
        <div class="win95-title-bar" id="skypeTitleBar">
            <div class="win95-title" id="skypeWindowTitle">${SKYPE_LOGO_SVG} Skype&trade; - ${profile.displayName}</div>
            <div class="win95-buttons">
                <button class="win95-button win95-minimize" type="button" tabindex="-1" aria-hidden="true">_</button>
                <button class="win95-button win95-maximize" type="button" tabindex="-1" aria-hidden="true">&#9633;</button>
                <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
            </div>
        </div>

        <div class="win95-menu-bar skype-menu-bar" aria-hidden="true">
            <div class="win95-menu-item">Skype</div>
            <div class="win95-menu-item">Contacts</div>
            <div class="win95-menu-item">Conversation</div>
            <div class="win95-menu-item">Call</div>
            <div class="win95-menu-item">View</div>
            <div class="win95-menu-item">Tools</div>
            <div class="win95-menu-item">Help</div>
        </div>

        <div class="skype-body">
            <div class="skype-header">
                <button class="skype-avatar" type="button" title="Insert coin for an extra life"
                        aria-label="Collect an extra life">
                    <img src="${profile.avatar}" alt="" width="96" height="96">
                    <span class="skype-presence" aria-hidden="true">${SKYPE_PRESENCE_SVG}</span>
                </button>
                <div class="skype-identity">
                    <div class="skype-display-name">${profile.displayName}</div>
                    <div class="skype-status"><span class="skype-status-dot" aria-hidden="true"></span>Online</div>
                    <div class="skype-mood">${profile.mood}</div>
                    <div class="skype-lives" aria-live="polite">
                        Lives:
                        <span class="skype-heart" aria-hidden="true">&hearts;</span>
                        <span aria-hidden="true">&times;</span>
                        <span class="skype-lives-count" id="skypeLivesCount">${skypeLives}</span>
                        <span class="skype-lives-max" id="skypeLivesMax" hidden>MAX</span>
                    </div>
                </div>
            </div>

            <fieldset class="skype-details">
                <legend>Personal info</legend>
                <dl class="skype-fields">
                    <dt>Skype name</dt>
                    <dd>${profile.skypeName}</dd>
                    <dt>Mobile phone</dt>
                    <dd>
                        <span class="skype-redacted" role="img" aria-label="Redacted" title="Nice try.">
                            +27
                            <span class="skype-redact-bar" style="width: 2ch"></span>
                            <span class="skype-redact-bar" style="width: 3ch"></span>
                            <span class="skype-redact-bar" style="width: 4ch"></span>
                        </span>
                    </dd>
                    <dt>Home phone</dt>
                    <dd class="skype-muted">[Number disconnected]</dd>
                    <dt>Country/Region</dt>
                    <dd>${profile.country}</dd>
                    <dt>Language</dt>
                    <dd>${profile.language}</dd>
                    <dt>About me</dt>
                    <dd>${profile.aboutMe}</dd>
                </dl>
            </fieldset>

            <div class="skype-chat" id="skypeChat" role="log" aria-label="Conversation with ${profile.displayName}">
                <p class="skype-chat-note">
                    ${profile.messageCount - 1} earlier messages (since ${formatSkypeDateTime(profile.firstMessage)})
                    are stored on a PC that no longer exists.
                </p>
                <div class="skype-message">
                    <div class="skype-message-meta">
                        <b>${profile.displayName}</b>
                        <time datetime="${profile.lastMessage.toISOString()}">${formatSkypeDateTime(profile.lastMessage)}</time>
                    </div>
                    <div class="skype-message-text">brb</div>
                </div>
                <div class="skype-chat-divider"><span id="skypeTimeAway"></span></div>
                <div id="skypeChatLive"></div>
            </div>
        </div>

        <div class="skype-statusbar">
            <span><span class="skype-status-dot" aria-hidden="true"></span>Online</span>
            <span>${profile.messageCount} messages &middot; ${formatSkypeDate(profile.firstMessage)} &ndash; ${formatSkypeDate(profile.lastMessage)}</span>
        </div>`;

    document.body.appendChild(skypeWindow);

    skypeWindow.querySelector('.win95-close').addEventListener('click', closeSkypeWindow);
    skypeWindow.querySelector('.skype-avatar').addEventListener('click', collectExtraLife);
    skypeWindow.addEventListener('mousedown', () => bringSkypeWindowToFront(skypeWindow));

    // Drag by the title bar, consistent with the other windows (program-icons.js)
    if (typeof makeWindowDraggable === 'function') {
        makeWindowDraggable('skypeWindow', 'skypeTitleBar');
    }

    return skypeWindow;
}

async function openSkypeWindow(returnFocus) {
    const opener = returnFocus || document.activeElement;
    await loadSkypeStyles();

    const skypeWindow = document.getElementById('skypeWindow') || buildSkypeWindow();
    const wasOpen = !skypeWindow.hidden;

    skypeWindow.hidden = false;
    bringSkypeWindowToFront(skypeWindow);
    skypeWindow.focus({ preventScroll: true });

    // Re-opening an open window just brings it forward
    if (wasOpen) return;

    skypeReturnFocus = opener && opener !== document.body ? opener : null;
    centerSkypeWindow(skypeWindow);
    playSkypeReturn();
}

function closeSkypeWindow() {
    const skypeWindow = document.getElementById('skypeWindow');
    if (!skypeWindow || skypeWindow.hidden) return;

    skypeWindow.hidden = true;
    skypeChatTimers.forEach(clearTimeout);
    skypeChatTimers = [];

    if (skypeReturnFocus && skypeReturnFocus.isConnected) {
        skypeReturnFocus.focus();
    }
}

// The "incoming message" moment: the last thing 2014-me said was "brb"...
function playSkypeReturn() {
    const live = document.getElementById('skypeChatLive');
    const chat = document.getElementById('skypeChat');
    const now = new Date();

    document.getElementById('skypeTimeAway').textContent =
        `${describeTimeAway(SKYPE_PROFILE.lastMessage, now)} later`;
    live.innerHTML = '';

    skypeChatTimers.forEach(clearTimeout);
    skypeChatTimers = [
        setTimeout(() => {
            live.innerHTML = `
                <div class="skype-typing">
                    &#9998; ${SKYPE_PROFILE.displayName} is typing<span class="skype-typing-dots"><span>.</span><span>.</span><span>.</span></span>
                </div>`;
            chat.scrollTop = chat.scrollHeight;
        }, 900),

        setTimeout(() => {
            live.innerHTML = `
                <div class="skype-message skype-message--new">
                    <div class="skype-message-meta">
                        <b>${SKYPE_PROFILE.displayName}</b>
                        <time datetime="${now.toISOString()}">Today ${formatSkypeDateTime(now).split(' ')[1]}</time>
                    </div>
                    <div class="skype-message-text">back :)</div>
                </div>`;
            chat.scrollTop = chat.scrollHeight;
            playSkypeSound('access');
        }, 2900)
    ];
}

// "I have lots of lives!" -- click the avatar to prove it
function collectExtraLife() {
    const avatar = document.querySelector('#skypeWindow .skype-avatar');
    const count = document.getElementById('skypeLivesCount');
    const atMax = skypeLives >= SKYPE_MAX_LIVES;

    if (!atMax) {
        skypeLives++;
        count.textContent = skypeLives;
        document.getElementById('skypeLivesMax').hidden = skypeLives < SKYPE_MAX_LIVES;
        playExtraLifeSound();

        // Restart the bump animation even on rapid clicks
        count.classList.remove('is-bumped');
        void count.offsetWidth;
        count.classList.add('is-bumped');
    }

    // Floating "1UP" (or "MAX" once the counter is full)
    const popup = document.createElement('span');
    popup.className = 'skype-oneup';
    popup.setAttribute('aria-hidden', 'true');
    popup.textContent = atMax ? 'MAX' : '1UP';
    avatar.appendChild(popup);
    setTimeout(() => popup.remove(), prefersReducedMotion() ? 600 : 900);
}

// --- Wiring -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {
    // The status bar is built by win95-components.js, which runs first
    const visitorCounter = document.getElementById('visitor-counter');
    if (visitorCounter) {
        visitorCounter.setAttribute('role', 'button');
        visitorCounter.tabIndex = 0;
        visitorCounter.title = 'Who\'s online?';

        visitorCounter.addEventListener('click', function () {
            showSkypeToast({ returnFocus: visitorCounter });
        });
        visitorCounter.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showSkypeToast({ returnFocus: visitorCounter, focus: true });
            }
        });
    }

    // Esc closes the window first, then the notification
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;

        const skypeWindow = document.getElementById('skypeWindow');
        const toast = document.getElementById('skypeToast');
        if (skypeWindow && !skypeWindow.hidden) {
            closeSkypeWindow();
        } else if (toast && !toast.hidden) {
            hideSkypeToast();
        }
    });

    // Keep the window on screen when a phone rotates
    window.addEventListener('resize', function () {
        const skypeWindow = document.getElementById('skypeWindow');
        if (skypeWindow && !skypeWindow.hidden) centerSkypeWindow(skypeWindow);
    });
});
