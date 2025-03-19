// Windows 95-style Decryption Easter Egg

// Replace these with your actual contact info
const REAL_EMAIL = "info@andresmit.co.za";
const REAL_PHONE = "(072) 338-6828";

// Skip browser-specific code if running in Node
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Elements
    let decryptButton;
    let encryptedEmail;
    let encryptedPhone;
    let decryptAnimation;
    let decryptProgressBar;
    let decryptText;
    let soundToggle;
    let soundEnabled = true;

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Get elements
        decryptButton = document.getElementById('decrypt-button');
        encryptedEmail = document.getElementById('encrypted-email');
        encryptedPhone = document.getElementById('encrypted-phone');
        decryptAnimation = document.getElementById('decrypt-animation');
        decryptProgressBar = document.getElementById('decrypt-progress-bar');
        decryptText = document.getElementById('decrypt-text');

        // Initially hide the main content
        const mainContent = document.querySelector('.win95-container');
        if (mainContent) {
            mainContent.style.display = 'none';
        }

        // Sound toggle
        soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', function() {
                soundEnabled = !soundEnabled;
                this.textContent = soundEnabled ? '🔊' : '🔇';
            });
        }

        // Add click handler to decrypt button
        if (decryptButton) {
            decryptButton.addEventListener('click', startDecryption);
        }

        // Check if this is an internal navigation from another page on your site
        const isInternalNavigation = document.referrer.includes(window.location.hostname) ||
            sessionStorage.getItem('internalNavigation') === 'true';

        // Clear the session storage flag
        sessionStorage.removeItem('internalNavigation');

        // Check if we're on a 404 page
        const is404Page = document.title.includes('404') ||
            window.location.pathname.includes('404') ||
            document.body.classList.contains('error-404');

        // Only show the startup dialog if we're not navigating internally and not on a 404 page
        if (!isInternalNavigation && !is404Page) {
            // Create a "Windows is starting up" dialog
            createStartupDialog();
        } else {
            // For internal navigation or 404 pages, just show the main content directly
            const mainContent = document.querySelector('.win95-container');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
        }

        // Modify all internal navigation links to set a session flag
        document.querySelectorAll('.win95-menu-item').forEach(item => {
            const originalOnClick = item.onclick;

            item.onclick = function(e) {
                // Set a session storage flag to indicate internal navigation
                sessionStorage.setItem('internalNavigation', 'true');

                // Call the original onclick handler if it exists
                if (typeof originalOnClick === 'function') {
                    return originalOnClick.call(this, e);
                }
            };
        });
    });

    // Track if startup sound has been played
    let startupSoundPlayed = false;

    // Create a Windows 95 startup dialog that plays sound when clicked
    function createStartupDialog() {
        // Create dialog elements
        const dialog = document.createElement('div');
        dialog.className = 'win95-dialog';
        dialog.innerHTML = `
            <div class="win95-dialog-title">
                <span class="dialog-title-text">Where do you want to go today?</span>
                <button class="win95-button win95-close" style="visibility:hidden">×</button>
            </div>
            <div class="win95-dialog-content">
                <div class="dialog-logo">
                    <div class="windows-logo">
                        <div class="bottom-left"></div>
                        <div class="bottom-right"></div>
                    </div>
                </div>
                <div class="dialog-message">
                    Welcome to Windows 95
                </div>
                <div class="dialog-buttons">
                    <button class="win95-button-large" id="start-windows">Start Windows</button>
                </div>
            </div>
        `;

        // Set the background to teal
        document.body.style.backgroundColor = '#008080';

        // Add to body
        document.body.appendChild(dialog);

        // Get the Start Windows button
        const startButton = document.getElementById('start-windows');

        // Add click handler to Start Windows button
        startButton.addEventListener('click', function() {
            // Play startup sound
            playWin95Sound('complete');
            startupSoundPlayed = true;

            // Hide dialog with fade effect
            dialog.style.opacity = '0';
            setTimeout(() => {
                dialog.style.display = 'none';

                // Show the main content
                const mainContent = document.querySelector('.win95-container');
                if (mainContent) {
                    mainContent.style.display = 'block';
                }

                // Show desktop icons
                const desktopIcons = document.querySelector('.desktop-icons');
                if (desktopIcons) {
                    desktopIcons.style.display = 'block';
                }
            }, 500);
        });
    }

    function startDecryption() {
        // Disable button during process
        decryptButton.disabled = true;

        // Show decrypt animation
        decryptAnimation.style.display = 'block';

        // Win95 decryption simulation
        updateProgress(0, "Initializing decryption protocol...");

        setTimeout(() => {
            updateProgress(15, "Accessing encrypted data...");
            // No sound here
        }, 800);

        setTimeout(() => {
            updateProgress(30, "Breaking encryption...");
            // No sound here
        }, 1600);

        setTimeout(() => {
            updateProgress(45, "Applying decryption algorithm...");
        }, 2400);

        setTimeout(() => {
            updateProgress(60, "Decrypting email address...");
            startEmailDecryption();
        }, 3200);

        setTimeout(() => {
            updateProgress(80, "Decrypting phone number...");
            startPhoneDecryption();
            // No sound here
        }, 4000);

        setTimeout(() => {
            updateProgress(100, "Decryption complete!");
            // Play access sound when decryption is complete
            playWin95Sound('access');

            // After small delay, create mailto link for email
            setTimeout(() => {
                encryptedEmail.innerHTML = `<a href="mailto:${REAL_EMAIL}">${REAL_EMAIL}</a>`;

                // Change button text
                decryptButton.textContent = "Information Decrypted!";
                decryptButton.style.backgroundColor = "#90ee90"; // Light green
            }, 500);
        }, 4800);
    }

    function startEmailDecryption() {
        // Gradual reveal of email character by character
        let currentEmail = "************@********.***";
        let targetEmail = REAL_EMAIL;
        let emailChars = currentEmail.split('');
        let targetChars = targetEmail.split('');

        for (let i = 0; i < targetChars.length; i++) {
            setTimeout(() => {
                emailChars[i] = targetChars[i];
                encryptedEmail.textContent = emailChars.join('');
            }, i * 80); // Reveal each character with a delay
        }
    }

    function startPhoneDecryption() {
        // Gradual reveal of phone number character by character
        let currentPhone = "(***) ***-****";
        let targetPhone = REAL_PHONE;
        let phoneChars = currentPhone.split('');
        let targetChars = targetPhone.split('');

        for (let i = 0; i < targetChars.length; i++) {
            setTimeout(() => {
                phoneChars[i] = targetChars[i];
                encryptedPhone.textContent = phoneChars.join('');
            }, i * 80); // Reveal each character with a delay
        }
    }

    function updateProgress(percent, message) {
        // Update progress bar
        decryptProgressBar.style.width = `${percent}%`;

        // Update message
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

// Add this to your JavaScript file (e.g., decrypt.js)
document.addEventListener('DOMContentLoaded', function() {
    // Get the close button
    const closeButton = document.querySelector('.win95-button.win95-close');

    if (closeButton) {
        closeButton.addEventListener('click', function() {
            // Show a Windows 95 style "closing" dialog
            showClosingDialog();
        });
    }

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
                } else {
                    // Restore
                    container.style.width = container.dataset.originalWidth;
                    container.style.maxWidth = container.dataset.originalMaxWidth;
                    container.style.height = container.dataset.originalHeight;
                    container.style.margin = container.dataset.originalMargin;
                    container.dataset.isMaximized = '';
                }
            }
        });
    }
});

function showClosingDialog() {
    // Create a Windows 95 style closing dialog
    const dialog = document.createElement('div');
    dialog.className = 'win95-dialog';
    dialog.style.zIndex = '9999';
    dialog.innerHTML = `
        <div class="win95-dialog-title">
            <span class="dialog-title-text">Windows</span>
            <button class="win95-button win95-close" style="visibility:hidden">×</button>
        </div>
        <div class="win95-dialog-content">
            <div class="dialog-message">
                <p>It is now safe to turn off your computer.</p>
            </div>
            <div class="dialog-buttons">
                <button class="win95-button-large" id="confirm-close">OK</button>
            </div>
        </div>
    `;

    // Add to body
    document.body.appendChild(dialog);

    // Get the confirm button
    const confirmButton = document.getElementById('confirm-close');

    // Add click handler
    confirmButton.addEventListener('click', function() {
        // Fade out effect
        document.body.style.transition = 'opacity 1s';
        document.body.style.opacity = '0';

        // After fade out, close the tab/window
        setTimeout(() => {
            window.close();

            // If window.close() doesn't work (common in modern browsers),
            // show a fallback message
            document.body.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000080;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: 'MS Sans Serif', Arial, sans-serif;
                    text-align: center;
                    padding: 20px;
                ">
                    <h1 style="font-size: 24px; margin-bottom: 20px;">Windows 95 has shut down</h1>
                    <p style="font-size: 16px;">It is now safe to close this tab.</p>
                    <p style="margin-top: 40px; font-size: 14px;">
                        (Modern browsers prevent scripts from closing tabs that weren't opened by JavaScript)
                    </p>
                </div>
            `;
        }, 1000);
    });
}

window.showClosingDialog = showClosingDialog;
