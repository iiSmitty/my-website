// Videos folder
// What I'm watching, as a Windows Explorer window: the series I'm on now, the
// last one I finished and the last few movies I saw. data/watching.json is
// refreshed from Trakt weekly by .github/workflows/update-watching.yml.
//
// Opened by double-clicking the Videos desktop icon (wired up in
// program-icons.js). Like the Skype window, nothing loads until then: the
// stylesheet, data and posters only load on first open.

const VIDEOS_DATA_URL = 'data/watching.json';
const VIDEOS_POSTER_URL = 'https://image.tmdb.org/t/p/w185';
const VIDEOS_TRAKT_URL = 'https://trakt.tv';
const VIDEOS_TRAKT_PROFILE = 'https://trakt.tv/users/andrez-smit';
const VIDEOS_FOLDER = 'C:\\My Documents\\Videos';

// Matches MOVIE_COUNT in the fetcher; more are ignored if the data ever has them
const VIDEOS_MOVIE_COUNT = 3;

// A show I haven't touched for this long is "Paused" rather than "Now playing"
const VIDEOS_STALE_DAYS = 21;
const VIDEOS_DAY_MS = 24 * 60 * 60 * 1000;

let videosStylesPromise = null;
let videosItems = [];
let videosReturnFocus = null;
let videosPropertiesReturnFocus = null;

// Same red error icon as the dead-device dialog in My Computer
const VIDEOS_ERROR_SVG = `
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#d00000" stroke="#800000" stroke-width="1"/>
        <path d="M10 10 L22 22 M22 10 L10 22" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`;

// --- Helpers ---------------------------------------------------------------

// Data from Trakt only ever reaches the page through textContent
function videosEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
}

// Load the window's stylesheet on first use. Resolves even if it fails, so the
// window still opens (unstyled) rather than not at all.
function loadVideosStyles() {
    if (!videosStylesPromise) {
        videosStylesPromise = new Promise(resolve => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/watching.min.css';
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    }
    return videosStylesPromise;
}

// DD/MM/YYYY HH:MM, the South African format used elsewhere on the site
function formatVideosDateTime(iso) {
    const date = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatVideosDate(iso) {
    return formatVideosDateTime(iso).split(' ')[0];
}

// "3 days ago", "5 weeks ago", "4 months ago"
function describeVideosAge(iso, now) {
    const days = Math.floor((now - new Date(iso)) / VIDEOS_DAY_MS);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}

function formatVideosEpisode(episode) {
    return episode ? `S${episode.season}E${String(episode.number).padStart(2, '0')}` : '';
}

function formatVideosRuntime(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

// Windows file names can't contain \ / : * ? " < > |
function videosFileName(title, extension) {
    const name = String(title).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    return `${name || 'Untitled'}.${extension}`;
}

// The 8.3 name Windows 95 keeps alongside a long file name: REACHER.AVI, DUNEPA~1.MPG
function videosDosName(fileName) {
    const dot = fileName.lastIndexOf('.');
    const base = fileName.slice(0, dot).toUpperCase();
    const extension = fileName.slice(dot + 1).toUpperCase();
    const short = base.replace(/[^A-Z0-9]/g, '') || 'VIDEO';
    const name = short.length <= 8 && short === base ? short : `${short.slice(0, 6)}~1`;
    return `${name}.${extension}`;
}

function videosHeading(item) {
    return item.year ? `${item.title} (${item.year})` : item.title;
}

function videosTraktLink(type, slug) {
    return slug ? `${VIDEOS_TRAKT_URL}/${type}/${encodeURIComponent(slug)}` : null;
}

// --- Data -> rows ----------------------------------------------------------

// The current and previous series, then the last few movies (newest first).
// A slot with nothing in it still gets a greyed-out row.
function buildVideosItems(data, now) {
    const current = data && data.current && data.current.title ? data.current : null;
    const previous = data && data.previous && data.previous.title ? data.previous : null;
    const movies = data && Array.isArray(data.movies)
        ? data.movies.filter(movie => movie && movie.title).slice(0, VIDEOS_MOVIE_COUNT)
        : [];
    const items = [];

    if (current) {
        const paused = now - new Date(current.lastWatchedAt) > VIDEOS_STALE_DAYS * VIDEOS_DAY_MS;
        const episode = formatVideosEpisode(current.episode);
        const episodeTitle = current.episode && current.episode.title ? ` "${current.episode.title}"` : '';
        const fileName = videosFileName(current.title, 'avi');
        items.push({
            fileName,
            heading: videosHeading(current),
            poster: current.poster,
            link: videosTraktLink('shows', current.slug),
            status: paused ? 'Paused' : 'Now playing',
            details: episode,
            progress: current.aired ? { watched: current.watched || 0, aired: current.aired } : null,
            modified: current.lastWatchedAt,
            lines: [
                paused ? `Paused. Last watched ${describeVideosAge(current.lastWatchedAt, now)}.` : 'Now playing',
                episode ? `${episode}${episodeTitle}` : '',
                current.aired ? `${current.watched || 0} of ${current.aired} episodes watched` : ''
            ],
            fields: [
                [['Type', 'Video Clip'], ['Location', VIDEOS_FOLDER]],
                [['Episodes', current.aired ? `${current.watched || 0} of ${current.aired} watched` : null],
                    ['Latest', episode ? `${episode}${episodeTitle}` : null],
                    ['Last watched', formatVideosDateTime(current.lastWatchedAt)]],
                [['MS-DOS name', videosDosName(fileName)]]
            ],
            readOnly: false
        });
    } else {
        items.push({ empty: true, fileName: '(empty)', status: 'Between shows', lines: ['Nothing playing right now.'] });
    }

    if (previous) {
        const fileName = videosFileName(previous.title, 'avi');
        items.push({
            fileName,
            heading: videosHeading(previous),
            poster: previous.poster,
            link: videosTraktLink('shows', previous.slug),
            status: 'Finished',
            details: previous.episodes ? `${previous.episodes} episodes` : '',
            modified: previous.finishedAt,
            lines: [
                `Finished ${formatVideosDate(previous.finishedAt)}`,
                previous.episodes ? `${previous.episodes} episodes` : ''
            ],
            fields: [
                [['Type', 'Video Clip'], ['Location', VIDEOS_FOLDER]],
                [['Episodes', previous.episodes ? `${previous.episodes} watched` : null],
                    ['Finished', formatVideosDateTime(previous.finishedAt)]],
                [['MS-DOS name', videosDosName(fileName)]]
            ],
            // Nothing more to write to it
            readOnly: true
        });
    } else {
        items.push({ empty: true, fileName: '(empty)', status: 'Nothing finished', lines: ['No finished series yet.'] });
    }

    movies.forEach(movie => {
        const fileName = videosFileName(movie.title, 'mpg');
        const runtime = formatVideosRuntime(movie.runtime);
        const details = [movie.year, runtime].filter(Boolean).join(' · ');
        items.push({
            fileName,
            heading: videosHeading(movie),
            poster: movie.poster,
            link: videosTraktLink('movies', movie.slug),
            status: 'Movie',
            details,
            modified: movie.watchedAt,
            lines: [`Watched ${formatVideosDate(movie.watchedAt)}`, details],
            fields: [
                [['Type', 'Movie Clip'], ['Location', VIDEOS_FOLDER]],
                [['Released', movie.year ? String(movie.year) : null], ['Length', runtime || null],
                    ['Watched', formatVideosDateTime(movie.watchedAt)]],
                [['MS-DOS name', videosDosName(fileName)]]
            ],
            readOnly: true
        });
    });

    if (!movies.length) {
        items.push({ empty: true, fileName: '(empty)', status: 'No movies yet', lines: ['No movies watched yet.'] });
    }

    return items;
}

// --- Window ----------------------------------------------------------------

function bringVideosWindowToFront(videosWindow) {
    document.querySelectorAll('.win95-window').forEach(win => {
        win.style.zIndex = 10;
    });
    videosWindow.style.zIndex = 100;
}

function centerVideosElement(element) {
    const rect = element.getBoundingClientRect();
    element.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + 'px';
    element.style.top = Math.max(8, (window.innerHeight - rect.height) / 2) + 'px';
}

function buildVideosWindow() {
    const videosWindow = document.createElement('div');
    videosWindow.className = 'win95-window videos-window';
    videosWindow.id = 'videosWindow';
    videosWindow.hidden = true;
    videosWindow.tabIndex = -1;
    videosWindow.setAttribute('role', 'dialog');
    videosWindow.setAttribute('aria-labelledby', 'videosWindowTitle');

    videosWindow.innerHTML = `
        <div class="win95-title-bar" id="videosTitleBar">
            <div class="win95-title" id="videosWindowTitle"><span class="VideosIcon_16x16" aria-hidden="true"></span>Videos</div>
            <div class="win95-buttons">
                <button class="win95-button win95-minimize" type="button" tabindex="-1" aria-hidden="true">_</button>
                <button class="win95-button win95-maximize" type="button" tabindex="-1" aria-hidden="true">&#9633;</button>
                <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
            </div>
        </div>

        <div class="win95-menu-bar videos-menu-bar" aria-hidden="true">
            <div class="win95-menu-item"><u>F</u>ile</div>
            <div class="win95-menu-item"><u>E</u>dit</div>
            <div class="win95-menu-item"><u>V</u>iew</div>
            <div class="win95-menu-item"><u>G</u>o</div>
            <div class="win95-menu-item">F<u>a</u>vorites</div>
            <div class="win95-menu-item"><u>H</u>elp</div>
        </div>

        <!-- Explorer's address bar: the label sits on the toolbar, outside the field -->
        <div class="videos-address">
            <span class="videos-address-label">Address</span>
            <div class="videos-address-field">
                <span class="VideosIcon_16x16" aria-hidden="true"></span>
                <span class="videos-address-path" id="videosAddress"></span>
                <span class="videos-address-drop" aria-hidden="true"></span>
            </div>
        </div>

        <div class="videos-body">
            <div class="videos-webview">
                <div class="videos-preview" id="videosPreview"></div>
                <p class="videos-credit">
                    Posters from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
            </div>

            <div class="videos-files">
                <table class="videos-list" id="videosList" role="grid" aria-labelledby="videosWindowTitle">
                    <thead>
                        <tr>
                            <th scope="col" class="videos-col-name">Name</th>
                            <th scope="col" class="videos-col-status">Status</th>
                            <th scope="col" class="videos-col-details">Details</th>
                            <th scope="col" class="videos-col-modified">Modified</th>
                        </tr>
                    </thead>
                    <tbody id="videosRows"></tbody>
                </table>

                <div class="videos-error" id="videosError" role="alert" hidden>
                    <div class="videos-error-icon">${VIDEOS_ERROR_SVG}</div>
                    <div class="videos-error-text">
                        <p><strong id="videosErrorPath"></strong></p>
                        <p>The device is not ready.</p>
                        <div class="videos-error-buttons">
                            <button class="win95-btn" type="button" id="videosRetry">Retry</button>
                            <button class="win95-btn" type="button" id="videosCancel">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="videos-statusbar">
            <span id="videosStatus">Reading...</span>
            <span>Source: <a href="${VIDEOS_TRAKT_PROFILE}" target="_blank" rel="noopener">Trakt</a></span>
        </div>`;

    document.body.appendChild(videosWindow);

    videosWindow.querySelector('#videosAddress').textContent = VIDEOS_FOLDER;
    videosWindow.querySelector('#videosErrorPath').textContent = `${VIDEOS_FOLDER} is not accessible.`;

    videosWindow.querySelector('.win95-close').addEventListener('click', closeVideosWindow);
    videosWindow.querySelector('#videosRetry').addEventListener('click', loadVideosFolder);
    videosWindow.querySelector('#videosCancel').addEventListener('click', closeVideosWindow);
    videosWindow.addEventListener('mousedown', () => bringVideosWindowToFront(videosWindow));
    videosWindow.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeVideosWindow();
    });

    const rows = videosWindow.querySelector('#videosRows');
    rows.addEventListener('click', event => {
        const row = event.target.closest('.videos-row');
        if (row) selectVideosRow(Number(row.dataset.index));
    });
    rows.addEventListener('dblclick', event => {
        const row = event.target.closest('.videos-row');
        if (row) openVideosProperties(Number(row.dataset.index));
    });
    rows.addEventListener('keydown', handleVideosRowKey);

    // Drag by the title bar, consistent with the other windows (program-icons.js)
    if (typeof makeWindowDraggable === 'function') {
        makeWindowDraggable('videosWindow', 'videosTitleBar');
    }

    return videosWindow;
}

async function openVideosWindow() {
    const opener = document.activeElement;
    await loadVideosStyles();

    const videosWindow = document.getElementById('videosWindow') || buildVideosWindow();
    const wasOpen = !videosWindow.hidden;

    videosWindow.hidden = false;
    bringVideosWindowToFront(videosWindow);

    // Re-opening an open window just brings it forward
    if (wasOpen) {
        focusSelectedVideosRow() || videosWindow.focus({ preventScroll: true });
        return;
    }

    videosReturnFocus = opener && opener !== document.body ? opener : null;
    centerVideosElement(videosWindow);
    videosWindow.focus({ preventScroll: true });
    await loadVideosFolder();
}

function closeVideosWindow() {
    const videosWindow = document.getElementById('videosWindow');
    if (!videosWindow || videosWindow.hidden) return;

    closeVideosProperties();
    videosWindow.hidden = true;

    if (videosReturnFocus && videosReturnFocus.isConnected) {
        videosReturnFocus.focus();
    }
}

// Fetched on every open, so the folder is never staler than the last deploy
async function loadVideosFolder() {
    const videosWindow = document.getElementById('videosWindow');
    const list = document.getElementById('videosList');
    const error = document.getElementById('videosError');
    const status = document.getElementById('videosStatus');

    videosWindow.setAttribute('aria-busy', 'true');
    videosWindow.classList.add('is-loading');
    status.textContent = 'Reading...';

    try {
        const response = await fetch(VIDEOS_DATA_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        videosItems = buildVideosItems(data, new Date());
        renderVideosRows();
        list.hidden = false;
        error.hidden = true;

        const files = videosItems.filter(item => !item.empty).length;
        status.textContent = `${files} object(s)`;

        // Only take focus if it's still on this window (it may have moved on while loading)
        const hadFocus = videosWindow.contains(document.activeElement);
        selectVideosRow(0, { focus: hadFocus });
    } catch (loadError) {
        console.warn('Could not read the Videos folder:', loadError);
        videosItems = [];
        list.hidden = true;
        error.hidden = false;
        status.textContent = '0 object(s)';
        renderVideosPreview(null);
        if (videosWindow.contains(document.activeElement)) {
            document.getElementById('videosRetry').focus();
        }
    } finally {
        videosWindow.removeAttribute('aria-busy');
        videosWindow.classList.remove('is-loading');
    }
}

// --- File list -------------------------------------------------------------

function buildVideosProgress({ watched, aired }) {
    const bar = videosEl('span', 'videos-progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(aired));
    bar.setAttribute('aria-valuenow', String(Math.min(watched, aired)));
    bar.setAttribute('aria-label', `${watched} of ${aired} episodes watched`);
    bar.title = `${watched} of ${aired} episodes`;

    const fill = videosEl('span', 'videos-progress-fill');
    fill.style.width = `${Math.min(100, (watched / aired) * 100)}%`;
    bar.append(fill);
    return bar;
}

function buildVideosRow(item, index) {
    const row = videosEl('tr', item.empty ? 'videos-row videos-row--empty' : 'videos-row');
    row.dataset.index = index;
    row.tabIndex = -1;
    row.setAttribute('aria-selected', 'false');

    const label = videosEl('span', 'videos-name-label');
    if (!item.empty) {
        const icon = videosEl('span', 'VideoFileIcon_16x16');
        icon.setAttribute('aria-hidden', 'true');
        label.append(icon);
    }
    // A long name is shortened before the extension, so ".avi"/".mpg" stays visible
    const name = videosEl('span', 'videos-name-text');
    const dot = item.empty ? -1 : item.fileName.lastIndexOf('.');
    if (dot > 0) {
        name.append(
            videosEl('span', 'videos-name-base', item.fileName.slice(0, dot)),
            videosEl('span', 'videos-name-ext', item.fileName.slice(dot))
        );
    } else {
        name.append(videosEl('span', 'videos-name-base', item.fileName));
    }
    label.append(name);
    const nameCell = videosEl('td', 'videos-name');
    nameCell.title = item.fileName;
    nameCell.append(label);

    const details = videosEl('div', 'videos-details-inner');
    if (item.details) details.append(videosEl('span', null, item.details));
    if (item.progress) details.append(buildVideosProgress(item.progress));
    const detailsCell = videosEl('td', 'videos-details');
    detailsCell.append(details);

    const modifiedCell = videosEl('td', 'videos-modified');
    if (item.modified) {
        const time = videosEl('time', null, formatVideosDateTime(item.modified));
        time.dateTime = item.modified;
        modifiedCell.append(time);
    }

    row.append(nameCell, videosEl('td', 'videos-status', item.status), detailsCell, modifiedCell);
    return row;
}

function renderVideosRows() {
    document.getElementById('videosRows')
        .replaceChildren(...videosItems.map((item, index) => buildVideosRow(item, index)));
}

// One row is selected and in the tab order at a time, like an Explorer list
function selectVideosRow(index, { focus = true } = {}) {
    const rows = document.querySelectorAll('#videosRows .videos-row');
    if (!rows[index]) return;

    rows.forEach((row, i) => {
        row.setAttribute('aria-selected', String(i === index));
        row.tabIndex = i === index ? 0 : -1;
    });
    if (focus) rows[index].focus();
    renderVideosPreview(videosItems[index]);
}

function focusSelectedVideosRow() {
    const row = document.querySelector('#videosRows .videos-row[aria-selected="true"]');
    if (row) row.focus();
    return !!row;
}

function handleVideosRowKey(event) {
    const row = event.target.closest('.videos-row');
    if (!row) return;

    const index = Number(row.dataset.index);
    const last = videosItems.length - 1;
    const moves = {
        ArrowDown: Math.min(index + 1, last),
        ArrowUp: Math.max(index - 1, 0),
        Home: 0,
        End: last
    };

    if (event.key in moves) {
        event.preventDefault();
        selectVideosRow(moves[event.key]);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        openVideosProperties(index);
    }
}

// --- Web view pane ---------------------------------------------------------
// The IE4 "View as Web Page" panel: describes whatever's selected

function buildVideosPoster(item) {
    const frame = videosEl('div', 'videos-poster');
    const showFallback = () => {
        const fallback = videosEl('span', 'videos-poster-fallback');
        fallback.setAttribute('role', 'img');
        fallback.setAttribute('aria-label', 'No poster');
        frame.replaceChildren(fallback);
    };

    // Only ever a TMDB file path like /abc123.jpg
    if (!item.poster || !/^\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(item.poster)) {
        showFallback();
        return frame;
    }

    const img = new Image(120, 180);
    img.alt = `Poster for ${item.heading}`;
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', showFallback, { once: true });
    img.src = VIDEOS_POSTER_URL + item.poster;
    frame.append(img);
    return frame;
}

function renderVideosPreview(item) {
    const preview = document.getElementById('videosPreview');
    if (!item) {
        preview.replaceChildren(videosEl('p', 'videos-hint', 'Select an item to view its description.'));
        return;
    }

    const parts = [];
    if (!item.empty) {
        parts.push(buildVideosPoster(item), videosEl('div', 'videos-preview-title', item.heading));
    }
    item.lines.filter(Boolean).forEach(line => parts.push(videosEl('div', 'videos-preview-line', line)));

    if (item.link) {
        const link = videosEl('a', 'videos-preview-link', 'View on Trakt');
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noopener';
        parts.push(link);
    }
    preview.replaceChildren(...parts);
}

// --- Properties dialog -----------------------------------------------------

function buildVideosProperties() {
    const overlay = document.createElement('div');
    overlay.id = 'videosProperties';
    overlay.className = 'dead-dialog-overlay';
    overlay.innerHTML = `
        <div class="dead-dialog win95-window videos-props" id="videosPropertiesWindow"
             role="dialog" aria-modal="true" aria-labelledby="videosPropertiesTitle">
            <div class="win95-title-bar" id="videosPropertiesTitleBar">
                <div class="win95-title" id="videosPropertiesTitle"></div>
                <div class="win95-buttons">
                    <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
                </div>
            </div>
            <div class="videos-props-tabs" aria-hidden="true">
                <span class="videos-props-tab">General</span>
            </div>
            <div class="videos-props-sheet">
                <div class="videos-props-head">
                    <span class="VideoFileIcon_32x32" aria-hidden="true"></span>
                    <span id="videosPropertiesName"></span>
                </div>
                <div id="videosPropertiesFields"></div>
                <div class="videos-props-attributes">
                    <span>Attributes:</span>
                    <label><input type="checkbox" id="videosReadOnly" disabled> Read-only</label>
                    <label><input type="checkbox" disabled> Hidden</label>
                    <label><input type="checkbox" checked disabled> Archive</label>
                </div>
            </div>
            <div class="videos-props-buttons">
                <button class="win95-btn" type="button" data-close>OK</button>
                <button class="win95-btn" type="button" data-close>Cancel</button>
                <button class="win95-btn" type="button" disabled>Apply</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close], .win95-close').forEach(button => {
        button.addEventListener('click', closeVideosProperties);
    });

    // Click outside the dialog (on the backdrop) closes it
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeVideosProperties();
    });

    overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            // Only the dialog, not the Videos window behind it
            event.stopPropagation();
            closeVideosProperties();
        } else if (event.key === 'Tab') {
            trapVideosPropertiesFocus(event, overlay);
        }
    });

    makeWindowDraggable('videosPropertiesWindow', 'videosPropertiesTitleBar');
    return overlay;
}

// It's modal, so Tab cycles through the dialog's buttons
function trapVideosPropertiesFocus(event, overlay) {
    const focusable = [...overlay.querySelectorAll('button:not([disabled])')];
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

function openVideosProperties(index) {
    const item = videosItems[index];
    if (!item || item.empty) return;

    selectVideosRow(index);
    videosPropertiesReturnFocus = document.activeElement;

    const overlay = document.getElementById('videosProperties') || buildVideosProperties();
    overlay.querySelector('#videosPropertiesTitle').textContent = `${item.fileName} Properties`;
    overlay.querySelector('#videosPropertiesName').textContent = item.fileName;
    overlay.querySelector('#videosReadOnly').checked = item.readOnly;

    // Groups of label/value pairs with an etched line between them, like the real sheet
    const groups = item.fields.map(group => {
        const list = videosEl('dl', 'videos-props-fields');
        group.filter(([, value]) => value).forEach(([label, value]) => {
            list.append(videosEl('dt', null, `${label}:`), videosEl('dd', null, value));
        });
        return list;
    });
    overlay.querySelector('#videosPropertiesFields').replaceChildren(...groups);

    overlay.classList.add('open');
    centerVideosElement(overlay.querySelector('#videosPropertiesWindow'));
    overlay.querySelector('[data-close]').focus();
}

function closeVideosProperties() {
    const overlay = document.getElementById('videosProperties');
    if (!overlay || !overlay.classList.contains('open')) return;

    overlay.classList.remove('open');
    if (videosPropertiesReturnFocus && videosPropertiesReturnFocus.isConnected) {
        videosPropertiesReturnFocus.focus();
    }
}
