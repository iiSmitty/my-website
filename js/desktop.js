// The desktop: its icons (select, open, drag, Delete) and the main window.
// Each program's window is registered with the window manager
// (window-manager.js) by its own script.

// The programs on the desktop. Their desktop icons (for those that have one)
// and the Start menu's Programs folder (taskbar.js) both open them from here.
const DESKTOP_PROGRAMS = [
    // TASKMGR.EXE (taskmgr.js)
    { name: 'Task Manager', icon: 'TaskManagerIcon_16x16', open: () => openTaskManager() },
    { name: 'My Computer', desktopIcon: 'ComputerIcon_32x32', icon: 'ComputerIcon_16x16', open: () => openMyTechWindow() },
    { name: 'Source Code', desktopIcon: 'GitHubIcon_32x32', icon: 'GitHubIcon_16x16 WhiteIcon', open: () => openGitHubInstallerWindow() },
    { name: 'Spotify', desktopIcon: 'SpotifyIcon_32x32', icon: 'SpotifyIcon_16x16 WhiteIcon', open: () => openSpotifyWindow() },
    // What I'm watching (watching.js)
    { name: 'Videos', desktopIcon: 'VideosIcon_32x32', icon: 'VideosIcon_16x16', open: () => openVideosWindow() },
    { name: 'Experience', desktopIcon: 'BriefcaseIcon_32x32', icon: 'BriefcaseIcon_16x16', open: () => openExperienceWindow() },
    { name: 'Dev Community', desktopIcon: 'SlackIcon_32x32', icon: 'SlackIcon_16x16', open: () => openSlackInviteWindow() },
    // Something from 2014 is still in the Recycle Bin (skype.js). It's an
    // easter egg, so the Start menu doesn't give it away.
    { name: 'Recycle Bin', desktopIcon: 'RecycleIcon_32x32', open: () => openSkypeWindow(), inStartMenu: false }
];

// Clicking anywhere but an icon or a window deselects the desktop icons
function initializeDesktopClickHandler() {
    const desktopBackground = document.body;

    desktopBackground.addEventListener('click', function(event) {
        if (!event.target.closest('.desktop-icon') && !event.target.closest('.win95-window')) {
            document.querySelectorAll('.desktop-icon').forEach(icon => icon.classList.remove('selected'));
        }
    });
}

// A click selects a desktop icon, a double-click opens its program
function initializeDesktopIcons() {
    // Make sure the desktop icons are visible - override inline style
    const desktopIconsContainer = document.querySelector('.desktop-icons');
    if (desktopIconsContainer) {
        desktopIconsContainer.style.display = 'block';
    }

    const desktopIcons = document.querySelectorAll('.desktop-icon');

    desktopIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
            desktopIcons.forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
            event.stopPropagation();
        });

        const program = DESKTOP_PROGRAMS.find(candidate =>
            candidate.desktopIcon && icon.querySelector(`.${candidate.desktopIcon}`));
        if (program) {
            icon.addEventListener('dblclick', () => program.open());
        }
    });

    initializeDesktopClickHandler();
}

// Desktop icons can be dragged anywhere on the desktop with the left button
function makeIconsDraggable() {
    const desktopIcons = document.querySelectorAll('.desktop-icon');

    desktopIcons.forEach(icon => {
        let isDragging = false;
        let offsetX, offsetY;

        icon.addEventListener('mousedown', function(e) {
            // The second press of a double-click opens the program, so it
            // doesn't start a drag
            const currentTime = new Date().getTime();
            const clickDelay = 200; // milliseconds

            if (icon.lastClickTime && (currentTime - icon.lastClickTime < clickDelay)) {
                return;
            }

            if (e.button !== 0) return;

            icon.lastClickTime = currentTime;

            desktopIcons.forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');

            isDragging = true;
            offsetX = e.clientX - icon.getBoundingClientRect().left;
            offsetY = e.clientY - icon.getBoundingClientRect().top;

            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            const desktopIconsContainer = document.querySelector('.desktop-icons');
            const containerRect = desktopIconsContainer.getBoundingClientRect();

            let newLeft = e.clientX - offsetX - containerRect.left;
            let newTop = e.clientY - offsetY - containerRect.top;

            // A dragged icon leaves the column layout and is placed absolutely,
            // without the margin the column gave it
            icon.style.position = 'absolute';
            icon.style.left = newLeft + 'px';
            icon.style.top = newTop + 'px';
            icon.style.margin = '0';

            e.preventDefault();
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // Dragging shouldn't select the icon's label text
        icon.addEventListener('selectstart', function(e) {
            e.preventDefault();
        });
    });
}

// Delete removes the selected desktop icon. Deleting all of them unlocks an
// Xbox-style achievement.
function addDeleteKeyFunctionality() {

    if (!document.querySelector('.achievement-notification')) {
        const achievementElement = document.createElement('div');
        achievementElement.className = 'achievement-notification';
        achievementElement.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <div class="achievement-text">
                    Achievement unlocked
                    <span class="achievement-separator">-</span>
                    25 G Desktop Declutterer
                </div>
            </div>
        `;
        document.body.appendChild(achievementElement);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete') {
            const selectedIcon = document.querySelector('.desktop-icon.selected');

            if (selectedIcon) {
                // Fade out, then remove
                selectedIcon.style.transition = 'opacity 0.3s';
                selectedIcon.style.opacity = '0';

                setTimeout(() => {
                    selectedIcon.remove();

                    const remainingIcons = document.querySelectorAll('.desktop-icon');
                    if (remainingIcons.length === 0) {
                        showAchievement();
                    }
                }, 300);
            }
        }
    });
}

function showAchievement() {
    const achievementElement = document.querySelector('.achievement-notification');
    if (!achievementElement) return;

    const achievementSound = new Audio('https://dl.dropboxusercontent.com/s/8qvrpd69ua7wio8/XboxAchievement.mp3');
    achievementSound.volume = 0.7;
    achievementSound.play().catch(err => console.log('Audio play failed:', err));

    // Already showing: the sound plays again, the notification doesn't restart
    if (achievementElement.classList.contains('achievement-show')) {
        return;
    }

    achievementElement.classList.add('achievement-show');

    setTimeout(() => {
        achievementElement.classList.remove('achievement-show');
    }, 8000); // Match this to the CSS animation duration
}

document.addEventListener('DOMContentLoaded', function() {
    // The main window sits in the page rather than floating, so it isn't dragged
    WindowManager.register(document.querySelector('.win95-container'), { maximizable: true, draggable: false });

    initializeDesktopIcons();
    makeIconsDraggable();
    addDeleteKeyFunctionality();
});
