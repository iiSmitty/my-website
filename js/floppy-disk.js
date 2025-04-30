document.addEventListener('DOMContentLoaded', function() {

    const floppyLoader = document.getElementById('floppyLoader');
    const floppyText = floppyLoader.querySelector('.floppy-text');
    const mainContent = document.getElementById('mainProfileContent');
    const pixelOverlay = document.getElementById('floppyPixelOverlay'); // Get overlay

    let isLoadingOrLoaded = false;

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

    // --- Main Logic ---
    if (floppyLoader && floppyText && mainContent && pixelOverlay) {
        floppyLoader.addEventListener('click', () => {
            if (!isLoadingOrLoaded) {
                isLoadingOrLoaded = true;
                floppyLoader.classList.add('loading');
                floppyLoader.classList.remove('interactive');
                floppyText.textContent = 'Loading Profile Data...';

                // --- Timeout 1: After loading animation ---
                setTimeout(() => {
                    floppyLoader.classList.remove('loading');
                    floppyLoader.classList.add('loaded');
                    floppyText.textContent = 'Profile Loaded!';
                    floppyLoader.style.pointerEvents = 'none';
                    mainContent.classList.add('visible');

                    // --- Timeout 2: Delay before starting pixelation ---
                    setTimeout(() => {
                        createPixelGrid(); // Generate the pixels
                        floppyLoader.classList.add('dissolving'); // Start pixelation + content fade

                        // --- Timeout 3: After pixelation animation completes ---
                        setTimeout(() => {
                            floppyLoader.classList.remove('dissolving'); // Clean up state
                            floppyLoader.classList.add('dissolved'); // Start final collapse

                            // --- Timeout 4: Remove element after collapse ---
                            setTimeout(() => {
                                if (floppyLoader.parentNode) {
                                    floppyLoader.parentNode.removeChild(floppyLoader);
                                }
                            }, collapseTransitionTime); // Wait for collapse CSS

                        }, pixelationDuration * 1000); // Wait for pixelation

                    }, delayBeforeDissolve); // Wait 4 seconds

                }, loadingTime); // Wait for loading animation
            }
        });
    } else {
        console.error("Required elements not found. Check HTML IDs.");
        if (mainContent) mainContent.classList.add('visible');
    }
});