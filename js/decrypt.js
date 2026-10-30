// Windows 95-style Decryption Easter Egg

// Simple FOUC prevention - mark when JavaScript has loaded
(function() {
    // Add class as soon as this script runs
    if (document.body) {
        document.body.classList.add('js-loaded');
    } else {
        // If body doesn't exist yet, wait for it
        document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.add('js-loaded');
        });
    }
})();

// The contact worker (cf-worker/) only hands out the email for a Turnstile token
const CONTACT_API_URL = "https://andresmit.co.za/api/contact";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY = "0x4AAAAAAFBIasdLcwxPVgu5";
// Must match TURNSTILE_ACTION in cf-worker/src/worker.js
const TURNSTILE_ACTION = "contact";

let REAL_EMAIL = null;

// Skip browser-specific code if running in Node
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Elements
    let decryptButton;
    let encryptedEmail;
    let decryptAnimation;
    let decryptProgressBar;
    let decryptText;
    let soundEnabled = true;

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Get elements
        decryptButton = document.getElementById('decrypt-button');
        encryptedEmail = document.getElementById('encrypted-email');
        decryptAnimation = document.getElementById('decrypt-animation');
        decryptProgressBar = document.getElementById('decrypt-progress-bar');
        decryptText = document.getElementById('decrypt-text');

        // Initially hide the main content
        const mainContent = document.querySelector('.win95-container');
        if (mainContent) {
            mainContent.style.display = 'none';
        }

        // Add click handler to decrypt button
        if (decryptButton) {
            decryptButton.addEventListener('click', onDecryptClick);
        }

        // Coming from another page of this site means Windows has already started
        const isInternalNavigation = document.referrer.includes(window.location.hostname);

        // Check if we're on a 404 page
        const is404Page = document.title.includes('404') ||
            window.location.pathname.includes('404') ||
            document.body.classList.contains('error-404');

        // Pages people land on from a shared link (e.g. a CV) opt out of the startup ritual
        const skipsStartup = document.body.hasAttribute('data-skip-startup');

        // Only show the startup dialog if we're not navigating internally and not on a 404 page
        if (!isInternalNavigation && !is404Page && !skipsStartup) {
            // Create a "Windows is starting up" dialog
            createStartupDialog();
        } else {
            // For internal navigation or 404 pages, just show the main content directly
            const mainContent = document.querySelector('.win95-container');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
        }
    });

    // "Welcome to Windows 95": clicking Start plays the startup sound and shows
    // the desktop
    function createStartupDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'win95-dialog';
        dialog.innerHTML = `
            <div class="win95-dialog-title">
                <span class="dialog-title-text">Where do you want to go today?</span>
                <button class="win95-button win95-close" style="visibility:hidden">×</button>
            </div>
            <div class="win95-dialog-content">
                <div class="dialog-message">
                    Welcome to Windows 95
                </div>
                <div class="startup-taskbar">
                    <button class="win95-start-button" id="start-windows" aria-label="Start — click here to begin">
                        <span class="WindowsLogoIcon_16x16" aria-hidden="true"></span>
                        <span class="start-label">Start</span>
                    </button>
                    <div class="start-hint">
                        <span class="start-hint-arrow" aria-hidden="true">&#8656;</span>
                        <span class="start-hint-text">Click here to begin.</span>
                    </div>
                </div>
            </div>
        `;

        // Enter startup mode: teal background, full-height centering, no scroll
        document.body.classList.add('startup');

        document.body.appendChild(dialog);

        // Focused, so keyboard users can start with Enter
        const startButton = document.getElementById('start-windows');
        startButton.focus();

        startButton.addEventListener('click', function() {
            playWin95Sound('complete');

            // Leave startup mode and fade the dialog out
            document.body.classList.remove('startup');
            dialog.style.opacity = '0';
            setTimeout(() => {
                dialog.style.display = 'none';

                const mainContent = document.querySelector('.win95-container');
                if (mainContent) {
                    mainContent.style.display = 'block';
                }

                const desktopIcons = document.querySelector('.desktop-icons');
                if (desktopIcons) {
                    desktopIcons.style.display = 'block';
                }

                // A link to a section (e.g. /#how-it-works) lands on it once Windows has started
                const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
                if (target) target.scrollIntoView();
            }, 500);
        });
    }

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

    function playWin95Sound(type) {
        if (!soundEnabled) return;

        try {
            const sound = new Audio(`sounds/win95-${type}.mp3`);
            sound.volume = 0.7;
            sound.play();
        } catch (e) {
            console.log(`Error playing ${type} sound: ${e.message}`);
        }
    }
} else {
    console.log("This script is designed to run in a browser environment.");
}

// The page's main window: its close button asks to shut down, and on pages
// without the window manager its minimize and maximize buttons are handled here
document.addEventListener('DOMContentLoaded', function() {
    // The first close button on the page is the main window's
    const closeButton = document.querySelector('.win95-button.win95-close');

    if (closeButton) {
        closeButton.addEventListener('click', function() {
            showClosingDialog();
        });
    }

    // On the home page the window manager (window-manager.js) minimizes and
    // maximizes the main window, with a taskbar to restore it from
    if (window.WindowManager) return;

    // Also handle minimize and maximize for a complete experience
    const minimizeButton = document.querySelector('.win95-button.win95-minimize');
    const maximizeButton = document.querySelector('.win95-button.win95-maximize');

    if (minimizeButton) {
        minimizeButton.addEventListener('click', function() {
            // Minimize animation effect
            const container = document.querySelector('.win95-container');
            if (container) {
                // Save current state
                container.dataset.originalHeight = container.offsetHeight + 'px';

                // Animate minimize
                container.style.transition = 'all 0.3s ease-out';
                container.style.height = '32px';  // Minimize to just the title bar
                container.style.overflow = 'hidden';

                // Add restore button
                const restoreButton = document.createElement('button');
                restoreButton.className = 'win95-button-large';
                restoreButton.textContent = 'Restore Window';
                restoreButton.style.position = 'fixed';
                restoreButton.style.bottom = '10px';
                restoreButton.style.right = '10px';
                restoreButton.style.zIndex = '9999';

                restoreButton.addEventListener('click', function() {
                    container.style.height = container.dataset.originalHeight;
                    document.body.removeChild(this);
                });

                document.body.appendChild(restoreButton);
            }
        });
    }

    if (maximizeButton) {
        maximizeButton.addEventListener('click', function() {
            // Toggle maximize
            const container = document.querySelector('.win95-container');
            const desktopIcons = document.querySelector('.desktop-icons');

            if (container) {
                if (!container.dataset.isMaximized) {
                    // Save current styles
                    container.dataset.originalWidth = container.style.width;
                    container.dataset.originalMaxWidth = container.style.maxWidth;
                    container.dataset.originalHeight = container.style.height;
                    container.dataset.originalMargin = container.style.margin;

                    // Maximize
                    container.style.transition = 'all 0.3s ease-out';
                    container.style.width = '100%';
                    container.style.maxWidth = '100%';
                    container.style.height = 'calc(100vh - 20px)';
                    container.style.margin = '0';
                    container.dataset.isMaximized = 'true';

                    // Hide desktop icons when maximized
                    if (desktopIcons) {
                        desktopIcons.style.display = 'none';
                    }
                } else {
                    // Restore
                    container.style.width = container.dataset.originalWidth;
                    container.style.maxWidth = container.dataset.originalMaxWidth;
                    container.style.height = container.dataset.originalHeight;
                    container.style.margin = container.dataset.originalMargin;
                    container.dataset.isMaximized = '';

                    const isMobile = isTouchDevice();

                    // Show desktop icons when restored
                    if (desktopIcons && !isMobile) {
                        desktopIcons.style.display = 'block';
                    }
                }
            }
        });
    }
});
