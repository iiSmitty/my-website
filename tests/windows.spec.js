const { test, expect } = require('./fixtures');
const { fastForwardUntil } = require('./contact-helpers');

// The home page's simpler desktop windows: Spotify, the GitHub installer
// (Source Code), Dev Community (Slack) and My Computer.

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

const openFromDesktop = (page, name) => page.locator('.desktop-icon', { hasText: name }).dblclick();

// A link out opens in a new tab; answer it locally rather than visit the site
async function expectNewTab(page, url, action) {
    await page.context().route(`${url}**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    const popup = page.waitForEvent('popup');
    await action();
    await expect(await popup).toHaveURL(url);
}

test.describe('desktop', () => {
    test.describe('Spotify', () => {
        const SPOTIFY = {
            topArtists: ['Artist One', 'Artist Two', 'Artist Three', 'Artist Four', 'Artist Five', 'Artist Six']
                .map(name => ({ name, image: 'images/favicon.png' })),
            topTracks: [
                { name: 'First Track', artist: 'First Artist', albumImage: 'images/favicon.png' },
                { name: 'Second Track', artist: 'Second Artist', albumImage: 'images/favicon.png' }
            ],
            // Midday UTC, so it's the 19th in any timezone
            lastUpdated: '2026-10-19T12:00:00Z'
        };

        test('shows the top five artists, the top tracks and when they were updated', async ({ page }) => {
            await page.route('**/data/spotify-data.json', route => route.fulfill({ json: SPOTIFY }));
            await boot(page);
            await openFromDesktop(page, 'Spotify');

            const spotify = page.locator('#spotifyWindow');
            await expect(spotify).toBeVisible();
            await expect(spotify.locator('.artist-name')).toHaveText(
                ['Artist One', 'Artist Two', 'Artist Three', 'Artist Four', 'Artist Five']);
            await expect(spotify.locator('#artist-image-1')).toHaveAttribute('src', 'images/favicon.png');
            await expect(spotify.locator('.spotify-track-item')).toHaveCount(2);
            await expect(spotify.locator('.track-number')).toHaveText(['1', '2']);
            await expect(spotify.locator('.track-name')).toHaveText(['First Track', 'Second Track']);
            await expect(spotify.locator('.track-artist')).toHaveText(['First Artist', 'Second Artist']);
            await expect(spotify.locator('.sync-text-content')).toHaveText(/^LAST UPDATED: 19 OCT, \d{2}:\d{2}$/);
        });

        test('a failed load says so', async ({ page }) => {
            await page.route('**/data/spotify-data.json', route => route.fulfill({ status: 500, body: '' }));
            await boot(page);
            await openFromDesktop(page, 'Spotify');
            await expect(page.locator('#spotifyWindow .sync-text-content')).toHaveText('Error loading data.');
        });
    });

    test.describe('GitHub installer', () => {
        const installer = (page) => page.locator('#githubInstallerWindow');
        const log = (page) => page.locator('#installationLog > div');

        test.beforeEach(async ({ page }) => {
            // A fake clock, so the installer's 13 seconds of steps can be skipped
            await page.clock.install();
            await boot(page);
        });

        test('runs through its steps, then Next opens GitHub in a new tab', async ({ page }) => {
            await openFromDesktop(page, 'Source Code');
            await expect(installer(page)).toBeVisible();
            await expect(page.locator('#nextBtn')).toBeDisabled();

            await fastForwardUntil(page, () => page.locator('#nextBtn').isEnabled(), true);
            await expect(page.locator('#statusText')).toHaveText('Installation complete!');
            await expect(log(page).last()).toHaveText('Ready to connect to GitHub repositories!');
            await expect(log(page).last()).toHaveClass('completed');
            await expect(page.locator('#progressBar')).toHaveAttribute('style', /width: 100%/);
            // The opening line, the twelve steps and the closing line
            await expect(log(page)).toHaveCount(14);

            await expectNewTab(page, 'https://github.com/iiSmitty', () => page.locator('#nextBtn').click());
            await expect(installer(page)).toBeHidden();
        });

        test('closing stops the installation, and opening it again starts over', async ({ page }) => {
            await openFromDesktop(page, 'Source Code');
            await page.clock.runFor(3000);
            const linesWhenClosed = await log(page).count();
            await installer(page).getByRole('button', { name: 'Cancel' }).click();
            await expect(installer(page)).toBeHidden();

            await page.clock.runFor(20000);
            await expect(log(page)).toHaveCount(linesWhenClosed);

            await openFromDesktop(page, 'Source Code');
            await expect(log(page).first()).toHaveText('Starting installation process...');
            await expect(log(page)).toHaveCount(2);
            await expect(page.locator('#nextBtn')).toBeDisabled();
        });
    });

    test.describe('Dev Community', () => {
        const slack = (page) => page.locator('#slackWindow');

        test('Join Community opens the ZATech invite in a new tab and closes the window', async ({ page }) => {
            await boot(page);
            await openFromDesktop(page, 'Dev Community');
            await expect(slack(page)).toBeVisible();

            await expectNewTab(page, 'https://zatech.co.za/',
                () => slack(page).getByRole('button', { name: 'Join Community' }).click());
            await expect(slack(page)).toBeHidden();
        });

        test('Maybe Later just closes it', async ({ page }) => {
            await boot(page);
            await openFromDesktop(page, 'Dev Community');
            await slack(page).getByRole('button', { name: 'Maybe Later' }).click();
            await expect(slack(page)).toBeHidden();
        });
    });

    test.describe('My Computer', () => {
        const myComputer = (page) => page.locator('#myTechWindow');
        const row = (page, name) => myComputer(page).locator('.tech-item', { hasText: name });
        const deadDialog = (page) => page.getByRole('dialog', { name: 'Sony WF-1000XM4 Properties' });

        test.beforeEach(async ({ page }) => {
            await boot(page);
            await openFromDesktop(page, 'My Computer');
            await expect(myComputer(page)).toBeVisible();
        });

        test('counts its devices, and selects one row at a time', async ({ page }) => {
            await expect(page.locator('#tech-item-counter')).toHaveText('9 object(s)');

            await row(page, 'Logitech G305').click();
            await expect(row(page, 'Logitech G305')).toHaveClass(/selected/);
            await row(page, 'Dell U2412M').click();
            await expect(row(page, 'Dell U2412M')).toHaveClass(/selected/);
            await expect(myComputer(page).locator('.tech-item.selected')).toHaveCount(1);
        });

        test('the dead headset explains itself, and OK, Escape or the backdrop dismisses it', async ({ page }) => {
            const headset = row(page, 'Sony WF-1000XM4');

            await headset.click();
            await expect(deadDialog(page)).toBeVisible();
            await expect(deadDialog(page)).toContainText('This device is not working properly.');
            await expect(headset).toHaveClass(/selected/);
            await deadDialog(page).getByRole('button', { name: 'OK' }).click();
            await expect(deadDialog(page)).toBeHidden();

            await headset.click();
            await expect(deadDialog(page)).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(deadDialog(page)).toBeHidden();

            await headset.click();
            await expect(deadDialog(page)).toBeVisible();
            await page.locator('#deadDeviceDialog').click({ position: { x: 5, y: 5 } });
            await expect(deadDialog(page)).toBeHidden();
        });
    });
});
