// Helpers shared by the site's scripts. Every page loads this first.

// "7 MAY, 08:35"
function formatCustomDateTime(isoString) {
    if (!isoString) {
        return "N/A";
    }
    const dateObj = new Date(isoString); // Parses the ISO string
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = dateObj.getDate();
    const month = monthNames[dateObj.getMonth()]; // getMonth() is 0-indexed

    const hours = String(dateObj.getHours()).padStart(2, '0'); // 24-hour format
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day} ${month}, ${hours}:${minutes}`; // e.g., "7 MAY, 08:35" - all caps for month
}

// DD/MM/YYYY HH:MM, the South African format used across the site
function formatDateTime(value) {
    const date = new Date(value);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// DD/MM/YYYY
function formatDate(value) {
    return formatDateTime(value).split(' ')[0];
}

// An element with an optional class and text. The text is set through
// textContent, so data from an API only ever reaches the page as text.
function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
}

// Adds a stylesheet the first time a window asks for it. Resolves even if it
// fails, so the window still opens (unstyled) rather than not at all.
const stylesheetLoads = new Map();
function loadStylesheet(href) {
    if (!stylesheetLoads.has(href)) {
        stylesheetLoads.set(href, new Promise(resolve => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        }));
    }
    return stylesheetLoads.get(href);
}

// In the middle of the screen, but never closer than 8px to its top or left
// edge. Set as left/top in px, so the window can still be dragged.
function centerInViewport(element) {
    const rect = element.getBoundingClientRect();
    element.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + 'px';
    element.style.top = Math.max(8, (window.innerHeight - rect.height) / 2) + 'px';
}

// Phones, tablets and anything else with a touch screen
function isTouchDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;
}


// One of the Windows 95 sounds in sounds/
function playWin95Sound(type) {
    try {
        const sound = new Audio(`sounds/win95-${type}.mp3`);
        sound.volume = 0.7;
        sound.play();
    } catch (e) {
        console.log(`Error playing ${type} sound: ${e.message}`);
    }
}
