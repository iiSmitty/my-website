const { test } = require('node:test');
const assert = require('node:assert/strict');
const { describeChange, formatDuration, processArtists, processTracks } = require('../spotify-data-fetcher.js');

function data(artists, tracks) {
    return {
        topArtists: artists.map(name => ({ name })),
        topTracks: tracks.map(([name, artist]) => ({ name, artist }))
    };
}

test('a new top artist is named, with the one it replaced', () => {
    const before = data(['Ramones'], [['Exile', 'Francois van Coke']]);
    const after = data(['Francois van Coke'], [['Exile', 'Francois van Coke']]);
    assert.equal(describeChange(before, after), '🎧 Francois van Coke has taken the top spot from Ramones. Noted, sir.');
});

test('a new top track is named when the top artist holds', () => {
    const before = data(['Ramones'], [['Exile', 'Francois van Coke']]);
    const after = data(['Ramones'], [['Pyro', 'Kings of Leon']]);
    assert.equal(describeChange(before, after), '🎧 New favourite: Pyro by Kings of Leon. On repeat, I gather.');
});

test('an unchanged top gets a quieter line', () => {
    const same = data(['Ramones'], [['Exile', 'Francois van Coke']]);
    assert.equal(describeChange(same, same), '🎧 Ramones still tops the charts. Another week of the same records, sir.');
});

test('a first run, or an empty month, still gets a message', () => {
    assert.equal(describeChange(null, data(['Ramones'], [])), '🎧 The Spotify records are filed, sir.');
    assert.equal(describeChange(data(['Ramones'], []), data([], [])), '🎧 Nothing on the gramophone this month, sir. The records are filed regardless.');
});

test('names from Spotify cannot break the message onto two lines', () => {
    const before = data(['Ramones'], []);
    const after = data(['Line\nBreak'], []);
    assert.doesNotMatch(describeChange(before, after), /\n/);
});

test('Spotify items are shaped the way the Spotify window expects', () => {
    const [artist] = processArtists([{
        name: 'Ramones', images: [{ url: 'a.jpg' }], genres: ['punk'], popularity: 70,
        uri: 'spotify:artist:1', external_urls: { spotify: 'https://open.spotify.com/artist/1' }
    }]);
    assert.deepEqual(artist, {
        name: 'Ramones', image: 'a.jpg', genres: ['punk'], popularity: 70,
        uri: 'spotify:artist:1', url: 'https://open.spotify.com/artist/1'
    });

    const [track] = processTracks([{
        name: 'Exile', artists: [{ name: 'A' }, { name: 'B' }], album: { name: 'LP', images: [] },
        duration_ms: 187000, popularity: 50, uri: 'spotify:track:1', external_urls: { spotify: 'https://open.spotify.com/track/1' }
    }]);
    assert.deepEqual(track, {
        name: 'Exile', artist: 'A, B', album: 'LP', albumImage: null, duration: '3:07',
        popularity: 50, uri: 'spotify:track:1', url: 'https://open.spotify.com/track/1'
    });
});

test('durations are minutes and zero-padded seconds', () => {
    assert.equal(formatDuration(65000), '1:05');
    assert.equal(formatDuration(600000), '10:00');
});
