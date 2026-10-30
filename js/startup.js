// Starting Windows: the page stays hidden until the scripts have loaded, and
// a first visit opens with the "Welcome to Windows 95" dialog

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

document.addEventListener('DOMContentLoaded', function() {
    // Initially hide the main content
    const mainContent = document.querySelector('.win95-container');
    if (mainContent) {
        mainContent.style.display = 'none';
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
