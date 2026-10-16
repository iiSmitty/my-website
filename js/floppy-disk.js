// The floppy disk loader: the profile sections stay hidden until the disk is
// clicked (or chosen from the keyboard), then the disk dissolves away.
//
// loadProfile() does the same from code, for Help > How This Site Works and
// for links straight to a section, like /#how-it-works. It resolves once the
// profile is showing.

let loadProfile = () => Promise.resolve();

document.addEventListener('DOMContentLoaded', function() {

    const floppyLoader = document.getElementById('floppyLoader');
    const floppyText = floppyLoader && floppyLoader.querySelector('.floppy-text');
    const mainContent = document.getElementById('mainProfileContent');
    const pixelOverlay = document.getElementById('floppyPixelOverlay'); // Get overlay

    // --- Timing Constants ---
    const loadingTime = 1800; // Duration of loading animation
    const delayBeforeDissolve = 4000; // Pause after load before effect starts
    const pixelSize = 5; // MUST match CSS .pixel-square width/height
    const maxPixelDelay = 1.0; // Max random delay (in seconds) for a pixel animation
    const pixelationDuration = maxPixelDelay + 0.5; // Max delay + pixel animation time
    const collapseTransitionTime = 600; // Duration of final collapse (match CSS)

    // --- Helper Function to Create Pixels ---
    function createPixelGrid() {
        pixelOverlay.innerHTML = ''; // Clear previous pixels if any
        const containerWidth = floppyLoader.offsetWidth;
        const containerHeight = floppyLoader.offsetHeight;
        const numCols = Math.ceil(containerWidth / pixelSize);
        const numRows = Math.ceil(containerHeight / pixelSize);
        const numPixels = numCols * numRows;

        for (let i = 0; i < numPixels; i++) {
            const pixel = document.createElement('div');
            pixel.classList.add('pixel-square');
            // Assign random delay for the "virus" effect
            const randomDelay = Math.random() * maxPixelDelay;
            pixel.style.animationDelay = `${randomDelay}s`;
            pixelOverlay.appendChild(pixel);
        }
        // Make the overlay container visible (but pixels are still paused)
        pixelOverlay.classList.add('active');
    }

    // Disk gone: the loader is no longer a control, so keep it out of the tab order
    function retireLoader() {
        floppyLoader.removeAttribute('role');
        floppyLoader.removeAttribute('tabindex');
        floppyLoader.setAttribute('aria-hidden', 'true');
    }

    function dissolveLoader() {
        createPixelGrid(); // Generate the pixels
        floppyLoader.classList.add('dissolving'); // Start pixelation + content fade

        // --- After pixelation animation completes ---
        setTimeout(() => {
            floppyLoader.classList.remove('dissolving'); // Clean up state
            floppyLoader.classList.add('dissolved'); // Start final collapse

            // --- Remove element after collapse ---
            setTimeout(() => {
                if (floppyLoader.parentNode) {
                    floppyLoader.parentNode.removeChild(floppyLoader);
                }
            }, collapseTransitionTime); // Wait for collapse CSS

        }, pixelationDuration * 1000); // Wait for pixelation
    }

    // --- Main Logic ---
    if (!floppyLoader || !floppyText || !mainContent || !pixelOverlay) {
        console.error("Required elements not found. Check HTML IDs.");
        if (mainContent) mainContent.classList.add('visible');
        return;
    }

    let loading = null;
    let revealed = false;
    // Someone is on their way to a section: once loaded, the disk goes at once,
    // because its dissolve and collapse would move the page out from under them
    let quick = false;
    let dissolveTimer = null;

    function removeLoader() {
        clearTimeout(dissolveTimer);
        floppyLoader.remove();
    }

    loadProfile = function({ quick: wantsQuick = false } = {}) {
        if (wantsQuick) {
            quick = true;
            if (revealed) removeLoader();
        }
        if (!loading) {
            loading = new Promise(resolve => {
                floppyLoader.classList.add('loading');
                floppyLoader.classList.remove('interactive');
                floppyText.textContent = 'Loading Profile Data...';

                // --- After loading animation ---
                setTimeout(() => {
                    floppyLoader.classList.remove('loading');
                    floppyLoader.classList.add('loaded');
                    floppyText.textContent = 'Profile Loaded!';
                    floppyLoader.style.pointerEvents = 'none';
                    floppyLoader.setAttribute('aria-expanded', 'true');
                    const hadFocus = document.activeElement === floppyLoader;
                    retireLoader();
                    // Sliding in would throw off the jump to a section
                    if (quick) mainContent.classList.add('is-instant');
                    mainContent.classList.add('visible');
                    revealed = true;
                    // Focus would otherwise be left on a control that's going
                    // away. Only now the profile is visible can it take focus.
                    if (hadFocus) mainContent.focus({ preventScroll: true });

                    if (quick) {
                        removeLoader();
                    } else {
                        // --- Delay before starting pixelation ---
                        dissolveTimer = setTimeout(dissolveLoader, delayBeforeDissolve);
                    }
                    resolve();

                }, loadingTime); // Wait for loading animation
            });
        }
        return loading;
    };

    floppyLoader.addEventListener('click', () => loadProfile());
    floppyLoader.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            loadProfile();
        }
    });

    // A link straight to a section of the profile (e.g. /#how-it-works from
    // another page's Help menu) skips the disk: there's no time for ceremony
    // when someone came for one thing
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target && mainContent.contains(target)) {
        loading = Promise.resolve();
        revealed = true;
        floppyLoader.remove();
        mainContent.classList.add('is-instant', 'visible');
        // The browser looked for the section while it was still hidden
        requestAnimationFrame(() => target.scrollIntoView());
    }
});
