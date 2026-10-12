// Window manager
// Every desktop window registers here, so they all open, close, stack, drag,
// minimize and maximize the same way, and the taskbar (taskbar.js) has one
// place to learn what's open.
//
// A window is "open" while it doesn't have the hidden attribute. Minimizing
// keeps it open (it still has a taskbar button) and only hides it with the
// is-minimized class, so a module can still ask "is my window open?" by
// checking hidden.

const WindowManager = (() => {
    // Windows stack from here up. Modal dialogs (2000), the taskbar (1500) and
    // the screensaver sit above them.
    const BASE_Z_INDEX = 100;

    // Keep enough of a dragged window on screen to grab it again
    const MIN_VISIBLE = 40;

    const windows = new Map();
    let stack = [];
    let opened = [];
    let active = null;
    const subscribers = new Set();

    function notify(change) {
        subscribers.forEach(subscriber => subscriber(change));
    }

    function restack() {
        stack.forEach((win, index) => {
            win.style.zIndex = BASE_Z_INDEX + index;
        });
    }

    function isOpen(win) {
        return windows.has(win) && !win.hidden;
    }

    function isMinimized(win) {
        return isOpen(win) && win.classList.contains('is-minimized');
    }

    function isShowing(win) {
        return isOpen(win) && !isMinimized(win);
    }

    function setActive(win) {
        active = win;
        windows.forEach((state, other) => other.classList.toggle('is-inactive', other !== win));
        notify();
    }

    // The top window that isn't minimized becomes active, or none does
    function activateTopmost() {
        const top = stack.filter(isShowing).pop() || null;
        setActive(top);
    }

    function activate(win) {
        if (!isShowing(win)) return;
        if (stack[stack.length - 1] !== win) {
            stack = stack.filter(other => other !== win).concat(win);
            restack();
        }
        if (active !== win) setActive(win);
    }

    // Returns whether it was already open, so a module can skip its first-open
    // setup when the window is only being brought forward
    function open(win) {
        const wasOpen = isOpen(win);
        if (!wasOpen) {
            win.hidden = false;
            opened.push(win);
        }
        win.classList.remove('is-minimized');
        activate(win);
        notify();
        return wasOpen;
    }

    function close(win) {
        if (!isOpen(win)) return;
        win.hidden = true;
        win.classList.remove('is-minimized');
        opened = opened.filter(other => other !== win);
        if (active === win) activateTopmost();
        notify();
    }

    // Closes a window the way its own close button does, so its module can
    // tidy up (stop timers, close both DECRYPT.EXE windows, and so on)
    function requestClose(win) {
        const closeButton = win.querySelector(':scope > .win95-title-bar .win95-close');
        if (closeButton) {
            closeButton.click();
        } else {
            close(win);
        }
    }

    function minimizeAll() {
        opened.filter(isShowing).forEach(win => win.classList.add('is-minimized'));
        setActive(null);
    }

    function minimize(win) {
        if (!isShowing(win)) return;
        const hadFocus = win.contains(document.activeElement);
        win.classList.add('is-minimized');
        if (active === win) activateTopmost();
        notify({ type: 'minimize', win, hadFocus });
    }

    function restore(win) {
        if (!isMinimized(win)) return;
        win.classList.remove('is-minimized');
        activate(win);
        notify();
    }

    function toggleMaximize(win) {
        const state = windows.get(win);
        if (!state || !state.maximizable) return;
        const maximized = win.classList.toggle('is-maximized');
        if (state.maximizeButton) {
            state.maximizeButton.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
        }
        notify();
    }

    // Puts keyboard focus back where it was in the window, or on the window itself
    function focusInside(win) {
        const state = windows.get(win);
        const last = state && state.lastFocus;
        const target = last && last.isConnected && win.contains(last) ? last : win;
        target.focus({ preventScroll: true });
    }

    // The window's name, as its title bar shows it
    function titleOf(win) {
        const title = win.querySelector(':scope > .win95-title-bar .win95-title');
        return title ? title.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    // The small icon at the start of the title bar, if it has one
    function iconOf(win) {
        const title = win.querySelector(':scope > .win95-title-bar .win95-title');
        const icon = title && title.firstElementChild;
        return icon && (icon.tagName === 'svg' || /Icon_16x16/.test(icon.className)) ? icon : null;
    }

    // Open windows, in the order they were opened (the taskbar's order)
    function openWindows() {
        return opened.slice();
    }

    function activeWindow() {
        return active;
    }

    function subscribe(subscriber) {
        subscribers.add(subscriber);
    }

    // Drag a fixed-position element by its title bar. Pointer capture keeps the
    // drag going even when the pointer crosses an iframe.
    function makeDraggable(win, handle, { canDrag = () => true } = {}) {
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button') || !canDrag()) return;

            const rect = win.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            const handleHeight = handle.getBoundingClientRect().height;

            handle.setPointerCapture(event.pointerId);
            win.classList.add('is-dragging');

            const move = moveEvent => {
                const maxLeft = window.innerWidth - MIN_VISIBLE;
                const maxTop = window.innerHeight - handleHeight;
                const left = Math.min(Math.max(moveEvent.clientX - offsetX, MIN_VISIBLE - rect.width), maxLeft);
                const top = Math.min(Math.max(moveEvent.clientY - offsetY, 0), maxTop);
                win.style.left = left + 'px';
                win.style.top = top + 'px';
            };
            const end = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', end);
                handle.removeEventListener('pointercancel', end);
                win.classList.remove('is-dragging');
            };

            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', end);
            handle.addEventListener('pointercancel', end);
        });
    }

    // The minimize and maximize buttons used to be decoration. Now they work,
    // they're real buttons; a window that can't be resized gets a greyed-out
    // maximize button, like a Win95 dialog.
    function wireTitleBarButtons(win, titleBar, state) {
        const minimizeButton = titleBar.querySelector('.win95-minimize');
        const maximizeButton = titleBar.querySelector('.win95-maximize');

        [minimizeButton, maximizeButton].forEach(button => {
            if (!button) return;
            button.type = 'button';
            button.removeAttribute('aria-hidden');
            button.removeAttribute('tabindex');
        });

        if (minimizeButton) {
            minimizeButton.setAttribute('aria-label', 'Minimize');
            minimizeButton.addEventListener('click', () => minimize(win));
        }

        if (maximizeButton) {
            if (state.maximizable) {
                maximizeButton.setAttribute('aria-label', 'Maximize');
                maximizeButton.addEventListener('click', () => toggleMaximize(win));
                state.maximizeButton = maximizeButton;
            } else {
                maximizeButton.setAttribute('aria-label', 'Maximize (unavailable)');
                maximizeButton.disabled = true;
            }
        }
    }

    // options:
    //   maximizable - the window can fill the screen (default false)
    //   draggable   - move it by its title bar (default true)
    function register(win, { maximizable = false, draggable = true } = {}) {
        if (windows.has(win)) return;

        const state = { maximizable, lastFocus: null, maximizeButton: null };
        windows.set(win, state);
        win.classList.add('wm-window');
        if (!win.hasAttribute('tabindex')) win.tabIndex = -1;

        stack.push(win);
        restack();
        if (!win.hidden) opened.push(win);

        // Capture phase, so a click that something inside the window stops
        // still brings the window forward
        win.addEventListener('pointerdown', () => activate(win), true);
        win.addEventListener('focusin', event => {
            state.lastFocus = event.target;
            activate(win);
        });

        const titleBar = win.querySelector(':scope > .win95-title-bar');
        if (titleBar) {
            wireTitleBarButtons(win, titleBar, state);
            if (draggable) {
                makeDraggable(win, titleBar, { canDrag: () => !win.classList.contains('is-maximized') });
            }
            if (maximizable) {
                titleBar.addEventListener('dblclick', event => {
                    if (!event.target.closest('button')) toggleMaximize(win);
                });
            }
        }

        if (isShowing(win)) {
            activate(win);
        } else {
            win.classList.add('is-inactive');
        }
        notify();
    }

    // Clicking the desktop itself leaves no window active, like Win95
    document.addEventListener('pointerdown', event => {
        const target = event.target;
        if (target === document.body || target === document.documentElement ||
            (target.closest && target.closest('.desktop-icons'))) {
            if (active) setActive(null);
        }
    });

    // A click inside an iframe never reaches this page, but it does take
    // focus away from it. If the iframe now has focus, its window is active.
    window.addEventListener('blur', () => {
        setTimeout(() => {
            const focused = document.activeElement;
            const win = focused && focused.tagName === 'IFRAME' ? focused.closest('.wm-window') : null;
            if (win) activate(win);
        });
    });

    return {
        register,
        open,
        close,
        requestClose,
        minimize,
        minimizeAll,
        restore,
        activate,
        toggleMaximize,
        isOpen,
        isMinimized,
        activeWindow,
        openWindows,
        focusInside,
        titleOf,
        iconOf,
        subscribe,
        makeDraggable,
    };
})();

window.WindowManager = WindowManager;
