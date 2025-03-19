// Combined device detection and navigation handling
document.addEventListener('DOMContentLoaded', function() {
    // Detect if this is a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

    // Get reference to desktop icons
    const desktopIcons = document.querySelector('.desktop-icons');

    // Get reference to startup dialog (if present)
    const startupDialog = document.querySelector('.win95-dialog');

    // Handle desktop icons visibility
    if (desktopIcons) {
        if (isMobile) {
            // On mobile: always remove desktop icons
            if (desktopIcons.parentNode) {
                desktopIcons.parentNode.removeChild(desktopIcons);
            }
        } else {
            // On desktop: check if we're in startup mode
            if (startupDialog && startupDialog.style.display !== 'none') {
                // Initial startup - icons will be shown after clicking "Start Windows"
                desktopIcons.style.display = 'none';
            } else {
                // Not in startup mode (either no dialog or returning navigation)
                desktopIcons.style.display = 'block';
            }
        }
    }

    // Add mobile class to body for CSS targeting if needed
    if (isMobile) {
        document.body.classList.add('is-touch-device');
    }
});