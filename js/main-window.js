// The page's main window: its close button asks to shut down, and on pages
// without the window manager its minimize and maximize buttons are handled here
document.addEventListener('DOMContentLoaded', function() {
    // The first close button on the page is the main window's
    const closeButton = document.querySelector('.win95-button.win95-close');

    if (closeButton) {
        closeButton.addEventListener('click', function() {
            showClosingDialog();
        });
    }

    // On the home page the window manager (window-manager.js) minimizes and
    // maximizes the main window, with a taskbar to restore it from
    if (window.WindowManager) return;

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
            const desktopIcons = document.querySelector('.desktop-icons');

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

                    // Hide desktop icons when maximized
                    if (desktopIcons) {
                        desktopIcons.style.display = 'none';
                    }
                } else {
                    // Restore
                    container.style.width = container.dataset.originalWidth;
                    container.style.maxWidth = container.dataset.originalMaxWidth;
                    container.style.height = container.dataset.originalHeight;
                    container.style.margin = container.dataset.originalMargin;
                    container.dataset.isMaximized = '';

                    const isMobile = isTouchDevice();

                    // Show desktop icons when restored
                    if (desktopIcons && !isMobile) {
                        desktopIcons.style.display = 'block';
                    }
                }
            }
        });
    }
});
