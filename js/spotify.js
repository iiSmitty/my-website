// Spotify: my top artists and tracks this month, from data/spotify-data.json

function openSpotifyWindow() {
    // Re-opening an open window just brings it forward
    if (!WindowManager.open(document.getElementById('spotifyWindow'))) {
        loadSpotifyData();
    }
}

function closeSpotifyWindow() {
    WindowManager.close(document.getElementById('spotifyWindow'));
}

// data/spotify-data.json is refreshed by a GitHub Action (spotify-data-fetcher.js)
async function loadSpotifyData() {
    const lastUpdatedText = document.querySelector('#spotifyLastUpdated .sync-text-content');

    try {
        const response = await fetch('data/spotify-data.json');

        if (!response.ok) {
            throw new Error('Failed to load Spotify data');
        }

        const data = await response.json();

        if (data.topArtists) {
            displayTopArtists(data.topArtists);
        }

        if (data.topTracks) {
            displayTopTracks(data.topTracks);
        }

        if (data.lastUpdated) {
            lastUpdatedText.textContent = `LAST UPDATED: ${formatCustomDateTime(data.lastUpdated)}`;
        }

    } catch (error) {
        console.error('Error loading Spotify data:', error);
        lastUpdatedText.textContent = "Error loading data.";
    }
}

// The window has room for five artists
function displayTopArtists(artists) {
    artists.forEach((artist, index) => {
        if (index < 5) {
            const imageElement = document.getElementById(`artist-image-${index + 1}`);
            const nameElement = document.getElementById(`artist-name-${index + 1}`);

            if (imageElement && nameElement) {
                if (artist.image) {
                    imageElement.src = artist.image;
                }
                nameElement.textContent = artist.name;
            }
        }
    });
}

function displayTopTracks(tracks) {
    const tracksList = document.querySelector('.spotify-tracks-list');
    if (tracksList) {
        tracksList.innerHTML = '';

        tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'spotify-track-item';

            trackElement.innerHTML = `
                <div class="track-number">${index + 1}</div>
                <div class="track-art-container">
                    <img src="${track.albumImage || ''}" alt="${track.name}" class="track-art">
                </div>
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-artist">${track.artist}</div>
                </div>
            `;

            tracksList.appendChild(trackElement);
        });
    } else {
        console.error("Could not find spotify-tracks-list element");
    }
}

document.addEventListener('DOMContentLoaded', function() {
    WindowManager.register(document.getElementById('spotifyWindow'));
});
