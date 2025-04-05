const axios = require('axios');
const qs = require('querystring');

// Get credentials from environment variables
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

async function refreshAccessToken() {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error('Missing required environment variables');
        process.exit(1);
    }

    try {
        console.log('Starting Spotify token refresh...');
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
            },
            data: qs.stringify({
                grant_type: 'refresh_token',
                refresh_token: REFRESH_TOKEN
            })
        });

        console.log('Access token refreshed successfully');

        // Return the access token to be used by other scripts
        return response.data.access_token;
    } catch (error) {
        console.error('Error refreshing token:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

// This can be run directly or imported as a module
if (require.main === module) {
    refreshAccessToken().then(token => {
        console.log('Access token:', token);
    });
} else {
    module.exports = { refreshAccessToken };
}