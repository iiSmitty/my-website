// Taskbar and Start menu
// The bar along the bottom of the desktop: the Start button, a button for each
// open window (window-manager.js) and the clock. Like the desktop icons it's
// desktop only; styles hide it on touch devices.
//
// The Start menu's Programs folder lists DESKTOP_PROGRAMS (desktop.js),
// so everything can still be opened after the desktop icons have been deleted.

const TASKBAR_FAVORITES = [
    { name: 'LinkedIn Profile', url: 'https://www.linkedin.com/in/andrezsmit/' },
    { name: 'GitHub', url: 'https://github.com/iiSmitty' }
];

// What each Start menu item does when chosen
const startMenuActions = new WeakMap();
const taskbarButtons = new Map();

// --- Helpers ---------------------------------------------------------------

// "Programs" with the P underlined, like a Win95 menu
function taskbarLabel(text, accessKey) {
    const label = makeElement('span', 'start-menu-label');
    const index = accessKey ? text.toLowerCase().indexOf(accessKey) : -1;
    if (index === -1) {
        label.textContent = text;
    } else {
        label.append(text.slice(0, index), makeElement('u', null, text[index]), text.slice(index + 1));
    }
    return label;
}

// --- Start menu ------------------------------------------------------------

function buildStartMenuItem(text, { icon, accessKey, href } = {}) {
    const item = makeElement(href ? 'a' : 'button', 'start-menu-item');
    item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
    if (href) {
        item.href = href;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
    } else {
        item.type = 'button';
    }
    if (accessKey) item.dataset.accessKey = accessKey;

    const iconElement = makeElement('span', `start-menu-icon ${icon || ''}`);
    iconElement.setAttribute('aria-hidden', 'true');
    item.append(iconElement, taskbarLabel(text, accessKey));
    return item;
}

function buildStartSubmenu(text, { icon, accessKey }, items) {
    const entry = makeElement('div', 'start-menu-entry');
    const parent = buildStartMenuItem(text, { icon, accessKey });
    parent.setAttribute('aria-haspopup', 'menu');
    parent.setAttribute('aria-expanded', 'false');
    const arrow = makeElement('span', 'start-menu-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    parent.append(arrow);

    const submenu = makeElement('div', 'start-menu start-submenu');
    submenu.setAttribute('role', 'menu');
    submenu.setAttribute('aria-label', text);
    submenu.hidden = true;
    submenu.append(...items);

    entry.append(parent, submenu);
    return entry;
}

function buildStartMenu() {
    const menu = makeElement('div', 'start-menu');
    menu.id = 'startMenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Start');
    menu.tabIndex = -1;
    menu.hidden = true;

    const banner = makeElement('div', 'start-menu-banner');
    banner.setAttribute('aria-hidden', 'true');
    banner.append(makeElement('b', null, 'Windows'), makeElement('span', null, '95'));

    // Win95 sorts the Programs folder by name
    const programs = DESKTOP_PROGRAMS
        .filter(program => program.inStartMenu !== false)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(program => {
            const item = buildStartMenuItem(program.name, { icon: program.icon });
            startMenuActions.set(item, program.open);
            return item;
        });

    const favorites = TASKBAR_FAVORITES.map(favorite =>
        buildStartMenuItem(favorite.name, { icon: 'InternetShortcutIcon_16x16', href: favorite.url }));

    // Win95's Help opened Windows Help; this one opens How This Site Works (site-help.js)
    const help = buildStartMenuItem('Help', { icon: 'StartHelpIcon', accessKey: 'h' });
    startMenuActions.set(help, () => openSiteHelp());

    const shutDown = buildStartMenuItem('Shut Down...', { icon: 'StartShutDownIcon', accessKey: 'u' });
    startMenuActions.set(shutDown, () => window.showClosingDialog());

    const separator = makeElement('div', 'start-menu-separator');
    separator.setAttribute('role', 'separator');

    const items = makeElement('div', 'start-menu-items');
    items.append(
        buildStartSubmenu('Programs', { icon: 'StartProgramsIcon', accessKey: 'p' }, programs),
        buildStartSubmenu('Favorites', { icon: 'StartFavoritesIcon', accessKey: 'a' }, favorites),
        help,
        separator,
        shutDown
    );

    menu.append(banner, items);

    menu.addEventListener('click', onStartMenuClick);
    menu.addEventListener('mouseover', onStartMenuHover);
    menu.addEventListener('keydown', onStartMenuKeydown);
    return menu;
}

function startMenu() {
    return document.getElementById('startMenu');
}

function startButton() {
    return document.getElementById('taskbarStart');
}

function isStartMenuOpen() {
    const menu = startMenu();
    return Boolean(menu && !menu.hidden);
}

// The items of one menu, not the ones in its submenus
function startMenuItems(menu) {
    return [...menu.querySelectorAll('.start-menu-item')].filter(item => item.closest('.start-menu') === menu);
}

function submenuOf(item) {
    return item.getAttribute('aria-haspopup') ? item.nextElementSibling : null;
}

function openStartMenu({ focusFirst = false } = {}) {
    const menu = startMenu();
    menu.hidden = false;
    startButton().setAttribute('aria-expanded', 'true');
    if (focusFirst) {
        startMenuItems(menu)[0].focus({ preventScroll: true });
    } else {
        menu.focus({ preventScroll: true });
    }
}

function closeStartMenu({ returnFocus = false } = {}) {
    if (!isStartMenuOpen()) return;
    const menu = startMenu();
    menu.querySelectorAll('.start-submenu').forEach(submenu => closeStartSubmenu(submenu));
    menu.hidden = true;
    startButton().setAttribute('aria-expanded', 'false');
    if (returnFocus) startButton().focus({ preventScroll: true });
}

function toggleStartMenu(options) {
    if (isStartMenuOpen()) {
        closeStartMenu({ returnFocus: true });
    } else {
        openStartMenu(options);
    }
}

function openStartSubmenu(parent, { focusFirst = false } = {}) {
    const submenu = submenuOf(parent);
    const menu = parent.closest('.start-menu');
    // Only one submenu open at a time
    startMenuItems(menu).forEach(item => {
        const other = submenuOf(item);
        if (other && other !== submenu) closeStartSubmenu(other);
    });
    submenu.hidden = false;
    parent.setAttribute('aria-expanded', 'true');

    // A submenu that would run off the bottom of the desktop moves up until it
    // sits on the taskbar, as Windows does
    submenu.style.top = '';
    const overflow = submenu.getBoundingClientRect().bottom - document.getElementById('taskbar').getBoundingClientRect().top;
    if (overflow > 0) {
        submenu.style.top = `${submenu.offsetTop - overflow}px`;
    }

    if (focusFirst) startMenuItems(submenu)[0].focus({ preventScroll: true });
}

function closeStartSubmenu(submenu) {
    submenu.hidden = true;
    submenu.previousElementSibling.setAttribute('aria-expanded', 'false');
}

function chooseStartMenuItem(item) {
    if (submenuOf(item)) {
        openStartSubmenu(item, { focusFirst: true });
        return;
    }
    // Favorites are real links: the browser opens them, the menu just closes
    const action = startMenuActions.get(item);
    closeStartMenu();
    if (action) action();
}

function onStartMenuClick(event) {
    const item = event.target.closest('.start-menu-item');
    if (item) chooseStartMenuItem(item);
}

// Pointing at an item selects it, and opens or closes submenus, like the real menu
function onStartMenuHover(event) {
    const item = event.target.closest('.start-menu-item');
    if (!item || item === document.activeElement) return;
    item.focus({ preventScroll: true });

    const menu = item.closest('.start-menu');
    if (submenuOf(item)) {
        openStartSubmenu(item);
    } else {
        startMenuItems(menu).forEach(other => {
            const submenu = submenuOf(other);
            if (submenu) closeStartSubmenu(submenu);
        });
    }
}

function onStartMenuKeydown(event) {
    const item = event.target.closest('.start-menu-item');
    const menu = item ? item.closest('.start-menu') : startMenu();
    const items = startMenuItems(menu);
    const index = items.indexOf(item);
    const parent = menu.classList.contains('start-submenu') ? menu.previousElementSibling : null;
    const focus = target => target.focus({ preventScroll: true });

    switch (event.key) {
        case 'ArrowDown':
            focus(items[(index + 1) % items.length]);
            break;
        case 'ArrowUp':
            focus(items[index <= 0 ? items.length - 1 : index - 1]);
            break;
        case 'Home':
            focus(items[0]);
            break;
        case 'End':
            focus(items[items.length - 1]);
            break;
        case 'ArrowRight':
            if (item && submenuOf(item)) openStartSubmenu(item, { focusFirst: true });
            break;
        case 'ArrowLeft':
            if (parent) {
                closeStartSubmenu(menu);
                focus(parent);
            }
            break;
        case 'Escape':
            if (parent) {
                closeStartSubmenu(menu);
                focus(parent);
            } else {
                closeStartMenu({ returnFocus: true });
            }
            break;
        case 'Enter':
        case ' ':
            if (!item) return;
            // A favorite is a link, so let the browser open it with Enter
            if (event.key === 'Enter' && item.tagName === 'A') {
                closeStartMenu();
                return;
            }
            item.click();
            break;
        case 'Tab':
            closeStartMenu({ returnFocus: true });
            break;
        default: {
            if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
            const key = event.key.toLowerCase();
            // An underlined letter chooses its item; any other letter jumps to
            // the next item starting with it
            const accessItem = items.find(candidate => candidate.dataset.accessKey === key);
            if (accessItem) {
                chooseStartMenuItem(accessItem);
                break;
            }
            const after = items.slice(index + 1).concat(items.slice(0, index + 1));
            const match = after.find(candidate => candidate.textContent.trim().toLowerCase().startsWith(key));
            if (!match) return;
            focus(match);
        }
    }

    // Handled here, so the windows behind the menu (Escape closes some of them) never see it
    event.preventDefault();
    event.stopPropagation();
}

// --- Right-click menu ------------------------------------------------------
// The taskbar's own menu, with the two items NT4 had that work here

function buildTaskbarMenu() {
    const menu = makeElement('div', 'start-menu taskbar-menu');
    menu.id = 'taskbarMenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Taskbar');
    menu.tabIndex = -1;
    menu.hidden = true;

    const minimizeAll = buildStartMenuItem('Minimize All Windows', { accessKey: 'm' });
    startMenuActions.set(minimizeAll, () => WindowManager.minimizeAll());
    const taskManager = buildStartMenuItem('Task Manager...', { accessKey: 'k' });
    startMenuActions.set(taskManager, () => openTaskManager());
    const separator = makeElement('div', 'start-menu-separator');
    separator.setAttribute('role', 'separator');
    menu.append(minimizeAll, separator, taskManager);

    menu.addEventListener('click', event => {
        const item = event.target.closest('.start-menu-item');
        if (!item) return;
        closeTaskbarMenu();
        startMenuActions.get(item)();
    });
    menu.addEventListener('mouseover', event => {
        const item = event.target.closest('.start-menu-item');
        if (item) item.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', onTaskbarMenuKeydown);
    return menu;
}

function taskbarMenu() {
    return document.getElementById('taskbarMenu');
}

function openTaskbarMenu(event) {
    // Not on the Start menu, which is a menu already
    if (event.target.closest('#startMenu, #taskbarMenu')) return;
    event.preventDefault();
    closeStartMenu();

    const menu = taskbarMenu();
    const taskbar = document.getElementById('taskbar');
    // A keyboard (Shift+F10, the menu key) gives no pointer position, so the menu opens at the focused item
    const x = event.clientX || event.target.getBoundingClientRect().left;
    menu.returnFocus = document.activeElement;
    menu.hidden = false;
    menu.style.left = Math.max(2, Math.min(x, taskbar.clientWidth - menu.offsetWidth - 2)) + 'px';

    const keyboard = event.button !== 2;
    if (keyboard) {
        startMenuItems(menu)[0].focus({ preventScroll: true });
    } else {
        menu.focus({ preventScroll: true });
    }
}

function closeTaskbarMenu({ returnFocus = false } = {}) {
    const menu = taskbarMenu();
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    if (returnFocus && menu.returnFocus && menu.returnFocus.isConnected) {
        menu.returnFocus.focus({ preventScroll: true });
    }
}

function onTaskbarMenuKeydown(event) {
    const menu = taskbarMenu();
    const items = startMenuItems(menu);
    const index = items.indexOf(event.target);
    const focus = target => target.focus({ preventScroll: true });

    switch (event.key) {
        case 'ArrowDown':
            focus(items[(index + 1) % items.length]);
            break;
        case 'ArrowUp':
            focus(items[index <= 0 ? items.length - 1 : index - 1]);
            break;
        case 'Home':
            focus(items[0]);
            break;
        case 'End':
            focus(items[items.length - 1]);
            break;
        case 'Enter':
        case ' ':
            if (index === -1) return;
            event.target.click();
            break;
        case 'Escape':
        case 'Tab':
            closeTaskbarMenu({ returnFocus: true });
            break;
        default: {
            const item = items.find(candidate => candidate.dataset.accessKey === event.key.toLowerCase());
            if (!item) return;
            item.click();
        }
    }
    event.preventDefault();
    event.stopPropagation();
}

// --- Window buttons --------------------------------------------------------

function buildTaskbarButton(win) {
    const button = makeElement('button', 'taskbar-button');
    button.type = 'button';

    const icon = WindowManager.iconOf(win);
    if (icon) {
        const copy = icon.cloneNode(true);
        copy.removeAttribute('id');
        copy.setAttribute('aria-hidden', 'true');
        button.append(copy);
    }
    button.append(makeElement('span', 'taskbar-button-label'));

    // Like Win95: a click brings the window forward, or minimizes it if it's
    // already in front, or restores it if it's minimized
    button.addEventListener('click', () => {
        if (WindowManager.isMinimized(win)) {
            WindowManager.restore(win);
            WindowManager.focusInside(win);
        } else if (WindowManager.activeWindow() === win) {
            WindowManager.minimize(win);
        } else {
            WindowManager.activate(win);
            WindowManager.focusInside(win);
        }
    });
    return button;
}

function renderTaskbarButtons(change) {
    const list = document.getElementById('taskbarWindows');
    const open = WindowManager.openWindows();

    taskbarButtons.forEach((button, win) => {
        if (!open.includes(win)) {
            button.remove();
            taskbarButtons.delete(win);
        }
    });

    // Buttons are only ever added at the end, so a focused button never moves
    open.forEach(win => {
        let button = taskbarButtons.get(win);
        if (!button) {
            button = buildTaskbarButton(win);
            taskbarButtons.set(win, button);
            list.append(button);
        }
        const title = WindowManager.titleOf(win);
        button.querySelector('.taskbar-button-label').textContent = title;
        button.title = title;
        button.setAttribute('aria-pressed',
            String(WindowManager.activeWindow() === win && !WindowManager.isMinimized(win)));
    });

    // Minimizing the window that had focus leaves it on the window's button
    if (change && change.type === 'minimize' && change.hadFocus) {
        const button = taskbarButtons.get(change.win);
        if (button) button.focus({ preventScroll: true });
    }
}

// --- Clock -----------------------------------------------------------------

function startTaskbarClock(clock) {
    const tick = () => {
        const now = new Date();
        clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        clock.dateTime = now.toISOString();
        // Hovering the clock shows the date, as it did on Win95
        clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    };
    tick();
}

// --- Taskbar ---------------------------------------------------------------

function buildTaskbar() {
    const taskbar = makeElement('div', 'taskbar');
    taskbar.id = 'taskbar';
    taskbar.setAttribute('role', 'region');
    taskbar.setAttribute('aria-label', 'Taskbar');

    const start = makeElement('button', 'taskbar-start');
    start.id = 'taskbarStart';
    start.type = 'button';
    start.setAttribute('aria-haspopup', 'menu');
    start.setAttribute('aria-expanded', 'false');
    start.setAttribute('aria-controls', 'startMenu');
    start.innerHTML = '<span class="WindowsLogoIcon_16x16" aria-hidden="true"></span><span>Start</span>';
    // A keyboard press (Enter or Space) clicks with detail 0, and gets the first item selected
    start.addEventListener('click', event => toggleStartMenu({ focusFirst: event.detail === 0 }));

    const windowList = makeElement('div', 'taskbar-windows');
    windowList.id = 'taskbarWindows';

    const tray = makeElement('div', 'taskbar-tray');
    const clock = makeElement('time', 'taskbar-clock');
    clock.id = 'taskbarClock';
    tray.append(clock);

    taskbar.append(start, buildStartMenu(), buildTaskbarMenu(), windowList, tray);
    taskbar.addEventListener('contextmenu', openTaskbarMenu);
    startTaskbarClock(clock);
    return taskbar;
}

document.addEventListener('DOMContentLoaded', function () {
    document.body.append(buildTaskbar());
    document.body.classList.add('has-taskbar');

    WindowManager.subscribe(renderTaskbarButtons);
    renderTaskbarButtons();

    // A click anywhere else closes the Start menu and the taskbar's menu
    document.addEventListener('pointerdown', event => {
        if (isStartMenuOpen() && !event.target.closest('#startMenu, #taskbarStart')) {
            closeStartMenu();
        }
        if (!event.target.closest('#taskbarMenu')) closeTaskbarMenu();
    });
    // So does clicking into another window's iframe, or leaving the page
    window.addEventListener('blur', () => {
        closeStartMenu();
        closeTaskbarMenu();
    });

    // Ctrl+Esc opens the Start menu, as it does on Windows. Caught on the way
    // down, so the window with focus never sees an Escape and closes itself.
    document.addEventListener('keydown', event => {
        // (Ctrl+Shift+Esc is Task Manager's, in taskmgr.js)
        if (event.key === 'Escape' && event.ctrlKey && !event.shiftKey && !document.body.classList.contains('startup')) {
            event.preventDefault();
            event.stopPropagation();
            toggleStartMenu({ focusFirst: true });
        }
    }, true);
});
