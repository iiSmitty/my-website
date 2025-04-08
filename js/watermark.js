// Add this script to your HTML page
document.addEventListener('DOMContentLoaded', function() {
    // Detect if this is a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

    // Don't show watermark on mobile devices
    if (isMobile) {
        return;
    }

    // Check for testing parameter in URL or check for macOS
    const urlParams = new URLSearchParams(window.location.search);
    const forceWatermark = urlParams.get('showWatermark') === 'true';

    if (forceWatermark || navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        // Create the watermark element
        const watermark = document.createElement('div');

        // Style the watermark to look like the Windows activation watermark
        watermark.style.position = 'fixed';
        watermark.style.bottom = '10px';
        watermark.style.right = '10px'; // Keep in right corner
        watermark.style.fontFamily = 'Segoe UI, Arial, sans-serif';
        watermark.style.fontSize = '12px';
        watermark.style.color = 'rgba(255, 255, 255, 0.85)';
        watermark.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
        watermark.style.pointerEvents = 'none'; // Makes it non-interactive
        watermark.style.zIndex = '9999'; // Ensures it appears on top of other elements
        watermark.style.textAlign = 'left'; // Left-aligned text
        watermark.style.lineHeight = '1.2';

        // Set the watermark text
        watermark.innerHTML = 'Activate Windows<br>Go to Settings to activate Windows.';

        // Add the watermark to the page
        document.body.appendChild(watermark);

        // Optional: Add a slight transparency to mimic Windows watermark
        watermark.style.opacity = '0.9';
    }
});