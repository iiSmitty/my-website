const path = require('path');
const base = require('@playwright/test');

// Every spec imports test and expect from here rather than from Playwright.
//
// The pages load Google's analytics script and its beacon from other
// people's servers, and the home page fetches its achievement sound from
// Dropbox once every desktop icon is deleted. The load event waits for
// analytics, so when seven test browsers start at once and those hosts are
// slow to answer the burst, the first wave of tests timed out. They're
// answered locally instead, so the suite only ever waits on this site. (p5.js and the APIs the windows call are left alone: they
// load on demand, and the specs that need them route them themselves.)
const STUBS = [
    ['https://*.googletagmanager.com/**', { status: 200, contentType: 'text/javascript', body: '' }],
    ['https://*.google-analytics.com/**', { status: 204, body: '' }],
    // A real sound of the site's own, so the audio element has something to decode
    ['https://dl.dropboxusercontent.com/**', { path: path.join(__dirname, '..', 'sounds', 'win95-complete.mp3') }]
];

const test = base.test.extend({
    context: async ({ context }, use) => {
        for (const [url, response] of STUBS) {
            await context.route(url, route => route.fulfill(response));
        }
        await use(context);
    }
});

// Windows and dialogs open in the middle of the screen, but never closer than
// 8px to its top or left edge, so a title bar too big to fit stays in reach
async function expectCentered(locator) {
    const box = await locator.boundingBox();
    const viewport = locator.page().viewportSize();
    base.expect(Math.abs(box.x - Math.max(8, (viewport.width - box.width) / 2))).toBeLessThanOrEqual(1);
    base.expect(Math.abs(box.y - Math.max(8, (viewport.height - box.height) / 2))).toBeLessThanOrEqual(1);
}

module.exports = { test, expect: base.expect, expectCentered, STUBS };
