const path = require('path');
const base = require('@playwright/test');

// Every spec imports test and expect from here rather than from Playwright.
//
// The pages load three things from other people's servers: Google's
// analytics script and its beacon, and the achievement sound from Dropbox.
// A page's load event waits for them, so when seven test browsers start at
// once and those hosts are slow to answer the burst, the first wave of tests
// timed out. They're answered locally instead, so the suite only ever waits
// on this site. (p5.js and the APIs the windows call are left alone: they
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

module.exports = { test, expect: base.expect, STUBS };
