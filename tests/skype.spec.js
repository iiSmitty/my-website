const { test, expect } = require('@playwright/test');

// The Skype easter egg shows an old profile that had real phone numbers on it.
// They must never reach the page: anything shaped like a South African number
// (+27 or a leading 0, then 9 digits in the usual groupings) fails the test.
const saPhoneNumber = /(\+\s*27|\b0)[\s-]*\d{2}[\s-]*\d{3}[\s-]*\d{4}/;

// Boot the home page past the startup dialog and floppy loader, so the status
// bar (and its visitor counter) is on screen.
async function bootHomePage(page, { touch = false } = {}) {
    await page.goto('/');
    const press = (locator) => (touch ? locator.tap() : locator.click());
    await press(page.locator('#start-windows'));
    await press(page.locator('#floppyLoader'));
    await expect(page.locator('#visitor-counter')).toBeVisible();
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until triggered', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /skype\.min\.css|skype-avatar/.test(url))).toEqual([]);
        await expect(page.locator('#skypeWindow')).toHaveCount(0);
    });

    test('the Recycle Bin restores the profile', async ({ page }) => {
        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();

        const skypeWindow = page.getByRole('dialog', { name: /Skype.*André Smit/ });
        await expect(skypeWindow).toBeVisible();
        await expect(skypeWindow).toBeFocused();
        await expect(skypeWindow).toHaveCSS('position', 'fixed');

        // Profile content
        await expect(skypeWindow).toContainText('andrez.smit');
        await expect(skypeWindow).toContainText('Always Happy :)');
        await expect(skypeWindow).toContainText('I don\'t need to "GET A LIFE." I\'m a gamer. I have lots of lives!');
        await expect(skypeWindow).toContainText('South Africa (za)');
        await expect(skypeWindow).toContainText('8 messages · 27/07/2014 – 03/08/2014');
        await expect(skypeWindow.locator('.skype-avatar img')).toHaveJSProperty('complete', true);
        expect(await skypeWindow.locator('.skype-avatar img').evaluate((img) => img.naturalWidth)).toBe(96);

        // The phone numbers are redacted, never rendered
        await expect(skypeWindow.getByRole('img', { name: 'Redacted' })).toBeVisible();
        await expect(skypeWindow).toContainText('[Number disconnected]');
        expect(await skypeWindow.innerText()).not.toMatch(saPhoneNumber);

        // 2014-me said "brb"... and eventually comes back
        await expect(skypeWindow.locator('.skype-chat')).toContainText('brb');
        await expect(skypeWindow.locator('.skype-chat')).toContainText('back :)');

        // Extra lives
        await expect(page.locator('#skypeLivesCount')).toHaveText('3');
        await skypeWindow.getByRole('button', { name: 'Collect an extra life' }).click();
        await expect(page.locator('#skypeLivesCount')).toHaveText('4');
        await expect(skypeWindow.locator('.skype-oneup')).toHaveText('1UP');

        await skypeWindow.getByRole('button', { name: 'Close' }).click();
        await expect(skypeWindow).toBeHidden();
    });

    test('the visitor counter brings André online, by mouse and keyboard', async ({ page }) => {
        await bootHomePage(page);
        const counter = page.locator('#visitor-counter');
        const toast = page.locator('#skypeToast');
        const skypeWindow = page.locator('#skypeWindow');

        await counter.click();
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('André Smit has come online');
        await toast.getByRole('button', { name: /has come online/ }).click();
        await expect(toast).toBeHidden();
        await expect(skypeWindow).toBeVisible();

        // Escape closes and hands focus back to the counter
        await page.keyboard.press('Escape');
        await expect(skypeWindow).toBeHidden();
        await expect(counter).toBeFocused();

        // Keyboard only: Enter shows the notification (focused), Enter opens it
        await page.keyboard.press('Enter');
        await expect(toast.getByRole('button', { name: /has come online/ })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(skypeWindow).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(skypeWindow).toBeHidden();

        // The notification can be dismissed on its own
        await counter.click();
        await toast.getByRole('button', { name: 'Dismiss notification' }).click();
        await expect(toast).toBeHidden();
    });

    test('no phone number anywhere in the shipped source', async ({ request }) => {
        for (const path of ['/', '/js/skype.js', '/css/skype.css']) {
            const body = await (await request.get(path)).text();
            expect(body, path).not.toMatch(saPhoneNumber);
        }
    });
});

test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('tapping the visitor counter opens a window that fits the screen', async ({ page }) => {
        await bootHomePage(page, { touch: true });

        await page.locator('#visitor-counter').tap();
        await page.locator('#skypeToast .skype-toast-body').tap();

        const skypeWindow = page.locator('#skypeWindow');
        await expect(skypeWindow).toBeVisible();
        expect(await skypeWindow.innerText()).not.toMatch(saPhoneNumber);

        const box = await skypeWindow.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        expect(box.y + box.height).toBeLessThanOrEqual(812);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        await page.locator('#skypeWindow .skype-avatar').tap();
        await expect(page.locator('#skypeLivesCount')).toHaveText('4');

        await page.locator('#skypeWindow .win95-close').tap();
        await expect(skypeWindow).toBeHidden();
    });
});

test.describe('reduced motion', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the window still works without animation', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();

        await expect(page.locator('#skypeWindow')).toBeVisible();
        await page.locator('#skypeWindow .skype-avatar').click();
        await expect(page.locator('#skypeWindow .skype-oneup')).toHaveCSS('animation-name', 'none');
        await expect(page.locator('#skypeLivesCount')).toHaveText('4');
    });
});
