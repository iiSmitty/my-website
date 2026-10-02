/**
 * Fetches what I'm watching from Trakt and writes data/watching.json for the
 * Videos folder on the desktop (js/watching.js):
 *
 *  - current:   the show I watched most recently, unless I've finished it
 *  - previous:  the show I finished most recently
 *  - movies:    the last few movies I watched, newest first
 *
 * Reads the public Trakt profile with only a client ID. No OAuth, so there
 * are no expiring tokens for the workflow to rotate. Posters come from TMDB,
 * because Trakt doesn't allow hotlinking its images.
 *
 * The file is only written when something changed, so a quiet run doesn't
 * commit (and redeploy) the site. Any API failure exits non-zero before
 * writing, so the site keeps showing the last good data.
 *
 * Usage: TRAKT_CLIENT_ID=... TMDB_READ_TOKEN=... node .github/scripts/watching-fetcher.js
 */

const fs = require('fs');
const path = require('path');

const TRAKT_USER = 'andrez-smit';
const TRAKT_API = 'https://api.trakt.tv';
const TMDB_API = 'https://api.themoviedb.org/3';
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'watching.json');
const MOVIE_COUNT = 3;
// History has one entry per viewing, so fetch extra to find enough different movies
const MOVIE_HISTORY_LIMIT = 20;

// Trakt requires a User-Agent naming the app; Node's default ("node") gets a 403
const USER_AGENT = 'watchstack/1.0 (+https://andresmit.co.za)';

// --- API clients -------------------------------------------------------------

// The start of the response body says why a call failed (e.g. a blocked request)
async function failure(label, response) {
    const body = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    return new Error(`${label} failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
}

async function getJson(url, headers) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw await failure(`GET ${url}`, response);
    return { body: await response.json(), headers: response.headers };
}

function createTraktClient(clientId) {
    const headers = {
        'content-type': 'application/json',
        'user-agent': USER_AGENT,
        'trakt-api-version': '2',
        'trakt-api-key': clientId
    };

    async function get(pathname) {
        return (await getJson(`${TRAKT_API}${pathname}`, headers)).body;
    }

    // Follows X-Pagination-Page-Count and deep-merges each page's object
    async function getAllPages(pathname) {
        const separator = pathname.includes('?') ? '&' : '?';
        let merged = {};
        for (let page = 1; ; page++) {
            const { body, headers: responseHeaders } =
                await getJson(`${TRAKT_API}${pathname}${separator}page=${page}&limit=100`, headers);
            merged = mergeDeep(merged, body);
            const pageCount = Number(responseHeaders.get('x-pagination-page-count')) || 1;
            if (page >= pageCount) return merged;
        }
    }

    return { get, getAllPages };
}

function createTmdbClient(token) {
    const headers = { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': USER_AGENT };

    // kind is 'tv' or 'movie'. A title TMDB doesn't know just has no poster.
    return async function posterFor(kind, tmdbId) {
        if (!tmdbId) return null;
        const response = await fetch(`${TMDB_API}/${kind}/${tmdbId}`, { headers });
        if (response.status === 404) return null;
        if (!response.ok) throw await failure(`TMDB ${kind}/${tmdbId}`, response);
        return (await response.json()).poster_path || null;
    };
}

// --- Deriving the three slots ---------------------------------------------------

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(target, source) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source || {})) {
        result[key] = isPlainObject(value) && isPlainObject(result[key]) ? mergeDeep(result[key], value) : value;
    }
    return result;
}

/**
 * `watched/shows?extended=min` maps show ID -> season ID -> episode ID ->
 * watch times. (The full response is documented to include seasons, but
 * Trakt leaves them out.) Returns show Trakt ID -> episodes watched.
 */
function countWatchedEpisodes(minimal) {
    if (!isPlainObject(minimal)) throw new Error('Unexpected Trakt response for watched/shows?extended=min');
    const counts = {};
    for (const [showId, seasons] of Object.entries(minimal)) {
        counts[showId] = Object.values(seasons || {})
            .reduce((total, episodes) => total + Object.keys(episodes || {}).length, 0);
    }
    return counts;
}

/**
 * A show is finished when I've watched every aired episode. It also stays
 * finished if it's the show I last recorded as finished and I haven't watched
 * anything of it since. Otherwise a returning series would flip back to "in
 * progress" the day its next season airs.
 */
function isFinished(entry, watchedCounts, stored) {
    const aired = entry.show.aired_episodes || 0;
    if (aired > 0 && (watchedCounts[entry.show.ids.trakt] || 0) >= aired) return true;

    const storedPrevious = stored && stored.previous;
    return !!storedPrevious &&
        storedPrevious.traktId === entry.show.ids.trakt &&
        storedPrevious.finishedAt === entry.last_watched_at;
}

/** Picks the Trakt watched/shows entries for the current and previous slots */
function pickShows(watchedShows, watchedCounts, stored) {
    if (!Array.isArray(watchedShows)) throw new Error('Unexpected Trakt response for watched/shows');

    const byRecent = watchedShows
        .filter(entry => entry && entry.show && entry.show.ids && entry.last_watched_at)
        .sort((a, b) => Date.parse(b.last_watched_at) - Date.parse(a.last_watched_at));

    const latest = byRecent[0];
    const current = latest && !isFinished(latest, watchedCounts, stored) ? latest : null;
    const previous = byRecent.find(entry => entry !== current && isFinished(entry, watchedCounts, stored)) || null;
    return { current, previous };
}

/** The most recent viewing of each of the last `count` different movies, newest first */
function latestDistinctMovies(history, count) {
    const seen = new Set();
    return history
        .filter(entry => entry && entry.movie && entry.movie.ids && entry.watched_at)
        .sort((a, b) => Date.parse(b.watched_at) - Date.parse(a.watched_at))
        .filter(entry => !seen.has(entry.movie.ids.trakt) && seen.add(entry.movie.ids.trakt))
        .slice(0, count);
}

// Reuse the poster I already have for the same title, so a normal run makes no TMDB calls
async function posterFor(posterLookup, kind, tmdbId, storedItem) {
    if (storedItem && storedItem.tmdbId === tmdbId && storedItem.poster) return storedItem.poster;
    return posterLookup(kind, tmdbId);
}

function showFields(show) {
    return {
        title: show.title,
        year: show.year || null,
        traktId: show.ids.trakt,
        tmdbId: show.ids.tmdb || null,
        slug: show.ids.slug || null
    };
}

/** Everything the Videos folder shows, from Trakt and TMDB */
async function collectWatching({ trakt, posterLookup, stored }) {
    const user = `/users/${TRAKT_USER}`;
    const [watchedShows, minimal, movieHistory] = await Promise.all([
        trakt.get(`${user}/watched/shows?extended=full`),
        trakt.getAllPages(`${user}/watched/shows?extended=min`),
        trakt.get(`${user}/history/movies?limit=${MOVIE_HISTORY_LIMIT}&extended=full`)
    ]);

    const watchedCounts = countWatchedEpisodes(minimal);
    const picked = pickShows(watchedShows, watchedCounts, stored);
    const storedCurrent = stored && stored.current;
    const storedPrevious = stored && stored.previous;
    const storedMovies = (stored && Array.isArray(stored.movies)) ? stored.movies : [];

    let current = null;
    if (picked.current) {
        const show = picked.current.show;
        const [latest] = await trakt.get(`${user}/history/shows/${show.ids.trakt}?limit=1`);
        const episode = latest && latest.episode;
        current = {
            ...showFields(show),
            poster: await posterFor(posterLookup, 'tv', show.ids.tmdb, storedCurrent),
            episode: episode ? { season: episode.season, number: episode.number, title: episode.title || null } : null,
            watched: watchedCounts[show.ids.trakt] || 0,
            aired: show.aired_episodes || 0,
            lastWatchedAt: picked.current.last_watched_at
        };
    }

    let previous = null;
    if (picked.previous) {
        const show = picked.previous.show;
        previous = {
            ...showFields(show),
            poster: await posterFor(posterLookup, 'tv', show.ids.tmdb, storedPrevious),
            episodes: watchedCounts[show.ids.trakt] || show.aired_episodes || 0,
            finishedAt: picked.previous.last_watched_at
        };
    }

    if (!Array.isArray(movieHistory)) throw new Error('Unexpected Trakt response for history/movies');
    const movies = [];
    for (const entry of latestDistinctMovies(movieHistory, MOVIE_COUNT)) {
        const movie = entry.movie;
        const storedMovie = storedMovies.find(item => item && item.tmdbId === movie.ids.tmdb);
        movies.push({
            title: movie.title,
            year: movie.year || null,
            traktId: movie.ids.trakt,
            tmdbId: movie.ids.tmdb || null,
            slug: movie.ids.slug || null,
            runtime: movie.runtime || null,
            poster: await posterFor(posterLookup, 'movie', movie.ids.tmdb, storedMovie),
            watchedAt: entry.watched_at
        });
    }

    return { current, previous, movies };
}

// --- Change detection ------------------------------------------------------------

function slots(data) {
    return {
        current: (data && data.current) || null,
        previous: (data && data.previous) || null,
        movies: (data && Array.isArray(data.movies)) ? data.movies : []
    };
}

function episodeCode(episode) {
    return episode ? ` S${episode.season}E${String(episode.number).padStart(2, '0')}` : '';
}

/**
 * An in-character commit message for what changed, or null when nothing did.
 * Alfred commits the coffee stats too (generate-commit-message.js).
 */
function describeChange(stored, next) {
    const before = slots(stored);
    const after = slots(next);
    if (JSON.stringify(before) === JSON.stringify(after)) return null;

    let message;
    const sameTitle = (a, b) => !!a && !!b && a.traktId === b.traktId;

    if (after.previous && !sameTitle(before.previous, after.previous)) {
        message = `📼 ${after.previous.title} finished. Filed under read-only, sir.`;
    } else if (after.movies[0] && (!sameTitle(before.movies[0], after.movies[0]) ||
        before.movies[0].watchedAt !== after.movies[0].watchedAt)) {
        message = `🎬 ${after.movies[0].title} watched. I trust the popcorn held up, sir.`;
    } else if (after.current && !sameTitle(before.current, after.current)) {
        message = `📼 Now showing: ${after.current.title}. A new series, sir? I shall fetch the popcorn.`;
    } else if (after.current) {
        message = `📼 ${after.current.title}${episodeCode(after.current.episode)} watched. Just one more, I presume?`;
    } else {
        message = '📼 The Videos folder has been tidied, sir.';
    }

    // Titles come from Trakt; keep the message to one line
    return message.replace(/[\r\n]+/g, ' ');
}

// --- Main ----------------------------------------------------------------------------

function readStored() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
        return null; // first run
    }
}

async function main() {
    const clientId = process.env.TRAKT_CLIENT_ID;
    const tmdbToken = process.env.TMDB_READ_TOKEN;
    if (!clientId || !tmdbToken) {
        console.error('Missing required environment variables: TRAKT_CLIENT_ID, TMDB_READ_TOKEN');
        process.exit(1);
    }

    const stored = readStored();
    const next = await collectWatching({
        trakt: createTraktClient(clientId),
        posterLookup: createTmdbClient(tmdbToken),
        stored
    });

    const message = describeChange(stored, next);
    if (!message) {
        console.log('No changes');
        return;
    }

    fs.writeFileSync(DATA_PATH, JSON.stringify({ lastUpdated: new Date().toISOString(), ...next }, null, 2) + '\n');
    console.log(message);
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `message=${message}\n`);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { collectWatching, countWatchedEpisodes, describeChange, latestDistinctMovies, mergeDeep, pickShows };
