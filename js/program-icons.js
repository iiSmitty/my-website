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

// What I Do: each program, shown the way Win95 showed a file's Properties.
// Which system I work on at Interfront isn't mine to name, so it says so the
// way Windows would. All of this is my own text, so it's set as HTML.
const ACCESS_DENIED = '<span class="access-denied"><span class="access-denied-icon" aria-hidden="true"></span>Access is denied.</span>';
const REDACTED = '<span class="redacted" role="img" aria-label="Access is denied"></span>';

const WHAT_I_DO = {
    integration: {
        name: 'Integration.dll',
        icon: 'IntegrationIcon_32x32',
        type: 'Application extension',
        location: 'C:\\Interfront\\' + REDACTED + '\\',
        modified: 'Jul 2026 &ndash; Present',
        story: `
            <p>I'm an integration developer at Interfront, working in .NET Framework and C# on one of
            South Africa's biggest systems. Which one? ${ACCESS_DENIED}</p>
            <p>My team owns the APIs between the frontend and the database, so when something breaks, we
            usually hear first:</p>
            <ul>
                <li>a date in the wrong format</li>
                <li>a value that won't convert</li>
                <li>a token that expires too early</li>
            </ul>
            <p>The job is to find out whether it's the frontend, the database or us, then fix it.
            Sometimes that takes a SQL query or two to prove which.</p>
            <p>There's always something new: projects and extensions to make it better for everyone who
            uses it.</p>`
    },
    pipeline: {
        name: 'LeadPipeline.exe',
        icon: 'PipelineIcon_32x32',
        type: 'Azure Function App',
        location: 'C:\\Interfront\\Clients\\',
        modified: 'Mar &ndash; Jul 2026',
        story: `
            <p>My first year and a half at Interfront was client work: two websites, one mostly frontend
            and one full stack in C#, then the biggest piece. We moved a client's ad leads off an old
            frontend setup and onto Azure, which is much faster and far easier to maintain.</p>
            <p>A senior colleague designed the architecture; I put the meat on the bones. Leads arrive
            from the website, TikTok, Facebook and WhatsApp, then pass through a chain of small Azure
            Functions joined by queues:</p>
            <ul>
                <li>normalise and validate</li>
                <li>check for duplicates</li>
                <li>route to the right call centre</li>
            </ul>
            <p>Every step records that it's done, so a retry never creates the same lead twice. I built
            the integrations for two of the four destination systems, with their API docs, and wrote the
            onboarding guide and runbooks for the developers taking over.</p>`
    },
    outsystems: {
        name: 'OutSystems.oml',
        icon: 'OutSystemsIcon_32x32',
        type: 'OutSystems module',
        location: 'C:\\Integralis\\Zuzani\\',
        modified: 'Oct 2021 &ndash; Feb 2025',
        story: `
            <p>My first big project, at Integralis: an internal document management system for our sister
            company, <a href="https://www.zuzanigroup.com/" target="_blank" rel="noopener noreferrer">Zuzani</a>.
            For most of it I was the only developer, so I learned OutSystems and built at the same time.
            Low-code isn't traditional coding, and it has limits you have to learn to work around.</p>
            <p>Later I trained a second developer to work on it with me. Along the way I was mentored by
            <a href="https://adplist.org/mentors/daniel-kuhlmann" target="_blank" rel="noopener noreferrer">Daniël Kuhlmann</a>,
            an OutSystems MVP, through ADPList.</p>`
    },
    claude: {
        name: 'Claude.exe',
        icon: 'ClaudeIcon_32x32',
        type: 'Application',
        location: 'C:\\Program Files\\Claude\\',
        modified: 'Every day',
        story: `
            <p>I make a deliberate effort to use Claude well. AI has changed the whole software development
            life cycle, and anyone who refuses to use it is going to miss the bus.</p>
            <p>We have seniors who keep us honest, so we learn from them and don't blindly trust what Claude
            writes. It's a process, and it takes time.</p>`
    }
};

function whatIDoProperties(program) {
    const field = (label, value) => `<div><dt>${label}:</dt><dd>${value}</dd></div>`;
    return `
        <div class="file-props">
            <div class="file-props-header">
                <span class="${program.icon}" aria-hidden="true"></span>
                <b class="file-props-name">${program.name}</b>
            </div>
            <dl class="file-props-fields">
                ${field('Type', program.type)}
                ${field('Location', program.location)}
                ${field('Modified', program.modified)}
            </dl>
            <div class="file-props-story">${program.story}</div>
        </div>`;
}

// Shows a program's Properties, and marks its icon as the chosen one
function showInfo(service, item) {
    const program = WHAT_I_DO[service];
    document.getElementById('infoBox').innerHTML = program
        ? whatIDoProperties(program)
        : 'Click an icon to see what I work on.';

    document.querySelectorAll('.program-item[role="button"]').forEach(other => {
        const chosen = other === item;
        other.classList.toggle('selected', chosen);
        other.setAttribute('aria-pressed', String(chosen));
    });
}

// Help > How This Site Works (the menu bar and the Start menu). Brings the
// main window back, loads the profile from the floppy if it hasn't been, then
// lands on the section, with focus on its heading so the keyboard is there too.
async function openSiteHelp() {
    const mainWindow = document.querySelector('.win95-container');
    if (mainWindow) WindowManager.open(mainWindow);

    await loadProfile({ quick: true });

    const heading = document.getElementById('how-it-works-title');
    if (!heading) return;
    // A jump, not a glide: Win95 never scrolled smoothly
    document.getElementById('how-it-works').scrollIntoView();
    heading.focus({ preventScroll: true });
}

// The help topics' shortcut buttons open the program they talk about, the way
// a WinHelp shortcut button opened the Control Panel item it described
function initializeSiteHelp() {
    document.querySelectorAll('.help-shortcut[data-program]').forEach(button => {
        const program = DESKTOP_PROGRAMS.find(candidate => candidate.name === button.dataset.program);
        if (program) button.addEventListener('click', () => program.open());
    });

    document.querySelectorAll('[data-site-help]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            openSiteHelp();
        });
    });
}

// What I Do's icons are role="button"s, so Enter and Space choose them too
function initializeProgramItems() {
    document.querySelectorAll('.program-item[role="button"]').forEach(item => {
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                item.click();
            }
        });
    });
}

function openMyTechWindow() {
    WindowManager.open(document.getElementById('myTechWindow'));
}

function closeMyTechWindow() {
    WindowManager.close(document.getElementById('myTechWindow'));
}

// Only one row of My Computer is selected at a time
function selectTechItem(element) {
    document.querySelectorAll('.tech-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
}

// Show a Win95-style "device not working" dialog for a retired/dead item.
// Used by the Sony WF-1000XM4 row, whose battery no longer holds a charge.
function showDeadDeviceDialog(element) {
    // Still behave like a normal row: mark it selected.
    selectTechItem(element);

    // Pull the device name straight from the row so the dialog stays in sync.
    // Prefer the struck-through name, falling back to the whole name cell.
    const nameNode = element.querySelector('.tech-item-name s') || element.querySelector('.tech-item-name');
    const name = (nameNode?.textContent || 'Device').trim();

    let overlay = document.getElementById('deadDeviceDialog');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'deadDeviceDialog';
        overlay.className = 'dead-dialog-overlay';
        overlay.innerHTML = `
            <div class="dead-dialog win95-window" id="deadDeviceWindow" role="dialog" aria-modal="true" aria-labelledby="deadDialogTitle">
                <div class="win95-title-bar" id="deadDeviceTitleBar" style="cursor: move;">
                    <div class="win95-title" id="deadDialogTitle"></div>
                    <div class="win95-buttons">
                        <button class="win95-button win95-close" type="button" aria-label="Close" onclick="closeDeadDeviceDialog()">&times;</button>
                    </div>
                </div>
                <div class="dead-dialog-body">
                    <div class="dead-dialog-icon" aria-hidden="true">
                        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="15" fill="#d00000" stroke="#800000" stroke-width="1"/>
                            <path d="M10 10 L22 22 M22 10 L10 22" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="dead-dialog-text">
                        <strong>This device is not working properly.</strong>
                        The battery no longer holds a charge, so Windows cannot start
                        this device. Served faithfully from first pairing to final charge.
                        <br><br>
                        <span class="dead-dialog-code">(Code 10: Device flatlined.)</span>
                    </div>
                </div>
                <div class="dead-dialog-buttons">
                    <button class="win95-btn" type="button" onclick="closeDeadDeviceDialog()">OK</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // Click outside the dialog (on the backdrop) closes it.
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeDeadDeviceDialog();
        });

        // Drag by the title bar, consistent with the other windows.
        WindowManager.makeDraggable(document.getElementById('deadDeviceWindow'),
            document.getElementById('deadDeviceTitleBar'));
    }

    overlay.querySelector('#deadDialogTitle').textContent = `${name} Properties`;
    overlay.classList.add('open');

    // Center on screen each time it opens (left/top in px so dragging works).
    const dialog = document.getElementById('deadDeviceWindow');
    const rect = dialog.getBoundingClientRect();
    dialog.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + 'px';
    dialog.style.top = Math.max(8, (window.innerHeight - rect.height) / 2) + 'px';

    // Esc closes the dialog while it's open.
    document.addEventListener('keydown', deadDeviceEscHandler);
}

function deadDeviceEscHandler(e) {
    if (e.key === 'Escape') closeDeadDeviceDialog();
}

function closeDeadDeviceDialog() {
    const overlay = document.getElementById('deadDeviceDialog');
    if (overlay) overlay.classList.remove('open');
    document.removeEventListener('keydown', deadDeviceEscHandler);
}

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

// The windows that are part of the page. The ones built on first open
// (Skype, Videos, DECRYPT.EXE) register themselves.
function registerDesktopWindows() {
    // The main window sits in the page rather than floating, so it isn't dragged
    WindowManager.register(document.querySelector('.win95-container'), { maximizable: true, draggable: false });

    ['myTechWindow', 'spotifyWindow', 'githubInstallerWindow', 'slackWindow'].forEach(id => {
        WindowManager.register(document.getElementById(id));
    });
    WindowManager.register(document.getElementById('experienceWindow'), { maximizable: true });
}

document.addEventListener('DOMContentLoaded', function() {
    registerDesktopWindows();
    initializeDesktopIcons();
    initializeSiteHelp();
    initializeProgramItems();
    makeIconsDraggable();
    addDeleteKeyFunctionality();
});

function openGitHubInstallerWindow() {
    const installerWindow = document.getElementById('githubInstallerWindow');

    // Re-opening an open window just brings it forward
    if (!WindowManager.open(installerWindow)) {
        startInstallation();
    }
}

function closeGitHubInstallerWindow() {
    clearTimeout(installationTimer);
    WindowManager.close(document.getElementById('githubInstallerWindow'));
}

// The installer's Next button: the GitHub profile, in a new tab
function openGitHubPage() {
    const githubUrl = 'https://github.com/iiSmitty';
    window.open(githubUrl, '_blank');
    closeGitHubInstallerWindow();
}

// Each step shows for its delay (in ms) before the next one
const installationSteps = [
    { text: "Checking system requirements...", delay: 1000 },
    { text: "Searching for existing GitHub installations...", delay: 1500 },
    { text: "Initializing connection protocols...", delay: 1200 },
    { text: "Configuring repository access...", delay: 1300 },
    { text: "Optimizing connection settings...", delay: 900 },
    { text: "Installing Octocat drivers (1/3)...", delay: 1100 },
    { text: "Installing Octocat drivers (2/3)...", delay: 1400 },
    { text: "Installing Octocat drivers (3/3)...", delay: 1000 },
    { text: "Configuring SSH keys...", delay: 1200 },
    { text: "Testing connection speed...", delay: 1300 },
    { text: "Finalizing installation...", delay: 1000 },
    { text: "Installation complete!", delay: 500 }
];

let currentStep = 0;
// The next step's timer, so closing the wizard stops it
let installationTimer = null;

// Starts the installation over from the first step
function startInstallation() {
    clearTimeout(installationTimer);
    currentStep = 0;
    const progressBar = document.getElementById('progressBar');
    const installationLog = document.getElementById('installationLog');
    const nextBtn = document.getElementById('nextBtn');

    progressBar.style.width = '0%';
    nextBtn.disabled = true;
    installationLog.innerHTML = '<div>Starting installation process...</div>';

    processNextStep();
}

function processNextStep() {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const nextBtn = document.getElementById('nextBtn');

    if (currentStep < installationSteps.length) {
        const step = installationSteps[currentStep];

        statusText.textContent = step.text;
        addLogEntry(step.text);

        const progress = ((currentStep + 1) / installationSteps.length) * 100;
        progressBar.style.width = `${progress}%`;

        installationTimer = setTimeout(processNextStep, step.delay);

        currentStep++;

        // The last step enables Next straight away, without waiting out its delay
        if (currentStep === installationSteps.length) {
            nextBtn.disabled = false;
            addLogEntry("Ready to connect to GitHub repositories!", "completed");
        }
    }
}

function addLogEntry(text, className = '') {
    const installationLog = document.getElementById('installationLog');
    const entry = document.createElement('div');
    entry.textContent = text;
    if (className) {
        entry.className = className;
    }
    installationLog.appendChild(entry);
    installationLog.scrollTop = installationLog.scrollHeight;
}

// The Experience window shows experience.html in embedded mode
function openExperienceWindow() {
    const frame = document.getElementById('experienceFrame');

    // Load the page on first open only, so the home page doesn't pay for it
    if (!frame.getAttribute('src')) {
        frame.setAttribute('src', frame.dataset.src);
    }

    WindowManager.open(document.getElementById('experienceWindow'));
}

function closeExperienceWindow() {
    WindowManager.close(document.getElementById('experienceWindow'));
}

function openSpotifyWindow() {
    // Re-opening an open window just brings it forward
    if (!WindowManager.open(document.getElementById('spotifyWindow'))) {
        loadSpotifyData();
    }
}

function closeSpotifyWindow() {
    WindowManager.close(document.getElementById('spotifyWindow'));
}

// data/spotify-data.json is refreshed by a GitHub Action (spotify-data-fetcher.js)
async function loadSpotifyData() {
    const lastUpdatedText = document.querySelector('#spotifyLastUpdated .sync-text-content');

    try {
        const response = await fetch('data/spotify-data.json');

        if (!response.ok) {
            throw new Error('Failed to load Spotify data');
        }

        const data = await response.json();

        if (data.topArtists) {
            displayTopArtists(data.topArtists);
        }

        if (data.topTracks) {
            displayTopTracks(data.topTracks);
        }

        if (data.lastUpdated) {
            lastUpdatedText.textContent = `LAST UPDATED: ${formatCustomDateTime(data.lastUpdated)}`;
        }

    } catch (error) {
        console.error('Error loading Spotify data:', error);
        lastUpdatedText.textContent = "Error loading data.";
    }
}

// The window has room for five artists
function displayTopArtists(artists) {
    artists.forEach((artist, index) => {
        if (index < 5) {
            const imageElement = document.getElementById(`artist-image-${index + 1}`);
            const nameElement = document.getElementById(`artist-name-${index + 1}`);

            if (imageElement && nameElement) {
                if (artist.image) {
                    imageElement.src = artist.image;
                }
                nameElement.textContent = artist.name;
            }
        }
    });
}

function displayTopTracks(tracks) {
    const tracksList = document.querySelector('.spotify-tracks-list');
    if (tracksList) {
        tracksList.innerHTML = '';

        tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'spotify-track-item';

            trackElement.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-art-container">
                    <img src="${track.albumImage || ''}" alt="${track.name}" class="track-art">
                </div>
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-artist">${track.artist}</div>
                </div>
            `;

            tracksList.appendChild(trackElement);
        });
    } else {
        console.error("Could not find spotify-tracks-list element");
    }
}

function openSlackInviteWindow() {
    WindowManager.open(document.getElementById('slackWindow'));
}

function closeSlackWindow() {
    WindowManager.close(document.getElementById('slackWindow'));
}

// The Join Community button: ZATech's invite page, in a new tab
function joinSlackCommunity() {
    const slackInviteUrl = 'https://zatech.co.za/';
    window.open(slackInviteUrl, '_blank');
    closeSlackWindow();
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

    // Preload the achievement sound
    const achievementSound = new Audio('https://dl.dropboxusercontent.com/s/8qvrpd69ua7wio8/XboxAchievement.mp3');

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