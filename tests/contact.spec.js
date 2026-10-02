const { test, expect } = require('@playwright/test');
const { TOKEN, stubTurnstile, stubContactApi, openContactSection, waitForReveal } = require('./contact-helpers');

// The plain "Decrypt Contact Info" flow: a progress bar, Turnstile and the
// worker. Phones and small screens get it straight away; desktops get
// DECRYPT.EXE first (decrypt-exe.spec.js), which can skip to this.
const EMAIL = 'hello@example.com';

test.describe('small screens', () => {
    // Below DECRYPT.EXE's 720px minimum
    test.use({ viewport: { width: 700, height: 900 } });
    // Startup, floppy loader, Turnstile and the reveal: among the longest flows
    // in the suite, so they get Playwright's tripled timeout under parallel load
    test.slow();

    test('nothing contact-related loads until Decrypt is clicked', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await openContactSection(page);
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /challenges\.cloudflare\.com|\/api\/contact/.test(url))).toEqual([]);
    });

    test('Decrypt Contact Info trades a Turnstile token for the email', async ({ page }) => {
        await stubTurnstile(page);
        const posted = await stubContactApi(page, EMAIL);

        const contact = await openContactSection(page);
        await expect(contact).not.toContainText('Phone');

        await page.locator('#decrypt-button').click();
        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);

        expect(posted).toEqual([{ method: 'POST', body: { token: TOKEN } }]);
        expect(await page.evaluate(() => window.turnstileRenders)).toEqual([{ container: '#decrypt-turnstile', action: 'contact' }]);
        // Nobody was asked to click, so the Security Check frame never showed
        await expect(contact.getByText('Security Check')).toBeHidden();
        // ...and DECRYPT.EXE never opened
        await expect(page.locator('#decryptExeNotepad')).toHaveCount(0);
    });

    test('the Security Check frame only appears while Turnstile wants a click', async ({ page }) => {
        await stubTurnstile(page, { interactive: true });
        await stubContactApi(page, EMAIL);

        const contact = await openContactSection(page);
        await page.locator('#decrypt-button').click();

        await expect(contact.getByText('Security Check')).toBeVisible();
        await expect(contact.getByText('Windows needs to confirm you are not a robot.')).toBeVisible();
        await expect(page.locator('#decrypt-text')).toHaveText('Waiting for human verification...');

        await page.evaluate(() => window.completeTurnstile());

        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toBeVisible();
        await expect(contact.getByText('Security Check')).toBeHidden();
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
