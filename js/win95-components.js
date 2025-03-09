// win95-components.js
document.addEventListener('DOMContentLoaded', function() {
    // Track the active dropdown for keyboard navigation
    let activeDropdown = null;
    let isAltKeyPressed = false;

    // Create the menu bar component
    function createMenuBar(currentPage) {
        const menuBar = document.createElement('div');
        menuBar.className = 'win95-menu-bar';

        // Define menu items with their links and access keys
        const menuItems = [
            {
                text: 'File',
                accessKey: 'F',
                dropdown: [
                    { text: 'Home', accessKey: 'H', link: './' },
                    { text: 'Strava PBs', accessKey: 'S', link: './strava-pbs' },
                    { text: 'Exit', accessKey: 'X', action: 'exit' }
                ]
            },
            { text: 'Edit', accessKey: 'E', link: '#' },
            { text: 'View', accessKey: 'V', link: '#' },
            { text: 'Help', accessKey: 'H', link: '#' }
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

        // Function to create text with underlined access key
        function createUnderlinedText(text, accessKey) {
            if (!text || text.length === 0) return document.createTextNode('');

            const container = document.createElement('span');

            // If accessKey is provided, find and underline that letter
            if (accessKey) {
                const lowercaseText = text.toLowerCase();
                const lowercaseKey = accessKey.toLowerCase();
                const keyIndex = lowercaseText.indexOf(lowercaseKey);

                if (keyIndex !== -1) {
                    // Add text before the access key
                    if (keyIndex > 0) {
                        container.appendChild(document.createTextNode(text.substring(0, keyIndex)));
                    }

                    // Add the underlined access key
                    const keySpan = document.createElement('span');
                    keySpan.textContent = text.charAt(keyIndex);
                    keySpan.style.textDecoration = 'underline';
                    container.appendChild(keySpan);

                    // Add text after the access key
                    if (keyIndex < text.length - 1) {
                        container.appendChild(document.createTextNode(text.substring(keyIndex + 1)));
                    }

                    return container;
                }
            }

            // Default behavior: just underline the first letter
            const firstLetter = document.createElement('span');
            firstLetter.textContent = text.charAt(0);
            firstLetter.style.textDecoration = 'underline';

            const restOfText = document.createTextNode(text.substring(1));

            container.appendChild(firstLetter);
            container.appendChild(restOfText);
            return container;
        }

        // Create and append all menu items
        menuItems.forEach(item => {
            if (item.dropdown) {
                // Create dropdown container
                const dropdownContainer = document.createElement('div');
                dropdownContainer.className = 'win95-dropdown';

                // Create dropdown trigger
                const menuItem = document.createElement('div');
                menuItem.className = 'win95-menu-item';
                menuItem.appendChild(createUnderlinedText(item.text, item.accessKey));
                menuItem.dataset.accessKey = item.accessKey.toLowerCase();

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
                    dropdownElement.appendChild(createUnderlinedText(dropdownItem.text, dropdownItem.accessKey));
                    dropdownElement.dataset.accessKey = dropdownItem.accessKey ? dropdownItem.accessKey.toLowerCase() : '';

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
                menuItem.appendChild(createUnderlinedText(item.text, item.accessKey));
                menuItem.dataset.accessKey = item.accessKey.toLowerCase();

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

    // Create the dialog for closing/shutdown
    function createClosingDialog() {
        // Create the overlay background
        const overlay = document.createElement('div');
        overlay.className = 'win95-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '1000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';

        // Create the dialog window
        const dialog = document.createElement('div');
        dialog.className = 'win95-dialog';
        dialog.style.width = '400px';
        dialog.style.backgroundColor = '#c0c0c0';
        dialog.style.border = 'outset 2px #dfdfdf';
        dialog.style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.2)';
        dialog.style.fontFamily = '"MS Sans Serif", sans-serif';
        dialog.style.padding = '2px';
        dialog.style.position = 'relative';

        // Create the dialog title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'win95-title-bar';
        titleBar.style.backgroundColor = '#000080';
        titleBar.style.color = 'white';
        titleBar.style.padding = '3px 4px';
        titleBar.style.fontWeight = 'bold';
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.alignItems = 'center';

        // Title text
        const titleText = document.createElement('span');
        titleText.textContent = 'Shut Down Windows';
        titleBar.appendChild(titleText);

        // Close button in title bar
        const closeButton = document.createElement('span');
        closeButton.innerHTML = '&#x2715;'; // X symbol
        closeButton.style.cursor = 'pointer';
        closeButton.style.marginLeft = '4px';
        closeButton.addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        titleBar.appendChild(closeButton);

        // Create dialog content
        const content = document.createElement('div');
        content.className = 'win95-dialog-content';
        content.style.padding = '15px';

        // Create dialog message
        const message = document.createElement('div');
        message.style.display = 'flex';
        message.style.alignItems = 'center';
        message.style.marginBottom = '20px';

        // Add Windows logo
        const logo = document.createElement('div');
        logo.innerHTML = '&#x1F5B3;'; // Computer emoji as Windows logo placeholder
        logo.style.fontSize = '32px';
        logo.style.marginRight = '15px';
        message.appendChild(logo);

        const text = document.createElement('p');
        text.textContent = 'Are you sure you want to shut down this website?';
        message.appendChild(text);

        content.appendChild(message);

        // Create buttons container
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.justifyContent = 'center';
        buttons.style.gap = '10px';

        // Yes button
        const yesButton = document.createElement('button');
        yesButton.className = 'win95-button';
        yesButton.textContent = 'Yes';
        yesButton.style.padding = '4px 10px';
        yesButton.style.backgroundColor = '#c0c0c0';
        yesButton.style.border = 'outset 2px #dfdfdf';
        yesButton.style.fontFamily = '"MS Sans Serif", sans-serif';
        yesButton.style.minWidth = '75px';
        yesButton.addEventListener('click', function() {
            // Play Windows 95 shutdown sound and video
            playShutdownVideo();
        });
        buttons.appendChild(yesButton);

        // No button
        const noButton = document.createElement('button');
        noButton.className = 'win95-button';
        noButton.textContent = 'No';
        noButton.style.padding = '4px 10px';
        noButton.style.backgroundColor = '#c0c0c0';
        noButton.style.border = 'outset 2px #dfdfdf';
        noButton.style.fontFamily = '"MS Sans Serif", sans-serif';
        noButton.style.minWidth = '75px';
        noButton.addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        buttons.appendChild(noButton);

        content.appendChild(buttons);

        // Assemble the dialog
        dialog.appendChild(titleBar);
        dialog.appendChild(content);
        overlay.appendChild(dialog);

        return overlay;
    }

    // Function to play the Windows 95 shutdown video
    function playShutdownVideo() {
        // Create a fullscreen overlay for the video
        const videoOverlay = document.createElement('div');
        videoOverlay.style.position = 'fixed';
        videoOverlay.style.top = '0';
        videoOverlay.style.left = '0';
        videoOverlay.style.width = '100%';
        videoOverlay.style.height = '100%';
        videoOverlay.style.backgroundColor = 'black';
        videoOverlay.style.zIndex = '2000';
        videoOverlay.style.display = 'flex';
        videoOverlay.style.justifyContent = 'center';
        videoOverlay.style.alignItems = 'center';

        // Create YouTube iframe
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.src = 'https://www.youtube.com/embed/lAkuJXGldrM?autoplay=1';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        videoOverlay.appendChild(iframe);
        document.body.appendChild(videoOverlay);
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

    // Global function to show the closing dialog
    window.showClosingDialog = function() {
        const dialog = createClosingDialog();
        document.body.appendChild(dialog);
    };

    // Initialize components
    loadComponents();

    // Set up keyboard navigation
    document.addEventListener('keydown', function(event) {
        // Check for Alt key
        if (event.key === 'Alt') {
            isAltKeyPressed = true;
            return;
        }

        // If Alt is being held down, check for menu access keys
        if (isAltKeyPressed) {
            const key = event.key.toLowerCase();
            const menuItems = document.querySelectorAll('.win95-menu-item');

            // Check each menu item for matching access key
            menuItems.forEach(item => {
                if (item.dataset.accessKey === key) {
                    event.preventDefault();

                    // Simulate click on the menu item
                    item.click();

                    // If this is a dropdown menu, store a reference to its dropdown content
                    const dropdownContainer = item.closest('.win95-dropdown');
                    if (dropdownContainer) {
                        activeDropdown = dropdownContainer.querySelector('.win95-dropdown-content');
                    }
                }
            });
        }

        // If a dropdown is active, navigate with arrow keys and execute with Enter or access keys
        if (activeDropdown && activeDropdown.classList.contains('show')) {
            const dropdownItems = activeDropdown.querySelectorAll('.win95-dropdown-item');

            // Get currently focused item (if any)
            let currentIndex = -1;
            dropdownItems.forEach((item, index) => {
                if (item.classList.contains('keyboard-focused')) {
                    currentIndex = index;
                    item.classList.remove('keyboard-focused');
                }
            });

            // Check for access key presses for dropdown items
            if (event.key.length === 1) { // Single character keys only
                const key = event.key.toLowerCase();
                let found = false;

                // Loop through dropdown items to find matching access key
                dropdownItems.forEach((item) => {
                    if (item.dataset.accessKey === key) {
                        event.preventDefault();
                        // Trigger the click on this item
                        item.click();
                        found = true;
                    }
                });

                if (found) {
                    return;
                }
            }

            // Handle arrow keys for navigation
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                currentIndex = (currentIndex + 1) % dropdownItems.length;
                dropdownItems[currentIndex].classList.add('keyboard-focused');
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                currentIndex = (currentIndex - 1 + dropdownItems.length) % dropdownItems.length;
                dropdownItems[currentIndex].classList.add('keyboard-focused');
            } else if (event.key === 'Enter' && currentIndex !== -1) {
                event.preventDefault();
                dropdownItems[currentIndex].click();
            } else if (event.key === 'Escape') {
                // Close dropdown with Escape key
                event.preventDefault();
                activeDropdown.classList.remove('show');
                const menuItem = activeDropdown.closest('.win95-dropdown').querySelector('.win95-menu-item');
                menuItem.classList.remove('active-menu-item');
                activeDropdown = null;
            }
        }
    });

    document.addEventListener('keyup', function(event) {
        if (event.key === 'Alt') {
            isAltKeyPressed = false;
        }
    });

    // Add this to your stylesheet or add a style tag
    const style = document.createElement('style');
    style.textContent = `
        .keyboard-focused {
            background-color: #000080 !important;
            color: white !important;
        }
    `;
    document.head.appendChild(style);
});