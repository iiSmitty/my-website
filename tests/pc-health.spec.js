const { test, expect } = require('./fixtures');

// PC Health: the Mood row, and the window that cheers up My Computer
// (js/pc-health.js, js/pc-health-window.js). Every test serves its own data
// files and answers the mood API itself, at a fixed time, so nothing depends
// on today's real coffee or on the real API (cf-mood/).

const NOW = Date.parse('2026-11-02T10:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const COFFEE = {
    totalSiteVisits: 160,
    currentBalance: 0,
    freeBeveragesRedeemed: 29,
    freeBeveragesAvailable: 3,
    // A coffee yesterday: +15
    lastVisitAt: new Date(NOW - DAY).toISOString(),
    lastUpdated: new Date(NOW - DAY).toISOString(),
    success: true
};

// An episode ten days ago: too long for the +10
const WATCHING = {
    lastUpdated: new Date(NOW - DAY).toISOString(),
    current: { title: 'House', year: 2004, slug: 'house', lastWatchedAt: new Date(NOW - 10 * DAY).toISOString() }
};

const SPOTIFY = { topTracks: [{ name: 'Cool Soos Koos Kombuis', artist: 'Snotkop' }], topArtists: [] };

const NONE = { pat: 0, coffee: 0, joke: 0, defrag: 0, dust: 0 };

function snapshot({ lift = 0, today = {}, total = 0, last = null, at = NOW } = {}) {
    return { lift, at, halfLifeHours: 12, today: { ...NONE, ...today }, total, last };
}

/**
 * Serves the data files and the mood API. `api(call, calls)` answers each API
 * call with a route.fulfill() options object, or 'abort'. Returns the calls.
 */
async function setup(page, { shared = true, coffee = {}, api = () => ({ json: snapshot() }), now = NOW } = {}) {
    await page.clock.install({ time: now });
    await page.route('**/data/features.json', route => route.fulfill({ json: { pcHealthShared: shared } }));
    await page.route('**/data/coffee-stats.json', route => route.fulfill({ json: { ...COFFEE, ...coffee } }));
    await page.route('**/data/watching.json', route => route.fulfill({ json: WATCHING }));
    await page.route('**/data/spotify-data.json', route => route.fulfill({ json: SPOTIFY }));

    const calls = [];
    await page.route('**/api/mood**', async route => {
        const request = route.request();
        const call = {
            method: request.method(),
            path: new URL(request.url()).pathname,
            body: request.method() === 'POST' ? request.postDataJSON() : undefined
        };
        calls.push(call);
        const answer = await api(call, calls);
        // The page may have given up on it already (the 3 second timeout)
        if (answer === 'abort') return route.abort().catch(() => {});
        return route.fulfill(answer).catch(() => {});
    });
    return calls;
}

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const healthWindow = (page) => page.getByRole('dialog', { name: 'PC Health' });
const moodRow = (page) => page.locator('#pcHealthRow');
const live = (page) => page.locator('#pcHealthLive');
const action = (page, name) => healthWindow(page).getByRole('button', { name });

async function openFromRow(page) {
    await moodRow(page).getByRole('button', { name: 'check on it' }).click();
    await expect(healthWindow(page)).toBeVisible();
}

// Waits out the cooldown between cheers
async function ready(page, name) {
    await expect(action(page, name)).not.toHaveAttribute('aria-disabled', 'true');
}

// Our own code's errors. A request the test aborts, or the 404 a missing
// Worker gives, is logged by the browser itself, not by the page.
function collectErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        if (message.type() === 'error' && !/Failed to load resource|net::ERR_/.test(message.text())) {
            errors.push(`console.error: ${message.text()}`);
        }
    });
    return errors;
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the home page shows the mood without asking the API or loading the window', async ({ page }) => {
        const calls = await setup(page);
        const requested = [];
        page.on('request', request => requested.push(request.url()));

        await boot(page);
        await page.waitForLoadState('networkidle');

        // 40, +15 for yesterday's coffee
        await expect(moodRow(page)).toBeVisible();
        await expect(moodRow(page).locator('dt')).toHaveText('Mood');
        await expect(page.locator('#pcHealthRowText')).toHaveText('Content, 55%');
        // The PC's face matches its mood
        await expect(page.locator('#pcHealthRowFace')).toHaveAttribute('data-face', 'content');
        await expect(page.locator('#pcHealthRowFace svg')).toBeVisible();

        expect(calls).toEqual([]);
        expect(requested.filter(url => /pc-health-window|pc-health\.min\.css|features\.json/.test(url))).toEqual([]);
        await expect(page.locator('#pcHealthWindow')).toHaveCount(0);
        // Coffee Analytics and the Mood row share one download
        expect(requested.filter(url => url.includes('coffee-stats.json'))).toHaveLength(1);
    });

    test('opens from the desktop icon, the Start menu and Help, like any program', async ({ page }) => {
        await setup(page);
        await boot(page);

        await page.locator('.desktop-icon', { hasText: 'PC Health' }).dblclick();
        await expect(healthWindow(page)).toBeVisible();
        await expect(healthWindow(page)).toBeFocused();
        await expect(page.getByRole('region', { name: 'Taskbar' }).getByRole('button', { name: 'PC Health' })).toBeVisible();
        await healthWindow(page).getByRole('button', { name: 'Close' }).click();
        await expect(healthWindow(page)).toBeHidden();

        await page.locator('#taskbarStart').click();
        await page.getByRole('menu', { name: 'Start' }).getByRole('menuitem', { name: 'Programs' }).click();
        await page.getByRole('menu', { name: 'Programs' }).getByRole('menuitem', { name: 'PC Health' }).click();
        await expect(healthWindow(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(healthWindow(page)).toBeHidden();

        await page.locator('.identity').getByRole('link', { name: 'how it works' }).click();
        const topic = page.locator('.help-topic', { hasText: 'A PC you can cheer up' });
        await topic.locator('summary').click();
        await topic.getByRole('button', { name: 'Open PC Health' }).click();
        await expect(healthWindow(page)).toBeVisible();

        // Opened three times, loaded once
        await expect(page.locator('link[href="css/pc-health.min.css"]')).toHaveCount(1);
        await expect(page.locator('script[src="js/pc-health-window.min.js"]')).toHaveCount(1);
    });

    test('shows the shared mood and traces of earlier visitors', async ({ page }) => {
        const calls = await setup(page, {
            api: () => ({
                json: snapshot({
                    lift: 20,
                    today: { pat: 6, coffee: 3, joke: 2, defrag: 1, dust: 2 },
                    total: 230,
                    last: { action: 'coffee', at: NOW - 3 * HOUR }
                })
            })
        });
        await boot(page);
        await openFromRow(page);

        // 55 + 20
        const meter = healthWindow(page).getByRole('meter', { name: 'Mood' });
        await expect(meter).toHaveAttribute('aria-valuetext', 'Happy, 75%');
        await expect(meter).toHaveAttribute('aria-valuenow', '75');
        await expect(page.locator('#pcHealthState')).toHaveText('Happy');
        await expect(page.locator('#pcHealthPercent')).toHaveText('75%');
        await expect(page.locator('#pcHealthArt')).toHaveAttribute('data-face', 'happy');
        await expect(healthWindow(page)).toContainText('Fans spinning, lights blinking. Good day.');

        await expect(page.locator('#pcHealthTraces')).toHaveText('14 cheers today. Last one: a coffee, 3 hours ago.');
        await expect(page.locator('#pcHealthLife')).toHaveText('André last had a coffee yesterday. Last episode: House, 10 days ago.');
        await expect(page.locator('#pcHealthHumming')).toHaveText('Humming: Cool Soos Koos Kombuis by Snotkop.');
        await expect(page.locator('#pcHealthMode')).toHaveText('Shared with every visitor');
        await expect(page.locator('#pcHealthYours')).toHaveText('You haven\'t cheered me up yet.');

        expect(calls).toEqual([{ method: 'GET', path: '/api/mood', body: undefined }]);
    });

    test('a cheer reacts at once, is sent, and is counted', async ({ page }) => {
        let today = { ...NONE };
        let lift = 0;
        const calls = await setup(page, {
            api: (call) => {
                if (call.method === 'POST') {
                    today = { ...today, [call.body.action]: today[call.body.action] + 1 };
                    lift = lift + (50 - lift) * 0.08;
                    return { json: { ...snapshot({ lift, today, total: 1, last: { action: call.body.action, at: NOW } }), accepted: true } };
                }
                return { json: snapshot({ lift, today }) };
            }
        });
        await boot(page);
        await openFromRow(page);
        await expect(page.locator('#pcHealthTraces')).toHaveText('No cheers yet today.');

        await action(page, 'Pour a coffee').click();
        await expect(page.locator('#pcHealthBubble')).toHaveText('André\'s loyalty card says 160 visits. Mine says one. Thank you.');
        await expect(live(page)).toHaveText('André\'s loyalty card says 160 visits. Mine says one. Thank you.');
        await expect(page.locator('#pcHealthArt')).toHaveClass(/is-cheered/);
        await expect(page.locator('#pcHealthTraces')).toHaveText('1 cheer today. Last one: a coffee, just now.');
        await expect(page.locator('#pcHealthYours')).toHaveText('You\'ve cheered me up 1 time.');
        await expect(page.locator('#pcHealthPercent')).toHaveText('59%');

        await ready(page, 'Pat the case');
        await action(page, 'Pat the case').click();
        await expect(page.locator('#pcHealthYours')).toHaveText('You\'ve cheered me up 2 times.');

        // Only the page load's first counted cheer says it's the first
        await expect.poll(() => calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
            { action: 'coffee', first: true },
            { action: 'pat' }
        ]);

        // The Mood row keeps up once the window closes: 55 + 7.68
        await expect(page.locator('#pcHealthPercent')).toHaveText('63%');
        await page.keyboard.press('Escape');
        await expect(page.locator('#pcHealthRowText')).toHaveText('Content, 63%');
    });

    test('the cooldown keeps focus where it is, and ignores clicks until it ends', async ({ page }) => {
        const calls = await setup(page, { api: (call) => ({ json: { ...snapshot(), accepted: call.method === 'POST' } }) });
        await boot(page);
        await openFromRow(page);

        const pat = action(page, 'Pat the case');
        await pat.focus();
        await page.keyboard.press('Enter');
        await expect(pat).toHaveAttribute('aria-disabled', 'true');
        await expect(action(page, 'Dust the fan')).toHaveAttribute('aria-disabled', 'true');
        await expect(pat).toBeFocused();

        await page.keyboard.press('Enter');
        await expect(pat).toBeFocused();
        // Forced: Playwright would otherwise wait for the cooldown to end
        await action(page, 'Dust the fan').click({ force: true });
        await ready(page, 'Pat the case');
        expect(calls.filter(call => call.method === 'POST')).toHaveLength(1);
        await expect(page.locator('#pcHealthYours')).toHaveText('You\'ve cheered me up 1 time.');
    });

    test('Defrag shows a progress dialog, then its result', async ({ page }) => {
        await setup(page);
        await boot(page);
        await openFromRow(page);

        await action(page, 'Run Defrag').click();
        const progress = healthWindow(page).getByRole('progressbar', { name: 'Defragmenting Drive C' });
        await expect(progress).toBeVisible();
        await expect(page.locator('#pcHealthBubble')).toHaveText('Defragmenting Drive C...');
        await expect(page.locator('#pcHealthBubble')).toHaveText('All my clusters are in a row. I feel organised.');
        await expect(progress).toBeHidden();
    });

    test('jokes are not repeated until every one has been told', async ({ page }) => {
        await setup(page, { shared: false });
        await boot(page);
        await openFromRow(page);

        const told = new Set();
        for (let i = 0; i < 21; i++) {
            await action(page, 'Tell a joke').click();
            await expect(page.locator('#pcHealthBubble')).not.toHaveText(/^Hello|^$/);
            const joke = await page.locator('#pcHealthBubble').textContent();
            if (i < 20) {
                expect(told.has(joke), joke).toBe(false);
                told.add(joke);
            } else {
                // All 20 heard: the pool starts again
                expect(told.has(joke), joke).toBe(true);
            }
            await page.clock.fastForward(1500);
            await ready(page, 'Tell a joke');
        }
    });

    test('switched off, it stays in the browser and never calls the API', async ({ page }) => {
        const calls = await setup(page, { shared: false });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('Visitor cheers are switched off for now. I still appreciate it.');
        await expect(page.locator('#pcHealthMode')).toHaveText('Just you and me');
        await expect(page.locator('#pcHealthPercent')).toHaveText('55%');

        await action(page, 'Dust the fan').click();
        await expect(page.locator('#pcHealthBubble')).toHaveText('Ahh. I can hear myself think again. It was mostly crumbs.');
        // The lift is this browser's own: 0 + 50 * 0.08
        await expect(page.locator('#pcHealthPercent')).toHaveText('59%');
        await page.waitForTimeout(500);
        expect(calls).toEqual([]);
    });

    test('the Worker\'s own off switch is treated the same', async ({ page }) => {
        const calls = await setup(page, { api: () => ({ status: 503, json: { error: 'disabled' } }) });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('Visitor cheers are switched off for now. I still appreciate it.');
        await action(page, 'Pat the case').click();
        await expect(page.locator('#pcHealthYours')).toHaveText('You\'ve cheered me up 1 time.');
        await page.waitForTimeout(500);
        expect(calls).toHaveLength(1);
    });

    test('offline, reactions still play, and there are no errors', async ({ page }) => {
        const errors = collectErrors(page);
        const calls = await setup(page, { api: () => 'abort' });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('Can\'t reach the network right now.');
        await expect(page.locator('#pcHealthMode')).toHaveText('Working offline');

        await action(page, 'Pat the case').click();
        await expect(page.locator('#pcHealthBubble')).toHaveText('Whirr. That\'s the spot, just above the floppy drive.');
        await expect(page.locator('#pcHealthTraces')).toHaveText('Can\'t reach the network, but I still felt that.');
        await expect(live(page)).toHaveText('Whirr. That\'s the spot, just above the floppy drive. Can\'t reach the network, but I still felt that.');
        await expect(page.locator('#pcHealthPercent')).toHaveText('59%');

        expect(calls.map(call => call.method)).toEqual(['GET', 'POST']);
        expect(errors).toEqual([]);
    });

    test('a Cloudflare error page or the site\'s 404 counts as offline', async ({ page }) => {
        const errors = collectErrors(page);
        await setup(page, {
            api: (call) => call.method === 'GET'
                ? { status: 404, contentType: 'text/html', body: '<!DOCTYPE html><title>404</title>' }
                : { status: 200, contentType: 'text/html', body: '<html>Error 1027</html>' }
        });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('Can\'t reach the network right now.');
        await action(page, 'Pat the case').click();
        await expect(page.locator('#pcHealthTraces')).toHaveText('Can\'t reach the network, but I still felt that.');
        expect(errors).toEqual([]);
    });

    test('a slow API gives up after 3 seconds', async ({ page }) => {
        await setup(page, {
            api: async () => {
                await new Promise(resolve => setTimeout(resolve, 6000));
                return { json: snapshot({ lift: 30 }) };
            }
        });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('Checking on the other visitors...');
        await page.clock.fastForward(3000);
        await expect(page.locator('#pcHealthTraces')).toHaveText('Can\'t reach the network right now.');
        await expect(page.locator('#pcHealthPercent')).toHaveText('55%');
    });

    test('resting, it stops calling until the time it gave', async ({ page }) => {
        const until = NOW + 14 * HOUR;
        const calls = await setup(page, { api: () => ({ status: 429, json: { resting: true, until } }) });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('I\'ve had a lot of visitors today and I need a rest. Come back tomorrow.');
        await expect(page.locator('#pcHealthMode')).toHaveText('Resting until tomorrow');
        await action(page, 'Pour a coffee').click();
        await expect(page.locator('#pcHealthYours')).toHaveText('You\'ve cheered me up 1 time.');
        expect(calls).toHaveLength(1);

        // Remembered across visits
        await page.reload();
        await page.locator('#start-windows').click();
        await openFromRow(page);
        await expect(page.locator('#pcHealthTraces')).toHaveText('I\'ve had a lot of visitors today and I need a rest. Come back tomorrow.');
        await page.waitForTimeout(500);
        expect(calls).toHaveLength(1);
    });

    test('the lift fades while the window is open, and the Mood row remembers it', async ({ page }) => {
        await setup(page, { api: () => ({ json: snapshot({ lift: 40 }) }) });
        await boot(page);
        await openFromRow(page);

        // 55 + 40, capped at 100... 95: Great day
        await expect(page.locator('#pcHealthPercent')).toHaveText('95%');
        await expect(page.locator('#pcHealthArt')).toHaveAttribute('data-face', 'great');

        // One half-life later: 55 + 20
        await page.clock.fastForward(12 * HOUR);
        await expect(page.locator('#pcHealthPercent')).toHaveText('75%');
        await expect(page.locator('#pcHealthState')).toHaveText('Happy');
        // The band change is announced once
        await expect(live(page)).toHaveText('Mood: Happy.');

        // 13 hours on, yesterday's coffee is over two days old too:
        // 40 + 40 * 0.5^(25/12) = 49
        await page.clock.fastForward(13 * HOUR);
        await expect(page.locator('#pcHealthPercent')).toHaveText('49%');
        await expect(live(page)).toHaveText('Mood: Okay.');

        await page.keyboard.press('Escape');
        await expect(page.locator('#pcHealthRowText')).toHaveText('Okay, 49%');
    });

    test('announcements: your own cheer at once, others summed up, the mood only on a band change', async ({ page }) => {
        let others = 0;
        let lift = 14;
        await setup(page, {
            // Other visitors pat the PC between your cheers
            api: (call) => {
                if (call.method === 'POST') {
                    lift = lift + (50 - lift) * 0.08;
                    others += 2;
                    return { json: { ...snapshot({ lift, today: { pat: 1 + others, [call.body.action]: 1 + (call.body.action === 'pat' ? others : 0) } }), accepted: true } };
                }
                return { json: snapshot({ lift, today: { pat: 1 } }) };
            },
            coffee: { lastVisitAt: new Date(NOW - 5 * DAY).toISOString() }
        });
        await boot(page);
        await openFromRow(page);
        // 40 + 14
        await expect(page.locator('#pcHealthPercent')).toHaveText('54%');
        await expect(live(page)).toHaveText('');

        // Crosses into Content
        await action(page, 'Dust the fan').click();
        await expect(live(page)).toHaveText('Ahh. I can hear myself think again. It was mostly crumbs. Mood: Content.');

        // Others patted twice while you weren't looking
        await ready(page, 'Pour a coffee');
        await action(page, 'Pour a coffee').click();
        await expect(live(page)).toHaveText('André\'s loyalty card says 160 visits. Mine says one. Thank you. Since you opened: 2 pats.');

        // Within the minute, no summary, however many more there are
        await ready(page, 'Dust the fan');
        await action(page, 'Dust the fan').click();
        await expect(live(page)).toHaveText('Ahh. I can hear myself think again. It was mostly crumbs.');
    });

    test('text from the API is never shown as it is', async ({ page }) => {
        await setup(page, {
            api: () => ({
                json: snapshot({
                    lift: 10,
                    today: { pat: '<b>9</b>', coffee: 2 },
                    last: { action: '<img src=x onerror="window.hacked=1">', at: NOW }
                })
            })
        });
        await boot(page);
        await openFromRow(page);

        await expect(page.locator('#pcHealthTraces')).toHaveText('2 cheers today.');
        await expect(healthWindow(page).locator('img, b')).toHaveCount(0);
        expect(await page.evaluate(() => window.hacked)).toBeUndefined();
    });
});

test.describe('Phase 3', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the tray shows the face this browser last saw, and opens PC Health', async ({ page }) => {
        const calls = await setup(page);
        await boot(page);

        const tray = page.getByRole('region', { name: 'Taskbar' }).getByRole('button', { name: 'Check on the PC' });
        await expect(tray).toBeVisible();
        await expect(tray.locator('.pc-health-tray-face')).toHaveAttribute('data-face', 'content');
        await expect(tray).toHaveAttribute('title', 'Check on the PC\nLast seen: Content, 55%');
        // Never live: the page hasn't asked the API anything
        expect(calls).toEqual([]);

        await tray.click();
        await expect(healthWindow(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tray).toBeFocused();
    });

    test('PC Health is listed in Task Manager\'s Applications tab while it\'s open', async ({ page }) => {
        await setup(page);
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { workflows: [], workflow_runs: [] } }));
        await boot(page);
        await openFromRow(page);

        await page.keyboard.press('Control+Shift+Escape');
        const taskManager = page.getByRole('dialog', { name: 'Windows Task Manager' });
        await expect(taskManager).toBeVisible();
        await expect(page.locator('#taskmgrTasks tr')).toHaveText([/Windows 95/, /PC Health/, /Windows Task Manager/]);
        await expect(page.locator('#taskmgrTasks tr').nth(1).locator('.PcHealthIcon_16x16')).toHaveCount(1);
    });

    test('at night in Cape Town it dozes, and a cheer wakes it', async ({ page }) => {
        // 23:30 in Cape Town
        await setup(page, { now: Date.parse('2026-11-02T21:30:00Z') });
        await boot(page);
        await expect(page.locator('#pcHealthRowFace')).toHaveAttribute('data-face', 'asleep');
        await openFromRow(page);

        await expect(page.locator('#pcHealthArt')).toHaveAttribute('data-face', 'asleep');
        await expect(page.locator('#pcHealthLine')).toHaveText('Dozing. It\'s 23:30 in Cape Town.');
        await expect(page.locator('#pcHealthBubble')).toHaveText('Zzz... It\'s 23:30 in Cape Town, so I\'m dozing. Any of these buttons will wake me.');
        // The word and the number stay, whatever the face
        await expect(healthWindow(page).getByRole('meter', { name: 'Mood' })).toHaveAttribute('aria-valuetext', /^Okay|^Content/);

        await action(page, 'Pat the case').click();
        await expect(page.locator('#pcHealthBubble')).toHaveText('Huh? Oh, hello! Whirr. That\'s the spot, just above the floppy drive.');
        await expect(page.locator('#pcHealthArt')).not.toHaveAttribute('data-face', 'asleep');
        await expect(page.locator('#pcHealthRowFace')).not.toHaveAttribute('data-face', 'asleep');

        // Ten quiet minutes later it nods off again
        await page.clock.fastForward(11 * 60 * 1000);
        await expect(page.locator('#pcHealthArt')).toHaveAttribute('data-face', 'asleep');
    });

    test('it greets you by the time of day in Cape Town', async ({ page }) => {
        // 08:00 in Cape Town
        await setup(page, { now: Date.parse('2026-11-02T06:00:00Z') });
        await boot(page);
        await openFromRow(page);
        await expect(page.locator('#pcHealthBubble')).toHaveText('Morning. Still warming up the CRT.');
    });
});

test.describe('touch', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('a phone opens PC Health from the Mood row, and everything is in reach', async ({ page }) => {
        await setup(page);
        await boot(page);
        await expect(page.locator('.desktop-icon')).toHaveCount(0);

        const check = moodRow(page).getByRole('button', { name: 'check on it' });
        expect((await check.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await check.tap();
        await expect(healthWindow(page)).toBeVisible();

        for (const name of ['Pat the case', 'Pour a coffee', 'Tell a joke', 'Run Defrag', 'Dust the fan']) {
            const box = await action(page, name).boundingBox();
            expect(box.height, name).toBeGreaterThanOrEqual(44);
        }

        await action(page, 'Pat the case').tap();
        await expect(page.locator('#pcHealthBubble')).toHaveText('Whirr. That\'s the spot, just above the floppy drive.');

        const box = await healthWindow(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        await healthWindow(page).getByRole('button', { name: 'Close' }).tap();
        await expect(healthWindow(page)).toBeHidden();
        await expect(check).toBeFocused();
    });
});

test.describe('reduced motion', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('nothing moves, and Defrag finishes at once', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setup(page);
        await boot(page);
        await openFromRow(page);

        expect(await page.locator('#pcHealthArt .pc-eyes').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');

        await action(page, 'Run Defrag').click();
        await expect(page.locator('#pcHealthBubble')).toHaveText('All my clusters are in a row. I feel organised.');
        await expect(page.locator('#pcHealthDefrag')).toBeHidden();
        const animations = await page.evaluate(() => ({
            hop: getComputedStyle(document.querySelector('#pcHealthArt .pc-health-svg')).animationName,
            heart: getComputedStyle(document.querySelector('#pcHealthArt .pc-health-heart')).animationName
        }));
        expect(animations).toEqual({ hop: 'none', heart: 'none' });
    });
});
