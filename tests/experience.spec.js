const { test, expect } = require('@playwright/test');

// Durations are computed from "now", so pin the clock. Every expected string
// below is what LinkedIn shows for the same dates in September 2026.
test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-15T12:00:00'));
});

const roleTenures = {
    'interfront-entry-level-developer': '6 mos',
    'interfront-graduate-developer': '1 yr 3 mos',
    'integralis-developer': '11 mos',
    'integralis-junior-developer': '1 yr 10 mos',
    'integralis-development-intern': '10 mos',
    'printd-technical-sales-design': '6 mos',
    'computer-mania-sales-representative': '1 yr 1 mo',
    'cape-canvasses-personal-assistant': '5 mos',
    'carbonite-forum-moderator': '6 yrs 2 mos',
    'tygerberg-gesinskerk-livestreaming-operator': '2 yrs 6 mos',
    'tygerberg-gesinskerk-multimedia-assistant': '1 yr 4 mos',
};

const companyTenures = {
    interfront: '1 yr 8 mos',
    integralis: '3 yrs 5 mos',
    'tygerberg-gesinskerk': '3 yrs 10 mos',
};

test.describe('desktop explorer', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('opens straight into the explorer with no startup dialog', async ({ page }) => {
        await page.goto('/experience');
        await expect(page.locator('#start-windows')).toHaveCount(0);
        await expect(page.getByRole('tree')).toBeVisible();
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience');
        await expect(page.locator('.xp-status-count')).toHaveText('6 object(s)');
    });

    test('computes LinkedIn-style durations', async ({ page }) => {
        await page.goto('/experience');
        for (const [id, tenure] of Object.entries(roleTenures)) {
            await expect(page.locator(`#${id} .xp-tenure`), id).toHaveText(tenure);
        }
        for (const [id, tenure] of Object.entries(companyTenures)) {
            await expect(page.locator(`#${id} .xp-company-span .xp-tenure`), id).toHaveText(tenure);
        }
        // Single-role companies don't repeat their dates as a company total
        await expect(page.locator('#printd .xp-company-span')).toHaveCount(0);
    });

    test('marks promotions within a company', async ({ page }) => {
        await page.goto('/experience');
        await expect(page.locator('#integralis .xp-promotion')).toHaveCount(2);
        await expect(page.locator('#interfront .xp-promotion')).toHaveCount(1);
        // The marker belongs to the role that was the promotion
        await expect(page.locator('#interfront-entry-level-developer .xp-promotion')).toHaveCount(1);
        await expect(page.locator('#interfront-graduate-developer .xp-promotion')).toHaveCount(0);
        // A role that starts the month after the previous one ended is a move, not a promotion
        await expect(page.locator('#tygerberg-gesinskerk .xp-promotion')).toHaveCount(0);
    });

    test('a role deep link opens its company', async ({ page }) => {
        await page.goto('/experience#integralis-junior-developer');
        await expect(page.locator('#integralis')).toBeVisible();
        await expect(page.locator('#interfront')).toBeHidden();
        await expect(page.locator('#integralis-junior-developer')).toHaveClass(/is-target/);
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience\\Integralis IT Consultancy');
        await expect(page.getByRole('treeitem', { name: 'Integralis IT Consultancy' })).toHaveAttribute('aria-selected', 'true');
    });

    test('a nested company shows its full path', async ({ page }) => {
        await page.goto('/experience#carbonite');
        await expect(page.locator('#carbonite')).toBeVisible();
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience\\Community\\Carbonite Classifieds');
        await page.getByRole('button', { name: 'Up' }).click();
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience\\Community');
        await expect(page).toHaveURL(/#community$/);
    });

    test('the tree is keyboard navigable and selection follows focus', async ({ page }) => {
        await page.goto('/experience');
        await page.getByRole('treeitem', { name: 'Experience' }).first().focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('#interfront')).toBeVisible();
        await expect(page).toHaveURL(/#interfront$/);

        await page.keyboard.press('End');
        await expect(page.locator('#tygerberg-gesinskerk')).toBeVisible();

        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience\\Community');
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('treeitem', { name: 'Carbonite Classifieds' })).toBeHidden();
    });

    test('clicking a listing row opens the company and back returns', async ({ page }) => {
        await page.goto('/experience');
        await page.locator('.xp-details tr', { hasText: 'Computer Mania' }).click();
        await expect(page.locator('#computer-mania')).toBeVisible();
        await page.goBack();
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience');
    });

    test('development-only filter hides the other roles', async ({ page }) => {
        await page.goto('/experience#printd');
        await page.getByLabel('Development only').check();

        // The selected company disappeared, so the view falls back to the root
        await expect(page.locator('.xp-address-field')).toHaveText('C:\\Experience');
        await expect(page.locator('.xp-status-count')).toHaveText('2 object(s)');
        await expect(page.getByRole('treeitem', { name: 'Printd Creations' })).toBeHidden();
        await expect(page.getByRole('treeitem', { name: 'Community' })).toBeHidden();

        await page.getByLabel('Development only').uncheck();
        await expect(page.locator('.xp-status-count')).toHaveText('6 object(s)');
    });
});

test.describe('phone layout', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('stacks every company and drops the tree', async ({ page }) => {
        await page.goto('/experience');
        await expect(page.getByRole('tree')).toBeHidden();
        for (const id of ['interfront', 'integralis', 'printd', 'computer-mania', 'cape-canvasses', 'carbonite', 'tygerberg-gesinskerk']) {
            await expect(page.locator(`#${id}`), id).toBeVisible();
        }
    });

    test('a deep link scrolls to the company', async ({ page }) => {
        await page.goto('/experience#computer-mania');
        await expect(page.locator('#computer-mania')).toBeInViewport();
    });
});

test.describe('home page desktop window', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the Experience icon opens the explorer in a window', async ({ page }) => {
        await page.goto('/');
        await page.locator('#start-windows').click();

        const frame = page.frameLocator('#experienceFrame');
        await expect(page.locator('#experienceFrame')).not.toHaveAttribute('src');

        await page.locator('.desktop-icon', { hasText: 'Experience' }).dblclick();
        await expect(page.locator('#experienceWindow')).toBeVisible();
        await expect(frame.getByRole('tree')).toBeVisible();
        // The host window supplies the chrome; the page's own is hidden
        await expect(frame.locator('.win95-title-bar')).toBeHidden();
        await expect(frame.locator('.win95-status-bar')).toBeHidden();

        await page.locator('#experienceWindow .win95-maximize').click();
        await expect(page.locator('#experienceWindow')).toHaveClass(/is-maximized/);
        await page.locator('#experienceWindow .win95-close').click();
        await expect(page.locator('#experienceWindow')).toBeHidden();
    });
});

test('print layout is a plain CV', async ({ page }) => {
    await page.goto('/experience');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.win95-menu-bar')).toBeHidden();
    await expect(page.getByRole('tree')).toBeHidden();
    await expect(page.locator('.xp-print-only')).toBeVisible();
    await expect(page.locator('#interfront')).toBeVisible();
    await expect(page.locator('#carbonite')).toBeVisible();
});
