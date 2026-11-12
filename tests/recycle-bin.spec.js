const { test, expect, expectCentered } = require('./fixtures');

// The Recycle Bin (js/recycle-bin.js): a folder of things that were deleted
// but never quite went away. Each item opens something: the Skype easter egg
// (skype.spec.js has the rest of it) or a message box about a coffee routine.

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const recycleBin = (page) => page.getByRole('dialog', { name: 'Recycle Bin' });
const item = (page, name) => page.locator('#recycleBinItems tr', { hasText: name });
const openRecycleBin = (page) => page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until opened', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await boot(page);
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /recycle-bin\.min\.css/.test(url))).toEqual([]);
        await expect(page.locator('#recycleBinWindow')).toHaveCount(0);
    });

    test('lists the deleted items with where they came from and when they went', async ({ page }) => {
        await boot(page);
        await openRecycleBin(page);

        await expect(recycleBin(page)).toBeVisible();
        await expectCentered(recycleBin(page));
        await expect(recycleBin(page).getByRole('columnheader')).toHaveText(
            ['Name', 'Original Location', 'Date Deleted', 'Type', 'Size']);
        await expect(page.locator('#recycleBinItems tr')).toHaveCount(3);

        await expect(item(page, 'andrez.smit').locator('td')).toHaveText(
            ['andrez.smit', 'A friend\'s contact list', '03/08/2014 18:00', 'Skype Contact', '8 messages']);
        await expect(item(page, 'filter-routine.exe').locator('td')).toHaveText(
            ['filter-routine.exe', 'C:\\Kitchen\\Mornings', 'A Monday, 06:12', 'Application', 'Too many steps']);
        await expect(item(page, 'bluebird-beans.bag').locator('td')).toHaveText(
            ['bluebird-beans.bag', 'C:\\Kitchen\\Cupboard', 'A Monday, 06:13', 'BAG File', '1 bag']);
        await expect(recycleBin(page)).toContainText('3 object(s)');

        // The first item is selected, with focus, ready for Enter
        await expect(item(page, 'andrez.smit')).toBeFocused();
        await expect(item(page, 'andrez.smit')).toHaveAttribute('aria-selected', 'true');

        // A click selects one item at a time
        await item(page, 'bluebird-beans.bag').click();
        await expect(item(page, 'bluebird-beans.bag')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#recycleBinItems tr[aria-selected="true"]')).toHaveCount(1);
    });

    test('the Skype contact opens Skype, and closing it comes back to the bin', async ({ page }) => {
        await boot(page);
        await openRecycleBin(page);
        await item(page, 'andrez.smit').dblclick();

        const skypeWindow = page.getByRole('dialog', { name: 'Skype™ - andrez.smit' });
        await expect(skypeWindow).toBeVisible();
        await expect(skypeWindow).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(skypeWindow).toBeHidden();
        await expect(recycleBin(page)).toBeVisible();
        await expect(item(page, 'andrez.smit')).toBeFocused();
    });

    test('filter-routine.exe says convenience won', async ({ page }) => {
        await boot(page);
        await openRecycleBin(page);
        await item(page, 'filter-routine.exe').dblclick();

        const message = page.getByRole('alertdialog', { name: 'filter-routine.exe' });
        await expect(message).toBeVisible();
        await expect(message).toHaveAccessibleDescription(
            'Deleted: convenience won. Required a filter machine, Bluebird Coffee beans and a routine. ' +
            'Replaced by instant, which requires a kettle.');
        await expect(message.getByRole('button', { name: 'OK' })).toBeFocused();

        await message.getByRole('button', { name: 'OK' }).click();
        await expect(message).toBeHidden();
        await expect(item(page, 'filter-routine.exe')).toBeFocused();
    });

    test('bluebird-beans.bag opens from the keyboard, and needs the routine', async ({ page }) => {
        await boot(page);
        await openRecycleBin(page);
        await expect(item(page, 'andrez.smit')).toBeFocused();

        await page.keyboard.press('End');
        await expect(item(page, 'bluebird-beans.bag')).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect(item(page, 'filter-routine.exe')).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        const message = page.getByRole('alertdialog', { name: 'bluebird-beans.bag' });
        await expect(message).toBeVisible();
        await expect(message).toContainText('Cannot open bluebird-beans.bag.');
        await expect(message).toContainText('It needs filter-routine.exe, which is in the Recycle Bin.');

        // Escape closes the message, not the bin behind it
        await page.keyboard.press('Escape');
        await expect(message).toBeHidden();
        await expect(recycleBin(page)).toBeVisible();
        await expect(item(page, 'bluebird-beans.bag')).toBeFocused();
    });

    test('Escape or the close button closes the bin, and it joins the taskbar meanwhile', async ({ page }) => {
        await boot(page);
        await openRecycleBin(page);
        const taskbarButton = page.getByRole('region', { name: 'Taskbar' }).getByRole('button', { name: 'Recycle Bin', exact: true });
        await expect(taskbarButton).toHaveAttribute('aria-pressed', 'true');

        await page.keyboard.press('Escape');
        await expect(recycleBin(page)).toBeHidden();
        await expect(taskbarButton).toHaveCount(0);

        await openRecycleBin(page);
        await expect(recycleBin(page)).toBeVisible();
        await recycleBin(page).getByRole('button', { name: 'Close' }).click();
        await expect(recycleBin(page)).toBeHidden();

        // Opening it again doesn't add its stylesheet again
        await openRecycleBin(page);
        await expect(recycleBin(page)).toBeVisible();
        await expect(page.locator('link[href="css/recycle-bin.min.css"]')).toHaveCount(1);
    });
});
