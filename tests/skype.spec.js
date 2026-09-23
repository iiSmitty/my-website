const { test, expect } = require('@playwright/test');

// The Skype easter egg shows an old profile that had real phone numbers on it.
// They must never reach the page: anything shaped like a South African number
// (+27 or a leading 0, then 9 digits in the usual groupings) fails the test.
const saPhoneNumber = /(\+\s*27|\b0)[\s-]*\d{2}[\s-]*\d{3}[\s-]*\d{4}/;

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until triggered', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /skype\.min\.css|skype-avatar|skype-message/.test(url))).toEqual([]);
        await expect(page.locator('#skypeWindow')).toHaveCount(0);
    });

    test('the Recycle Bin restores the profile', async ({ page }) => {
        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();

        const skypeWindow = page.getByRole('dialog', { name: 'Skype™' });
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
        await expect(skypeWindow.locator('.skype-chat')).toContainText('back :)', { timeout: 10000 });

        // Extra lives
        await expect(page.locator('#skypeLivesCount')).toHaveText('3');
        await skypeWindow.getByRole('button', { name: 'Collect an extra life' }).click();
        await expect(page.locator('#skypeLivesCount')).toHaveText('4');
        await expect(skypeWindow.locator('.skype-oneup')).toHaveText('1UP');

        await skypeWindow.getByRole('button', { name: 'Close' }).click();
        await expect(skypeWindow).toBeHidden();
    });

    test('Escape closes the window', async ({ page }) => {
        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();

        const skypeWindow = page.locator('#skypeWindow');
        await expect(skypeWindow).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(skypeWindow).toBeHidden();
    });

    test('no phone number anywhere in the shipped source', async ({ request }) => {
        for (const path of ['/', '/js/skype.js', '/css/skype.css']) {
            const body = await (await request.get(path)).text();
            expect(body, path).not.toMatch(saPhoneNumber);
        }
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
        // The "1UP" only lives for 600ms, so read its style in the same tick as the click
        const oneUpAnimation = await page.evaluate(() => {
            document.querySelector('#skypeWindow .skype-avatar').click();
            return getComputedStyle(document.querySelector('#skypeWindow .skype-oneup')).animationName;
        });
        expect(oneUpAnimation).toBe('none');
        await expect(page.locator('#skypeLivesCount')).toHaveText('4');
    });
});
