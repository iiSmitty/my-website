const { test, expect } = require('@playwright/test');

// The home page's identity block, and How This Site Works: its WinHelp-style
// topics, and the ways in (the Help menu, the Start menu, the identity's link,
// and a link straight to /#how-it-works).

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const helpHeading = (page) => page.getByRole('heading', { name: 'How This Site Works' });
const topic = (page, name) => page.locator('.help-topic', { has: page.locator('summary', { hasText: name }) });

// Where the section sits in the main window's scrolling content
async function offsetInWindow(page) {
    return page.evaluate(() => {
        const content = document.querySelector('.win95-container > .win95-content');
        return document.getElementById('how-it-works').getBoundingClientRect().top - content.getBoundingClientRect().top;
    });
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('says who this is before the profile is loaded', async ({ page }) => {
        await boot(page);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('André Smit');
        await expect(page.locator('.identity-tagline')).toHaveText('Problem Solver');
        // What it says is checked against the experience page in current-role.spec.js
        await expect(page.locator('.identity-specs dt')).toHaveText(['Now', 'Works in', 'Developing since', 'This site']);
        await expect(page.locator('#mainProfileContent')).toBeHidden();
    });

    test('the floppy loads from the keyboard', async ({ page }) => {
        await boot(page);
        const floppy = page.getByRole('button', { name: /Click to Load Profile/ });
        await floppy.focus();
        await page.keyboard.press('Enter');

        await expect(page.locator('#mainProfileContent')).toBeVisible();
        // Focus moves into the profile rather than staying on the disk as it goes
        await expect(page.locator('#mainProfileContent')).toBeFocused();
        await expect(page.locator('#floppyLoader')).not.toHaveAttribute('tabindex');
    });

    test('Help > How This Site Works loads the profile and lands on the section', async ({ page }) => {
        await boot(page);
        await page.locator('.win95-container .win95-menu-item', { hasText: 'Help' }).click();
        await page.locator('.win95-dropdown-item', { hasText: 'How This Site Works' }).click();

        await expect(helpHeading(page)).toBeFocused();
        // The disk is gone at once, so nothing moves the section afterwards
        await expect(page.locator('#floppyLoader')).toHaveCount(0);
        expect(Math.round(await offsetInWindow(page))).toBe(12);
    });

    test('the Start menu has Help too', async ({ page }) => {
        await boot(page);
        await page.locator('#taskbarStart').click();
        await page.getByRole('menu', { name: 'Start' }).getByRole('menuitem', { name: 'Help' }).click();
        await expect(helpHeading(page)).toBeFocused();
    });

    test('a book opens to its topic, and its shortcut opens the window it talks about', async ({ page }) => {
        await boot(page);
        await page.locator('.identity').getByRole('link', { name: 'how it works' }).click();

        const windowManager = topic(page, 'A window manager, written from scratch');
        await expect(windowManager.locator('.help-page')).toBeHidden();
        await windowManager.locator('summary').click();
        await expect(windowManager.locator('.help-page')).toBeVisible();
        await expect(windowManager).toHaveJSProperty('open', true);

        await windowManager.getByRole('button', { name: 'Open the Experience window' }).click();
        await expect(page.locator('#experienceWindow')).toBeVisible();
    });

    test('source links go to the repository on GitHub, in a new tab', async ({ page }) => {
        await boot(page);
        const links = page.locator('.help-shortcut[target="_blank"]');
        expect(await links.count()).toBeGreaterThan(0);
        for (const href of await links.evaluateAll(els => els.map(el => el.href))) {
            expect(href).toMatch(/^https:\/\/github\.com\/iiSmitty\/my-website\//);
        }
        await expect(links.first()).toHaveAttribute('rel', /noopener/);
    });

    test('another page\'s Help menu lands on the section, with no startup or floppy', async ({ page }) => {
        await page.goto('/experience');
        await page.locator('.win95-menu-item', { hasText: 'Help' }).click();
        await page.locator('.win95-dropdown-item', { hasText: 'How This Site Works' }).click();

        await expect(page).toHaveURL(/\/#how-it-works$/);
        // The URL changes before the new page's scripts have run
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#start-windows')).toHaveCount(0);
        await expect(page.locator('#floppyLoader')).toHaveCount(0);
        await expect(helpHeading(page)).toBeInViewport();
        expect(Math.round(await offsetInWindow(page))).toBe(12);
    });

    test('a shared link to the section lands on it once Windows has started', async ({ page }) => {
        await page.goto('/#how-it-works');
        await page.locator('#start-windows').click();
        await expect(helpHeading(page)).toBeInViewport();
    });
});

test.describe('touch', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('topics read on a phone, without the desktop-only shortcuts', async ({ page }) => {
        await boot(page);
        await page.locator('.identity').getByRole('link', { name: 'how it works' }).click();
        await expect(helpHeading(page)).toBeFocused();

        const data = topic(page, 'Data that keeps itself fresh');
        await data.locator('summary').click();
        await expect(data.getByRole('link', { name: 'Browse the workflows' })).toBeVisible();
        await expect(data.getByRole('button', { name: /Open Task Manager/ })).toBeHidden();

        // Nothing wider than the screen
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
