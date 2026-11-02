const { test, expect } = require('./fixtures');

// The privacy notice (privacy.html), the ways to it, and the promises it
// makes that a test can keep: no Google, no cookies, nothing in storage.

const pages = ['/', '/experience', '/strava-pbs', '/privacy', '/404.html'];

for (const path of pages) {
    test(`${path} sends nothing to Google and sets no cookies`, async ({ page, context }) => {
        const google = [];
        page.on('request', (request) => {
            if (/google-analytics|googletagmanager|doubleclick/.test(request.url())) google.push(request.url());
        });

        await page.goto(path, { waitUntil: 'load' });

        expect(google).toEqual([]);
        expect(await context.cookies()).toEqual([]);
        expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the identity block links to the notice', async ({ page }) => {
        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('.identity').getByRole('link', { name: 'privacy' }).click();

        await expect(page).toHaveURL(/\/privacy$/);
        await expect(page.locator('.win95-title').first()).toHaveText('PRIVACY.TXT - Notepad');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('PRIVACY.TXT');
    });

    test('the notice points to the contact section and the regulator', async ({ page }) => {
        await page.goto('/privacy');
        const notice = page.locator('.notepad-text');

        await expect(notice.getByRole('link', { name: 'Contact Me' }).first()).toHaveAttribute('href', './#contact');
        await expect(notice.getByRole('link', { name: 'Information Regulator' })).toHaveAttribute('href', 'https://inforegulator.org.za/');
        await expect(notice.getByRole('heading', { level: 2 })).toHaveCount(8);
    });
});

test.describe('touch', () => {
    test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

    test('reads on a small phone, with nothing wider than the screen', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.getByRole('heading', { name: '7. Your rights' })).toBeAttached();
        await expect(page.locator('.notepad-text')).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the notice still shows', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.locator('.notepad-text')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('PRIVACY.TXT');
    });
});
