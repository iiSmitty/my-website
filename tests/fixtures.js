const path = require('path');
const base = require('@playwright/test');

// Every spec imports test and expect from here rather than from Playwright.
//
// The home page fetches its achievement sound from Dropbox once every desktop
// icon is deleted. It's answered locally instead, so the suite only ever
// waits on this site. (p5.js and the APIs the windows call are left alone:
// they load on demand, and the specs that need them route them themselves.)
//
// PC Health's API (cf-mood/) is answered as switched off, so no test can
// ever cheer up the real PC. pc-health.spec.js routes it per test.
const STUBS = [
    // A real sound of the site's own, so the audio element has something to decode
    ['https://dl.dropboxusercontent.com/**', { path: path.join(__dirname, '..', 'sounds', 'win95-complete.mp3') }],
    ['**/api/mood**', { status: 503, json: { error: 'disabled' } }]
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

// The Recycle Bin on the desktop opens a folder, and double-clicking one of
// its items opens that (recycle-bin.js). The Skype easter egg is one of them.
async function openFromRecycleBin(page, name) {
    await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();
    await page.locator('#recycleBinItems tr', { hasText: name }).dblclick();
}

module.exports = { test, expect: base.expect, expectCentered, openFromRecycleBin, STUBS };
