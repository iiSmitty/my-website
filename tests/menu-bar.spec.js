const { test, expect } = require('./fixtures');

// The main window's menu bar (js/win95-components.js): File and Help drop
// down, by mouse or with Alt and a letter. And the status bar under it.

// Coming from another page of the site, so Windows has already started
const FROM_THE_SITE = { referer: 'http://localhost:3000/' };

const menuBar = (page) => page.locator('.win95-container .win95-menu-bar').first();
const menu = (page, name) => menuBar(page).locator('.win95-menu-item', { hasText: name });
const openDropdown = (page) => page.locator('.win95-dropdown-content.show');
const dropdownItems = (page) => openDropdown(page).locator('.win95-dropdown-item');
const shutDownQuestion = (page) => page.getByText('Are you sure you want to shut down this website?');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test.describe('home page', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/', FROM_THE_SITE);
            await expect(menuBar(page)).toBeVisible();
        });

        test('File lists the pages and marks this one; a second click or a click elsewhere closes it', async ({ page }) => {
            await menu(page, 'File').click();
            await expect(dropdownItems(page)).toHaveText(['Home', 'Work Experience', 'Strava PBs', 'LinkedIn Profile', 'Exit']);
            await expect(dropdownItems(page).filter({ hasText: 'Home' })).toHaveClass(/active-dropdown-item/);
            await expect(dropdownItems(page).filter({ hasText: 'Work Experience' })).not.toHaveClass(/active-dropdown-item/);

            await menu(page, 'File').click();
            await expect(openDropdown(page)).toHaveCount(0);

            await menu(page, 'File').click();
            await page.locator('.win95-container .win95-title').first().click();
            await expect(openDropdown(page)).toHaveCount(0);
        });

        test('opening Help closes File', async ({ page }) => {
            await menu(page, 'File').click();
            await menu(page, 'Help').click();
            await expect(openDropdown(page)).toHaveCount(1);
            await expect(dropdownItems(page)).toHaveText(['How This Site Works']);
        });

        test('each menu and item underlines its access key', async ({ page }) => {
            const underlined = (locator) => locator.locator('span span');
            await expect(underlined(menu(page, 'File'))).toHaveText('F');
            await expect(underlined(menu(page, 'File'))).toHaveCSS('text-decoration-line', 'underline');
            await expect(underlined(menu(page, 'Help'))).toHaveText('H');

            await menu(page, 'File').click();
            await expect(underlined(dropdownItems(page).filter({ hasText: 'Exit' }))).toHaveText('x');
            await expect(underlined(dropdownItems(page).filter({ hasText: 'Strava PBs' }))).toHaveText('S');
            await menu(page, 'Help').click();
            // The first w in the name, which is How's
            await expect(dropdownItems(page).locator('span span')).toHaveText('w');
            await expect(dropdownItems(page)).toHaveText('How This Site Works');
        });

        test('Alt and a letter open a menu, the arrow keys move through it, and Enter chooses', async ({ page }) => {
            await page.keyboard.press('Alt+f');
            await expect(dropdownItems(page)).toHaveCount(5);

            await page.keyboard.press('ArrowDown');
            const home = dropdownItems(page).nth(0);
            await expect(home).toHaveClass(/keyboard-focused/);
            await expect(home).toHaveCSS('background-color', 'rgb(0, 0, 128)');
            await expect(home).toHaveCSS('color', 'rgb(255, 255, 255)');

            await page.keyboard.press('ArrowDown');
            await expect(dropdownItems(page).nth(1)).toHaveClass(/keyboard-focused/);
            await expect(home).not.toHaveClass(/keyboard-focused/);

            // Up from the top wraps to the bottom
            await page.keyboard.press('ArrowUp');
            await page.keyboard.press('ArrowUp');
            await expect(dropdownItems(page).filter({ hasText: 'Exit' })).toHaveClass(/keyboard-focused/);
            await expect(page.locator('.keyboard-focused')).toHaveCount(1);

            await page.keyboard.press('Enter');
            await expect(shutDownQuestion(page)).toBeVisible();
            await expect(openDropdown(page)).toHaveCount(0);
        });

        test('Escape closes the menu, and an item\'s letter chooses it', async ({ page }) => {
            await page.keyboard.press('Alt+f');
            await expect(openDropdown(page)).toHaveCount(1);
            await page.keyboard.press('Escape');
            await expect(openDropdown(page)).toHaveCount(0);

            await page.keyboard.press('Alt+f');
            await page.keyboard.press('x');
            await expect(shutDownQuestion(page)).toBeVisible();
        });

        test('Alt+H then W opens How This Site Works', async ({ page }) => {
            await page.keyboard.press('Alt+h');
            await expect(dropdownItems(page)).toHaveText(['How This Site Works']);
            await page.keyboard.press('w');
            await expect(page.getByRole('heading', { name: 'How This Site Works' })).toBeInViewport();
        });

        test('Edit and View go nowhere', async ({ page }) => {
            await menu(page, 'Edit').click();
            await expect(page).toHaveURL(/\/#$/);
            await page.keyboard.press('Alt+v');
            await expect(page).toHaveURL(/\/#$/);
            await expect(openDropdown(page)).toHaveCount(0);
        });

        test('File > Work Experience goes there, and LinkedIn opens in a new tab', async ({ page, context }) => {
            await context.route('https://www.linkedin.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>LinkedIn</title>' }));
            await menu(page, 'File').click();
            const [linkedIn] = await Promise.all([
                page.waitForEvent('popup'),
                dropdownItems(page).filter({ hasText: 'LinkedIn Profile' }).click()
            ]);
            await expect(linkedIn).toHaveURL('https://www.linkedin.com/in/andrezsmit/');
            await expect(openDropdown(page)).toHaveCount(0);

            await menu(page, 'File').click();
            await dropdownItems(page).filter({ hasText: 'Work Experience' }).click();
            await expect(page).toHaveURL(/\/experience$/);
        });

        test('the status bar', async ({ page }) => {
            const statusBar = page.locator('.win95-container .win95-status-bar').first();
            await expect(statusBar.locator('.status-bar-top .status-item')).toHaveText([
                'Page loaded successfully', 'Visitors: 1,337', 'Last updated: August 24, 1995', 'Cloudflare Pages'
            ]);
            const cloudflare = statusBar.locator('a.status-item');
            await expect(cloudflare).toHaveText('Cloudflare Pages');
            await expect(cloudflare).toHaveAttribute('href', 'https://pages.cloudflare.com');
            await expect(cloudflare).toHaveAttribute('target', '_blank');
            await expect(cloudflare).toHaveAttribute('rel', 'noopener noreferrer');
            await expect(cloudflare).toHaveAttribute('title', 'Hosted on Cloudflare Pages');
            await expect(statusBar.locator('.faith-message a')).toHaveText('Discover His Love');
            await expect(statusBar.locator('.faith-message a')).toHaveAttribute('href', 'https://www.bible.com/');
        });
    });

    test('the Experience page offers Print / Save as PDF', async ({ page }) => {
        await page.goto('/experience.html');
        await page.evaluate(() => { window.print = () => { window.printed = true; }; });
        await menu(page, 'File').click();
        await expect(dropdownItems(page)).toHaveText(['Home', 'Work Experience', 'Strava PBs', 'LinkedIn Profile', 'Print / Save as PDF', 'Exit']);
        await expect(dropdownItems(page).filter({ hasText: 'Work Experience' })).toHaveClass(/active-dropdown-item/);

        await dropdownItems(page).filter({ hasText: 'Print / Save as PDF' }).click();
        expect(await page.evaluate(() => window.printed)).toBe(true);
        await expect(openDropdown(page)).toHaveCount(0);
    });

    test('elsewhere, Help > How This Site Works goes to the home page\'s section', async ({ page }) => {
        await page.goto('/strava-pbs.html', FROM_THE_SITE);
        await menu(page, 'File').click();
        await expect(dropdownItems(page).filter({ hasText: 'Strava PBs' })).toHaveClass(/active-dropdown-item/);

        await menu(page, 'Help').click();
        await dropdownItems(page).click();
        await expect(page).toHaveURL(/\/#how-it-works$/);
    });
});
