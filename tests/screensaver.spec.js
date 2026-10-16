const { test, expect } = require('@playwright/test');

// The flying windows screensaver (js/screensaver.js). p5.js is only fetched
// the first time the screensaver starts, not with the page.

const P5 = '**/p5.js/**/p5.min.js';

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const screensaver = (page) => page.locator('#screensaver-container');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('p5.js loads when the screensaver starts, not with the page', async ({ page }) => {
        const p5Requests = [];
        page.on('request', request => {
            if (request.url().includes('/p5.min.js')) p5Requests.push(request.url());
        });

        await boot(page);
        expect(p5Requests).toEqual([]);
        expect(await page.evaluate(() => typeof p5)).toBe('undefined');

        await page.evaluate(() => startScreensaver());
        await expect(screensaver(page)).toBeVisible();
        await expect(screensaver(page).locator('canvas')).toHaveCount(1);
        expect(p5Requests).toHaveLength(1);

        // Any activity puts it away, and the next start reuses what's loaded
        await page.mouse.move(300, 300);
        await expect(screensaver(page)).toBeHidden();
        await page.evaluate(() => startScreensaver());
        await expect(screensaver(page)).toBeVisible();
        await expect(screensaver(page).locator('canvas')).toHaveCount(1);
        expect(p5Requests).toHaveLength(1);
    });

    test('activity while p5.js is still loading means no screensaver', async ({ page }) => {
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.route(P5, async route => {
            await held;
            await route.continue();
        });

        await boot(page);
        const requested = page.waitForRequest(request => request.url().includes('/p5.min.js'));
        const started = page.evaluate(() => startScreensaver());
        // Only once it's waiting on p5.js does the activity count as "during"
        await requested;
        await page.mouse.move(300, 300);
        release();
        await started;

        await expect(screensaver(page)).toBeHidden();
        await expect(screensaver(page).locator('canvas')).toHaveCount(0);
    });

    test('if p5.js won\'t load, nothing is left over the page, and a later start tries again', async ({ page }) => {
        await page.route(P5, route => route.abort());
        await boot(page);

        await page.evaluate(() => startScreensaver());
        await expect(screensaver(page)).toBeHidden();
        // Still usable
        await page.locator('#floppyLoader').click();
        await expect(page.locator('#mainProfileContent')).toBeVisible();

        await page.unroute(P5);
        await page.evaluate(() => startScreensaver());
        await expect(screensaver(page).locator('canvas')).toHaveCount(1);
    });
});
