// The desktop: its icons (select, open, drag, Delete) and the main window.
// Each program's window is registered with the window manager
// (window-manager.js) by its own script.

// The programs on the desktop. Their desktop icons (for those that have one)
// and the Start menu's Programs folder (taskbar.js) both open them from here.
const DESKTOP_PROGRAMS = [
    // TASKMGR.EXE (taskmgr.js)
    { name: 'Task Manager', icon: 'TaskManagerIcon_16x16', open: () => openTaskManager() },
    { name: 'My Computer', desktopIcon: 'ComputerIcon_32x32', icon: 'ComputerIcon_16x16', open: () => openMyTechWindow() },
    // My Computer's mood, and visitors cheering it up (pc-health.js)
    { name: 'PC Health', desktopIcon: 'PcHealthIcon_32x32', icon: 'PcHealthIcon_16x16', open: () => openPcHealthWindow() },
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

// Desktop icons can be dragged anywhere on the desktop with the left button.
// Like Windows, a press only becomes a drag once the mouse has moved a few
// pixels, so the small wobble of a click or double-click leaves the icon where
// it is.
const ICON_DRAG_THRESHOLD = 4; // pixels

// Icons start out stacked in a column. Before the first one is dragged, every
// icon is pinned where it sits, so taking one out of the column doesn't slide
// the icons below it up underneath it.
function pinDesktopIcons() {
    const container = document.querySelector('.desktop-icons');
    if (!container || container.dataset.iconsPinned) return;

    const containerRect = container.getBoundingClientRect();
    const icons = Array.from(container.querySelectorAll('.desktop-icon'));
    // Measure them all before moving any of them
    const positions = icons.map(icon => {
        const rect = icon.getBoundingClientRect();
        return { left: rect.left - containerRect.left, top: rect.top - containerRect.top };
    });
    icons.forEach((icon, i) => {
        icon.style.position = 'absolute';
        icon.style.left = positions[i].left + 'px';
        icon.style.top = positions[i].top + 'px';
        icon.style.margin = '0';
    });
    container.dataset.iconsPinned = 'true';
}

function makeIconsDraggable() {
    const desktopIcons = document.querySelectorAll('.desktop-icon');

    desktopIcons.forEach(icon => {
        let isPressed = false;
        let isDragging = false;
        let startX, startY, offsetX, offsetY;

        icon.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;

            desktopIcons.forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');

            isPressed = true;
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            offsetX = e.clientX - icon.getBoundingClientRect().left;
            offsetY = e.clientY - icon.getBoundingClientRect().top;

            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isPressed) return;

            if (!isDragging) {
                if (Math.abs(e.clientX - startX) < ICON_DRAG_THRESHOLD &&
                    Math.abs(e.clientY - startY) < ICON_DRAG_THRESHOLD) {
                    return;
                }
                isDragging = true;
                pinDesktopIcons();
            }

            const containerRect = document.querySelector('.desktop-icons').getBoundingClientRect();
            icon.style.left = (e.clientX - offsetX - containerRect.left) + 'px';
            icon.style.top = (e.clientY - offsetY - containerRect.top) + 'px';

            e.preventDefault();
        });

        document.addEventListener('mouseup', function() {
            isPressed = false;
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
