const { test, expect } = require('@playwright/test');

// Contact details come from the Cloudflare Worker (cf-worker/), never the page.
// The worker is stubbed here so the test doesn't depend on production.
const EMAIL = 'hello@example.com';

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('Decrypt Contact Info reveals the email and nothing else', async ({ page }) => {
        await page.route('**/api/contact', (route) => route.fulfill({ json: { email: EMAIL } }));

        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.locator('#floppyLoader').click();

        const contact = page.locator('.section-content', { has: page.locator('#decrypt-button') });
        await expect(contact).not.toContainText('Phone');

        await page.locator('#decrypt-button').click();
        await expect(page.locator('#decrypt-button')).toHaveText('Information Decrypted!', { timeout: 10000 });
        await expect(contact.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);
    });
});
