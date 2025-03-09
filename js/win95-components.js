// win95-components.js
document.addEventListener('DOMContentLoaded', function() {
    // Create the menu bar component
    function createMenuBar(currentPage) {
        const menuBar = document.createElement('div');
        menuBar.className = 'win95-menu-bar';

        // Define menu items with their links
        const menuItems = [
            {
                text: 'File',
                dropdown: [
                    { text: 'Home', link: './' },
                    { text: 'Strava PBs', link: './strava-pbs' },
                    { text: 'Exit', action: 'exit' }
                ]
            },
            { text: 'Edit', link: '#' },
            { text: 'View', link: '#' },
            { text: 'Help', link: '#' }
        ];

        // Close any open dropdowns when clicking elsewhere
        document.addEventListener('click', function(event) {
            const dropdowns = document.querySelectorAll('.win95-dropdown');
            dropdowns.forEach(dropdown => {
                if (!dropdown.contains(event.target)) {
                    dropdown.querySelector('.win95-dropdown-content').classList.remove('show');

                    // Remove active state from menu item
                    dropdown.querySelector('.win95-menu-item').classList.remove('active-menu-item');
                }
            });
        });

        // Create and append all menu items
        menuItems.forEach(item => {
            if (item.dropdown) {
                // Create dropdown container
                const dropdownContainer = document.createElement('div');
                dropdownContainer.className = 'win95-dropdown';

                // Create dropdown trigger
                const menuItem = document.createElement('div');
                menuItem.className = 'win95-menu-item';
                menuItem.textContent = item.text;

                // Create dropdown content
                const dropdownContent = document.createElement('div');
                dropdownContent.className = 'win95-dropdown-content';

                // Toggle dropdown on click
                menuItem.addEventListener('click', function(event) {
                    event.stopPropagation();

                    // Close any open dropdowns first
                    document.querySelectorAll('.win95-dropdown-content').forEach(dropdown => {
                        if (dropdown !== dropdownContent) {
                            dropdown.classList.remove('show');
                        }
                    });

                    dropdownContent.classList.toggle('show');

                    // Add active state to menu item when dropdown is open
                    if (dropdownContent.classList.contains('show')) {
                        menuItem.classList.add('active-menu-item');
                    } else {
                        menuItem.classList.remove('active-menu-item');
                    }
                });

                // Add dropdown items
                item.dropdown.forEach(dropdownItem => {
                    const dropdownElement = document.createElement('div');
                    dropdownElement.className = 'win95-dropdown-item';
                    dropdownElement.textContent = dropdownItem.text;

                    // Highlight active page in dropdown
                    if ((dropdownItem.text === 'Home' && (currentPage === 'home' || currentPage === '' || currentPage === 'index')) ||
                        (dropdownItem.text === 'Strava PBs' && currentPage === 'strava-pbs')) {
                        dropdownElement.classList.add('active-dropdown-item');
                    }

                    // Check for special actions first
                    if (dropdownItem.action === 'exit') {
                        dropdownElement.addEventListener('click', function() {
                            console.log('Exit clicked'); // Debug log

                            // First close the dropdown
                            dropdownContent.classList.remove('show');
                            menuItem.classList.remove('active-menu-item');

                            // Call the global showClosingDialog function
                            if (typeof window.showClosingDialog === 'function') {
                                window.showClosingDialog();
                            } else {
                                console.error('showClosingDialog function not found in global scope');
                            }
                        });
                    }
                    // Handle normal links
                    else if (dropdownItem.link) {
                        dropdownElement.addEventListener('click', function() {
                            window.location.href = dropdownItem.link;
                        });
                    }

                    dropdownContent.appendChild(dropdownElement);
                });

                // Assemble dropdown
                dropdownContainer.appendChild(menuItem);
                dropdownContainer.appendChild(dropdownContent);
                menuBar.appendChild(dropdownContainer);
            } else {
                // Create regular menu item
                const menuItem = document.createElement('div');
                menuItem.className = 'win95-menu-item';
                menuItem.textContent = item.text;

                // Add click event for links
                if (item.link) {
                    menuItem.addEventListener('click', function() {
                        window.location.href = item.link;
                    });
                }

                menuBar.appendChild(menuItem);
            }
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