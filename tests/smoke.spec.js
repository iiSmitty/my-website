const { test, expect } = require('@playwright/test');

// Every HTML page that should load cleanly. Add new pages here as the site grows.
const pages = ['index.html', 'strava-pbs.html', '404.html'];

// Console errors from third-party scripts we don't control (analytics, fonts,
// ad/tracker blockers, etc.) are noise — we only care about errors from our own
// code. Add substrings here to ignore a known-benign console error.
const ignoredConsole = [
    'googletagmanager',
    'google-analytics',
    'gtag',
    'favicon',
];

function isOurError(text) {
    return !ignoredConsole.some((needle) => text.toLowerCase().includes(needle.toLowerCase()));
}

for (const page of pages) {
    test(`${page} loads with no errors`, async ({ page: p }) => {
        const errors = [];

        // Uncaught exceptions (e.g. "p5 is not defined") always count.
        p.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

        // console.error from our own scripts counts; third-party noise is filtered.
        p.on('console', (msg) => {
            if (msg.type() === 'error' && isOurError(msg.text())) {
                errors.push(`console.error: ${msg.text()}`);
            }
        });

        await p.goto(`/${page}`, { waitUntil: 'load' });

        // Force latent code paths that normally only run after a delay. The
        // screensaver waits 3 minutes of inactivity — trigger it immediately so
        // a regression like the missing p5 library surfaces in the test instead
        // of in production days later.
        await p.evaluate(() => {
            if (typeof startScreensaver === 'function') startScreensaver();
        });
        await p.waitForTimeout(500);

        expect(errors, `Unexpected errors on ${page}:\n${errors.join('\n')}`).toEqual([]);
    });
}
