// Touch devices get no desktop icons, and body.is-touch-device so the styles
// and other scripts (screensaver.js, taskmgr.js) can leave out desktop-only
// features
document.addEventListener('DOMContentLoaded', function() {
    const isMobile = isTouchDevice();

    const desktopIcons = document.querySelector('.desktop-icons');

    // The startup dialog (startup.js), if this visit has one
    const startupDialog = document.querySelector('.win95-dialog');

    if (desktopIcons) {
        if (isMobile) {
            if (desktopIcons.parentNode) {
                desktopIcons.parentNode.removeChild(desktopIcons);
            }
        } else {
            if (startupDialog && startupDialog.style.display !== 'none') {
                // startup.js shows the icons once "Start" is clicked
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
