const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Spotify API credentials from environment variables
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// Spotify API endpoints
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const TOP_ITEMS_ENDPOINT = 'https://api.spotify.com/v1/me/top';

// Function to get an access token using the refresh token
async function getAccessToken() {
    try {
        const response = await axios.post(
            TOKEN_ENDPOINT,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: REFRESH_TOKEN,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

// Function to fetch top items (artists or tracks) from Spotify
async function fetchTopItems(accessToken, type, timeRange = 'short_term', limit = 5) {
    try {
        console.log(`Fetching top ${type} (${timeRange})...`);
        const response = await axios.get(`${TOP_ITEMS_ENDPOINT}/${type}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                time_range: timeRange,
                limit: limit
            }
        });

        return response.data.items;
    } catch (error) {
        console.error(`Error fetching top ${type}:`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

// Function to process artists data
function processArtists(artists) {
    return artists.map(artist => ({
        name: artist.name,
        image: artist.images && artist.images.length > 0 ? artist.images[0].url : null,
        genres: artist.genres,
        popularity: artist.popularity,
        uri: artist.uri,
        url: artist.external_urls.spotify
    }));
}

// Function to process tracks data
function processTracks(tracks) {
    return tracks.map(track => {
        // Format duration (milliseconds to MM:SS)
        const minutes = Math.floor(track.duration_ms / 60000);
        const seconds = Math.floor((track.duration_ms % 60000) / 1000);
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return {
            name: track.name,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            // Changed albumArt to albumImage to match frontend expectations
            albumImage: track.album.images && track.album.images.length > 0 ? track.album.images[0].url : null,
            duration: formattedDuration,
            popularity: track.popularity,
            uri: track.uri,
            url: track.external_urls.spotify
        };
    });
}

async function main() {
    try {
        console.log('Starting Spotify data fetch...');

        // Get access token
        const accessToken = await getAccessToken();
        console.log('Access token obtained successfully');

        // Fetch top artists and tracks
        const [topArtists, topTracks] = await Promise.all([
            fetchTopItems(accessToken, 'artists', 'short_term', 5),
            fetchTopItems(accessToken, 'tracks', 'short_term', 10)
        ]);

        console.log(`Retrieved ${topArtists.length} top artists and ${topTracks.length} top tracks`);

        // Process the data
        const spotifyData = {
            topArtists: processArtists(topArtists),
            topTracks: processTracks(topTracks),
            lastUpdated: new Date().toISOString()
        };

        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Write the data to a JSON file
        const dataPath = path.join(dataDir, 'spotify-data.json');
        fs.writeFileSync(dataPath, JSON.stringify(spotifyData, null, 2));

        console.log(`Spotify data saved to ${dataPath}`);

        // Create a summary for logging
        console.log('\nTop Artists:');
        spotifyData.topArtists.forEach((artist, index) => {
            console.log(`${index + 1}. ${artist.name}`);
        });

        console.log('\nTop Tracks:');
        spotifyData.topTracks.slice(0, 5).forEach((track, index) => {
            console.log(`${index + 1}. ${track.name} by ${track.artist} (${track.duration})`);
        });

    } catch (error) {
        console.error('Error in Spotify data fetch:', error.message);
        process.exit(1);
    }
}

main();