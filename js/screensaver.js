// Inactivity tracker and screensaver launcher
let inactivityTime = 0;
const inactivityLimit = 3 * 60 * 1000; // 3 minutes in milliseconds
let timer;
let screensaverActive = false;
let p5Instance;

// P5.js screensaver code
// Based on https://github.com/miresk/flying-windows by miresk
const screensaver = (p) => {
    let speed = 4;
    let windows = [];
    let windowsNum = 500;
    let imgs = [];

    p.preload = function() {
        for (let i = 1; i <= 5; i++) {
            imgs[i-1] = p.loadImage('images/microsoft-windows-' + i + '.png');
        }
    }

    class Window {
        constructor() {
            this.x = p.random(-p.width, p.width);
            this.y = p.random(-p.height, p.height);
            this.z = p.random(p.width);
            this.pz = this.z;
            this.img = p.random(imgs);
        }

        update() {
            this.z = this.z - speed;

            if (this.z < 1) {
                this.z = p.width/2;
                this.x = p.random(-p.width, p.width);
                this.y = p.random(-p.height, p.height);
                this.pz = this.z;
            }
        }

        show() {
            let sx = p.map(this.x/this.z, 0, 1, 0, p.width/2);
            let sy = p.map(this.y/this.z, 0, 1, 0, p.height/2);

            let r = p.map(this.z, 0, p.width/2, 26, 4);
            p.image(this.img, sx, sy, r, r);

            this.pz = this.z;
        }
    }

    p.setup = function() {
        const screensaverContainer = document.getElementById('screensaver-container');
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent(screensaverContainer);

        for(let i = 0; i < windowsNum; i++) {
            windows[i] = new Window();
        }
    }

    p.draw = function() {
        p.background(0);
        p.translate(p.width/2, p.height/2);
        for(let i = 0; i < windows.length; i++) {
            windows[i].update();
            windows[i].show();
        }
    }

    p.windowResized = function() {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
    }
};

// Create the screensaver container element
function createScreensaverContainer() {
    const container = document.createElement('div');
    container.id = 'screensaver-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '9999';
    container.style.display = 'none';
    document.body.appendChild(container);
    return container;
}

// Start the screensaver
function startScreensaver() {
    if (screensaverActive) return;

    const container = document.getElementById('screensaver-container') || createScreensaverContainer();
    container.style.display = 'block';

    // Initialize p5 instance
    if (!p5Instance) {
        p5Instance = new p5(screensaver, container);
    }

    screensaverActive = true;
}

// Stop the screensaver
function stopScreensaver() {
    if (!screensaverActive) return;

    const container = document.getElementById('screensaver-container');
    if (container) {
        container.style.display = 'none';
    }

    screensaverActive = false;
    resetTimer();
}

// Reset the inactivity timer
function resetTimer() {
    clearTimeout(timer);
    inactivityTime = 0;
    timer = setTimeout(checkInactivity, 1000); // Check every second
}

// Check if the user has been inactive for the set limit
function checkInactivity() {
    inactivityTime += 1000;

    if (inactivityTime >= inactivityLimit) {
        startScreensaver();
    } else {
        timer = setTimeout(checkInactivity, 1000);
    }
}

// Track user activity and reset timer
function trackActivity() {
    if (screensaverActive) {
        stopScreensaver();
    } else {
        resetTimer();
    }
}

// Initialize the inactivity tracker
function initInactivityTracker() {
    // Check if body has the mobile class that your mobile-detection.js adds
    if (document.body.classList.contains('is-touch-device')) {
        console.log("Mobile device detected. Screensaver disabled.");
        return;
    }

    // Create the screensaver container
    createScreensaverContainer();

    // Set up event listeners for user activity
    const activityEvents = [
        'mousedown', 'mousemove', 'keypress',
        'scroll', 'touchstart', 'click', 'keydown'
    ];

    activityEvents.forEach(event => {
        document.addEventListener(event, trackActivity, true);
    });

    // Start the inactivity timer
    resetTimer();
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initInactivityTracker);