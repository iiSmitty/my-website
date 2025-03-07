// Windows 95-style Decryption Easter Egg

// Replace these with your actual contact info
const REAL_EMAIL = "andrez.smit@gmail.com";
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

        // Create a "Windows is starting up" dialog
        // Check if we're on a 404 page
        const is404Page = document.title.includes('404') ||
            window.location.pathname.includes('404') ||
            document.body.classList.contains('error-404');

        // Only create the startup dialog if we're not on a 404 page
        if (!is404Page) {
            // Create a "Windows is starting up" dialog
            createStartupDialog();
        } else {
            // For 404 pages, just show the main content directly
            const mainContent = document.querySelector('.win95-container');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
            playWin95Sound('error');
        }
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