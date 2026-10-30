// The parts every page shares: the main window's menu bar (File, Edit, View,
// Help) and status bar, and Alt+letter menu shortcuts. Shut Down is in
// shutdown.js.
document.addEventListener('DOMContentLoaded', function() {
    // The dropdown last opened with Alt and a letter, which the keyboard then
    // moves through
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
            document.querySelectorAll('.win95-dropdown').forEach(dropdown => {
                if (!dropdown.contains(event.target)) {
                    dropdown.querySelector('.win95-dropdown-content').classList.remove('show');
                }
            });
        });

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'win95-menu-item';
            menuItem.appendChild(accessKeyLabel(item.text, item.accessKey));
            menuItem.dataset.accessKey = item.accessKey.toLowerCase();

            if (!item.dropdown) {
                menuItem.addEventListener('click', function() {
                    window.location.href = item.link;
                });
                menuBar.appendChild(menuItem);
                return;
            }

            const dropdownContainer = document.createElement('div');
            dropdownContainer.className = 'win95-dropdown';
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'win95-dropdown-content';

            // A click opens it, closing the other one, and a second click closes it
            menuItem.addEventListener('click', function(event) {
                event.stopPropagation();
                document.querySelectorAll('.win95-dropdown-content').forEach(dropdown => {
                    if (dropdown !== dropdownContent) {
                        dropdown.classList.remove('show');
                    }
                });
                dropdownContent.classList.toggle('show');
            });

            item.dropdown.forEach(dropdownItem => {
                const dropdownElement = document.createElement('div');
                dropdownElement.className = 'win95-dropdown-item';
                dropdownElement.appendChild(accessKeyLabel(dropdownItem.text, dropdownItem.accessKey));
                dropdownElement.dataset.accessKey = dropdownItem.accessKey.toLowerCase();

                // The page we're on
                if (dropdownItem.pages && dropdownItem.pages.includes(currentPage)) {
                    dropdownElement.classList.add('active-dropdown-item');
                }

                dropdownElement.addEventListener('click', function() {
                    dropdownContent.classList.remove('show');
                    chooseDropdownItem(dropdownItem);
                });

                dropdownContent.appendChild(dropdownElement);
            });

            dropdownContainer.appendChild(menuItem);
            dropdownContainer.appendChild(dropdownContent);
            menuBar.appendChild(dropdownContainer);
        });

        return menuBar;
    }

    // "File" with the F underlined. Without its access key in the text, the
    // first letter is underlined.
    function accessKeyLabel(text, accessKey) {
        const label = document.createElement('span');
        const index = Math.max(0, text.toLowerCase().indexOf(accessKey.toLowerCase()));
        label.append(text.slice(0, index), makeElement('span', 'access-key', text[index]), text.slice(index + 1));
        return label;
    }

    function chooseDropdownItem(dropdownItem) {
        if (dropdownItem.action === 'print') {
            window.print();
        } else if (dropdownItem.action === 'site-help') {
            // The home page has the section (site-help.js); other pages go
            // there and land on it
            if (typeof openSiteHelp === 'function') {
                openSiteHelp();
            } else {
                window.location.href = './#how-it-works';
            }
        } else if (dropdownItem.action === 'exit') {
            showClosingDialog();
        } else if (dropdownItem.target === '_blank') {
            window.open(dropdownItem.link, '_blank');
        } else {
            window.location.href = dropdownItem.link;
        }
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
        cfItem.className = 'status-item cloudflare-badge';

        const cfDot = document.createElement('div');
        cfDot.className = 'cloudflare-badge-logo';
        cfDot.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/></svg>';

        const cfText = document.createElement('span');
        cfText.textContent = 'Cloudflare Pages';

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
            document.querySelectorAll('.win95-menu-item').forEach(item => {
                if (item.dataset.accessKey !== key) return;
                event.preventDefault();
                item.click();

                const dropdownContainer = item.closest('.win95-dropdown');
                if (dropdownContainer) {
                    activeDropdown = dropdownContainer.querySelector('.win95-dropdown-content');
                }
            });
        }

        // Not while typing in a text field (e.g. DECRYPT.EXE's Notepad), whose keys are its own
        const isTyping = event.target.closest && event.target.closest('input, textarea, [contenteditable]');
        if (activeDropdown && activeDropdown.classList.contains('show') && !isTyping) {
            navigateDropdown(event);
        }
    });

    // In an open dropdown, an item's letter chooses it, the arrow keys move
    // the highlight (any other key clears it), Enter chooses the highlighted
    // item and Escape closes the dropdown
    function navigateDropdown(event) {
        const dropdownItems = [...activeDropdown.querySelectorAll('.win95-dropdown-item')];
        let currentIndex = dropdownItems.findIndex(item => item.classList.contains('keyboard-focused'));
        dropdownItems.forEach(item => item.classList.remove('keyboard-focused'));

        if (event.key.length === 1) {
            const chosen = dropdownItems.filter(item => item.dataset.accessKey === event.key.toLowerCase());
            if (chosen.length) {
                event.preventDefault();
                chosen.forEach(item => item.click());
                return;
            }
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            currentIndex = (currentIndex + step + dropdownItems.length) % dropdownItems.length;
            dropdownItems[currentIndex].classList.add('keyboard-focused');
        } else if (event.key === 'Enter' && currentIndex !== -1) {
            event.preventDefault();
            dropdownItems[currentIndex].click();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            activeDropdown.classList.remove('show');
            activeDropdown = null;
        }
    }
});