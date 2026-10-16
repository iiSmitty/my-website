const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// What I Do on the home page: three programs, each telling what I work on
// when chosen (js/program-icons.js).

async function bootWithProfile(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('#floppyLoader').click();
    await expect(page.locator('#mainProfileContent')).toBeVisible();
}

const program = (page, name) => page.getByRole('button', { name, exact: true });
const infoBox = (page) => page.locator('#infoBox');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('each program tells its story, and only the chosen one is highlighted', async ({ page }) => {
        await bootWithProfile(page);
        await expect(infoBox(page)).toHaveText('Click an icon to see what I work on.');
        await expect(page.locator('.program-item')).toHaveCount(3);

        await program(page, 'Integration.dll').click();
        // Shown as the file's Properties: name, then Type, Location and Modified, then the story
        await expect(infoBox(page).locator('.file-props-name')).toHaveText('Integration.dll');
        await expect(infoBox(page).locator('.file-props-fields dt')).toHaveText(['Type:', 'Location:', 'Modified:']);
        await expect(infoBox(page).locator('.file-props-fields dd').first()).toHaveText('Application extension');
        await expect(infoBox(page).getByRole('img', { name: 'Access is denied' })).toBeVisible();
        await expect(infoBox(page)).toContainText('integration developer at Interfront');
        await expect(infoBox(page).locator('.access-denied')).toHaveText('Access is denied.');
        await expect(program(page, 'Integration.dll')).toHaveAttribute('aria-pressed', 'true');

        await program(page, 'OutSystems.oml').click();
        await expect(infoBox(page)).toContainText('document management system');
        await expect(program(page, 'OutSystems.oml')).toHaveAttribute('aria-pressed', 'true');
        await expect(program(page, 'Integration.dll')).toHaveAttribute('aria-pressed', 'false');
    });

    test('programs are chosen from the keyboard too', async ({ page }) => {
        await bootWithProfile(page);
        await program(page, 'Claude.exe').focus();
        await page.keyboard.press('Enter');
        await expect(infoBox(page)).toContainText('use Claude well');
    });

    test('links in a story open in a new tab', async ({ page }) => {
        await bootWithProfile(page);
        await program(page, 'OutSystems.oml').click();

        const mentor = infoBox(page).getByRole('link', { name: 'Daniël Kuhlmann' });
        await expect(mentor).toHaveAttribute('href', 'https://adplist.org/mentors/daniel-kuhlmann');
        for (const link of await infoBox(page).getByRole('link').all()) {
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', /noopener/);
        }
    });
});

// Which system I work on isn't mine to name. Read from disk, so it covers
// everything that ships, not only what a page happens to load.
test('the system I work on is never named in the shipped source', () => {
    const root = path.join(__dirname, '..');
    const shipped = [
        ...fs.readdirSync(root).filter(file => file.endsWith('.html')),
        ...['js', 'css'].flatMap(dir => fs.readdirSync(path.join(root, dir))
            .filter(file => !file.includes('.min.'))
            .map(file => path.join(dir, file)))
    ];
    for (const file of shipped) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        expect(source, file).not.toMatch(/\bSARS\b|e-?filing/i);
    }
});
