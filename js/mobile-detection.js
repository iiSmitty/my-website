// Touch devices get no desktop icons, and body.is-touch-device so the styles
// and other scripts (screensaver.js, taskmgr.js) can leave out desktop-only
// features
document.addEventListener('DOMContentLoaded', function() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

    const desktopIcons = document.querySelector('.desktop-icons');

    // The startup dialog (decrypt.js), if this visit has one
    const startupDialog = document.querySelector('.win95-dialog');

    if (desktopIcons) {
        if (isMobile) {
            if (desktopIcons.parentNode) {
                desktopIcons.parentNode.removeChild(desktopIcons);
            }
        } else {
            if (startupDialog && startupDialog.style.display !== 'none') {
                // decrypt.js shows the icons once "Start" is clicked
                desktopIcons.style.display = 'none';
            } else {
                desktopIcons.style.display = 'block';
            }
        }
    }

    if (isMobile) {
        document.body.classList.add('is-touch-device');
    }
});
