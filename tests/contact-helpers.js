const { expect } = require('@playwright/test');

// Shared by contact.spec.js and decrypt-exe.spec.js.
//
// Contact details come from the Cloudflare Worker (cf-worker/), never the page,
// and only for a Turnstile token. Both Turnstile and the worker are stubbed in
// the tests so they don't depend on Cloudflare or production.

const TOKEN = 'stub-turnstile-token';

// Stands in for challenges.cloudflare.com/turnstile/v0/api.js and records how
// the widget was rendered. It passes at once, or with `interactive` it asks for
// a click and waits for window.completeTurnstile().
const turnstileStub = ({ interactive }) => `
    window.turnstile = {
        render(container, options) {
            window.turnstileRenders = (window.turnstileRenders || []).concat({
                container: typeof container === 'string' ? container : '#' + container.id,
                action: options.action,
            });
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

// Answers like the real worker would for a good token, and records each request
async function stubContactApi(page, email) {
    const posted = [];
    await page.route('**/api/contact', (route) => {
        posted.push({ method: route.request().method(), body: route.request().postDataJSON() });
        return route.fulfill({ json: { email } });
    });
    return posted;
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

module.exports = { TOKEN, stubTurnstile, stubContactApi, fastForwardUntil, openContactSection, waitForReveal };
