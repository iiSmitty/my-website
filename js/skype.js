// Skype 2014 Easter Egg
// A friend's old Skype contact export still had my 2014 profile in it. This
// brings that contact card back as a Win95 window.
//
// Opened by double-clicking the Recycle Bin (wired up in program-icons.js).
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

// Give people a moment to take in the profile before the chat comes alive
const SKYPE_TYPING_DELAY = 1800;
const SKYPE_MESSAGE_DELAY = 4300;

// Skype's animated "(wave)" emoticon for the reply, with a still frame for
// reduced motion (CSS can't pause a GIF)
const SKYPE_EMOTICON_HI = 'images/skype-hi.gif';
const SKYPE_EMOTICON_HI_STILL = 'images/skype-hi.png';

let skypeLives = SKYPE_STARTING_LIVES;
let skypeStylesPromise = null;
let skypeChatTimers = [];
let skypeReturnFocus = null;
let skypeAudioContext = null;

// Small presence badge (green tick) on the avatar
const SKYPE_PRESENCE_SVG = `
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" stroke="#ffffff" stroke-width="2"/>
        <path d="M4.6 8.3l2.2 2.2 4.5-4.6" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

// Skype logo (glyph from Bootstrap Icons, MIT). The "S" is a cut-out, so a white
// disc behind it keeps it white on the navy title bar.
const SKYPE_LOGO_SVG = `
    <svg class="skype-logo" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="#ffffff"/>
        <path fill="#00aff0" d="M4.671 0c.88 0 1.733.247 2.468.702a7.42 7.42 0 0 1 6.02 2.118 7.37 7.37 0 0 1 2.167 5.215q0 .517-.072 1.026a4.66 4.66 0 0 1 .6 2.281 4.64 4.64 0 0 1-1.37 3.294A4.67 4.67 0 0 1 11.18 16c-.84 0-1.658-.226-2.37-.644a7.42 7.42 0 0 1-6.114-2.107A7.37 7.37 0 0 1 .529 8.035q0-.545.08-1.081a4.644 4.644 0 0 1 .76-5.59A4.68 4.68 0 0 1 4.67 0zm.447 7.01c.18.309.43.572.729.769a7 7 0 0 0 1.257.653q.737.308 1.145.523c.229.112.437.264.615.448.135.142.21.331.21.528a.87.87 0 0 1-.335.723c-.291.196-.64.289-.99.264a2.6 2.6 0 0 1-1.048-.206 11 11 0 0 1-.532-.253 1.3 1.3 0 0 0-.587-.15.72.72 0 0 0-.501.176.63.63 0 0 0-.195.491.8.8 0 0 0 .148.482 1.2 1.2 0 0 0 .456.354 5.1 5.1 0 0 0 2.212.419 4.6 4.6 0 0 0 1.624-.265 2.3 2.3 0 0 0 1.08-.801c.267-.39.402-.855.386-1.327a2.1 2.1 0 0 0-.279-1.101 2.5 2.5 0 0 0-.772-.792A7 7 0 0 0 8.486 7.3a1 1 0 0 0-.145-.058 18 18 0 0 1-1.013-.447 1.8 1.8 0 0 1-.54-.387.73.73 0 0 1-.2-.508.8.8 0 0 1 .385-.723 1.76 1.76 0 0 1 .968-.247c.26-.003.52.03.772.096q.412.119.802.293c.105.049.22.075.336.076a.6.6 0 0 0 .453-.19.7.7 0 0 0 .18-.496.72.72 0 0 0-.17-.476 1.4 1.4 0 0 0-.556-.354 3.7 3.7 0 0 0-.708-.183 6 6 0 0 0-1.022-.078 4.5 4.5 0 0 0-1.536.258 2.7 2.7 0 0 0-1.174.784 1.9 1.9 0 0 0-.45 1.287c-.01.37.076.736.25 1.063"/>
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

function playSkypeSound(sound) {
    try {
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
            <div class="win95-title" id="skypeWindowTitle">${SKYPE_LOGO_SVG} Skype&trade; - ${profile.skypeName}</div>
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

async function openSkypeWindow() {
    const opener = document.activeElement;
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

    // Start loading the sound and emoticon now so they are ready when the message lands
    const messageSound = new Audio('sounds/skype-message.mp3');
    new Image().src = prefersReducedMotion() ? SKYPE_EMOTICON_HI_STILL : SKYPE_EMOTICON_HI;

    skypeChatTimers.forEach(clearTimeout);
    skypeChatTimers = [
        setTimeout(() => {
            live.innerHTML = `
                <div class="skype-typing">
                    &#9998; ${SKYPE_PROFILE.displayName} is typing<span class="skype-typing-dots"><span>.</span><span>.</span><span>.</span></span>
                </div>`;
            chat.scrollTop = chat.scrollHeight;
        }, SKYPE_TYPING_DELAY),

        setTimeout(() => {
            live.innerHTML = `
                <div class="skype-message skype-message--new">
                    <div class="skype-message-meta">
                        <b>${SKYPE_PROFILE.displayName}</b>
                        <time datetime="${now.toISOString()}">Today ${formatSkypeDateTime(now).split(' ')[1]}</time>
                    </div>
                    <div class="skype-message-text">
                        back
                        <picture>
                            <source srcset="${SKYPE_EMOTICON_HI_STILL}" media="(prefers-reduced-motion: reduce)">
                            <img class="skype-emoticon" src="${SKYPE_EMOTICON_HI}" alt="(wave)" title="Hi" width="20" height="20">
                        </picture>
                    </div>
                </div>`;
            chat.scrollTop = chat.scrollHeight;
            playSkypeSound(messageSound);
        }, SKYPE_MESSAGE_DELAY)
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

// Esc closes the window
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSkypeWindow();
});
