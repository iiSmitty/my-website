const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectWatching, countWatchedEpisodes, describeChange, latestDistinctMovies, mergeDeep, pickShows } = require('../watching-fetcher.js');

// Shapes match what Trakt actually returns for andrez-smit (October 2026)

function watchedShow(traktId, title, aired, lastWatchedAt, tmdb = traktId + 1000) {
    return {
        plays: 1,
        last_watched_at: lastWatchedAt,
        last_updated_at: lastWatchedAt,
        reset_at: null,
        show: { title, year: 2004, aired_episodes: aired, network: 'FOX', ids: { trakt: traktId, slug: title.toLowerCase(), tmdb } }
    };
}

// show ID -> season ID -> episode ID -> watch times, n episodes in one season
function minimalFor(entries) {
    const minimal = {};
    for (const [showId, episodes] of Object.entries(entries)) {
        const season = {};
        for (let i = 1; i <= episodes; i++) season[`${showId}0${i}`] = ['2026-10-01T14:45:00.000Z'];
        minimal[showId] = { [`${showId}9`]: season };
    }
    return minimal;
}

const HOUSE = watchedShow(1399, 'House', 177, '2026-10-02T12:42:00.000Z');
const REACHER = watchedShow(2400, 'Reacher', 32, '2026-09-16T19:00:00.000Z');
const ABANDONED = watchedShow(3000, 'Lost', 121, '2025-01-01T19:00:00.000Z');

function fakeTrakt({ shows, minimal, movies = [], history = {} }) {
    const calls = [];
    return {
        calls,
        async get(pathname) {
            calls.push(pathname);
            if (pathname.includes('/watched/shows?extended=full')) return shows;
            if (pathname.includes('/history/movies')) return movies;
            const showHistory = pathname.match(/\/history\/shows\/(\d+)/);
            if (showHistory) return history[showHistory[1]] || [];
            throw new Error(`Unexpected call ${pathname}`);
        },
        async getAllPages(pathname) {
            calls.push(pathname);
            return minimal;
        }
    };
}

function fakePosters() {
    const calls = [];
    const lookup = async (kind, id) => {
        calls.push(`${kind}/${id}`);
        return `/${kind}-${id}.jpg`;
    };
    lookup.calls = calls;
    return lookup;
}

test('counts watched episodes per show across seasons', () => {
    const minimal = {
        1399: { 4016: { 74343: ['a'], 74344: ['b'] }, 4017: { 74400: ['c', 'd'] } },
        2400: {}
    };
    assert.deepEqual(countWatchedEpisodes(minimal), { 1399: 3, 2400: 0 });
    assert.throws(() => countWatchedEpisodes([]), /Unexpected Trakt response/);
});

test('merges paged responses without losing episodes of a show split across pages', () => {
    const merged = mergeDeep({ 1: { 10: { 100: ['a'] } } }, { 1: { 10: { 101: ['b'] } }, 2: { 20: {} } });
    assert.deepEqual(merged, { 1: { 10: { 100: ['a'], 101: ['b'] } }, 2: { 20: {} } });
});

test('the latest unfinished show is current and the latest finished one is previous', () => {
    const counts = { 1399: 31, 2400: 32, 3000: 10 };
    const { current, previous } = pickShows([REACHER, ABANDONED, HOUSE], counts, null);
    assert.equal(current.show.title, 'House');
    assert.equal(previous.show.title, 'Reacher');
});

test('finishing the latest show leaves nothing current', () => {
    const counts = { 1399: 177, 2400: 32 };
    const { current, previous } = pickShows([HOUSE, REACHER], counts, null);
    assert.equal(current, null);
    assert.equal(previous.show.title, 'House');
});

test('a finished show stays finished when its next season airs', () => {
    // Reacher gained 8 aired episodes, but I haven't watched any of them
    const reacherS5 = watchedShow(2400, 'Reacher', 40, '2026-09-16T19:00:00.000Z');
    const stored = { previous: { traktId: 2400, finishedAt: '2026-09-16T19:00:00.000Z' } };
    const { current, previous } = pickShows([reacherS5], { 2400: 32 }, stored);
    assert.equal(current, null);
    assert.equal(previous.show.title, 'Reacher');

    // Once I start season 5 it's in progress again
    const watchingS5 = watchedShow(2400, 'Reacher', 40, '2026-11-01T19:00:00.000Z');
    const restarted = pickShows([watchingS5], { 2400: 33 }, stored);
    assert.equal(restarted.current.show.title, 'Reacher');
    assert.equal(restarted.previous, null);
});

test('rejects a watched/shows response that is not a list', () => {
    assert.throws(() => pickShows({ error: 'nope' }, {}, null), /Unexpected Trakt response/);
});

test('collects all three slots with episode details and posters', async () => {
    const trakt = fakeTrakt({
        shows: [REACHER, HOUSE],
        minimal: minimalFor({ 1399: 31, 2400: 32 }),
        movies: [{ watched_at: '2026-09-20T18:00:00.000Z', movie: { title: 'Dune: Part Two', year: 2024, runtime: 166, ids: { trakt: 500, slug: 'dune-part-two-2024', tmdb: 693134 } } }],
        history: { 1399: [{ episode: { season: 2, number: 9, title: 'Deception' } }] }
    });
    const posterLookup = fakePosters();

    const data = await collectWatching({ trakt, posterLookup, stored: null });

    assert.deepEqual(data.current, {
        title: 'House', year: 2004, traktId: 1399, tmdbId: 2399, slug: 'house',
        poster: '/tv-2399.jpg',
        episode: { season: 2, number: 9, title: 'Deception' },
        watched: 31, aired: 177, lastWatchedAt: '2026-10-02T12:42:00.000Z'
    });
    assert.deepEqual(data.previous, {
        title: 'Reacher', year: 2004, traktId: 2400, tmdbId: 3400, slug: 'reacher',
        poster: '/tv-3400.jpg', episodes: 32, finishedAt: '2026-09-16T19:00:00.000Z'
    });
    assert.deepEqual(data.movies, [{
        title: 'Dune: Part Two', year: 2024, traktId: 500, tmdbId: 693134, slug: 'dune-part-two-2024',
        runtime: 166, poster: '/movie-693134.jpg', watchedAt: '2026-09-20T18:00:00.000Z'
    }]);
});

test('reuses stored posters instead of asking TMDB again', async () => {
    const trakt = fakeTrakt({ shows: [REACHER, HOUSE], minimal: minimalFor({ 1399: 31, 2400: 32 }) });
    const posterLookup = fakePosters();
    const stored = {
        current: { tmdbId: 2399, poster: '/house.jpg' },
        previous: { tmdbId: 3400, poster: '/reacher.jpg', traktId: 2400, finishedAt: REACHER.last_watched_at }
    };

    const data = await collectWatching({ trakt, posterLookup, stored });

    assert.equal(data.current.poster, '/house.jpg');
    assert.equal(data.previous.poster, '/reacher.jpg');
    assert.deepEqual(posterLookup.calls, []);
});

test('an empty profile gives three empty slots', async () => {
    const trakt = fakeTrakt({ shows: [], minimal: {} });
    const data = await collectWatching({ trakt, posterLookup: fakePosters(), stored: null });
    assert.deepEqual(data, { current: null, previous: null, movies: [] });
});

test('nothing changed means no commit', () => {
    const data = { current: { traktId: 1, title: 'House' }, previous: null, movies: [] };
    assert.equal(describeChange({ lastUpdated: 'yesterday', ...data }, data), null);
});

test('describes what changed, in character', () => {
    const house = (number) => ({ traktId: 1399, title: 'House', episode: { season: 2, number } });
    const reacher = { traktId: 2400, title: 'Reacher' };
    const dune = { traktId: 500, title: 'Dune: Part Two', watchedAt: 'a' };

    assert.equal(describeChange({ current: house(9) }, { current: house(10) }),
        '📼 House S2E10 watched. Just one more, I presume?');
    assert.equal(describeChange({ current: house(9) }, { current: { traktId: 7, title: 'Severance' } }),
        '📼 Now showing: Severance. A new series, sir? I shall fetch the popcorn.');
    assert.equal(describeChange({ current: reacher }, { previous: reacher }),
        '📼 Reacher finished. Filed under read-only, sir.');
    assert.equal(describeChange({}, { movies: [dune] }),
        '🎬 Dune: Part Two watched. I trust the popcorn held up, sir.');
    assert.equal(describeChange({ movies: [dune] }, { movies: [{ ...dune, watchedAt: 'b' }] }),
        '🎬 Dune: Part Two watched. I trust the popcorn held up, sir.');
    assert.equal(describeChange({}, { current: { traktId: 1, title: 'Line\nbreak' } }),
        '📼 Now showing: Line break. A new series, sir? I shall fetch the popcorn.');
});

function viewing(traktId, title, watchedAt) {
    return { watched_at: watchedAt, movie: { title, year: 2000, ids: { trakt: traktId, tmdb: traktId + 1000 } } };
}

test('the last three different movies, newest first, with a rewatch counted once', () => {
    const history = [
        viewing(1, 'Alien', '2026-09-01T19:00:00.000Z'),
        viewing(2, 'Heat', '2026-09-30T19:00:00.000Z'),
        viewing(1, 'Alien', '2026-09-28T19:00:00.000Z'),
        viewing(3, 'Jaws', '2026-09-20T19:00:00.000Z'),
        viewing(4, 'Up', '2026-08-01T19:00:00.000Z')
    ];
    const picked = latestDistinctMovies(history, 3);
    assert.deepEqual(picked.map(entry => entry.movie.title), ['Heat', 'Alien', 'Jaws']);
    // The rewatch keeps its latest date
    assert.equal(picked[1].watched_at, '2026-09-28T19:00:00.000Z');
});

test('reuses each stored movie poster by TMDB ID', async () => {
    const trakt = fakeTrakt({
        shows: [],
        minimal: {},
        movies: [viewing(2, 'Heat', '2026-09-30T19:00:00.000Z'), viewing(1, 'Alien', '2026-09-28T19:00:00.000Z')]
    });
    const posterLookup = fakePosters();
    const stored = { movies: [{ tmdbId: 1001, poster: '/alien.jpg' }] };

    const data = await collectWatching({ trakt, posterLookup, stored });

    assert.deepEqual(data.movies.map(movie => movie.poster), ['/movie-1002.jpg', '/alien.jpg']);
    assert.deepEqual(posterLookup.calls, ['movie/1002']);
});

test('the commit message names the newest movie', () => {
    const heat = { traktId: 2, title: 'Heat', watchedAt: 'b' };
    const alien = { traktId: 1, title: 'Alien', watchedAt: 'a' };
    assert.equal(describeChange({ movies: [alien] }, { movies: [heat, alien] }),
        '🎬 Heat watched. I trust the popcorn held up, sir.');
});
