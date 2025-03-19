document.addEventListener('DOMContentLoaded', function() {
    // Basic mobile detection
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0) {

        console.log('Mobile device detected, removing desktop icons');

        // Find the desktop icons element
        const desktopIcons = document.querySelector('.desktop-icons');

        // If found, remove it completely from the DOM
        if (desktopIcons && desktopIcons.parentNode) {
            desktopIcons.parentNode.removeChild(desktopIcons);
        }
    }
});