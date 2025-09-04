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
    // Show the My Tech window
    const techWindow = document.getElementById('myTechWindow');
    if (techWindow) {
        techWindow.style.display = 'block';

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
    const techWindow = document.getElementById('myTechWindow');
    if (techWindow) {
        techWindow.style.display = 'none';
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

// Function to handle deselecting icons when clicking outside
function initializeDesktopClickHandler() {
    const desktopBackground = document.body;

    desktopBackground.addEventListener('click', function(event) {
        // Check if the click is on the desktop background and not on an icon or a window
        if (!event.target.closest('.desktop-icon') && !event.target.closest('.win95-window')) {
            document.querySelectorAll('.desktop-icon').forEach(icon => icon.classList.remove('selected'));
        }
    });
}

// Initialize all desktop icons and their functionality
function initializeDesktopIcons() {
    // Make sure the desktop icons are visible - override inline style
    const desktopIconsContainer = document.querySelector('.desktop-icons');
    if (desktopIconsContainer) {
        desktopIconsContainer.style.display = 'block';
    }

    // Add click handlers to all desktop icons
    const desktopIcons = document.querySelectorAll('.desktop-icon');

    desktopIcons.forEach((icon, index) => {
        // Click handler to select the icon
        icon.addEventListener('click', function(event) {
            desktopIcons.forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
            event.stopPropagation();
        });

        // For My Computer specifically, add double-click handler
        if (icon.querySelector('.ComputerIcon_32x32')) {
            icon.addEventListener('dblclick', openMyTechWindow);
        }

        // For Source Code icon, add double-click handler
        if (icon.querySelector('.GitHubIcon_32x32')) {
            icon.addEventListener('dblclick', openGitHubInstallerWindow);
        }

        // For Spotify icon, add double-click handler
        if (icon.querySelector('.SpotifyIcon_32x32')) {
            icon.addEventListener('dblclick', openSpotifyWindow);
        }
    });

    // Make windows draggable
    makeTechWindowDraggable();
    makeWindowDraggable('spotifyWindow', 'spotifyTitleBar');

    // Initialize the desktop click handler
    initializeDesktopClickHandler();
}

// Function to make the tech window draggable
function makeTechWindowDraggable() {
    const techWindow = document.getElementById('myTechWindow');
    const techTitleBar = document.getElementById('myTechTitleBar');

    if (!techWindow || !techTitleBar) {
        // Try again later if elements don't exist yet
        setTimeout(makeTechWindowDraggable, 500);
        return;
    }

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
    initializeDesktopIcons();
    makeIconsDraggable();
    addDeleteKeyFunctionality();
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

// Function to open the Spotify window
function openSpotifyWindow() {
    // Show the Spotify window
    const spotifyWindow = document.getElementById('spotifyWindow');
    if (spotifyWindow) {
        spotifyWindow.style.display = 'block';

        // Bring to front
        const allWindows = document.querySelectorAll('.win95-window');
        allWindows.forEach(win => {
            win.style.zIndex = 10;
        });
        spotifyWindow.style.zIndex = 100;

        // Load Spotify data
        loadSpotifyData();
    } else {
        console.error("Could not find spotifyWindow element");
    }
}

// Function to close the Spotify window
function closeSpotifyWindow() {
    const spotifyWindow = document.getElementById('spotifyWindow');
    if (spotifyWindow) {
        spotifyWindow.style.display = 'none';
    }
}

// Function to load data from local JSON file
async function loadSpotifyData() {
    try {
        // Fetch the local JSON file from the data folder
        const response = await fetch('data/spotify-data.json');

        if (!response.ok) {
            throw new Error('Failed to load Spotify data');
        }

        const data = await response.json();

        // Display the data
        if (data.topArtists) {
            displayTopArtists(data.topArtists);
        }

        if (data.topTracks) {
            displayTopTracks(data.topTracks);
        }

        // Update to use the shared formatCustomDateTime function
        if (data.lastUpdated) {
            const formattedTime = formatCustomDateTime(data.lastUpdated);

            // Get the last updated container
            const lastUpdatedContainer = document.getElementById('spotifyLastUpdated');

            if (lastUpdatedContainer) {
                // Check if we have the structure with LED indicator
                const textElement = lastUpdatedContainer.querySelector('.sync-text-content');

                if (textElement) {
                    // Just update the text content
                    textElement.textContent = `LAST UPDATED: ${formattedTime}`;
                } else {
                    // Create the new structure completely
                    lastUpdatedContainer.innerHTML = `
                        <div class="refresh-time">
                            <div class="sync-indicator"></div>
                            <div class="sync-text-content">LAST UPDATED: ${formattedTime}</div>
                        </div>
                    `;
                }
            } else {
                // Fall back to the original element if the new container doesn't exist
                const lastUpdatedElement = document.getElementById('lastUpdated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `LAST UPDATED: ${formattedTime}`;
                }
            }
        }

    } catch (error) {
        console.error('Error loading Spotify data:', error);

        // Update the last updated text if there's an error
        const textElement = document.getElementById('spotifyLastUpdated')?.querySelector('.sync-text-content');
        if (textElement) {
            textElement.textContent = "Error loading data.";
        }
    }
}

// Function to display top artists
function displayTopArtists(artists) {
    artists.forEach((artist, index) => {
        if (index < 5) { // Limit to 5 artists
            const imageElement = document.getElementById(`artist-image-${index + 1}`);
            const nameElement = document.getElementById(`artist-name-${index + 1}`);

            if (imageElement && nameElement) {
                // Set artist image
                if (artist.image) {
                    imageElement.src = artist.image;
                }

                // Set artist name
                nameElement.textContent = artist.name;
            }
        }
    });
}

// Function to display top tracks
function displayTopTracks(tracks) {
    // Clear existing tracks
    const tracksList = document.querySelector('.spotify-tracks-list');
    if (tracksList) {
        // Clear the list first
        tracksList.innerHTML = '';

        // Add each track
        tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'spotify-track-item';

            // Build the track item HTML
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

            // Add to the tracks list
            tracksList.appendChild(trackElement);
        });
    } else {
        console.error("Could not find spotify-tracks-list element");
    }
}

// Function to make desktop icons draggable
function makeIconsDraggable() {
    const desktopIcons = document.querySelectorAll('.desktop-icon');

    desktopIcons.forEach(icon => {
        let isDragging = false;
        let offsetX, offsetY;

        // Mouse down event to start dragging
        icon.addEventListener('mousedown', function(e) {
            // Only start dragging if it's not a double-click
            // (use a timer to detect double-clicks)
            const currentTime = new Date().getTime();
            const clickDelay = 200; // milliseconds

            if (icon.lastClickTime && (currentTime - icon.lastClickTime < clickDelay)) {
                // This is a double-click, don't start dragging
                return;
            }

            // Only start dragging on left mouse button (button 0)
            if (e.button !== 0) return;

            // Remember last click time for double-click detection
            icon.lastClickTime = currentTime;

            // Select the icon first
            desktopIcons.forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');

            // Set up dragging
            isDragging = true;
            offsetX = e.clientX - icon.getBoundingClientRect().left;
            offsetY = e.clientY - icon.getBoundingClientRect().top;

            // Prevent default behavior and event bubbling
            e.preventDefault();
            e.stopPropagation();
        });

        // Mouse move event for dragging
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            // Calculate new position
            const desktopIconsContainer = document.querySelector('.desktop-icons');
            const containerRect = desktopIconsContainer.getBoundingClientRect();

            let newLeft = e.clientX - offsetX - containerRect.left;
            let newTop = e.clientY - offsetY - containerRect.top;

            // Set the icon's position (convert from absolute to relative positioning)
            icon.style.position = 'absolute';
            icon.style.left = newLeft + 'px';
            icon.style.top = newTop + 'px';
            icon.style.margin = '0'; // Remove the margin to prevent offset issues

            e.preventDefault();
        });

        // Mouse up event to stop dragging
        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // Prevent accidental text selection during dragging
        icon.addEventListener('selectstart', function(e) {
            e.preventDefault();
        });
    });
}

// Function to add delete functionality with simplified achievement notification
function addDeleteKeyFunctionality() {

    // Create achievement notification element (hidden initially)
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

    // Add a keyboard event listener to the document
    document.addEventListener('keydown', function(e) {
        // Check if the Delete key was pressed
        if (e.key === 'Delete') {
            // Find the selected icon
            const selectedIcon = document.querySelector('.desktop-icon.selected');

            if (selectedIcon) {
                // Animate the deletion
                selectedIcon.style.transition = 'opacity 0.3s';
                selectedIcon.style.opacity = '0';

                // Remove the icon after animation
                setTimeout(() => {
                    selectedIcon.remove();

                    // Check if all icons are now deleted
                    const remainingIcons = document.querySelectorAll('.desktop-icon');
                    if (remainingIcons.length === 0) {
                        showAchievement();
                    }
                }, 300);
            }
        }
    });
}

// Function to display the achievement notification
function showAchievement() {
    const achievementElement = document.querySelector('.achievement-notification');
    if (!achievementElement) return;

    // Play achievement sound
    const achievementSound = new Audio('https://dl.dropboxusercontent.com/s/8qvrpd69ua7wio8/XboxAchievement.mp3');
    achievementSound.volume = 0.7;
    achievementSound.play().catch(err => console.log('Audio play failed:', err));

    // Prevent showing multiple times
    if (achievementElement.classList.contains('achievement-show')) {
        return;
    }

    // Show and animate the achievement
    achievementElement.classList.add('achievement-show');

    // Remove the animation class after it completes
    setTimeout(() => {
        achievementElement.classList.remove('achievement-show');
    }, 8000); // Match this to the CSS animation duration
}