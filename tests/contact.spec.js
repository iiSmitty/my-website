const { test, expect } = require('@playwright/test');

// Contact details come from the Cloudflare Worker (cf-worker/), never the page,
// and only for a Turnstile token. Both Turnstile and the worker are stubbed here
// so the tests don't depend on Cloudflare or production.
const EMAIL = 'hello@example.com';
const TOKEN = 'stub-turnstile-token';

// Stands in for challenges.cloudflare.com/turnstile/v0/api.js: passes at once
// and records how the widget was rendered.
const TURNSTILE_STUB = `
    window.turnstile = {
        render(container, options) {
            window.turnstileRenders = (window.turnstileRenders || []).concat({ container, action: options.action });
            setTimeout(() => options.callback(${JSON.stringify(TOKEN)}));
            return 'widget-1';
        },
        remove() {},
    };
`;

async function stubTurnstile(page) {
    await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB }));
}

async function openContactSection(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('#floppyLoader').click();
    return page.locator('.section-content', { has: page.locator('#decrypt-button') });
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('nothing contact-related loads until Decrypt is clicked', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await openContactSection(page);
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /challenges\.cloudflare\.com|\/api\/contact/.test(url))).toEqual([]);
    });

    test('Decrypt Contact Info trades a Turnstile token for the email', async ({ page }) => {
        await stubTurnstile(page);
        const posted = [];
        await page.route('**/api/contact', (route) => {
            posted.push({ method: route.request().method(), body: route.request().postDataJSON() });
            return route.fulfill({ json: { email: EMAIL } });
        });

        const contact = await openContactSection(page);
        await expect(contact).not.toContainText('Phone');

        await page.locator('#decrypt-button').click();
        await expect(page.locator('#decrypt-button')).toHaveText('Information Decrypted!', { timeout: 10000 });
        await expect(contact.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);

        expect(posted).toEqual([{ method: 'POST', body: { token: TOKEN } }]);
        expect(await page.evaluate(() => window.turnstileRenders)).toEqual([{ container: '#decrypt-turnstile', action: 'contact' }]);
    });

    test('a rejected token leaves the email hidden and lets the visitor retry', async ({ page }) => {
        await stubTurnstile(page);
        await page.route('**/api/contact', (route) => route.fulfill({ status: 403, json: { error: 'verification_failed' } }));

        const contact = await openContactSection(page);
        await page.locator('#decrypt-button').click();

        await expect(page.locator('#decrypt-text')).toHaveText('Connection failed. Try again.');
        await expect(page.locator('#decrypt-button')).toBeEnabled();
        await expect(contact).not.toContainText('@example.com');
    });
});
