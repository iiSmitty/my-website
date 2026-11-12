const { test, expect } = require('./fixtures');
const { fastForwardUntil } = require('./contact-helpers');

// The coffees my GitHub sponsors have bought (js/sponsors.js): a GroupBox in
// Coffee Analytics, and the "thanks to N patrons" link by the identity
// block's sponsor link. Fed from data/sponsors.json, which
// .github/scripts/sponsors-fetcher.js writes.

const WILHELM = { login: 'wkirschbaum', name: 'Wilhelm Kirschbaum', since: '2026-11', coffees: 2 };
const ONE = { lastUpdated: '2026-11-12T06:00:00.000Z', sponsors: [WILHELM] };
const SEVERAL = {
    lastUpdated: '2027-02-03T06:00:00.000Z',
    sponsors: [
        WILHELM,
        // A generous sponsor, listed by when they started, not how much
        { login: 'thandin', name: 'Thandi Nkosi', since: '2026-12', coffees: 12 },
        { login: 'nameless', name: null, since: '2027-02', coffees: 1 }
    ]
};
const NONE = { lastUpdated: '2026-11-12T06:00:00.000Z', sponsors: [] };

const group = (page) => page.locator('#sponsors');
const rows = (page) => page.locator('.sponsors-item');
const thanks = (page) => page.locator('.identity').getByRole('link', { name: /^thanks to/ });

// Starts Windows with these sponsors, without loading the profile
async function startWith(page, data, { status = 200 } = {}) {
    await page.route('**/data/sponsors.json', (route) => route.fulfill({ status, json: data }));
    // A fake clock that still ticks in real time, so fastForwardUntil can skip the floppy
    await page.clock.install();
    await page.goto('/');
    await page.locator('#start-windows').click();
}

// Starts Windows and loads the floppy, which reveals Coffee Analytics
async function bootWith(page, data) {
    await startWith(page, data);
    await page.locator('#floppyLoader').click();
    await fastForwardUntil(page, () => page.locator('.coffee-program-manager').isVisible(), true);
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('credits the first sponsor in coffees, as the Founding Patron', async ({ page }) => {
        await bootWith(page, ONE);

        await expect(group(page).locator('legend')).toHaveText('Sponsors');
        await expect(rows(page)).toHaveCount(1);
        await expect(rows(page)).toHaveClass(/is-founding/);
        await expect(rows(page).locator('.sponsors-standing')).toHaveText('Founding Patron · since Nov 2026');

        // A pixel cup per coffee, with the count in words for screen readers
        const cups = rows(page).getByRole('img', { name: '2 cappuccinos with wings' });
        await expect(cups.locator('.pixel-cup')).toHaveCount(2);
        await expect(cups).toHaveAttribute('title', '2 cappuccinos with wings');

        const profile = rows(page).getByRole('link', { name: 'Wilhelm Kirschbaum' });
        await expect(profile).toHaveAttribute('href', 'https://github.com/wkirschbaum');
        await expect(profile).toHaveAttribute('target', '_blank');
        await expect(profile).toHaveAttribute('rel', 'noopener noreferrer');

        // Thanks, without asking for more: the identity block's sponsor link
        // is the only way to sponsor
        await expect(group(page).getByRole('link')).toHaveCount(1);
        await expect(group(page).getByRole('button')).toHaveCount(0);
    });

    test('never shows an amount of money', async ({ page }) => {
        await bootWith(page, SEVERAL);
        await expect(rows(page)).toHaveCount(3);
        await expect(group(page)).not.toContainText(/\$|USD|R\d|dollar|rand/i);
    });

    test('lists several sponsors in the order they first sponsored, with only the first as Founding Patron', async ({ page }) => {
        await bootWith(page, SEVERAL);

        await expect(rows(page).getByRole('link')).toHaveText(['Wilhelm Kirschbaum', 'Thandi Nkosi', '@nameless']);
        await expect(rows(page).locator('.sponsors-standing')).toHaveText([
            'Founding Patron · since Nov 2026',
            'Patron · since Dec 2026',
            'Patron · since Feb 2027'
        ]);
        await expect(page.locator('.sponsors-item.is-founding')).toHaveCount(1);
        await expect(thanks(page)).toHaveText('thanks to 3 patrons');
    });

    test('past five cups, a row shows one cup and the count', async ({ page }) => {
        await bootWith(page, SEVERAL);

        const generous = rows(page).nth(1).getByRole('img', { name: '12 cappuccinos with wings' });
        await expect(generous.locator('.pixel-cup')).toHaveCount(1);
        await expect(generous).toHaveText('x12');
        await expect(rows(page).nth(2).getByRole('img', { name: '1 cappuccino with wings' }).locator('.pixel-cup'))
            .toHaveCount(1);
    });

    test('with no sponsors yet, shows no box and no thank-you', async ({ page }) => {
        await bootWith(page, NONE);

        await expect(group(page)).toBeHidden();
        await expect(page.locator('#sponsorsThanks')).toBeHidden();
    });

    test('shows nothing at all if the sponsors file fails to load', async ({ page }) => {
        await startWith(page, null, { status: 404 });
        await page.locator('#floppyLoader').click();
        await fastForwardUntil(page, () => page.locator('.coffee-program-manager').isVisible(), true);

        await expect(group(page)).toBeHidden();
        await expect(page.locator('#sponsorsThanks')).toBeHidden();
        // The rest of Coffee Analytics is unaffected
        await expect(page.locator('#coffee-total-visits')).not.toHaveText('—');
    });

    test('names reach the page as text, never as markup', async ({ page }) => {
        const sneaky = { login: 'sneaky', name: '<img src=x onerror="window.pwned=1">', since: '2026-11', coffees: 1 };
        await bootWith(page, { sponsors: [sneaky] });
        await expect(rows(page).getByRole('link')).toHaveText('<img src=x onerror="window.pwned=1">');
        await expect(group(page).locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    });

    test('thanks the patrons by the sponsor link, which stays as it was', async ({ page }) => {
        await startWith(page, ONE);
        await expect(thanks(page)).toHaveText('thanks to 1 patron');
        await expect(page.locator('.identity').getByRole('link', { name: 'sponsor', exact: true }))
            .toHaveAttribute('href', 'https://github.com/sponsors/iiSmitty');
    });

    test('the thank-you loads the profile and lands on the sponsors', async ({ page }) => {
        await startWith(page, ONE);
        await expect(page.locator('#mainProfileContent')).toBeHidden();

        await thanks(page).click();
        await fastForwardUntil(page, () => group(page).evaluate(el => el === document.activeElement), true);

        await expect(group(page)).toBeInViewport();
        // The disk is gone at once, so nothing moves the sponsors afterwards
        await expect(page.locator('#floppyLoader')).toHaveCount(0);
    });

    test('a link straight to the sponsors lands on them once Windows has started', async ({ page }) => {
        await page.route('**/data/sponsors.json', (route) => route.fulfill({ json: ONE }));
        await page.goto('/#sponsors');
        await page.locator('#start-windows').click();
        await expect(group(page)).toBeInViewport();
    });
});

test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('several sponsors fit without scrolling sideways', async ({ page }) => {
        await bootWith(page, SEVERAL);
        await group(page).scrollIntoViewIfNeeded();
        await expect(rows(page)).toHaveCount(3);
        await expect(thanks(page)).toHaveText('thanks to 3 patrons');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
