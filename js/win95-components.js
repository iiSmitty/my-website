// The parts every page shares: the main window's menu bar (File, Edit, View,
// Help) and status bar, and Alt+letter menu shortcuts. Shut Down is in
// shutdown.js.
document.addEventListener('DOMContentLoaded', function() {
    // Track the active dropdown for keyboard navigation
    let activeDropdown = null;

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
                    { text: 'Home', accessKey: 'H', link: './', pages: ['', 'index', 'home'] },
                    { text: 'Work Experience', accessKey: 'W', link: './experience', pages: ['experience'] },
                    { text: 'Strava PBs', accessKey: 'S', link: './strava-pbs', pages: ['strava-pbs'] },
                    { text: 'LinkedIn Profile', accessKey: 'L', link: 'https://www.linkedin.com/in/andrezsmit/', target: '_blank'},
                    // Only offered where the page has a print stylesheet worth saving as a PDF
                    { text: 'Print / Save as PDF', accessKey: 'P', action: 'print', onlyOn: ['experience'] },
                    { text: 'Exit', accessKey: 'X', action: 'exit' }
                ].filter(dropdownItem => !dropdownItem.onlyOn || dropdownItem.onlyOn.includes(currentPage))
            },
            { text: 'Edit', accessKey: 'E', link: '#' },
            { text: 'View', accessKey: 'V', link: '#' },
            {
                text: 'Help',
                accessKey: 'H',
                dropdown: [
                    { text: 'How This Site Works', accessKey: 'W', action: 'site-help' }
                ]
            }
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
                    if (dropdownItem.pages && dropdownItem.pages.includes(currentPage)) {
                        dropdownElement.classList.add('active-dropdown-item');
                    }

                    // Check for special actions first
                    if (dropdownItem.action === 'print') {
                        dropdownElement.addEventListener('click', function() {
                            dropdownContent.classList.remove('show');
                            menuItem.classList.remove('active-menu-item');
                            window.print();
                        });
                    } else if (dropdownItem.action === 'site-help') {
                        dropdownElement.addEventListener('click', function() {
                            dropdownContent.classList.remove('show');
                            menuItem.classList.remove('active-menu-item');

                            // The home page has the section (site-help.js);
                            // other pages go there and land on it
                            if (typeof openSiteHelp === 'function') {
                                openSiteHelp();
                            } else {
                                window.location.href = './#how-it-works';
                            }
                        });
                    } else if (dropdownItem.action === 'exit') {
                        dropdownElement.addEventListener('click', function() {
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
                            // Check if the link should open in a new tab
                            if (dropdownItem.target === '_blank') {
                                window.open(dropdownItem.link, '_blank');
                            } else {
                                window.location.href = dropdownItem.link;
                            }

                            // Close the dropdown after clicking
                            dropdownContent.classList.remove('show');
                            menuItem.classList.remove('active-menu-item');
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
            { html: '<span class="date-label">Last updated: </span>August 24, 1995' }
        ];

        // Create standard status items
        statusItems.forEach(item => {
            const statusItem = document.createElement('div');
            statusItem.className = 'status-item';
            if (item.html) {
                statusItem.innerHTML = item.html;
            } else {
                statusItem.textContent = item.text;
            }
            statusBarTop.appendChild(statusItem);
        });

        // Cloudflare Pages panel (right-aligned)
        const cfItem = document.createElement('a');
        cfItem.href = 'https://pages.cloudflare.com';
        cfItem.target = '_blank';
        cfItem.rel = 'noopener noreferrer';
        cfItem.title = 'Hosted on Cloudflare Pages';
        cfItem.className = 'status-item';
        cfItem.style.cssText = 'display:flex;align-items:center;gap:5px;text-decoration:none;color:#000;border-top:1px solid #808080;border-left:1px solid #808080;border-right:1px solid #fff;border-bottom:1px solid #fff;';

        const cfDot = document.createElement('div');
        cfDot.style.cssText = 'width:12px;height:12px;background:#F6821F;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
        cfDot.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/></svg>';

        const cfText = document.createElement('span');
        cfText.textContent = 'Cloudflare Pages';
        cfText.style.cssText = 'white-space:nowrap;';

        cfItem.appendChild(cfDot);
        cfItem.appendChild(cfText);
        statusBarTop.appendChild(cfItem);

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

        // Only the first menu bar and status bar on the page are replaced: the
        // main window's. Other windows' menu bars are plain decoration.
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

    }

    // Initialize components
    loadComponents();

    // Set up keyboard navigation
    document.addEventListener('keydown', function(event) {
        // Alt + letter opens a menu. Read Alt from the event itself: tracking
        // it with keydown/keyup gets stuck after Alt+Tab (the keyup happens in
        // another window), which then swallowed plain F/E/V/H typing.
        if (event.altKey && event.key !== 'Alt') {
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

        // If a dropdown is active, navigate with arrow keys and execute with Enter or access keys.
        // Not while typing in a text field (e.g. DECRYPT.EXE's Notepad), whose keys are its own.
        const isTyping = event.target.closest && event.target.closest('input, textarea, [contenteditable]');
        if (activeDropdown && activeDropdown.classList.contains('show') && !isTyping) {
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

    // The dropdown item chosen with the arrow keys
    const style = document.createElement('style');
    style.textContent = `
        .keyboard-focused {
            background-color: #000080 !important;
            color: white !important;
        }
    `;
    document.head.appendChild(style);
});