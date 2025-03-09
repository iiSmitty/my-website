// win95-components.js
document.addEventListener('DOMContentLoaded', function() {
    // Create the menu bar component
    function createMenuBar(currentPage) {
        const menuBar = document.createElement('div');
        menuBar.className = 'win95-menu-bar';

        // Define menu items with their links
        const menuItems = [
            { text: 'File', link: '#' },
            { text: 'Edit', link: '#' },
            { text: 'View', link: '#' },
            { text: 'Strava PBs', link: './strava-pbs', activePage: 'strava-pbs' },
            { text: 'Help', link: '#' }
        ];

        // Special case for home link
        const homeItem = document.createElement('div');
        homeItem.className = 'win95-menu-item';
        if (currentPage === 'home' || currentPage === '') {
            homeItem.classList.add('active-menu-item');
        }
        homeItem.textContent = 'Home';
        homeItem.addEventListener('click', function() {
            window.location.href = './';
        });
        menuBar.appendChild(homeItem);

        // Create and append all other menu items
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'win95-menu-item';
            menuItem.textContent = item.text;

            // Highlight active page
            if (item.activePage && currentPage === item.activePage) {
                menuItem.classList.add('active-menu-item');
            }

            // Add click event for links
            if (item.link) {
                menuItem.addEventListener('click', function() {
                    window.location.href = item.link;
                });
            }

            menuBar.appendChild(menuItem);
        });

        return menuBar;
    }

    // Create the status bar component
    function createStatusBar() {
        const statusBar = document.createElement('div');
        statusBar.className = 'win95-status-bar';

        // Create top status bar section
        const statusBarTop = document.createElement('div');
        statusBarTop.className = 'status-bar-top';

        const statusItems = [
            { text: 'Page loaded successfully' },
            { text: 'Visitors: 1,337' },
            { text: 'Last updated: August 24, 1995' }
        ];

        // Create standard status items
        statusItems.forEach(item => {
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            statusItem.textContent = item.text;
            statusBarTop.appendChild(statusItem);
        });

        // Create sound toggle button
        const soundItem = document.createElement('div');
        soundItem.className = 'status-item';

        const soundButton = document.createElement('button');
        soundButton.className = 'win95-sound-button';
        soundButton.id = 'sound-toggle';
        soundButton.title = 'Toggle Sound';
        soundButton.textContent = '🔊';

        soundItem.appendChild(soundButton);
        statusBarTop.appendChild(soundItem);

        // Create bottom status bar section
        const statusBarBottom = document.createElement('div');
        statusBarBottom.className = 'status-bar-bottom';

        const faithMessage = document.createElement('div');
        faithMessage.className = 'faith-message';
        faithMessage.innerHTML = 'Jesus Christ is the Light and Saviour of the world! <a href="https://www.bible.com/" target="_blank">Discover His Love</a>';

        statusBarBottom.appendChild(faithMessage);

        // Assemble the full status bar
        statusBar.appendChild(statusBarTop);
        statusBar.appendChild(statusBarBottom);

        return statusBar;
    }

    // Function to load components into the page
    function loadComponents() {
        // Determine current page
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '');

        // Find the elements we need to replace
        const existingMenuBar = document.querySelector('.win95-menu-bar');
        const existingStatusBar = document.querySelector('.win95-status-bar');

        // Replace menu bar
        if (existingMenuBar) {
            const newMenuBar = createMenuBar(page);
            existingMenuBar.parentNode.replaceChild(newMenuBar, existingMenuBar);
        }

        // Replace status bar
        if (existingStatusBar) {
            const newStatusBar = createStatusBar();
            existingStatusBar.parentNode.replaceChild(newStatusBar, existingStatusBar);
        }

        // Add sound toggle functionality
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', function() {
                // Toggle between sound on/off icons
                if (this.textContent === '🔊') {
                    this.textContent = '🔈';
                } else {
                    this.textContent = '🔊';
                }
                // Here you would add code to actually toggle sound
            });
        }
    }

    // Initialize components
    loadComponents();
});