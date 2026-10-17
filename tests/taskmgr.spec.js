const { test, expect } = require('./fixtures');

// TASKMGR.EXE reads the GitHub Actions API, so every test serves its own
// answers rather than depending on GitHub (or its rate limit).

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const REPO = 'https://github.com/iiSmitty/my-website';

function workflow(id, name, file, state = 'active') {
    return { id, name, path: `.github/workflows/${file}`, state, html_url: `${REPO}/actions/workflows/${file}` };
}

const WORKFLOWS = {
    total_count: 5,
    workflows: [
        workflow(11, 'Update Spotify Data', 'spotify-data-update.yml'),
        workflow(22, 'Update Coffee Stats', 'update-coffee-stats.yml'),
        workflow(33, 'Update Watching', 'update-watching.yml'),
        workflow(44, 'Update Strava Data', 'update-strava-data.yml'),
        // GitHub's own Pages workflow isn't one of the site's processes
        { id: 55, name: 'pages-build-deployment', path: 'dynamic/pages/pages-build-deployment', state: 'active' }
    ]
};

let runId = 1000;
function run(workflowId, startedAgo, { seconds = 30, conclusion = 'success', status = 'completed', event = 'schedule' } = {}) {
    const start = Date.now() - startedAgo;
    runId++;
    return {
        id: runId,
        workflow_id: workflowId,
        status,
        conclusion: status === 'completed' ? conclusion : null,
        event,
        run_started_at: new Date(start).toISOString(),
        created_at: new Date(start).toISOString(),
        updated_at: new Date(start + seconds * 1000).toISOString(),
        html_url: `${REPO}/actions/runs/${runId}`
    };
}

// Coffee's last run failed and Watching is running right now. Five finished
// runs in the last 30 days, one of them failed. Strava isn't among the newest
// runs at all.
const RUNS = {
    workflow_runs: [
        run(33, 5 * MINUTE, { status: 'in_progress', event: 'push' }),
        run(22, 1 * HOUR, { seconds: 40, conclusion: 'failure' }),
        run(11, 2 * DAY, { seconds: 15 }),
        run(22, 1 * DAY, { seconds: 35 }),
        run(22, 2 * DAY, { seconds: 45 }),
        run(33, 7 * DAY, { seconds: 10 }),
        // Too old to count towards the last 30 days
        run(11, 40 * DAY, { seconds: 600 })
    ]
};

// Strava last ran months ago, so only asking for its own runs finds it
const STRAVA_RUNS = { workflow_runs: [run(44, 200 * DAY, { seconds: 49 })] };

// The workflow list, the newest runs, and one workflow's own runs
function gitHubAnswer(url, { workflows = WORKFLOWS, runs = RUNS, workflowRuns = { 44: STRAVA_RUNS } } = {}) {
    const ownRuns = url.match(/\/workflows\/(\d+)\/runs/);
    if (ownRuns) return workflowRuns[ownRuns[1]] || { workflow_runs: [] };
    return url.includes('/workflows') ? workflows : runs;
}

async function mockGitHub(page, { status = 200, headers = {}, ...answers } = {}) {
    const requests = [];
    await page.route('https://api.github.com/**', (route) => {
        const url = route.request().url();
        requests.push(url);
        if (status !== 200) return route.fulfill({ status, headers, json: { message: 'Nope' } });
        return route.fulfill({ json: gitHubAnswer(url, answers) });
    });
    return requests;
}

async function boot(page) {
    await page.goto('/');
    await page.locator('#start-windows').click();
    await expect(page.locator('.win95-container')).toBeVisible();
}

async function openTaskManager(page) {
    await page.locator('#taskbarStart').click();
    await page.getByRole('menu', { name: 'Start' }).getByRole('menuitem', { name: 'Programs' }).click();
    await page.getByRole('menu', { name: 'Programs' }).getByRole('menuitem', { name: 'Task Manager' }).click();
    const taskManager = page.getByRole('dialog', { name: 'Windows Task Manager' });
    await expect(taskManager).toBeVisible();
    return taskManager;
}

const processRows = (page) => page.locator('#taskmgrProcessRows tr');
const taskRows = (page) => page.locator('#taskmgrTasks tr');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('loads nothing until opened', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await boot(page);
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /taskmgr\.min\.css|api\.github\.com/.test(url))).toEqual([]);
        await expect(page.locator('#taskmgrWindow')).toHaveCount(0);
    });

    test('Processes shows each workflow and how its last run went', async ({ page }) => {
        const requests = await mockGitHub(page);
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();

        await expect(processRows(page)).toHaveCount(4);
        await expect(processRows(page).locator('.taskmgr-col-image')).toHaveText([
            'COFFEE.EXE', 'SPOTIFY.EXE', 'STRAVA.EXE', 'WATCHING.EXE'
        ]);
        await expect(processRows(page).locator('.taskmgr-col-status')).toHaveText([
            'Not Responding', 'Sleeping', 'Sleeping', 'Running'
        ]);
        await expect(processRows(page).nth(0).locator('.taskmgr-col-pid')).toHaveText('22');
        await expect(processRows(page).nth(0).locator('.taskmgr-col-time')).toHaveText('0:00:40');
        await expect(processRows(page).nth(1).locator('.taskmgr-col-time')).toHaveText('0:00:15');
        // Strava's last run is found even though it's long out of the newest runs
        await expect(processRows(page).nth(2).locator('.taskmgr-col-last')).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
        await expect(processRows(page).nth(2).locator('.taskmgr-col-time')).toHaveText('0:00:49');

        await expect(taskManager.locator('.taskmgr-statusbar')).toContainText('Processes: 4');
        await expect(taskManager.locator('.taskmgr-statusbar')).toContainText('Success: 80%');
        await expect(taskManager.locator('.taskmgr-statusbar')).toContainText('Runs: 5 in 30 days');

        // The workflows, the newest runs and Strava's own last run. Opening it
        // again within the minute doesn't ask again.
        expect(requests).toHaveLength(3);
        expect(requests.filter((url) => url.includes('/workflows/44/runs'))).toHaveLength(1);
        await taskManager.getByRole('button', { name: 'Close' }).click();
        await openTaskManager(page);
        expect(requests).toHaveLength(3);

        // F5 refreshes Task Manager rather than the page
        await page.getByRole('tab', { name: 'Processes' }).focus();
        await page.keyboard.press('F5');
        await expect.poll(() => requests.length).toBe(6);
        await expect(page.locator('#taskmgrWindow')).toBeVisible();
    });

    test('Properties explains a process and links to its runs', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();
        await processRows(page).nth(1).dblclick();

        const properties = page.getByRole('alertdialog', { name: 'SPOTIFY.EXE Properties' });
        await expect(properties).toBeVisible();
        await expect(properties).toContainText('top artists and tracks of the month from Spotify');
        await expect(properties).toContainText('Update Spotify Data');
        await expect(properties).toContainText('Succeeded');
        await expect(properties.getByRole('link', { name: 'View last run on GitHub' }))
            .toHaveAttribute('href', /^https:\/\/github\.com\/iiSmitty\/my-website\/actions\/runs\/\d+$/);
        await expect(properties.getByRole('link', { name: 'View workflow' }))
            .toHaveAttribute('href', `${REPO}/actions/workflows/spotify-data-update.yml`);

        // Escape closes the dialog, not Task Manager
        await page.keyboard.press('Escape');
        await expect(properties).toBeHidden();
        await expect(taskManager).toBeVisible();
    });

    test('End Process is refused, the NT way', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();
        await expect(processRows(page)).toHaveCount(4);

        await taskManager.getByRole('button', { name: 'End Process' }).click();
        const warning = page.getByRole('alertdialog', { name: 'Task Manager Warning' });
        await expect(warning).toContainText('Are you sure you want to terminate COFFEE.EXE?');
        await expect(warning.getByRole('button', { name: 'Yes' })).toBeFocused();

        await warning.getByRole('button', { name: 'Yes' }).click();
        const denied = page.getByRole('alertdialog', { name: 'Unable to Terminate Process' });
        await expect(denied).toContainText('Access is denied.');
        await denied.getByRole('button', { name: 'OK' }).click();
        await expect(denied).toBeHidden();
        await expect(processRows(page)).toHaveCount(4);
    });

    test('Performance graphs the last 30 days', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Performance' }).click();

        await expect(page.getByRole('meter', { name: 'Success Rate' })).toHaveAttribute('aria-valuenow', '80');
        await expect(page.locator('#taskmgrTotalRuns')).toHaveText('5');
        await expect(page.locator('#taskmgrTotalFailed')).toHaveText('1');
        await expect(page.locator('#taskmgrTimeTotal')).toHaveText('0:02:25');
        await expect(page.locator('#taskmgrTimeLongest')).toHaveText('0:00:45');
        await expect(page.locator('#taskmgrRunsGraph')).toHaveAttribute('aria-label', /5 runs, 1 failed/);
        await expect(page.locator('#taskmgrRunsGraph polyline')).toHaveCount(2);
    });

    test('Applications lists the open windows, and switches to or ends them', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'My Computer' }).dblclick();
        const taskManager = await openTaskManager(page);

        await expect(taskRows(page)).toHaveText([/Windows 95/, /My Computer/, /Windows Task Manager/]);
        await expect(taskRows(page).locator('.taskmgr-col-status').first()).toHaveText('Running');
        // Every task has its window's icon, the main window's floppy included
        await expect(taskRows(page).locator('.taskmgr-task-label > :first-child:not(:only-child)')).toHaveCount(3);

        // Switch To brings the window forward and gets Task Manager out of the way
        await taskRows(page).nth(1).click();
        await taskManager.getByRole('button', { name: 'Switch To' }).click();
        await expect(taskManager).toBeHidden();
        await expect(page.locator('#myTechWindow')).not.toHaveClass(/is-inactive/);

        // End Task closes it, as its own close button would
        await page.getByRole('region', { name: 'Taskbar' }).getByRole('button', { name: 'Windows Task Manager' }).click();
        await taskRows(page).nth(1).click();
        await page.keyboard.press('Delete');
        await expect(page.locator('#myTechWindow')).toBeHidden();
        await expect(taskRows(page)).toHaveText([/Windows 95/, /Windows Task Manager/]);
    });

    test('Applications shows each window\'s icon, and ending the main window shuts down', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'Spotify' }).dblclick();
        const taskManager = await openTaskManager(page);

        // A white logo is drawn black on the white list, and white again when selected
        const spotifyIcon = page.locator('#taskmgrTasks .SpotifyIcon_16x16');
        await expect(spotifyIcon).toHaveCSS('filter', 'brightness(0)');
        await taskRows(page).filter({ hasText: 'Spotify' }).click();
        await expect(spotifyIcon).toHaveCSS('filter', 'none');

        // Ending the main window means shutting down
        await taskRows(page).nth(0).click();
        await taskManager.getByRole('button', { name: 'End Task' }).click();
        await expect(page.getByText('Are you sure you want to shut down this website?')).toBeVisible();
    });

    test('a GitHub outage shows an error, and Retry recovers', async ({ page }) => {
        let fail = true;
        await page.route('https://api.github.com/**', (route) => fail
            ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
            : route.fulfill({ json: gitHubAnswer(route.request().url()) }));
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();

        await expect(page.getByRole('alert')).toContainText('The RPC server is unavailable.');
        await expect(taskManager.getByRole('button', { name: 'End Process' })).toBeDisabled();

        fail = false;
        await page.getByRole('button', { name: 'Retry' }).click();
        await expect(processRows(page)).toHaveCount(4);
        await expect(page.getByRole('alert')).toBeHidden();
    });

    test('running out of GitHub requests says when to try again', async ({ page }) => {
        const reset = Math.floor((Date.now() + 10 * MINUTE) / 1000);
        await mockGitHub(page, {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset), 'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset' }
        });
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();
        await expect(page.getByRole('alert')).toContainText(/Too many requests to GitHub\. Try again in (10|11) minutes\./);
    });

    test('what GitHub says is shown as text, and unknown workflows still appear', async ({ page }) => {
        await mockGitHub(page, {
            workflows: { workflows: [workflow(66, '<img src=x onerror="window.pwned=1">', 'new-thing.yml', 'disabled_manually')] },
            runs: { workflow_runs: [] }
        });
        await boot(page);
        const taskManager = await openTaskManager(page);
        await taskManager.getByRole('tab', { name: 'Processes' }).click();

        await expect(processRows(page).locator('.taskmgr-col-image')).toHaveText(['NEWTHING.EXE']);
        await expect(processRows(page).locator('.taskmgr-col-status')).toHaveText(['Stopped']);
        await processRows(page).first().dblclick();
        await expect(page.getByRole('alertdialog')).toContainText('<img src=x onerror="window.pwned=1">');
        expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    });

    test('the taskbar\'s right-click menu opens Task Manager and minimizes everything', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        await page.locator('.desktop-icon', { hasText: 'My Computer' }).dblclick();

        const taskbar = page.getByRole('region', { name: 'Taskbar' });
        await taskbar.click({ button: 'right', position: { x: 900, y: 14 } });
        const menu = page.getByRole('menu', { name: 'Taskbar' });
        await expect(menu).toBeVisible();
        await menu.getByRole('menuitem', { name: 'Minimize All Windows' }).click();
        await expect(page.locator('#myTechWindow')).toBeHidden();
        await expect(page.locator('.win95-container')).toBeHidden();

        await taskbar.click({ button: 'right', position: { x: 900, y: 14 } });
        await menu.getByRole('menuitem', { name: 'Task Manager...' }).click();
        await expect(page.getByRole('dialog', { name: 'Windows Task Manager' })).toBeVisible();
    });

    test('Ctrl+Shift+Esc opens it, and the tabs work from the keyboard', async ({ page }) => {
        await mockGitHub(page);
        await boot(page);
        // A window that closes on Escape has focus; the shortcut mustn't close it
        await page.locator('.desktop-icon', { hasText: 'Recycle Bin' }).dblclick();
        await expect(page.locator('#skypeWindow')).toBeFocused();
        await page.keyboard.press('Control+Shift+Escape');

        const taskManager = page.getByRole('dialog', { name: 'Windows Task Manager' });
        await expect(taskManager).toBeVisible();
        await expect(page.locator('#skypeWindow')).toBeVisible();
        // Not the Start menu, which is Ctrl+Esc
        await expect(page.getByRole('menu', { name: 'Start' })).toBeHidden();

        await expect(taskManager.getByRole('tab', { name: 'Applications' })).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(taskManager.getByRole('tab', { name: 'Processes' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#taskmgrProcesses')).toBeVisible();
        await page.keyboard.press('End');
        await expect(page.locator('#taskmgrPerformance')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(taskManager).toBeHidden();

        // Ctrl+Esc opens the Start menu without closing the window either
        await page.locator('#skypeWindow').focus();
        await page.keyboard.press('Control+Escape');
        await expect(page.getByRole('menu', { name: 'Start' })).toBeVisible();
        await expect(page.locator('#skypeWindow')).toBeVisible();
    });
});
