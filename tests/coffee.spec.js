const { test, expect } = require('./fixtures');
const { fastForwardUntil } = require('./contact-helpers');

// Coffee Analytics on the home page (js/coffee-simple.js), fed from
// data/coffee-stats.json, which .github/scripts/coffee-fetcher.js writes.

const REAL = {
    totalSiteVisits: 164,
    currentBalance: 0,
    freeBeveragesRedeemed: 26,
    freeBeveragesAvailable: 6,
    lastUpdated: '2026-09-27T13:26:15.635Z',
    success: true
};

// Starts Windows and loads the floppy, which reveals the profile the panel is in
async function bootWith(page, stats) {
    await page.route('**/data/coffee-stats.json', (route) => route.fulfill({ json: stats }));
    await page.clock.install();
    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('#floppyLoader').click();
    await fastForwardUntil(page, () => page.locator('.coffee-program-manager').isVisible(), true);
    await expect(page.locator('#coffee-total-visits')).toHaveText(stats.totalSiteVisits.toLocaleString());
}

const tiles = (page) => page.locator('.coffee-metrics-grid .coffee-metric-item');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('shows visits, cups worked out from points, and free coffees', async ({ page }) => {
        await bootWith(page, REAL);

        await expect(page.locator('#coffee-monthly-avg')).toHaveText(/^about \d+ visits a month$/);
        // 32 earned x 10 points = 320 bought, plus 26 free
        await expect(page.locator('#coffee-cups')).toHaveText('≈346');
        await expect(page.locator('#coffee-cups')).toHaveAttribute('title', '320 bought (1 point per drink) + 26 free = 346');
        await expect(page.locator('#coffee-cups-per-visit')).toHaveText('about 2.1 per visit');
        await expect(page.locator('#coffee-free-earned')).toHaveText('32');
        await expect(page.locator('#coffee-free-detail')).toHaveText('26 redeemed · 6 in the bank');
        await expect(page.locator('#coffee-progress-text')).toHaveText('0/10 points');
        await expect(page.locator('#coffee-loyalty-status')).toHaveText('Platinum Member');
        await expect(page.locator('#coffee-last-updated')).toHaveText('Last updated: 27/09/2026');
    });

    test('puts the three tiles side by side', async ({ page }) => {
        await bootWith(page, REAL);
        // Measured together, so the page can't move between the three
        const boxes = await tiles(page).evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
        expect(boxes[1].y).toBe(boxes[0].y);
        expect(boxes[2].y).toBe(boxes[0].y);
        expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width - 1);
    });

    test('fills one punch card cell per point', async ({ page }) => {
        await bootWith(page, { ...REAL, currentBalance: 7 });
        await expect(page.locator('#coffee-progress-text')).toHaveText('7/10 points');
        await expect(page.locator('#coffee-progress-fill')).toHaveAttribute('style', /width: 70%/);
    });

    test('says so when there are no free coffees waiting', async ({ page }) => {
        await bootWith(page, { ...REAL, freeBeveragesRedeemed: 32, freeBeveragesAvailable: 0 });
        await expect(page.locator('#coffee-free-earned')).toHaveText('32');
        await expect(page.locator('#coffee-free-detail')).toHaveText('32 redeemed · none in the bank');
    });

    test('a new member is told when the first free coffee comes', async ({ page }) => {
        await bootWith(page, { ...REAL, totalSiteVisits: 4, currentBalance: 6, freeBeveragesRedeemed: 0, freeBeveragesAvailable: 0 });
        await expect(page.locator('#coffee-free-earned')).toHaveText('0');
        await expect(page.locator('#coffee-free-detail')).toHaveText('First one at 10 points');
        await expect(page.locator('#coffee-free-detail')).toHaveClass(/is-quiet/);
        await expect(page.locator('#coffee-monthly-avg')).toHaveText('under 1 visit a month');
    });

    test('a stats file from before the free coffee figures shows dashes, not a guess', async ({ page }) => {
        const { freeBeveragesRedeemed, freeBeveragesAvailable, ...old } = REAL;
        await bootWith(page, old);
        await expect(page.locator('#coffee-cups')).toHaveText('—');
        await expect(page.locator('#coffee-free-earned')).toHaveText('—');
        await expect(page.locator('#coffee-cups-per-visit')).toHaveText('');
        await expect(page.locator('#coffee-free-detail')).toHaveText('');
    });
});

test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('stacks the tiles without scrolling sideways', async ({ page }) => {
        await bootWith(page, REAL);
        const boxes = await tiles(page).evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
        expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
        expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height - 1);

        // The context line wraps rather than being cut off
        const detail = page.locator('#coffee-free-detail');
        const clipped = await detail.evaluate(el => el.scrollWidth > el.clientWidth);
        expect(clipped).toBe(false);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
