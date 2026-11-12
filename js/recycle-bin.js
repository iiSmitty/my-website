// Recycle Bin: things that were deleted but never quite went away, as an
// Explorer Details view with Win95's own Recycle Bin columns. Double-clicking
// an item (or Enter) opens it:
//
//   andrez.smit        - the Skype 2014 easter egg (skype.js)
//   filter-routine.exe - the filter coffee routine, which convenience beat
//   bluebird-beans.bag - its beans, which can't be used without it
//
// Opened by double-clicking the Recycle Bin on the desktop (desktop.js).
// Nothing is built until it's first needed: the stylesheet and DOM only load
// on the first open, so the home page doesn't pay for them.

// Small file icons, drawn on the pixel grid
const RECYCLE_BIN_APP_ICON = `
    <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
        <rect x="1" y="2" width="14" height="12" fill="#000000"/>
        <rect x="2" y="3" width="12" height="10" fill="#ffffff"/>
        <rect x="2" y="3" width="12" height="2" fill="#000080"/>
    </svg>`;

const RECYCLE_BIN_FILE_ICON = `
    <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
        <path fill="#000000" d="M3 1h7l3 3v11H3z"/>
        <path fill="#ffffff" d="M4 2h5v3h3v9H4z"/>
        <path fill="#808080" d="M10 2h1v1h1v1h-2z"/>
    </svg>`;

const RECYCLE_BIN_ITEMS = [
    {
        name: SKYPE_PROFILE.skypeName,
        icon: SKYPE_LOGO_SVG,
        location: 'A friend\'s contact list',
        // The last thing 2014-me said was "brb"
        deleted: formatDateTime(SKYPE_PROFILE.lastMessage),
        type: 'Skype Contact',
        size: `${SKYPE_PROFILE.messageCount} messages`,
        open: () => openSkypeWindow()
    },
    {
        name: 'filter-routine.exe',
        icon: RECYCLE_BIN_APP_ICON,
        location: 'C:\\Kitchen\\Mornings',
        deleted: 'A Monday, 06:12',
        type: 'Application',
        size: 'Too many steps',
        open: () => showMessageBox({
            title: 'filter-routine.exe',
            heading: 'Deleted: convenience won.',
            message: [
                'Required a filter machine, Bluebird Coffee beans and a routine.',
                'Replaced by instant, which requires a kettle.'
            ]
        })
    },
    {
        name: 'bluebird-beans.bag',
        icon: RECYCLE_BIN_FILE_ICON,
        location: 'C:\\Kitchen\\Cupboard',
        // A minute later: it went with the routine
        deleted: 'A Monday, 06:13',
        type: 'BAG File',
        size: '1 bag',
        open: () => showMessageBox({
            title: 'bluebird-beans.bag',
            icon: 'error',
            heading: 'Cannot open bluebird-beans.bag.',
            message: ['It needs filter-routine.exe, which is in the Recycle Bin.']
        })
    }
];

let recycleBinReturnFocus = null;

function recycleBinWindow() {
    return document.getElementById('recycleBinWindow');
}

function buildRecycleBinWindow() {
    const win = document.createElement('div');
    win.className = 'win95-window recycle-bin-window';
    win.id = 'recycleBinWindow';
    win.hidden = true;
    win.tabIndex = -1;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-labelledby', 'recycleBinTitle');

    win.innerHTML = `
        <div class="win95-title-bar" id="recycleBinTitleBar">
            <div class="win95-title" id="recycleBinTitle"><span class="RecycleIcon_16x16" aria-hidden="true"></span>Recycle Bin</div>
            <div class="win95-buttons">
                <button class="win95-button win95-minimize" type="button">_</button>
                <button class="win95-button win95-maximize" type="button">&#9633;</button>
                <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
            </div>
        </div>
        <div class="win95-menu-bar recycle-bin-menu-bar" aria-hidden="true">
            <div class="win95-menu-item"><u>F</u>ile</div>
            <div class="win95-menu-item"><u>E</u>dit</div>
            <div class="win95-menu-item"><u>V</u>iew</div>
            <div class="win95-menu-item"><u>H</u>elp</div>
        </div>
        <div class="recycle-bin-frame">
            <table class="recycle-bin-list" role="grid" aria-label="Deleted items">
                <thead>
                    <tr>
                        <th scope="col" class="recycle-bin-col-name">Name</th>
                        <th scope="col" class="recycle-bin-col-location">Original Location</th>
                        <th scope="col" class="recycle-bin-col-deleted">Date Deleted</th>
                        <th scope="col" class="recycle-bin-col-type">Type</th>
                        <th scope="col" class="recycle-bin-col-size">Size</th>
                    </tr>
                </thead>
                <tbody id="recycleBinItems"></tbody>
            </table>
        </div>
        <div class="recycle-bin-statusbar">
            <span>${RECYCLE_BIN_ITEMS.length} object(s)</span>
            <span>Double-click an item to open it</span>
        </div>`;

    const body = win.querySelector('#recycleBinItems');
    body.append(...RECYCLE_BIN_ITEMS.map((item, index) => {
        const row = makeElement('tr');
        row.dataset.index = index;
        const name = makeElement('td', 'recycle-bin-col-name');
        const label = makeElement('span', 'recycle-bin-label');
        label.innerHTML = item.icon;
        label.append(makeElement('span', null, item.name));
        name.append(label);
        row.append(
            name,
            makeElement('td', 'recycle-bin-col-location', item.location),
            makeElement('td', 'recycle-bin-col-deleted', item.deleted),
            makeElement('td', 'recycle-bin-col-type', item.type),
            makeElement('td', 'recycle-bin-col-size', item.size)
        );
        return row;
    }));

    document.body.appendChild(win);

    win.querySelector('.win95-close').addEventListener('click', closeRecycleBin);
    body.addEventListener('click', event => {
        const row = event.target.closest('tr');
        if (row) selectRecycleBinItem(Number(row.dataset.index), { focus: true });
    });
    body.addEventListener('dblclick', event => {
        const row = event.target.closest('tr');
        if (row) openRecycleBinItem(Number(row.dataset.index));
    });
    body.addEventListener('keydown', onRecycleBinRowKeydown);
    // Esc closes the window, when it has focus (not every window on the desktop)
    win.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeRecycleBin();
    });

    // Drag, stack and minimize like the other desktop windows
    WindowManager.register(win);

    selectRecycleBinItem(0);
    return win;
}

async function openRecycleBin() {
    const opener = document.activeElement;
    await loadStylesheet('css/recycle-bin.min.css');

    const win = recycleBinWindow() || buildRecycleBinWindow();
    const wasOpen = WindowManager.open(win);

    if (!wasOpen) {
        recycleBinReturnFocus = opener && opener !== document.body ? opener : null;
        centerInViewport(win);
    }
    win.querySelector('#recycleBinItems tr[tabindex="0"]').focus({ preventScroll: true });
}

function closeRecycleBin() {
    const win = recycleBinWindow();
    if (!win || win.hidden) return;

    WindowManager.close(win);
    if (recycleBinReturnFocus && recycleBinReturnFocus.isConnected) {
        recycleBinReturnFocus.focus({ preventScroll: true });
    }
}

// One row is selected, and in the tab order, at a time
function selectRecycleBinItem(index, { focus = false } = {}) {
    const rows = [...document.getElementById('recycleBinItems').rows];
    rows.forEach((row, i) => {
        row.setAttribute('aria-selected', String(i === index));
        row.tabIndex = i === index ? 0 : -1;
    });
    if (focus && rows[index]) rows[index].focus({ preventScroll: true });
}

function openRecycleBinItem(index) {
    selectRecycleBinItem(index, { focus: true });
    RECYCLE_BIN_ITEMS[index].open();
}

function onRecycleBinRowKeydown(event) {
    const row = event.target.closest('tr');
    if (!row) return;
    const index = Number(row.dataset.index);
    const last = RECYCLE_BIN_ITEMS.length - 1;
    const moves = { ArrowDown: Math.min(index + 1, last), ArrowUp: Math.max(index - 1, 0), Home: 0, End: last };

    if (event.key in moves) {
        event.preventDefault();
        selectRecycleBinItem(moves[event.key], { focus: true });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        openRecycleBinItem(index);
    }
}
