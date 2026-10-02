const { test, expect } = require('@playwright/test');

// The Videos folder reads data/watching.json, so every test serves its own
// copy rather than depending on what the workflow last committed.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();

// 1x1 transparent PNG standing in for TMDB posters
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function watching(overrides = {}) {
    return {
        lastUpdated: daysAgo(0),
        current: {
            title: 'Severance', year: 2022, traktId: 1, tmdbId: 95396, slug: 'severance',
            poster: '/severance.jpg', episode: { season: 2, number: 7, title: 'Chikhai Bardo' },
            watched: 16, aired: 19, lastWatchedAt: daysAgo(2)
        },
        previous: {
            title: 'The Bear', year: 2022, traktId: 2, tmdbId: 136315, slug: 'the-bear',
            poster: '/the-bear.jpg', episodes: 28, finishedAt: daysAgo(30)
        },
        movies: [
            {
                title: 'Dune: Part Two', year: 2024, traktId: 3, tmdbId: 693134, slug: 'dune-part-two-2024',
                runtime: 166, poster: '/dune.jpg', watchedAt: daysAgo(5)
            },
            { title: 'Heat', year: 1995, traktId: 4, tmdbId: 949, slug: 'heat-1995', runtime: 170, poster: '/heat.jpg', watchedAt: daysAgo(9) },
            { title: 'Alien', year: 1979, traktId: 5, tmdbId: 348, slug: 'alien-1979', runtime: 117, poster: '/alien.jpg', watchedAt: daysAgo(12) }
        ],
        ...overrides
    };
}

async function openVideos(page, data, { status = 200, posterStatus = 200 } = {}) {
    const posters = [];
    await page.route('**/data/watching.json', (route) => route.fulfill({ status, json: data }));
    await page.route('https://image.tmdb.org/**', (route) => {
        posters.push(route.request().url());
        return posterStatus === 200
            ? route.fulfill({ contentType: 'image/png', body: PNG })
            : route.fulfill({ status: posterStatus });
    });

    await page.goto('/');
    await page.locator('#start-windows').click();
    await page.locator('.desktop-icon', { hasText: 'Videos' }).dblclick();

    const videosWindow = page.getByRole('dialog', { name: 'Videos' });
    await expect(videosWindow).toBeVisible();
    return { videosWindow, posters };
}

const rows = (page) => page.locator('#videosRows .videos-row');
const preview = (page) => page.locator('#videosPreview');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until triggered', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await page.goto('/');
        await page.locator('#start-windows').click();
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /watching\.min\.css|watching\.json|image\.tmdb\.org/.test(url))).toEqual([]);
        await expect(page.locator('#videosWindow')).toHaveCount(0);
    });

    test('shows the current series, the last finished one and the last few movies', async ({ page }) => {
        const { videosWindow, posters } = await openVideos(page, watching());

        await expect(videosWindow).toHaveCSS('position', 'fixed');
        await expect(videosWindow.locator('.videos-address')).toContainText('C:\\My Documents\\Videos');
        await expect(rows(page)).toHaveCount(5);
        await expect(rows(page).nth(0)).toContainText('Severance.avi');
        await expect(rows(page).nth(0)).toContainText('Now playing');
        await expect(rows(page).nth(0)).toContainText('S2E07');
        await expect(rows(page).nth(0).getByRole('progressbar', { name: '16 of 19 episodes watched' })).toBeVisible();
        await expect(rows(page).nth(1)).toContainText('The Bear.avi');
        await expect(rows(page).nth(1)).toContainText('Finished');
        await expect(rows(page).nth(1)).toContainText('28 episodes');
        // ":" isn't allowed in a Windows file name
        await expect(rows(page).nth(2)).toContainText('Dune Part Two.mpg');
        await expect(rows(page).nth(2)).toContainText('Movie');
        await expect(rows(page).nth(2)).toContainText('2024 · 2h 46m');
        await expect(rows(page).nth(3)).toContainText('Heat.mpg');
        await expect(rows(page).nth(4)).toContainText('Alien.mpg');
        await expect(page.locator('#videosStatus')).toHaveText('5 object(s)');

        // The current series is selected, focused and described in the web view pane
        await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'true');
        await expect(rows(page).nth(0)).toBeFocused();
        await expect(preview(page)).toContainText('Severance (2022)');
        await expect(preview(page)).toContainText('S2E07 "Chikhai Bardo"');
        await expect(preview(page)).toContainText('16 of 19 episodes watched');
        await expect(preview(page).getByRole('link', { name: 'View on Trakt' })).toHaveAttribute('href', 'https://trakt.tv/shows/severance');
        await expect(preview(page).getByRole('img', { name: 'Poster for Severance (2022)' })).toHaveJSProperty('complete', true);
        await expect(videosWindow).toContainText('This product uses the TMDB API but is not endorsed or certified by TMDB.');

        // Only the selected item's poster loads
        expect(posters).toEqual(['https://image.tmdb.org/t/p/w185/severance.jpg']);

        // Arrow keys move the selection, and the preview follows
        await page.keyboard.press('ArrowDown');
        await expect(rows(page).nth(1)).toBeFocused();
        await expect(rows(page).nth(1)).toHaveAttribute('aria-selected', 'true');
        await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'false');
        await expect(preview(page)).toContainText('The Bear (2022)');
        await page.keyboard.press('ArrowDown');
        await expect(preview(page)).toContainText('Dune: Part Two (2024)');
        await expect(preview(page).getByRole('link', { name: 'View on Trakt' })).toHaveAttribute('href', 'https://trakt.tv/movies/dune-part-two-2024');
        await page.keyboard.press('End');
        await expect(rows(page).nth(4)).toBeFocused();
        await expect(preview(page)).toContainText('Alien (1979)');

        await videosWindow.getByRole('button', { name: 'Close' }).click();
        await expect(videosWindow).toBeHidden();
    });

    test('Properties shows the file details', async ({ page }) => {
        await openVideos(page, watching());

        // Enter opens Properties for the selected file
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        const properties = page.getByRole('dialog', { name: 'The Bear.avi Properties' });
        await expect(properties).toBeVisible();
        await expect(properties.getByRole('button', { name: 'OK' })).toBeFocused();
        await expect(properties).toContainText('MS-DOS name:THEBEA~1.AVI');
        await expect(properties).toContainText('Episodes:28 watched');
        await expect(properties.getByLabel('Read-only')).toBeChecked();

        // Escape closes just the dialog and puts focus back on the row
        await page.keyboard.press('Escape');
        await expect(properties).toBeHidden();
        await expect(page.locator('#videosWindow')).toBeVisible();
        await expect(rows(page).nth(1)).toBeFocused();

        // Double-click works too. The current series isn't read-only yet.
        await rows(page).nth(0).dblclick();
        const current = page.getByRole('dialog', { name: 'Severance.avi Properties' });
        await expect(current).toContainText('MS-DOS name:SEVERA~1.AVI');
        await expect(current).toContainText('Latest:S2E07 "Chikhai Bardo"');
        await expect(current.getByLabel('Read-only')).not.toBeChecked();
        await current.getByRole('button', { name: 'OK' }).click();
        await expect(current).toBeHidden();

        // A second Escape closes the window
        await page.keyboard.press('Escape');
        await expect(page.locator('#videosWindow')).toBeHidden();
    });

    test('empty slots and a series left alone too long', async ({ page }) => {
        const data = watching({ previous: null, movies: [] });
        data.current.lastWatchedAt = daysAgo(40);
        await openVideos(page, data);

        await expect(rows(page).nth(0)).toContainText('Paused');
        await expect(preview(page)).toContainText('Paused. Last watched 5 weeks ago.');
        await expect(rows(page).nth(1)).toContainText('(empty)');
        await expect(rows(page).nth(1)).toContainText('Nothing finished');
        await expect(rows(page).nth(2)).toContainText('No movies yet');
        await expect(page.locator('#videosStatus')).toHaveText('1 object(s)');

        // Empty rows have nothing to open
        await rows(page).nth(2).dblclick();
        await expect(page.locator('#videosProperties.open')).toHaveCount(0);
        await expect(preview(page)).toContainText('No movies watched yet.');
    });

    test('nothing playing between series', async ({ page }) => {
        await openVideos(page, watching({ current: null }));

        await expect(rows(page).nth(0)).toContainText('Between shows');
        await expect(preview(page)).toContainText('Nothing playing right now.');
        await expect(rows(page).nth(1)).toContainText('The Bear.avi');
    });

    test('a failed load says the device is not ready, and Retry recovers', async ({ page }) => {
        const { videosWindow } = await openVideos(page, {}, { status: 500 });

        const error = videosWindow.getByRole('alert');
        await expect(error).toContainText('C:\\My Documents\\Videos is not accessible.');
        await expect(error).toContainText('The device is not ready.');
        await expect(videosWindow.getByRole('grid')).toBeHidden();

        await page.unroute('**/data/watching.json');
        await page.route('**/data/watching.json', (route) => route.fulfill({ json: watching() }));
        await videosWindow.getByRole('button', { name: 'Retry' }).click();

        await expect(error).toBeHidden();
        await expect(rows(page)).toHaveCount(5);
        await expect(rows(page).nth(0)).toContainText('Severance.avi');
    });

    test('a poster that fails to load falls back to an icon', async ({ page }) => {
        await openVideos(page, watching(), { posterStatus: 404 });
        await expect(preview(page).getByRole('img', { name: 'No poster' })).toBeVisible();
        await expect(preview(page).locator('img')).toHaveCount(0);
    });

    test('a long name is shortened before its extension', async ({ page }) => {
        const data = watching();
        data.movies[0].title = 'The Lord of the Rings: The Fellowship of the Ring';
        await openVideos(page, data);

        const name = rows(page).nth(2).locator('.videos-name');
        await expect(name).toHaveAttribute('title', 'The Lord of the Rings The Fellowship of the Ring.mpg');
        await expect(name.locator('.videos-name-ext')).toBeVisible();
        await expect(name.locator('.videos-name-ext')).toHaveText('.mpg');

        // The base is cut off with an ellipsis rather than pushing ".mpg" out of the cell
        const cut = await name.locator('.videos-name-base').evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(cut).toBe(true);
        const [cell, ext] = await Promise.all([name.boundingBox(), name.locator('.videos-name-ext').boundingBox()]);
        expect(ext.x + ext.width).toBeLessThanOrEqual(cell.x + cell.width);
    });

    test('titles are shown as text, never parsed as HTML', async ({ page }) => {
        const data = watching();
        data.current.title = '<img src=x onerror="window.pwned=1">';
        data.current.poster = '"><script>window.pwned=1</script>';
        await openVideos(page, data);

        await expect(preview(page)).toContainText('<img src=x onerror="window.pwned=1">');
        // A poster value that isn't a TMDB file path is never requested
        await expect(preview(page).getByRole('img', { name: 'No poster' })).toBeVisible();
        expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    });
});
