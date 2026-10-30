// The Contact Me section's email, decrypted on request: a Turnstile check,
// then the contact worker hands the address over and a progress bar reveals it

// The contact worker (cf-worker/) only hands out the email for a Turnstile token
const CONTACT_API_URL = "https://andresmit.co.za/api/contact";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY = "0x4AAAAAAFBIasdLcwxPVgu5";
// Must match TURNSTILE_ACTION in cf-worker/src/worker.js
const TURNSTILE_ACTION = "contact";

let REAL_EMAIL = null;

// Elements
let decryptButton;
let encryptedEmail;
let decryptAnimation;
let decryptProgressBar;
let decryptText;

document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    decryptButton = document.getElementById('decrypt-button');
    encryptedEmail = document.getElementById('encrypted-email');
    decryptAnimation = document.getElementById('decrypt-animation');
    decryptProgressBar = document.getElementById('decrypt-progress-bar');
    decryptText = document.getElementById('decrypt-text');

    // Add click handler to decrypt button
    if (decryptButton) {
        decryptButton.addEventListener('click', onDecryptClick);
    }
});

// Developers on a desktop get the DECRYPT.EXE coding challenge first
// (decrypt-exe.js); everyone else goes straight to the decryption
function onDecryptClick() {
    if (window.DecryptExe && window.DecryptExe.isAvailable()) {
        window.DecryptExe.open();
    } else {
        startDecryption();
    }
}

async function startDecryption() {
    decryptButton.disabled = true;
    decryptAnimation.style.display = 'block';
    updateProgress(0, "Scanning for robots...");

    try {
        const token = await getTurnstileToken(document.getElementById('decrypt-turnstile-panel'), {
            onInteractive: () => updateProgress(0, "Waiting for human verification..."),
            onInteractiveDone: () => updateProgress(0, "Scanning for robots..."),
        });

        updateProgress(0, "Connecting to secure server...");
        REAL_EMAIL = await fetchContactEmail(token);
        runDecryptionAnimation();
    } catch {
        updateProgress(0, "Connection failed. Try again.");
        decryptButton.disabled = false;
    }
}

async function fetchContactEmail(token) {
    const res = await fetch(CONTACT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error('Worker returned ' + res.status);
    return (await res.json()).email;
}

// Turnstile is only loaded once someone asks for the contact details
let turnstileLoading = null;

function loadTurnstile() {
    if (!turnstileLoading) {
        turnstileLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = TURNSTILE_SCRIPT_URL;
            script.onload = () => resolve(window.turnstile);
            script.onerror = () => {
                // Let the next click try again
                script.remove();
                turnstileLoading = null;
                reject(new Error('Turnstile failed to load'));
            };
            document.head.appendChild(script);
        });
    }
    return turnstileLoading;
}

// Resolves with a fresh single-use token. The widget renders into a
// .decrypt-turnstile panel and stays invisible unless Cloudflare wants the
// visitor to click a checkbox, which is when the panel shows.
async function getTurnstileToken(panel, { onInteractive, onInteractiveDone }) {
    const turnstile = await loadTurnstile();
    const showPanel = (visible) => panel.classList.toggle('is-interactive', visible);

    return new Promise((resolve, reject) => {
        let widgetId;
        const removeWidget = () => {
            turnstile.remove(widgetId);
            showPanel(false);
        };
        const fail = () => {
            removeWidget();
            reject(new Error('Turnstile challenge failed'));
        };

        widgetId = turnstile.render(panel.querySelector('.decrypt-turnstile-widget'), {
            sitekey: TURNSTILE_SITE_KEY,
            action: TURNSTILE_ACTION,
            appearance: 'interaction-only',
            theme: 'light',
            retry: 'never',
            'before-interactive-callback': () => {
                showPanel(true);
                onInteractive();
            },
            'after-interactive-callback': onInteractiveDone,
            callback: (token) => {
                removeWidget();
                resolve(token);
            },
            'error-callback': fail,
            'expired-callback': fail,
            'timeout-callback': fail,
        });
    });
}

function runDecryptionAnimation() {
    updateProgress(0, "Initializing decryption protocol...");

    setTimeout(() => {
        updateProgress(15, "Accessing encrypted data...");
    }, 800);

    setTimeout(() => {
        updateProgress(30, "Breaking encryption...");
    }, 1600);

    setTimeout(() => {
        updateProgress(45, "Applying decryption algorithm...");
    }, 2400);

    setTimeout(() => {
        updateProgress(60, "Decrypting email address...");
        startEmailDecryption();
    }, 3200);

    setTimeout(() => {
        updateProgress(80, "Verifying integrity...");
    }, 4000);

    setTimeout(() => {
        updateProgress(100, "Decryption complete!");
        playWin95Sound('access');

        // Then the revealed address becomes a mailto link
        setTimeout(finishReveal, 500);
    }, 4800);
}

// DECRYPT.EXE already did the decrypting, so skip the progress bar and
// just reveal the email in the Contact Me section
function showDecryptedEmail(email) {
    REAL_EMAIL = email;
    decryptButton.disabled = true;
    const revealTime = startEmailDecryption();
    setTimeout(finishReveal, revealTime);
}

function finishReveal() {
    encryptedEmail.innerHTML = `<a href="mailto:${REAL_EMAIL}">${REAL_EMAIL}</a>`;

    decryptButton.textContent = "Information Decrypted!";
    decryptButton.style.backgroundColor = "#90ee90"; // Light green
}

// Reveals the email one character every 80ms over the asterisks.
// Returns how long the reveal takes, in ms.
function startEmailDecryption() {
    let currentEmail = "************@********.***";
    let targetEmail = REAL_EMAIL;
    let emailChars = currentEmail.split('');
    let targetChars = targetEmail.split('');

    for (let i = 0; i < targetChars.length; i++) {
        setTimeout(() => {
            emailChars[i] = targetChars[i];
            encryptedEmail.textContent = emailChars.join('');
        }, i * 80);
    }
    return targetChars.length * 80;
}

// Shared with DECRYPT.EXE (decrypt-exe.js)
window.ContactGate = {
    getTurnstileToken,
    fetchContactEmail,
    showDecryptedEmail,
    startDecryption,
};

function updateProgress(percent, message) {
    decryptProgressBar.style.width = `${percent}%`;
    decryptText.textContent = message;
}
