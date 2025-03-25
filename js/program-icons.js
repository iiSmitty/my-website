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