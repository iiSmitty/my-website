const { test, expect } = require('@playwright/test');

// The window manager (js/window-manager.js) and the taskbar and Start menu
// (js/taskbar.js) on the home page's desktop.

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const taskbar = (page) => page.getByRole('region', { name: 'Taskbar' });
const taskbarButton = (page, name) => taskbar(page).getByRole('button', { name, exact: true });
const startButton = (page) => page.locator('#taskbarStart');
const startMenu = (page) => page.getByRole('menu', { name: 'Start' });
const mainWindow = (page) => page.locator('.win95-container');

async function openFromStartMenu(page, program) {
    await startButton(page).click();
    await startMenu(page).getByRole('menuitem', { name: 'Programs' }).click();
    await page.getByRole('menu', { name: 'Programs' }).getByRole('menuitem', { name: program }).click();
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the taskbar appears once Windows has started', async ({ page }) => {
        await page.goto('/');
        await expect(taskbar(page)).toBeHidden();

        await page.locator('#start-windows').click();
        await expect(taskbar(page)).toBeVisible();
        await expect(taskbarButton(page, 'Windows 95')).toHaveAttribute('aria-pressed', 'true');
        await expect(taskbar(page).locator('.taskbar-clock')).toHaveText(/\d{1,2}:\d{2}/);

        // The page isn't hidden behind it
        const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
        expect(padding).toBeGreaterThanOrEqual(28);
    });

    test('the Start menu opens every program, sorted by name', async ({ page }) => {
        await boot(page);
        await startButton(page).click();
        await expect(startMenu(page)).toBeVisible();
        await expect(startButton(page)).toHaveAttribute('aria-expanded', 'true');

        await startMenu(page).getByRole('menuitem', { name: 'Programs' }).hover();
        const programs = page.getByRole('menu', { name: 'Programs' });
        await expect(programs).toBeVisible();
        // The Recycle Bin is an easter egg, so it isn't listed
        await expect(programs.getByRole('menuitem')).toHaveText([
            'Dev Community', 'Experience', 'My Computer', 'Source Code', 'Spotify', 'Task Manager', 'Videos'
        ]);

        await programs.getByRole('menuitem', { name: 'Spotify' }).click();
        await expect(startMenu(page)).toBeHidden();
        await expect(page.locator('#spotifyWindow')).toBeVisible();
        await expect(taskbarButton(page, 'Spotify')).toHaveAttribute('aria-pressed', 'true');
        await expect(taskbarButton(page, 'Windows 95')).toHaveAttribute('aria-pressed', 'false');
    });

    test('a submenu too tall for the space below it moves up to stay on screen', async ({ page }) => {
        // Short enough that Programs would run past the taskbar
        await page.setViewportSize({ width: 1280, height: 600 });
        await boot(page);
        await startButton(page).click();
        await startMenu(page).getByRole('menuitem', { name: 'Programs' }).hover();

        const programs = await page.getByRole('menu', { name: 'Programs' }).boundingBox();
        const bar = await taskbar(page).boundingBox();
        expect(programs.y).toBeGreaterThanOrEqual(0);
        expect(programs.y + programs.height).toBeLessThanOrEqual(bar.y + 1);
    });

    test('Favorites are real links', async ({ page }) => {
        await boot(page);
        await startButton(page).click();
        await startMenu(page).getByRole('menuitem', { name: 'Favorites' }).click();

        const linkedIn = page.getByRole('menu', { name: 'Favorites' }).getByRole('menuitem', { name: 'LinkedIn Profile' });
        await expect(linkedIn).toHaveAttribute('href', 'https://www.linkedin.com/in/andrezsmit/');
        await expect(linkedIn).toHaveAttribute('target', '_blank');
        await expect(linkedIn).toHaveAttribute('rel', /noopener/);
    });

    test('Shut Down asks before shutting down', async ({ page }) => {
        await boot(page);
        await startButton(page).click();
        await startMenu(page).getByRole('menuitem', { name: 'Shut Down...' }).click();
        await expect(page.getByText('Are you sure you want to shut down this website?')).toBeVisible();
    });

    test('the Start menu works from the keyboard', async ({ page }) => {
        await boot(page);
        await startButton(page).focus();
        await page.keyboard.press('Enter');
        await expect(startMenu(page).getByRole('menuitem', { name: 'Programs' })).toBeFocused();

        await page.keyboard.press('ArrowRight');
        const programs = page.getByRole('menu', { name: 'Programs' });
        await expect(programs.getByRole('menuitem', { name: 'Dev Community' })).toBeFocused();

        // A letter jumps to the next program starting with it
        await page.keyboard.press('m');
        await expect(programs.getByRole('menuitem', { name: 'My Computer' })).toBeFocused();

        // Left steps back out of the submenu, Escape closes the menu
        await page.keyboard.press('ArrowLeft');
        await expect(programs).toBeHidden();
        await expect(startMenu(page).getByRole('menuitem', { name: 'Programs' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(startMenu(page)).toBeHidden();
        await expect(startButton(page)).toBeFocused();

        // The underlined letter chooses an item: P opens Programs
        await page.keyboard.press('Enter');
        await page.keyboard.press('p');
        await expect(programs.getByRole('menuitem', { name: 'Dev Community' })).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog', { name: 'Videos' })).toBeVisible();
    });

    test('clicking elsewhere closes the Start menu', async ({ page }) => {
        await boot(page);
        await startButton(page).click();
        await expect(startMenu(page)).toBeVisible();
        await page.mouse.click(1000, 600);
        await expect(startMenu(page)).toBeHidden();
    });

    test('minimize sends a window to the taskbar, and its button brings it back', async ({ page }) => {
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'My Computer' }).dblclick();
        const myComputer = page.locator('#myTechWindow');
        await expect(myComputer).toBeVisible();

        await myComputer.getByRole('button', { name: 'Minimize' }).click();
        await expect(myComputer).toBeHidden();
        // Focus waits on the window's button rather than getting lost
        await expect(taskbarButton(page, 'My Computer')).toBeFocused();
        await expect(taskbarButton(page, 'My Computer')).toHaveAttribute('aria-pressed', 'false');

        await taskbarButton(page, 'My Computer').click();
        await expect(myComputer).toBeVisible();
        await expect(taskbarButton(page, 'My Computer')).toHaveAttribute('aria-pressed', 'true');

        // Clicking the button of the window in front minimizes it
        await taskbarButton(page, 'My Computer').click();
        await expect(myComputer).toBeHidden();

        // Opening it again restores it
        await page.locator('.desktop-icon', { hasText: 'My Computer' }).dblclick();
        await expect(myComputer).toBeVisible();
    });

    test('closing a window removes its taskbar button', async ({ page }) => {
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'Dev Community' }).dblclick();
        await expect(taskbarButton(page, 'Join Our Dev Community')).toBeVisible();

        await page.locator('#slackWindow').getByRole('button', { name: 'Maybe Later' }).click();
        await expect(page.locator('#slackWindow')).toBeHidden();
        await expect(taskbarButton(page, 'Join Our Dev Community')).toHaveCount(0);
        await expect(taskbarButton(page, 'Windows 95')).toHaveAttribute('aria-pressed', 'true');
    });

    test('the window you click comes to the front, and only it has a blue title bar', async ({ page }) => {
        await boot(page);
        await openFromStartMenu(page, 'My Computer');
        await openFromStartMenu(page, 'Dev Community');

        const myComputer = page.locator('#myTechWindow');
        const slack = page.locator('#slackWindow');
        const zIndex = (locator) => locator.evaluate((element) => Number(getComputedStyle(element).zIndex));

        expect(await zIndex(slack)).toBeGreaterThan(await zIndex(myComputer));
        await expect(myComputer).toHaveClass(/is-inactive/);
        await expect(mainWindow(page)).toHaveClass(/is-inactive/);

        // The left end of its title bar is the bit the Slack window doesn't cover
        const box = await myComputer.boundingBox();
        await page.mouse.click(box.x + 20, box.y + 40);
        expect(await zIndex(myComputer)).toBeGreaterThan(await zIndex(slack));
        await expect(myComputer).not.toHaveClass(/is-inactive/);
        await expect(slack).toHaveClass(/is-inactive/);
        await expect(taskbarButton(page, 'My Computer')).toHaveAttribute('aria-pressed', 'true');

        // Clicking the desktop leaves no window active
        await page.mouse.click(1000, 700);
        await expect(myComputer).toHaveClass(/is-inactive/);
        await expect(taskbar(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    });

    test('a window is dragged by its title bar, but never above the top of the screen', async ({ page }) => {
        await boot(page);
        await openFromStartMenu(page, 'My Computer');
        const myComputer = page.locator('#myTechWindow');
        const before = await myComputer.boundingBox();

        const title = myComputer.locator('.win95-title');
        const grip = await title.boundingBox();
        await page.mouse.move(grip.x + 40, grip.y + 5);
        await page.mouse.down();
        await page.mouse.move(grip.x + 240, grip.y + 105, { steps: 5 });
        await page.mouse.up();

        const after = await myComputer.boundingBox();
        expect(Math.round(after.x - before.x)).toBe(200);
        expect(Math.round(after.y - before.y)).toBe(100);

        await page.mouse.move(after.x + 40, after.y + 5);
        await page.mouse.down();
        await page.mouse.move(after.x + 40, -200, { steps: 5 });
        await page.mouse.up();
        expect((await myComputer.boundingBox()).y).toBe(0);
    });

    test('a fixed-size window can\'t be maximized, a resizable one can', async ({ page }) => {
        await boot(page);
        await openFromStartMenu(page, 'Spotify');
        await expect(page.locator('#spotifyWindow').getByRole('button', { name: /Maximize/ })).toBeDisabled();

        await openFromStartMenu(page, 'Experience');
        const experience = page.locator('#experienceWindow');
        await experience.locator('.win95-title').dblclick();
        await expect(experience).toHaveClass(/is-maximized/);
        const box = await experience.boundingBox();
        expect(box.x).toBe(0);
        expect(box.y).toBe(0);
        // It stops at the taskbar
        expect(Math.round(box.height)).toBe(800 - 28);

        await experience.getByRole('button', { name: 'Restore' }).click();
        await expect(experience).not.toHaveClass(/is-maximized/);
    });

    test('the main window minimizes to the taskbar', async ({ page }) => {
        await boot(page);
        await mainWindow(page).getByRole('button', { name: 'Minimize' }).click();
        await expect(mainWindow(page)).toBeHidden();
        // The desktop icons belong to the desktop, so they stay
        await expect(page.locator('.desktop-icon', { hasText: 'My Computer' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Restore Window' })).toHaveCount(0);

        await taskbarButton(page, 'Windows 95').click();
        await expect(mainWindow(page)).toBeVisible();
    });

    test('windows built on first open join the taskbar too', async ({ page }) => {
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();
        const skype = page.locator('#skypeWindow');
        await expect(skype).toBeVisible();
        await expect(taskbarButton(page, 'Skype™ - andrez.smit')).toHaveAttribute('aria-pressed', 'true');

        await skype.getByRole('button', { name: 'Minimize' }).click();
        await expect(skype).toBeHidden();

        // Re-opening a minimized window restores it rather than starting over
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();
        await expect(skype).toBeVisible();
        await expect(skype.locator('.skype-message--new')).toContainText('back', { timeout: 10000 });
    });

    test('programs still open from the Start menu after the desktop icons are deleted', async ({ page }) => {
        await boot(page);
        const icon = page.locator('.desktop-icon', { hasText: 'My Computer' });
        await icon.click();
        await page.keyboard.press('Delete');
        await expect(icon).toHaveCount(0);

        await openFromStartMenu(page, 'My Computer');
        await expect(page.locator('#myTechWindow')).toBeVisible();
    });
});

test.describe('touch device', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('has no taskbar, like it has no desktop icons', async ({ page }) => {
        await boot(page);
        await expect(taskbar(page)).toBeHidden();
        const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
        expect(padding).toBeLessThan(28);
    });
});
