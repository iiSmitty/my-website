// Function to display info when program icons are clicked
function showInfo(service) {
    const infoBox = document.getElementById('infoBox');

    switch(service) {
        case 'backend':
            infoBox.innerHTML = "<b>Backend Development</b><br>Working with .NET Framework to develop server-side logic. Learning to build APIs and services while following best practices for maintainable code.";
            break;
        case 'frontend':
            infoBox.innerHTML = "<b>Frontend Development</b><br>Creating user interfaces with HTML/CSS. Developing web pages that are responsive and user-friendly while expanding my skills in modern web technologies.";
            break;
        case 'database':
            infoBox.innerHTML = "<b>Database Design</b><br>Working with SQL databases and learning efficient schema design. Implementing database solutions while building experience with data management concepts.";
            break;
        case 'architecture':
            infoBox.innerHTML = "<b>System Architecture</b><br>Learning about system design principles. Understanding how different components work together to create cohesive applications as I grow my development experience.";
            break;
        case 'optimization':
            infoBox.innerHTML = "<b>Code Optimization</b><br>Improving code efficiency and readability. Practicing techniques to write cleaner, faster code while developing my skills in performance analysis.";
            break;
        default:
            infoBox.innerHTML = "Click an icon to learn more about what I'm focusing on as a graduate developer...";
    }
}

// Function to open the My Tech window
function openMyTechWindow() {
    console.log("Opening My Tech window...");

    // Show the My Tech window
    const techWindow = document.getElementById('myTechWindow');
    if (techWindow) {
        techWindow.style.display = 'block';
        console.log("My Tech window opened");

        // Bring to front
        const allWindows = document.querySelectorAll('.win95-window');
        allWindows.forEach(win => {
            win.style.zIndex = 10;
        });
        techWindow.style.zIndex = 100;
    } else {
        console.error("Could not find myTechWindow element");
    }
}

// Function to close the My Tech window
function closeMyTechWindow() {
    console.log("Closing My Tech window...");

    const techWindow = document.getElementById('myTechWindow');
    if (techWindow) {
        techWindow.style.display = 'none';
        console.log("My Tech window closed");
    }
}

// Function to select a tech item
function selectTechItem(element) {
    // Clear any previously selected items
    document.querySelectorAll('.tech-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Select the clicked item
    element.classList.add('selected');
}

// Initialize all desktop icons and their functionality
function initializeDesktopIcons() {
    console.log("Initializing desktop icons...");

    // Make sure the desktop icons are visible - override inline style
    const desktopIconsContainer = document.querySelector('.desktop-icons');
    if (desktopIconsContainer) {
        desktopIconsContainer.style.display = 'block'; // This overrides the inline style
        console.log("Made desktop icons visible");
    }

    // Add click handlers to all desktop icons
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    console.log("Found desktop icons:", desktopIcons.length);

    desktopIcons.forEach((icon, index) => {
        // Click handler to select the icon
        icon.addEventListener('click', function() {
            console.log("Icon clicked:", index);
            desktopIcons.forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
        });

        // For My Computer specifically, add double-click handler
        if (icon.querySelector('.ComputerIcon_32x32')) {
            console.log("Found My Computer icon at index:", index);
            icon.addEventListener('dblclick', function() {
                console.log("My Computer double-clicked");
                openMyTechWindow();
            });
        }

        // For Source Code icon, add double-click handler
        if (icon.querySelector('.GitHubIcon_32x32')) {
            console.log("Found Source Code icon at index:", index);
            icon.addEventListener('dblclick', function() {
                console.log("Source Code double-clicked");
                openGitHubInstallerWindow();
            });
        }
    });

    // Make the tech window draggable
    makeTechWindowDraggable();
}

// Function to make the tech window draggable
function makeTechWindowDraggable() {
    const techWindow = document.getElementById('myTechWindow');
    const techTitleBar = document.getElementById('myTechTitleBar');

    if (!techWindow || !techTitleBar) {
        console.log("Tech window or title bar not found yet");
        // Try again later if elements don't exist yet
        setTimeout(makeTechWindowDraggable, 500);
        return;
    }

    console.log("Setting up draggable tech window");

    let isDragging = false;
    let offsetX, offsetY;

    techTitleBar.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - techWindow.getBoundingClientRect().left;
        offsetY = e.clientY - techWindow.getBoundingClientRect().top;

        // Bring window to front
        const allWindows = document.querySelectorAll('.win95-window');
        allWindows.forEach(win => {
            win.style.zIndex = 10;
        });
        techWindow.style.zIndex = 100;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        techWindow.style.left = (e.clientX - offsetX) + 'px';
        techWindow.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
}

// When the document is ready, initialize everything
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM is ready, initializing...");
    initializeDesktopIcons();
});

// Function to open the GitHub installer window
function openGitHubInstallerWindow() {
    const installerWindow = document.getElementById('githubInstallerWindow');
    installerWindow.style.display = 'block';

    // Start the installation process
    startInstallation();

    // Make the window draggable
    makeWindowDraggable('githubInstallerWindow', 'githubInstallerTitleBar');
}

// Function to close the GitHub installer window
function closeGitHubInstallerWindow() {
    const installerWindow = document.getElementById('githubInstallerWindow');
    installerWindow.style.display = 'none';
}

// Function to open GitHub page in a new tab
function openGitHubPage() {
    // Your GitHub URL
    const githubUrl = 'https://github.com/iiSmitty';
    window.open(githubUrl, '_blank');

    // Close the installer window
    closeGitHubInstallerWindow();
}

// Installation steps with delays (in ms)
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

// Start the installation process
function startInstallation() {
    currentStep = 0;
    const progressBar = document.getElementById('progressBar');
    const installationLog = document.getElementById('installationLog');
    const nextBtn = document.getElementById('nextBtn');

    // Reset UI
    progressBar.style.width = '0%';
    nextBtn.disabled = true;
    installationLog.innerHTML = '<div>Starting installation process...</div>';

    // Process each step with its delay
    processNextStep();
}

function processNextStep() {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const nextBtn = document.getElementById('nextBtn');

    if (currentStep < installationSteps.length) {
        const step = installationSteps[currentStep];

        // Update status text
        statusText.textContent = step.text;

        // Add to log
        addLogEntry(step.text);

        // Update progress bar
        const progress = ((currentStep + 1) / installationSteps.length) * 100;
        progressBar.style.width = `${progress}%`;

        // Move to next step after delay
        setTimeout(processNextStep, step.delay);

        currentStep++;

        // Enable Next button when done
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

// Function to make windows draggable (reusable for all windows)
function makeWindowDraggable(windowId, titleBarId) {
    const windowElement = document.getElementById(windowId);
    const titleBar = document.getElementById(titleBarId);

    if (!windowElement || !titleBar) {
        console.log(`Window ${windowId} or title bar ${titleBarId} not found`);
        return;
    }

    let isDragging = false;
    let offsetX, offsetY;

    titleBar.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - windowElement.getBoundingClientRect().left;
        offsetY = e.clientY - windowElement.getBoundingClientRect().top;

        // Bring window to front
        const allWindows = document.querySelectorAll('.win95-window');
        allWindows.forEach(win => {
            win.style.zIndex = 10;
        });
        windowElement.style.zIndex = 100;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        windowElement.style.left = (e.clientX - offsetX) + 'px';
        windowElement.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
}