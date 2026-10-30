// TASKMGR.EXE
// The Windows NT Task Manager for the desktop. Applications lists the open
// windows (window-manager.js). Processes lists the GitHub Actions workflows
// that keep the site's data fresh, and Performance graphs their last 30 days.
//
// The workflow data comes live from the public GitHub API when the window
// opens: two requests, plus one for each workflow that hasn't run in about a
// month, out of the 60 an hour GitHub allows each visitor.
// Like the Skype and Videos windows, nothing loads until it's first opened.
//
// Opened from Start > Programs, the taskbar's right-click menu, or
// Ctrl+Alt+Del / Ctrl+Shift+Esc where the operating system lets those through.

const TASKMGR_API = 'https://api.github.com/repos/iiSmitty/my-website/actions';
const TASKMGR_HISTORY_DAYS = 30;
const TASKMGR_DAY_MS = 24 * 60 * 60 * 1000;
// GitHub caches these responses for a minute, so asking sooner gets the same answer
const TASKMGR_REFRESH_MS = 60 * 1000;

// Each workflow, as a process. A workflow not listed here still shows up,
// under the 8.3 name of its file.
const TASKMGR_PROCESSES = {
    'spotify-data-update.yml': {
        image: 'SPOTIFY.EXE',
        description: 'Every Monday, saves my top artists and tracks of the month from Spotify, for the Spotify window.'
    },
    'update-coffee-stats.yml': {
        image: 'COFFEE.EXE',
        description: 'Reads my coffee loyalty card every day, for Coffee Analytics. It has three tries a day and skips the rest once it has the day\'s numbers.'
    },
    'update-watching.yml': {
        image: 'WATCHING.EXE',
        description: 'Every Monday, and whenever its code changes, reads what I\'m watching on Trakt, for the Videos folder.'
    },
    'update-strava-data.yml': {
        image: 'STRAVA.EXE',
        description: 'Fetched my running PBs from Strava. Retired: it only runs when started by hand.'
    }
};

// What started a run, as the Properties sheet says it
const TASKMGR_EVENTS = {
    schedule: 'Schedule',
    workflow_dispatch: 'Started by hand',
    push: 'Code change'
};

let taskmgrProcesses = [];
let taskmgrFetchedAt = 0;
let taskmgrLoading = null;
let taskmgrSelectedTask = null;
let taskmgrRenderedTasks = null;
let taskmgrSelectedProcess = 0;
let taskmgrReturnFocus = null;

// --- Helpers ---------------------------------------------------------------

// 0:00:38, the way Task Manager shows CPU time
function formatTaskmgrDuration(ms) {
    const seconds = Math.max(0, Math.round(ms / 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

// The 8.3 name for a workflow file Task Manager doesn't know: NEW-THING.yml -> NEWTHING.EXE
function taskmgrDosName(fileName) {
    const base = fileName.replace(/\.ya?ml$/i, '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'WORKFLOW';
    return `${base.length <= 8 ? base : `${base.slice(0, 6)}~1`}.EXE`;
}

// Only ever link to GitHub itself
function taskmgrGitHubUrl(url) {
    return typeof url === 'string' && /^https:\/\/github\.com\//.test(url) ? url : null;
}

function taskmgrTime(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
}

// --- Data ------------------------------------------------------------------

function taskmgrRun(run, now) {
    const startedAt = taskmgrTime(run.run_started_at) || taskmgrTime(run.created_at);
    const completed = run.status === 'completed';
    const endedAt = completed ? taskmgrTime(run.updated_at) : now;
    return {
        startedAt,
        durationMs: startedAt && endedAt ? Math.max(0, endedAt - startedAt) : 0,
        completed,
        conclusion: completed ? run.conclusion : null,
        failed: completed && !['success', 'skipped', 'neutral', 'cancelled'].includes(run.conclusion),
        event: run.event,
        url: taskmgrGitHubUrl(run.html_url)
    };
}

function taskmgrStatus(workflow, latest) {
    if (typeof workflow.state === 'string' && workflow.state.startsWith('disabled')) return 'Stopped';
    if (!latest) return 'Idle';
    if (!latest.completed) return 'Running';
    if (latest.failed) return 'Not Responding';
    if (latest.conclusion === 'cancelled') return 'Cancelled';
    // Its last run went fine; it waits for the next one
    return 'Sleeping';
}

// Only the repo's own workflows, not ones GitHub adds (like Pages builds)
function isTaskmgrWorkflow(workflow) {
    return Boolean(workflow) && typeof workflow.path === 'string' && workflow.path.startsWith('.github/workflows/');
}

// Workflows and their runs from the GitHub API, as Task Manager's processes
function buildTaskmgrProcesses(workflowsJson, runsJson, now) {
    const workflows = workflowsJson && Array.isArray(workflowsJson.workflows) ? workflowsJson.workflows : [];
    const runs = runsJson && Array.isArray(runsJson.workflow_runs) ? runsJson.workflow_runs : [];
    const since = now - TASKMGR_HISTORY_DAYS * TASKMGR_DAY_MS;

    return workflows
        .filter(isTaskmgrWorkflow)
        .map(workflow => {
            const fileName = workflow.path.split('/').pop();
            const known = TASKMGR_PROCESSES[fileName];
            const own = runs
                .filter(run => run && run.workflow_id === workflow.id)
                .map(run => taskmgrRun(run, now))
                .filter(run => run.startedAt)
                .sort((a, b) => b.startedAt - a.startedAt);
            const latest = own[0] || null;
            const name = String(workflow.name || fileName);

            return {
                id: workflow.id,
                image: known ? known.image : taskmgrDosName(fileName),
                name,
                description: known ? known.description : name,
                workflowUrl: taskmgrGitHubUrl(workflow.html_url),
                status: taskmgrStatus(workflow, latest),
                latest,
                recent: own.filter(run => run.startedAt >= since && run.completed)
            };
        })
        .sort((a, b) => a.image.localeCompare(b.image));
}

// Totals and per-day history across every process, for Performance
function summarizeTaskmgrRuns(processes, now) {
    const runs = processes.flatMap(process => process.recent);
    const failed = runs.filter(run => run.failed).length;
    const totalMs = runs.reduce((sum, run) => sum + run.durationMs, 0);

    // One bucket per local day, oldest first, ending today
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: TASKMGR_HISTORY_DAYS }, (_, i) => ({
        start: today.getTime() - (TASKMGR_HISTORY_DAYS - 1 - i) * TASKMGR_DAY_MS,
        runs: 0,
        failed: 0,
        ms: 0
    }));
    runs.forEach(run => {
        const day = days.findLast(candidate => run.startedAt >= candidate.start);
        if (!day) return;
        day.runs++;
        day.ms += run.durationMs;
        if (run.failed) day.failed++;
    });

    return {
        runs: runs.length,
        failed,
        successRate: runs.length ? Math.round(((runs.length - failed) / runs.length) * 100) : null,
        totalMs,
        averageMs: runs.length ? totalMs / runs.length : 0,
        longestMs: runs.reduce((longest, run) => Math.max(longest, run.durationMs), 0),
        days
    };
}

async function fetchTaskmgrJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        // GitHub allows 60 requests an hour; when they're used up it says when they reset
        if (response.headers.get('x-ratelimit-remaining') === '0') {
            error.resetAt = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        }
        throw error;
    }
    return response.json();
}

// --- Window ----------------------------------------------------------------

function taskmgrWindow() {
    return document.getElementById('taskmgrWindow');
}

function buildTaskmgrList(id, label, columns) {
    const frame = makeElement('div', 'taskmgr-list-frame');
    const table = makeElement('table', 'taskmgr-list');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', label);
    const head = table.createTHead().insertRow();
    columns.forEach(([text, className]) => {
        const cell = makeElement('th', className, text);
        cell.scope = 'col';
        head.append(cell);
    });
    const body = table.createTBody();
    body.id = id;
    frame.append(table);
    return frame;
}

// An NT4 meter: green LEDs on black, with the value underneath
function buildTaskmgrMeter(id, label) {
    const group = makeElement('fieldset', 'taskmgr-group taskmgr-meter-group');
    group.append(makeElement('legend', null, label));
    const meter = makeElement('div', 'taskmgr-meter');
    meter.id = id;
    meter.setAttribute('role', 'meter');
    meter.setAttribute('aria-label', label);
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    const bar = makeElement('div', 'taskmgr-meter-bar');
    bar.append(makeElement('div', 'taskmgr-meter-fill'));
    meter.append(bar, makeElement('div', 'taskmgr-meter-value'));
    group.append(meter);
    return group;
}

function buildTaskmgrGraph(id, label) {
    const group = makeElement('fieldset', 'taskmgr-group taskmgr-graph-group');
    group.append(makeElement('legend', null, label));
    const graph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    graph.id = id;
    graph.classList.add('taskmgr-graph');
    graph.setAttribute('viewBox', '0 0 300 100');
    graph.setAttribute('preserveAspectRatio', 'none');
    graph.setAttribute('role', 'img');
    group.append(graph);
    return group;
}

function buildTaskmgrTotals(label, rows) {
    const group = makeElement('fieldset', 'taskmgr-group taskmgr-totals');
    group.append(makeElement('legend', null, label));
    const list = makeElement('dl');
    rows.forEach(([term, id]) => {
        const value = makeElement('dd');
        value.id = id;
        list.append(makeElement('dt', null, term), value);
    });
    group.append(list);
    return group;
}

function buildTaskmgrWindow() {
    const win = makeElement('div', 'win95-window taskmgr-window');
    win.id = 'taskmgrWindow';
    win.hidden = true;
    win.tabIndex = -1;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-labelledby', 'taskmgrTitle');

    win.innerHTML = `
        <div class="win95-title-bar" id="taskmgrTitleBar">
            <div class="win95-title" id="taskmgrTitle"><span class="TaskManagerIcon_16x16" aria-hidden="true"></span>Windows Task Manager</div>
            <div class="win95-buttons">
                <button class="win95-button win95-minimize" type="button">_</button>
                <button class="win95-button win95-maximize" type="button">&#9633;</button>
                <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
            </div>
        </div>
        <div class="win95-menu-bar taskmgr-menu-bar" aria-hidden="true">
            <div class="win95-menu-item"><u>F</u>ile</div>
            <div class="win95-menu-item"><u>O</u>ptions</div>
            <div class="win95-menu-item"><u>V</u>iew</div>
            <div class="win95-menu-item"><u>H</u>elp</div>
        </div>
        <div class="taskmgr-tabs" role="tablist" aria-label="Task Manager">
            <button class="taskmgr-tab" type="button" role="tab" id="taskmgrTabApplications"
                    aria-controls="taskmgrApplications" data-tab="applications">Applications</button>
            <button class="taskmgr-tab" type="button" role="tab" id="taskmgrTabProcesses"
                    aria-controls="taskmgrProcesses" data-tab="processes">Processes</button>
            <button class="taskmgr-tab" type="button" role="tab" id="taskmgrTabPerformance"
                    aria-controls="taskmgrPerformance" data-tab="performance">Performance</button>
        </div>
        <div class="taskmgr-sheet">
            <div class="taskmgr-panel" role="tabpanel" id="taskmgrApplications" aria-labelledby="taskmgrTabApplications"></div>
            <div class="taskmgr-panel" role="tabpanel" id="taskmgrProcesses" aria-labelledby="taskmgrTabProcesses" hidden></div>
            <div class="taskmgr-panel" role="tabpanel" id="taskmgrPerformance" aria-labelledby="taskmgrTabPerformance" hidden></div>
        </div>
        <div class="taskmgr-statusbar">
            <span id="taskmgrStatusProcesses">Processes: --</span>
            <span id="taskmgrStatusSuccess">Success: --</span>
            <span id="taskmgrStatusRuns">Runs: --</span>
        </div>`;

    // Applications: the open windows
    const applications = win.querySelector('#taskmgrApplications');
    const tasks = buildTaskmgrList('taskmgrTasks', 'Tasks', [['Task', 'taskmgr-col-task'], ['Status', 'taskmgr-col-status']]);
    const taskButtons = makeElement('div', 'taskmgr-buttons');
    taskButtons.innerHTML = `
        <button class="win95-btn" type="button" id="taskmgrEndTask">End Task</button>
        <button class="win95-btn" type="button" id="taskmgrSwitchTo">Switch To</button>`;
    applications.append(tasks, taskButtons);

    // Processes: the workflows
    const processes = win.querySelector('#taskmgrProcesses');
    const processList = buildTaskmgrList('taskmgrProcessRows', 'Processes', [
        ['Image Name', 'taskmgr-col-image'], ['PID', 'taskmgr-col-pid'], ['Status', 'taskmgr-col-status'],
        ['CPU Time', 'taskmgr-col-time'], ['Last Run', 'taskmgr-col-last']
    ]);
    const error = makeElement('div', 'taskmgr-error');
    error.id = 'taskmgrError';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    error.innerHTML = `
        <img src="icons/error-32.png" alt="" width="32" height="32">
        <div>
            <p id="taskmgrErrorMessage"></p>
            <button class="win95-btn" type="button" id="taskmgrRetry">Retry</button>
        </div>`;
    processList.append(error);
    const processButtons = makeElement('div', 'taskmgr-buttons');
    processButtons.innerHTML = `
        <button class="win95-btn" type="button" id="taskmgrProperties">Properties</button>
        <button class="win95-btn" type="button" id="taskmgrEndProcess">End Process</button>`;
    processes.append(processList, processButtons);

    // Performance: the last 30 days, NT4-style
    const performance = win.querySelector('#taskmgrPerformance');
    const charts = makeElement('div', 'taskmgr-charts');
    charts.append(
        buildTaskmgrMeter('taskmgrSuccessMeter', 'Success Rate'),
        buildTaskmgrGraph('taskmgrRunsGraph', 'Runs per Day'),
        buildTaskmgrMeter('taskmgrTimeMeter', 'Run Time'),
        buildTaskmgrGraph('taskmgrTimeGraph', 'Run Time History')
    );
    const totals = makeElement('div', 'taskmgr-totals-row');
    totals.append(
        buildTaskmgrTotals('Totals', [['Processes', 'taskmgrTotalProcesses'], ['Runs', 'taskmgrTotalRuns'], ['Failed', 'taskmgrTotalFailed']]),
        buildTaskmgrTotals(`Run Time (${TASKMGR_HISTORY_DAYS} days)`, [['Total', 'taskmgrTimeTotal'], ['Average', 'taskmgrTimeAverage'], ['Longest', 'taskmgrTimeLongest']])
    );
    performance.append(charts, totals);

    document.body.appendChild(win);

    win.querySelector('.win95-close').addEventListener('click', closeTaskManager);
    win.querySelector('.taskmgr-tabs').addEventListener('click', event => {
        const tab = event.target.closest('.taskmgr-tab');
        if (tab) selectTaskmgrTab(tab.dataset.tab);
    });
    win.querySelector('.taskmgr-tabs').addEventListener('keydown', onTaskmgrTabKeydown);
    win.querySelector('#taskmgrEndTask').addEventListener('click', endTaskmgrTask);
    win.querySelector('#taskmgrSwitchTo').addEventListener('click', switchToTaskmgrTask);
    win.querySelector('#taskmgrProperties').addEventListener('click', () => openTaskmgrProperties(taskmgrSelectedProcess));
    win.querySelector('#taskmgrEndProcess').addEventListener('click', endTaskmgrProcess);
    win.querySelector('#taskmgrRetry').addEventListener('click', () => loadTaskmgrProcesses({ force: true }));
    win.addEventListener('keydown', onTaskmgrKeydown);

    const taskRows = win.querySelector('#taskmgrTasks');
    taskRows.addEventListener('click', event => {
        const row = event.target.closest('tr');
        if (row) selectTaskmgrTask(Number(row.dataset.index));
    });
    taskRows.addEventListener('dblclick', event => {
        if (event.target.closest('tr')) switchToTaskmgrTask();
    });
    taskRows.addEventListener('keydown', event => onTaskmgrRowKeydown(event, 'tasks'));

    const processRows = win.querySelector('#taskmgrProcessRows');
    processRows.addEventListener('click', event => {
        const row = event.target.closest('tr');
        if (row) selectTaskmgrProcess(Number(row.dataset.index));
    });
    processRows.addEventListener('dblclick', event => {
        const row = event.target.closest('tr');
        if (row) openTaskmgrProperties(Number(row.dataset.index));
    });
    processRows.addEventListener('keydown', event => onTaskmgrRowKeydown(event, 'processes'));

    // Drag, stack and minimize like the other desktop windows
    WindowManager.register(win);
    // Applications follows the windows as they open and close. Only when the
    // list changes: rebuilding it mid-click would lose the click.
    WindowManager.subscribe(() => {
        if (!win.hidden && taskmgrTaskList() !== taskmgrRenderedTasks) renderTaskmgrTasks();
    });

    selectTaskmgrTab('applications', { focus: false });
    return win;
}

async function openTaskManager() {
    const opener = document.activeElement;
    await loadStylesheet('css/taskmgr.min.css');

    const win = taskmgrWindow() || buildTaskmgrWindow();
    const wasOpen = WindowManager.open(win);

    if (!wasOpen) {
        taskmgrReturnFocus = opener && opener !== document.body ? opener : null;
        centerInViewport(win);
        renderTaskmgrTasks();
    }
    win.querySelector('.taskmgr-tab[aria-selected="true"]').focus({ preventScroll: true });
    loadTaskmgrProcesses();
}

function closeTaskManager() {
    const win = taskmgrWindow();
    if (!win || win.hidden) return;

    closeTaskmgrDialog();
    WindowManager.close(win);
    if (taskmgrReturnFocus && taskmgrReturnFocus.isConnected) {
        taskmgrReturnFocus.focus({ preventScroll: true });
    }
}

// --- Tabs ------------------------------------------------------------------

function selectTaskmgrTab(name, { focus = true } = {}) {
    const win = taskmgrWindow();
    win.querySelectorAll('.taskmgr-tab').forEach(tab => {
        const selected = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus({ preventScroll: true });
    });
    win.querySelectorAll('.taskmgr-panel').forEach(panel => {
        panel.hidden = panel.getAttribute('aria-labelledby') !== `taskmgrTab${name[0].toUpperCase()}${name.slice(1)}`;
    });
}

function onTaskmgrTabKeydown(event) {
    const tabs = [...taskmgrWindow().querySelectorAll('.taskmgr-tab')];
    const index = tabs.indexOf(event.target);
    if (index === -1) return;
    const moves = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (event.key in moves) {
        event.preventDefault();
        selectTaskmgrTab(tabs[moves[event.key]].dataset.tab);
    }
}

// --- Lists -----------------------------------------------------------------

// One row is selected, and in the tab order, at a time
function selectTaskmgrRow(body, index, { focus = false } = {}) {
    const rows = [...body.rows];
    rows.forEach((row, i) => {
        row.setAttribute('aria-selected', String(i === index));
        row.tabIndex = i === index ? 0 : -1;
    });
    if (focus && rows[index]) rows[index].focus({ preventScroll: true });
}

function onTaskmgrRowKeydown(event, list) {
    const row = event.target.closest('tr');
    if (!row) return;
    const index = Number(row.dataset.index);
    const last = row.parentElement.rows.length - 1;
    const moves = { ArrowDown: Math.min(index + 1, last), ArrowUp: Math.max(index - 1, 0), Home: 0, End: last };

    if (event.key in moves) {
        event.preventDefault();
        if (list === 'tasks') selectTaskmgrTask(moves[event.key], { focus: true });
        else selectTaskmgrProcess(moves[event.key], { focus: true });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (list === 'tasks') switchToTaskmgrTask();
        else openTaskmgrProperties(index);
    } else if (event.key === 'Delete') {
        event.preventDefault();
        if (list === 'tasks') endTaskmgrTask();
        else endTaskmgrProcess();
    }
}

// --- Applications ----------------------------------------------------------

function taskmgrTasks() {
    return WindowManager.openWindows();
}

// The open windows' titles, to tell whether the list needs redrawing
function taskmgrTaskList() {
    return taskmgrTasks().map(win => WindowManager.titleOf(win)).join('\n');
}

function renderTaskmgrTasks() {
    const body = document.getElementById('taskmgrTasks');
    const tasks = taskmgrTasks();
    const hadFocus = body.contains(document.activeElement);
    taskmgrRenderedTasks = taskmgrTaskList();

    body.replaceChildren(...tasks.map((win, index) => {
        const row = makeElement('tr');
        row.dataset.index = index;
        const label = makeElement('span', 'taskmgr-task-label');
        const icon = WindowManager.iconOf(win);
        if (icon) {
            const copy = icon.cloneNode(true);
            copy.removeAttribute('id');
            copy.setAttribute('aria-hidden', 'true');
            label.append(copy);
        }
        label.append(makeElement('span', null, WindowManager.titleOf(win)));
        const name = makeElement('td', 'taskmgr-col-task');
        name.append(label);
        row.append(name, makeElement('td', 'taskmgr-col-status', 'Running'));
        return row;
    }));

    if (!tasks.includes(taskmgrSelectedTask)) taskmgrSelectedTask = tasks[0] || null;
    selectTaskmgrRow(body, tasks.indexOf(taskmgrSelectedTask), { focus: hadFocus });
    document.getElementById('taskmgrEndTask').disabled = !taskmgrSelectedTask;
    document.getElementById('taskmgrSwitchTo').disabled = !taskmgrSelectedTask;
}

function selectTaskmgrTask(index, options) {
    const tasks = taskmgrTasks();
    if (!tasks[index]) return;
    taskmgrSelectedTask = tasks[index];
    selectTaskmgrRow(document.getElementById('taskmgrTasks'), index, options);
}

// Closes the window the way its own close button would. For the main
// window that means the Shut Down dialog, as ending Explorer would.
function endTaskmgrTask() {
    if (taskmgrSelectedTask) WindowManager.requestClose(taskmgrSelectedTask);
}

// Brings the window forward. Task Manager gets out of its way, as NT4's
// "Minimize On Use" option did by default.
function switchToTaskmgrTask() {
    const win = taskmgrSelectedTask;
    if (!win) return;
    if (win === taskmgrWindow()) return;
    WindowManager.minimize(taskmgrWindow());
    WindowManager.restore(win);
    WindowManager.activate(win);
    WindowManager.focusInside(win);
}

// --- Processes -------------------------------------------------------------

async function loadTaskmgrProcesses({ force = false } = {}) {
    if (taskmgrLoading) return taskmgrLoading;
    if (!force && taskmgrFetchedAt && Date.now() - taskmgrFetchedAt < TASKMGR_REFRESH_MS) return;

    const win = taskmgrWindow();
    win.classList.add('is-loading');
    win.setAttribute('aria-busy', 'true');

    taskmgrLoading = (async () => {
        try {
            const [workflows, runs] = await Promise.all([
                fetchTaskmgrJson(`${TASKMGR_API}/workflows`),
                fetchTaskmgrJson(`${TASKMGR_API}/runs?per_page=100&exclude_pull_requests=true`)
            ]);

            // The newest 100 runs are about a month of the busy workflows. Any
            // workflow that hasn't run in that time gets asked for its own last run.
            const recentRuns = Array.isArray(runs.workflow_runs) ? runs.workflow_runs : [];
            const seen = new Set(recentRuns.map(run => run && run.workflow_id));
            const quiet = (Array.isArray(workflows.workflows) ? workflows.workflows : [])
                .filter(workflow => isTaskmgrWorkflow(workflow) && !seen.has(workflow.id));
            const lastRuns = await Promise.all(quiet.map(workflow =>
                fetchTaskmgrJson(`${TASKMGR_API}/workflows/${encodeURIComponent(workflow.id)}/runs?per_page=1&exclude_pull_requests=true`)));
            const allRuns = recentRuns.concat(...lastRuns.map(json => (Array.isArray(json.workflow_runs) ? json.workflow_runs : [])));

            const now = Date.now();
            taskmgrProcesses = buildTaskmgrProcesses(workflows, { workflow_runs: allRuns }, now);
            taskmgrFetchedAt = now;
            renderTaskmgrProcesses(now);
        } catch (loadError) {
            console.warn('Task Manager could not read the processes:', loadError);
            showTaskmgrError(loadError);
        } finally {
            win.classList.remove('is-loading');
            win.removeAttribute('aria-busy');
            taskmgrLoading = null;
        }
    })();
    return taskmgrLoading;
}

function showTaskmgrError(loadError) {
    let message = 'Unable to retrieve process information. The RPC server is unavailable.';
    if (loadError.resetAt) {
        const minutes = Math.max(1, Math.ceil((loadError.resetAt - Date.now()) / 60000));
        message = `Too many requests to GitHub. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    document.getElementById('taskmgrErrorMessage').textContent = message;
    document.getElementById('taskmgrError').hidden = false;
    document.querySelector('#taskmgrProcesses .taskmgr-list').hidden = true;
    ['taskmgrProperties', 'taskmgrEndProcess'].forEach(id => {
        document.getElementById(id).disabled = true;
    });
}

function renderTaskmgrProcesses(now) {
    document.getElementById('taskmgrError').hidden = true;
    document.querySelector('#taskmgrProcesses .taskmgr-list').hidden = false;

    const body = document.getElementById('taskmgrProcessRows');
    const hadFocus = body.contains(document.activeElement);
    body.replaceChildren(...taskmgrProcesses.map((process, index) => {
        const row = makeElement('tr', process.status === 'Not Responding' ? 'is-not-responding' : null);
        row.dataset.index = index;
        row.title = process.description;
        row.append(
            makeElement('td', 'taskmgr-col-image', process.image),
            makeElement('td', 'taskmgr-col-pid', String(process.id)),
            makeElement('td', 'taskmgr-col-status', process.status),
            makeElement('td', 'taskmgr-col-time', process.latest ? formatTaskmgrDuration(process.latest.durationMs) : '--:--:--'),
            makeElement('td', 'taskmgr-col-last', process.latest ? formatDateTime(process.latest.startedAt) : 'Never')
        );
        return row;
    }));

    taskmgrSelectedProcess = Math.min(taskmgrSelectedProcess, Math.max(0, taskmgrProcesses.length - 1));
    selectTaskmgrRow(body, taskmgrSelectedProcess, { focus: hadFocus });
    ['taskmgrProperties', 'taskmgrEndProcess'].forEach(id => {
        document.getElementById(id).disabled = !taskmgrProcesses.length;
    });

    renderTaskmgrPerformance(summarizeTaskmgrRuns(taskmgrProcesses, now));
}

function selectTaskmgrProcess(index, options) {
    if (!taskmgrProcesses[index]) return;
    taskmgrSelectedProcess = index;
    selectTaskmgrRow(document.getElementById('taskmgrProcessRows'), index, options);
}

// A workflow can't be stopped from a portfolio, and NT4 had just the words for it
function endTaskmgrProcess() {
    const process = taskmgrProcesses[taskmgrSelectedProcess];
    if (!process) return;

    openTaskmgrDialog({
        title: 'Task Manager Warning',
        icon: 'icons/warning-32.png',
        message: [
            'WARNING: Terminating a process can cause undesired results, including loss of data and system instability.',
            `Are you sure you want to terminate ${process.image}?`
        ],
        buttons: [
            { label: 'Yes', action: () => openTaskmgrDialog({
                title: 'Unable to Terminate Process',
                icon: 'icons/error-32.png',
                message: ['The operation could not be completed.', 'Access is denied.'],
                buttons: [{ label: 'OK' }]
            }) },
            { label: 'No' }
        ]
    });
}

function openTaskmgrProperties(index) {
    const process = taskmgrProcesses[index];
    if (!process) return;
    selectTaskmgrProcess(index);

    const latest = process.latest;
    const failed = process.recent.filter(run => run.failed).length;
    const result = !latest ? null : !latest.completed ? 'Running now'
        : latest.failed ? 'Failed' : latest.conclusion === 'cancelled' ? 'Cancelled' : 'Succeeded';
    const fields = [
        ['Workflow', process.name],
        ['Status', process.status],
        ['Last run', latest ? formatDateTime(latest.startedAt) : 'Never'],
        ['Started by', latest ? TASKMGR_EVENTS[latest.event] || latest.event : null],
        ['Result', result],
        ['CPU time', latest ? formatTaskmgrDuration(latest.durationMs) : null],
        [`Runs (${TASKMGR_HISTORY_DAYS} days)`, `${process.recent.length}${failed ? ` (${failed} failed)` : ''}`]
    ];

    const links = [
        latest && latest.url ? ['View last run on GitHub', latest.url] : null,
        process.workflowUrl ? ['View workflow', process.workflowUrl] : null
    ].filter(Boolean);

    openTaskmgrDialog({
        title: `${process.image} Properties`,
        icon: 'icons/system-monitor-32.png',
        heading: process.image,
        message: [process.description],
        fields,
        links,
        buttons: [{ label: 'OK' }]
    });
}

// --- Performance -----------------------------------------------------------

function renderTaskmgrMeter(id, fraction, valueText) {
    const meter = document.getElementById(id);
    const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    meter.querySelector('.taskmgr-meter-fill').style.height = `${percent}%`;
    meter.querySelector('.taskmgr-meter-value').textContent = valueText;
    meter.setAttribute('aria-valuenow', String(percent));
    meter.setAttribute('aria-valuetext', valueText);
}

// Green on black, with the grid Task Manager draws behind its lines
function renderTaskmgrGraph(id, lines, label) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const graph = document.getElementById(id);
    const max = Math.max(1, ...lines.flatMap(line => line.values));
    const parts = [];

    for (let y = 10; y < 100; y += 10) {
        const gridLine = document.createElementNS(svgNs, 'line');
        gridLine.setAttribute('class', 'taskmgr-grid');
        gridLine.setAttribute('x1', '0');
        gridLine.setAttribute('x2', '300');
        gridLine.setAttribute('y1', String(y));
        gridLine.setAttribute('y2', String(y));
        parts.push(gridLine);
    }
    for (let x = 30; x < 300; x += 30) {
        const gridLine = document.createElementNS(svgNs, 'line');
        gridLine.setAttribute('class', 'taskmgr-grid');
        gridLine.setAttribute('x1', String(x));
        gridLine.setAttribute('x2', String(x));
        gridLine.setAttribute('y1', '0');
        gridLine.setAttribute('y2', '100');
        parts.push(gridLine);
    }

    lines.forEach(({ values, className }) => {
        const step = 300 / Math.max(1, values.length - 1);
        const points = values.map((value, i) => `${(i * step).toFixed(1)},${(98 - (value / max) * 94).toFixed(1)}`);
        const line = document.createElementNS(svgNs, 'polyline');
        line.setAttribute('class', className);
        line.setAttribute('points', points.join(' '));
        parts.push(line);
    });

    graph.replaceChildren(...parts);
    graph.setAttribute('aria-label', label);
}

function renderTaskmgrPerformance(summary) {
    const days = summary.days;

    renderTaskmgrMeter('taskmgrSuccessMeter', summary.successRate === null ? 0 : summary.successRate / 100,
        summary.successRate === null ? '--' : `${summary.successRate}%`);
    renderTaskmgrMeter('taskmgrTimeMeter', summary.longestMs ? summary.averageMs / summary.longestMs : 0,
        `${Math.round(summary.averageMs / 1000)}s avg`);

    renderTaskmgrGraph('taskmgrRunsGraph', [
        { values: days.map(day => day.runs), className: 'taskmgr-line' },
        { values: days.map(day => day.failed), className: 'taskmgr-line taskmgr-line--failed' }
    ], `Runs per day over the last ${TASKMGR_HISTORY_DAYS} days: ${summary.runs} runs, ${summary.failed} failed`);
    renderTaskmgrGraph('taskmgrTimeGraph', [
        { values: days.map(day => day.ms / 1000), className: 'taskmgr-line' }
    ], `Run time per day over the last ${TASKMGR_HISTORY_DAYS} days: ${formatTaskmgrDuration(summary.totalMs)} in total`);

    const set = (id, text) => { document.getElementById(id).textContent = text; };
    set('taskmgrTotalProcesses', String(taskmgrProcesses.length));
    set('taskmgrTotalRuns', String(summary.runs));
    set('taskmgrTotalFailed', String(summary.failed));
    set('taskmgrTimeTotal', formatTaskmgrDuration(summary.totalMs));
    set('taskmgrTimeAverage', formatTaskmgrDuration(summary.averageMs));
    set('taskmgrTimeLongest', formatTaskmgrDuration(summary.longestMs));

    set('taskmgrStatusProcesses', `Processes: ${taskmgrProcesses.length}`);
    set('taskmgrStatusSuccess', `Success: ${summary.successRate === null ? '--' : `${summary.successRate}%`}`);
    set('taskmgrStatusRuns', `Runs: ${summary.runs} in ${TASKMGR_HISTORY_DAYS} days`);
}

// --- Dialogs ---------------------------------------------------------------
// Modal message boxes and the Properties sheet, in front of Task Manager

function openTaskmgrDialog({ title, icon, heading, message = [], fields = [], links = [], buttons }) {
    closeTaskmgrDialog();
    const returnFocus = document.activeElement;

    const overlay = makeElement('div', 'dead-dialog-overlay open taskmgr-dialog-overlay');
    overlay.id = 'taskmgrDialog';
    const dialog = makeElement('div', 'dead-dialog win95-window taskmgr-dialog');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'taskmgrDialogTitle');
    dialog.setAttribute('aria-describedby', 'taskmgrDialogBody');

    const titleBar = makeElement('div', 'win95-title-bar');
    const titleText = makeElement('div', 'win95-title', title);
    titleText.id = 'taskmgrDialogTitle';
    const close = makeElement('button', 'win95-button win95-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    const titleButtons = makeElement('div', 'win95-buttons');
    titleButtons.append(close);
    titleBar.append(titleText, titleButtons);

    const body = makeElement('div', 'taskmgr-dialog-body');
    body.id = 'taskmgrDialogBody';
    const image = makeElement('img', 'taskmgr-dialog-icon');
    image.src = icon;
    image.alt = '';
    image.width = image.height = 32;
    const text = makeElement('div', 'taskmgr-dialog-text');
    if (heading) text.append(makeElement('div', 'taskmgr-dialog-heading', heading));
    message.forEach(line => text.append(makeElement('p', null, line)));
    if (fields.some(([, value]) => value)) {
        const list = makeElement('dl', 'taskmgr-dialog-fields');
        fields.filter(([, value]) => value).forEach(([term, value]) => {
            list.append(makeElement('dt', null, `${term}:`), makeElement('dd', null, value));
        });
        text.append(list);
    }
    links.forEach(([label, href]) => {
        const link = makeElement('a', 'taskmgr-dialog-link', label);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        text.append(link);
    });
    body.append(image, text);

    const buttonRow = makeElement('div', 'taskmgr-dialog-buttons');
    buttons.forEach(({ label, action }) => {
        const button = makeElement('button', 'win95-btn', label);
        button.type = 'button';
        button.addEventListener('click', () => {
            closeTaskmgrDialog();
            if (action) action();
        });
        buttonRow.append(button);
    });

    dialog.append(titleBar, body, buttonRow);
    overlay.append(dialog);
    document.body.append(overlay);

    close.addEventListener('click', () => closeTaskmgrDialog());
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeTaskmgrDialog();
    });
    overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            // Only the dialog, not Task Manager behind it
            event.stopPropagation();
            closeTaskmgrDialog();
        } else if (event.key === 'Tab') {
            // It's modal, so Tab cycles through the dialog
            const focusable = [...overlay.querySelectorAll('button, a[href]')];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    overlay.returnFocus = returnFocus;
    WindowManager.makeDraggable(dialog, titleBar);
    centerInViewport(dialog);
    buttonRow.querySelector('button').focus();
}

function closeTaskmgrDialog() {
    const overlay = document.getElementById('taskmgrDialog');
    if (!overlay) return;
    overlay.remove();
    const target = overlay.returnFocus;
    if (target && target.isConnected && !taskmgrWindow().hidden) target.focus({ preventScroll: true });
}

// --- Keyboard --------------------------------------------------------------

function onTaskmgrKeydown(event) {
    if (event.key === 'Escape') {
        closeTaskManager();
    } else if (event.key === 'F5') {
        // View > Refresh Now, instead of reloading the page
        event.preventDefault();
        loadTaskmgrProcesses({ force: true });
    }
}

// Ctrl+Alt+Del, or NT4's own Ctrl+Shift+Esc. Windows keeps both for itself,
// but other systems pass them on. Caught on the way down, so the window with
// focus never sees an Escape and closes itself.
document.addEventListener('keydown', event => {
    const ctrlAltDel = event.ctrlKey && event.altKey && (event.key === 'Delete' || event.key === 'Backspace');
    const ctrlShiftEsc = event.ctrlKey && event.shiftKey && event.key === 'Escape';
    if ((ctrlAltDel || ctrlShiftEsc) && !document.body.classList.contains('startup') &&
        document.body.classList.contains('has-taskbar') && !document.body.classList.contains('is-touch-device')) {
        event.preventDefault();
        event.stopPropagation();
        openTaskManager();
    }
}, true);
