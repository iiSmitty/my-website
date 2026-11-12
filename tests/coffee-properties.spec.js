const { test, expect, expectCentered } = require('./fixtures');
const { fastForwardUntil } = require('./contact-helpers');

// Coffee Properties (js/coffee-properties.js): how I take my coffee, as a
// Win95 property sheet opened from Coffee Analytics on the home page.

// Startup, the floppy loader and the reveal come first: among the longest
// flows in the suite, so they get Playwright's tripled timeout under parallel load
test.slow();

// Starts Windows and loads the floppy, which reveals the profile Coffee
// Analytics is in
async function boot(page) {
    await page.clock.install();
    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('#floppyLoader').click();
    await fastForwardUntil(page, () => page.locator('#coffee-properties-button').isVisible(), true);
}

const propertiesButton = (page) => page.getByRole('button', { name: 'Properties...' });
const sheet = (page) => page.getByRole('dialog', { name: 'Coffee Properties' });
const tab = (page, name) => sheet(page).getByRole('tab', { name });
const roast = (page) => sheet(page).getByRole('slider');

async function openOnTab(page, name) {
    await propertiesButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await tab(page, name).click();
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until opened', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await boot(page);

        expect(requested.filter((url) => /coffee-properties\.min\.css/.test(url))).toEqual([]);
        await expect(page.locator('#coffeeProperties')).toHaveCount(0);
    });

    test('opens on General: at home, out, and the favourites', async ({ page }) => {
        await boot(page);
        await propertiesButton(page).click();

        await expect(sheet(page)).toBeVisible();
        await expectCentered(sheet(page));
        await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
        await expect(tab(page, 'General')).toBeFocused();

        const general = sheet(page).getByRole('tabpanel', { name: 'General' });
        const atHome = general.getByRole('group', { name: 'At home' });
        await expect(atHome).toContainText('Instant');
        await expect(atHome).toContainText('Woolworths Italian Blend, Nescafé Crema');
        await expect(atHome).toContainText('Milky, smooth, mild');

        const out = general.getByRole('group', { name: 'Out' });
        await expect(out).toContainText('Cappuccino with wings');
        await expect(out).toContainText('Seattle, Bootlegger, Woolworths, Platō');
        await expect(out).toContainText('With wings: South African for takeaway.');

        await expect(general.getByRole('list', { name: 'Favourites:' }).getByRole('listitem')).toHaveText([
            'Truth Coffee',
            'Origin Coffee Roasting (tasting)',
            /^Choir Speciality Coffee\s+★\s+Best cup so far$/
        ]);
    });

    test('the tabs switch by click and from the keyboard', async ({ page }) => {
        await boot(page);
        await openOnTab(page, 'Roast');
        await expect(sheet(page).getByRole('tabpanel', { name: 'Roast' })).toBeVisible();
        await expect(sheet(page).getByRole('tabpanel', { name: 'General' })).toBeHidden();

        await page.keyboard.press('ArrowRight');
        await expect(tab(page, 'Additives')).toBeFocused();
        await expect(sheet(page).getByRole('tabpanel', { name: 'Additives' })).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('End');
        await expect(sheet(page).getByRole('tabpanel', { name: 'Additives' })).toBeVisible();
        await page.keyboard.press('Home');
        await expect(sheet(page).getByRole('tabpanel', { name: 'General' })).toBeVisible();
    });

    test('milk, lots; sugar has been disabled by the administrator', async ({ page }) => {
        await boot(page);
        await openOnTab(page, 'Additives');

        await expect(sheet(page).getByRole('checkbox', { name: 'Milk (lots)' })).toBeChecked();

        const sugar = sheet(page).getByRole('checkbox', { name: 'Sugar' });
        await expect(sugar).toBeDisabled();
        await expect(sugar).not.toBeChecked();
        await expect(sugar).toHaveAccessibleDescription('This option has been disabled by your administrator.');

        // The tooltip only shows on hover. The disabled box gets no mouse
        // events, so it's the wrapper that's hovered.
        const tooltip = sheet(page).getByRole('tooltip');
        await expect(tooltip).toBeHidden();
        await sheet(page).locator('#coffeeSugar').hover();
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toHaveText('This option has been disabled by your administrator.');
        await sheet(page).getByRole('checkbox', { name: 'Milk (lots)' }).hover();
        await expect(tooltip).toBeHidden();
    });

    test('dark roast performs an illegal operation, then the slider snaps back to Medium', async ({ page }) => {
        await boot(page);
        await openOnTab(page, 'Roast');
        await expect(roast(page)).toHaveValue('1');
        await expect(roast(page)).toHaveAttribute('aria-valuetext', 'Medium');

        await roast(page).fill('2');
        const crash = page.getByRole('alertdialog', { name: 'DARKROAST' });
        await expect(crash).toBeVisible();
        await expect(crash).toHaveAccessibleDescription(
            'Dark roast has performed an illegal operation and will be shut down. If the problem persists, try Medium.');
        // It waits on Dark while the error is up
        await expect(roast(page)).toHaveValue('2');

        await crash.getByRole('button', { name: 'Close' }).click();
        await expect(crash).toBeHidden();
        await expect(roast(page)).toHaveValue('1');
        await expect(roast(page)).toHaveAttribute('aria-valuetext', 'Medium');
        await expect(roast(page)).toBeFocused();
        await expect(sheet(page)).toBeVisible();
    });

    test('light roast is a bit light, and Escape only closes the message', async ({ page }) => {
        await boot(page);
        await openOnTab(page, 'Roast');

        await roast(page).focus();
        await page.keyboard.press('ArrowLeft');
        const message = page.getByRole('alertdialog', { name: 'Roast' });
        await expect(message).toBeVisible();
        await expect(message).toContainText('That\'s a bit light. Medium is just right.');

        await page.keyboard.press('Escape');
        await expect(message).toBeHidden();
        await expect(sheet(page)).toBeVisible();
        await expect(roast(page)).toHaveValue('1');
    });

    test('OK, Cancel, Escape and the close button all close it, and focus goes back to Properties...', async ({ page }) => {
        await boot(page);
        const closers = [
            () => sheet(page).getByRole('button', { name: 'OK' }).click(),
            () => sheet(page).getByRole('button', { name: 'Cancel' }).click(),
            () => page.keyboard.press('Escape'),
            () => sheet(page).getByRole('button', { name: 'Close' }).click(),
            // The backdrop
            () => page.locator('#coffeeProperties').click({ position: { x: 5, y: 5 } })
        ];
        for (const close of closers) {
            await propertiesButton(page).click();
            await expect(sheet(page)).toBeVisible();
            await close();
            await expect(sheet(page)).toBeHidden();
            await expect(propertiesButton(page)).toBeFocused();
        }
        await expect(page.locator('link[href="css/coffee-properties.min.css"]')).toHaveCount(1);
    });

    test('Apply wakes up when milk changes; Cancel forgets it, OK and Enter keep it', async ({ page }) => {
        await boot(page);
        const milk = sheet(page).getByRole('checkbox', { name: 'Milk (lots)' });
        const apply = sheet(page).getByRole('button', { name: 'Apply' });

        await openOnTab(page, 'Additives');
        await expect(apply).toBeDisabled();
        await milk.uncheck();
        await expect(apply).toBeEnabled();
        await sheet(page).getByRole('button', { name: 'Cancel' }).click();

        await openOnTab(page, 'Additives');
        await expect(milk).toBeChecked();
        await milk.uncheck();
        await apply.click();
        await expect(apply).toBeDisabled();
        await sheet(page).getByRole('button', { name: 'OK' }).click();

        await openOnTab(page, 'Additives');
        await expect(milk).not.toBeChecked();
        // Enter presses OK, the default button
        await milk.check();
        await page.keyboard.press('Enter');
        await expect(sheet(page)).toBeHidden();

        await openOnTab(page, 'Additives');
        await expect(milk).toBeChecked();
    });

    test('Tab stays inside the sheet', async ({ page }) => {
        await boot(page);
        await propertiesButton(page).click();
        await expect(tab(page, 'General')).toBeFocused();

        // General has nothing to tab to, so: OK, Cancel (Apply is greyed out), and round again
        await page.keyboard.press('Tab');
        await expect(sheet(page).getByRole('button', { name: 'OK' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(sheet(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(sheet(page).getByRole('button', { name: 'Close' })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(sheet(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
    });
});

test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('the button and the sheet fit without scrolling sideways', async ({ page }) => {
        await boot(page);
        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(await overflow()).toBeLessThanOrEqual(0);

        await propertiesButton(page).click();
        await expect(sheet(page)).toBeVisible();
        const box = await sheet(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        expect(await overflow()).toBeLessThanOrEqual(0);
    });
});
