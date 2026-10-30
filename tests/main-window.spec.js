const { test, expect, expectCentered } = require('./fixtures');

// Starting Windows (the "Welcome to Windows 95" dialog), shutting it down from
// a page's main window, and that window's minimize and maximize on the pages
// without the window manager.

const mainWindow = (page) => page.locator('.win95-container');
const welcome = (page) => page.getByText('Welcome to Windows 95');
const shutDownQuestion = (page) => page.getByText('Are you sure you want to shut down this website?');
const shutDownDialog = (page) => page.locator('.win95-overlay .win95-dialog');

// Coming from another page of the site, so Windows has already started
const FROM_THE_SITE = { referer: 'http://localhost:3000/' };

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test.describe('startup', () => {
        test('a first visit starts with the Welcome dialog, and Start shows the desktop', async ({ page }) => {
            const sounds = [];
            page.on('request', (request) => {
                if (request.url().includes('/sounds/')) sounds.push(new URL(request.url()).pathname);
            });

            await page.goto('/');
            await expect(welcome(page)).toBeVisible();
            await expect(mainWindow(page)).toBeHidden();
            await expect(page.locator('#start-windows')).toBeFocused();

            await page.locator('#start-windows').click();
            await expect(mainWindow(page)).toBeVisible();
            await expect(welcome(page)).toBeHidden();
            await expect.poll(() => sounds).toEqual(['/sounds/win95-complete.mp3']);
        });

        test('arriving from another page of the site skips it', async ({ page }) => {
            await page.goto('/', FROM_THE_SITE);
            await expect(mainWindow(page)).toBeVisible();
            await expect(welcome(page)).toHaveCount(0);
        });

        test('the Strava page starts Windows on a first visit too', async ({ page }) => {
            await page.goto('/strava-pbs.html');
            await expect(welcome(page)).toBeVisible();
            await expect(mainWindow(page)).toBeHidden();
        });

        for (const path of ['/experience.html', '/404.html']) {
            test(`${path} skips it`, async ({ page }) => {
                await page.goto(path);
                await expect(mainWindow(page)).toBeVisible();
                await expect(welcome(page)).toHaveCount(0);
            });
        }
    });

    test.describe('shutting down', () => {
        for (const path of ['/', '/experience.html', '/strava-pbs.html', '/404.html']) {
            test(`${path}: the main window's close button asks first, and Yes plays the shutdown video`, async ({ page }) => {
                // The video is a YouTube embed; the test never reaches YouTube
                await page.route('https://www.youtube.com/**', (route) =>
                    route.fulfill({ contentType: 'text/html', body: '<title>Video</title>' }));
                await page.goto(path, FROM_THE_SITE);
                const closeButton = mainWindow(page).locator('.win95-close').first();

                await closeButton.click();
                await expect(page.getByText('Shut Down Windows')).toBeVisible();
                await expect(shutDownQuestion(page)).toBeVisible();
                await expectCentered(shutDownDialog(page));
                await page.getByRole('button', { name: 'No' }).click();
                await expect(shutDownQuestion(page)).toHaveCount(0);

                await closeButton.click();
                await page.locator('.win95-overlay').getByText('✕').click();
                await expect(shutDownQuestion(page)).toHaveCount(0);

                await closeButton.click();
                await page.getByRole('button', { name: 'Yes' }).click();
                const video = page.locator('iframe[title="YouTube video player"]');
                await expect(video).toHaveAttribute('src', 'https://www.youtube.com/embed/lAkuJXGldrM?autoplay=1&playsinline=1&rel=0');
                const watchOnYouTube = page.getByRole('link', { name: 'Trouble loading? ▸ Watch on YouTube' });
                await expect(watchOnYouTube).toHaveAttribute('href', 'https://www.youtube.com/watch?v=lAkuJXGldrM&autoplay=1');
                await expect(watchOnYouTube).toHaveAttribute('target', '_blank');

                await page.getByRole('button', { name: 'Close video' }).click();
                await expect(video).toHaveCount(0);
                // The question is still there after the video
                await expect(shutDownQuestion(page)).toBeVisible();

                await page.getByRole('button', { name: 'Yes' }).click();
                await expect(video).toBeVisible();
                await page.keyboard.press('Escape');
                await expect(video).toHaveCount(0);
            });
        }
    });

    // The home page's window manager does these with a taskbar
    // (shell.spec.js); the other pages have a simpler fallback
    test.describe('minimize and maximize without the window manager', () => {
        for (const path of ['/experience.html', '/strava-pbs.html', '/404.html']) {
            test(`${path}: minimize leaves the title bar and a Restore Window button`, async ({ page }) => {
                await page.goto(path, FROM_THE_SITE);
                await mainWindow(page).locator('.win95-minimize').first().click();
                await expect(mainWindow(page)).toHaveCSS('height', '32px');

                const restore = page.getByRole('button', { name: 'Restore Window' });
                await restore.click();
                await expect(restore).toHaveCount(0);
                await expect.poll(async () => (await mainWindow(page).boundingBox()).height).toBeGreaterThan(100);
            });

            test(`${path}: maximize fills the page, and a second click puts it back`, async ({ page }) => {
                await page.goto(path, FROM_THE_SITE);
                const before = await mainWindow(page).boundingBox();
                const maximize = mainWindow(page).locator('.win95-maximize').first();

                await maximize.click();
                await expect(mainWindow(page)).toHaveAttribute('data-is-maximized', 'true');
                await expect(mainWindow(page)).toHaveCSS('margin', '0px');

                await maximize.click();
                await expect(mainWindow(page)).toHaveAttribute('data-is-maximized', '');
                await expect.poll(async () => (await mainWindow(page).boundingBox()).width).toBeCloseTo(before.width, 0);
            });
        }
    });
});

test.describe('phone', () => {
    test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

    test('the Shut Down dialog fits on the screen', async ({ page }) => {
        await page.goto('/404.html');
        await mainWindow(page).locator('.win95-close').first().click();
        const box = await shutDownDialog(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
        await expectCentered(shutDownDialog(page));
    });
});
