/**
 * Saves my top artists and tracks of the last month from Spotify to
 * data/spotify-data.json, for the Spotify window and PC Health.
 *
 * Alfred commits the result, so this also prints an in-character commit
 * message for what changed, and passes it to the workflow as the step output
 * `message`. The file is rewritten every run (lastUpdated always moves), so
 * there is always something to commit.
 *
 * No dependencies: Node's built-in fetch does the talking.
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'spotify-data.json');
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const TOP_ITEMS_ENDPOINT = 'https://api.spotify.com/v1/me/top';
const TIME_RANGE = 'short_term'; // roughly the last four weeks
const TOP_ARTISTS = 5;
const TOP_TRACKS = 10;
const REQUEST_TIMEOUT_MS = 15000;

// --- Spotify --------------------------------------------------------------------------

async function spotifyJson(url, options) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${url}: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    return JSON.parse(text);
}

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
    const data = await spotifyJson(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        }).toString()
    });
    return data.access_token;
}

async function fetchTopItems(accessToken, type, limit) {
    const url = `${TOP_ITEMS_ENDPOINT}/${type}?${new URLSearchParams({ time_range: TIME_RANGE, limit: String(limit) })}`;
    const data = await spotifyJson(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    return data.items || [];
}

// --- Shaping --------------------------------------------------------------------------

function firstImage(images) {
    return Array.isArray(images) && images.length > 0 ? images[0].url : null;
}

function processArtists(artists) {
    return artists.map(artist => ({
        name: artist.name,
        image: firstImage(artist.images),
        genres: artist.genres,
        popularity: artist.popularity,
        uri: artist.uri,
        url: artist.external_urls.spotify
    }));
}

/** "3:07" from milliseconds */
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function processTracks(tracks) {
    return tracks.map(track => ({
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        albumImage: firstImage(track.album.images),
        duration: formatDuration(track.duration_ms),
        popularity: track.popularity,
        uri: track.uri,
        url: track.external_urls.spotify
    }));
}

// --- Commit message -------------------------------------------------------------------

function topName(list) {
    return Array.isArray(list) && list[0] && typeof list[0].name === 'string' ? list[0].name : null;
}

/**
 * An in-character commit message for what changed at the top. Alfred commits
 * the coffee and watching data too (generate-commit-message.js, watching-fetcher.js).
 */
function describeChange(before, after) {
    const oldArtist = topName(before && before.topArtists);
    const newArtist = topName(after.topArtists);
    const oldTrack = topName(before && before.topTracks);
    const newTrack = topName(after.topTracks);

    let message;
    if (!newArtist && !newTrack) {
        message = '🎧 Nothing on the gramophone this month, sir. The records are filed regardless.';
    } else if (newArtist && oldArtist && newArtist !== oldArtist) {
        message = `🎧 ${newArtist} has taken the top spot from ${oldArtist}. Noted, sir.`;
    } else if (newTrack && oldTrack && newTrack !== oldTrack) {
        message = `🎧 New favourite: ${newTrack} by ${after.topTracks[0].artist}. On repeat, I gather.`;
    } else if (newArtist && oldArtist) {
        message = `🎧 ${newArtist} still tops the charts. Another week of the same records, sir.`;
    } else {
        message = '🎧 The Spotify records are filed, sir.';
    }
    // Names come from Spotify; keep the message to one line
    return message.replace(/[\r\n]+/g, ' ');
}

// --- Main -----------------------------------------------------------------------------

function readStored() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
        return null; // first run
    }
}

async function main() {
    const credentials = {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
    };
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
        console.error('Missing required environment variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN');
        process.exit(1);
    }

    const accessToken = await getAccessToken(credentials);
    const [artists, tracks] = await Promise.all([
        fetchTopItems(accessToken, 'artists', TOP_ARTISTS),
        fetchTopItems(accessToken, 'tracks', TOP_TRACKS)
    ]);

    const next = {
        topArtists: processArtists(artists),
        topTracks: processTracks(tracks),
        lastUpdated: new Date().toISOString()
    };
    const message = describeChange(readStored(), next);

    fs.writeFileSync(DATA_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Saved ${next.topArtists.length} artists and ${next.topTracks.length} tracks`);
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

module.exports = { describeChange, formatDuration, processArtists, processTracks };
