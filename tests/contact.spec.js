const { test, expect } = require('@playwright/test');

// Contact details come from the Cloudflare Worker (cf-worker/), never the page,
// and only for a Turnstile token. Both Turnstile and the worker are stubbed here
// so the tests don't depend on Cloudflare or production.
const EMAIL = 'hello@example.com';
const TOKEN = 'stub-turnstile-token';

// Stands in for challenges.cloudflare.com/turnstile/v0/api.js and records how
// the widget was rendered. It passes at once, or with `interactive` it asks for
// a click and waits for window.completeTurnstile().
const turnstileStub = ({ interactive }) => `
    window.turnstile = {
        render(container, options) {
            window.turnstileRenders = (window.turnstileRenders || []).concat({ container, action: options.action });
            const pass = () => options.callback(${JSON.stringify(TOKEN)});
            if (${interactive}) {
                setTimeout(() => options['before-interactive-callback']());
                window.completeTurnstile = () => {
                    options['after-interactive-callback']();
                    pass();
                };
            } else {
                setTimeout(pass);
            }
            return 'widget-1';
        },
        remove() {},
    };
`;

async function stubTurnstile(page, { interactive = false } = {}) {
    await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: turnstileStub({ interactive }) }));
}

// The floppy loader and the reveal are deliberate multi-second animations run
// on timers. Fast-forward the page's clock while waiting for them, so the tests
// are quick and a busy machine can't time them out.
async function fastForwardUntil(page, read, expected) {
    await expect.poll(async () => {
        await page.clock.runFor(1000);
        return read();
    }, { timeout: 20000 }).toBe(expected);
}

async function openContactSection(page) {
    // A fake clock that still ticks in real time, so fastForwardUntil can skip ahead
    await page.clock.install();
    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('#floppyLoader').click();
    await fastForwardUntil(page, () => page.locator('#decrypt-button').isVisible(), true);
    return page.locator('.section-content', { has: page.locator('#decrypt-button') });
}

async function waitForReveal(page) {
    await fastForwardUntil(page, () => page.locator('#decrypt-button').textContent(), 'Information Decrypted!');
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    // Startup, floppy loader, Turnstile and the reveal: the longest flow in the
    // suite, so it gets Playwright's tripled timeout under parallel load
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
        const posted = [];
        await page.route('**/api/contact', (route) => {
            posted.push({ method: route.request().method(), body: route.request().postDataJSON() });
            return route.fulfill({ json: { email: EMAIL } });
        });

        const contact = await openContactSection(page);
        await expect(contact).not.toContainText('Phone');

        await page.locator('#decrypt-button').click();
        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);

        expect(posted).toEqual([{ method: 'POST', body: { token: TOKEN } }]);
        expect(await page.evaluate(() => window.turnstileRenders)).toEqual([{ container: '#decrypt-turnstile', action: 'contact' }]);
        // Nobody was asked to click, so the Security Check frame never showed
        await expect(contact.getByText('Security Check')).toBeHidden();
    });

    test('the Security Check frame only appears while Turnstile wants a click', async ({ page }) => {
        await stubTurnstile(page, { interactive: true });
        await page.route('**/api/contact', (route) => route.fulfill({ json: { email: EMAIL } }));

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
