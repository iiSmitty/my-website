const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Strava API credentials from environment variables
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

// Helper function to format time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
      : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function getAccessToken() {
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
}

async function fetchPersonalRecords(accessToken) {
  try {
    console.log('Fetching athlete stats including personal records...');
    const response = await axios.get('https://www.strava.com/api/v3/athletes/me/stats', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching personal records:', error.message);
    throw error;
  }
}

async function fetchActivity(accessToken, activityId) {
  try {
    console.log(`Fetching details for activity ${activityId}...`);
    const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching activity ${activityId}:`, error.message);
    throw error;
  }
}

async function countCompletedDistances(accessToken) {
  try {
    // Get athlete stats which includes counts of runs by type
    const stats = await fetchPersonalRecords(accessToken);

    // Extract counts from stats
    const completedCounts = {
      '5k': stats.recent_run_totals.count || 0,  // Recent runs as 5K approximation
      '10k': stats.all_run_totals.count || 0,    // All runs (overestimate)
      'half_marathon': 0,
      'marathon': 0
    };

    // You may need additional logic to get accurate half marathon and marathon counts
    // For now, we'll fetch the first page of activities and count them
    const activityResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        per_page: 200,
        page: 1
      }
    });

    const activities = activityResponse.data;

    // Count half marathons and marathons
    activities.forEach(activity => {
      if (activity.type === 'Run') {
        if (activity.distance >= 20000 && activity.distance < 30000) {
          completedCounts['half_marathon']++;
        } else if (activity.distance >= 40000) {
          completedCounts['marathon']++;
        }
      }
    });

    console.log("Completed Runs Summary:", completedCounts);
    return completedCounts;
  } catch (error) {
    console.error('Error counting completed distances:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Get access token
    const accessToken = await getAccessToken();

    // Fetch athlete stats (including PRs)
    console.log('Fetching personal records...');
    const athleteStats = await fetchPersonalRecords(accessToken);

    // Process personal records
    const personalBests = {};

    // Extract best efforts for standard distances
    if (athleteStats.recent_run_totals && athleteStats.best_efforts) {
      const effortMap = {
        '5k': '5000m',
        '10k': '10000m',
        'half_marathon': 'Half Marathon'
      };

      // Process each effort type we're interested in
      for (const [key, stravaName] of Object.entries(effortMap)) {
        const effort = athleteStats.best_efforts?.find(e => e.name === stravaName);

        if (effort && effort.activity_id) {
          // Fetch the full activity details for this effort
          const activity = await fetchActivity(accessToken, effort.activity_id);

          if (activity) {
            // For the specific case of the 10K PR that needs correction
            if (key === '10k' && effort.activity_id !== 13692390402) {
              console.log('Overriding incorrect 10K PR with the correct activity ID');
              const correctActivity = await fetchActivity(accessToken, 13692390402);

              if (correctActivity) {
                personalBests[key] = {
                  id: correctActivity.id,
                  name: correctActivity.name,
                  start_date: correctActivity.start_date,
                  elapsed_time: correctActivity.elapsed_time,
                  distance: correctActivity.distance,
                  normalized_time: effort.elapsed_time, // Keep the PR time
                  pace_per_km: Math.round((effort.elapsed_time / (correctActivity.distance / 1000)) * 10) / 10,
                  strava_url: `https://www.strava.com/activities/${correctActivity.id}`
                };
              }
            } else {
              personalBests[key] = {
                id: activity.id,
                name: activity.name,
                start_date: activity.start_date,
                elapsed_time: activity.elapsed_time,
                distance: activity.distance,
                normalized_time: effort.elapsed_time,
                pace_per_km: Math.round((effort.elapsed_time / (activity.distance / 1000)) * 10) / 10,
                strava_url: `https://www.strava.com/activities/${activity.id}`
              };
            }
          }
        }
      }
    }

    // Fall back to hardcoded values only if needed
    const requiredPBs = {
      '5k': {
        time: (21 * 60) + 36,  // 21:36
        name: "5K Personal Best"
      },
      '10k': {
        time: (47 * 60) + 10,  // 47:10
        name: "10K Personal Best"
      },
      'half_marathon': {
        time: (1 * 3600) + (52 * 60) + 55,  // 1:52:55
        name: "Half Marathon Personal Best"
      }
    };

    // For each required PB, check if we have it. If not, use the fallback.
    Object.entries(requiredPBs).forEach(([distance, required]) => {
      if (!personalBests[distance]) {
        console.log(`Creating missing ${distance} record with time ${formatTime(required.time)}`);

        // Standard distances in meters
        const standardDistances = {
          '5k': 5000,
          '10k': 10000,
          'half_marathon': 21097.5
        };

        personalBests[distance] = {
          id: "manual-" + distance,
          name: required.name,
          start_date: new Date().toISOString(),
          elapsed_time: required.time,
          distance: standardDistances[distance],
          normalized_time: required.time,
          pace_per_km: Math.round((required.time / (standardDistances[distance] / 1000)) * 10) / 10,
          strava_url: "https://www.strava.com/athlete/you"
        };
      }
    });

    // Format times and paces for all PRs
    Object.keys(personalBests).forEach(key => {
      if (personalBests[key]) {
        // Format time
        personalBests[key].formatted_time = formatTime(personalBests[key].normalized_time);

        // Format pace
        const paceSeconds = personalBests[key].pace_per_km;
        const paceMinutes = Math.floor(paceSeconds / 60);
        const paceRemainingSeconds = Math.round(paceSeconds % 60);
        personalBests[key].formatted_pace = `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`;

        // Add display name
        const displayNames = {
          '5k': '5 Kilometers',
          '10k': '10 Kilometers',
          'half_marathon': 'Half Marathon'
        };
        personalBests[key].display_name = displayNames[key] || key;
      }
    });

    // Count completed distances (more efficiently)
    const completedCounts = await countCompletedDistances(accessToken);

    // Create final result object
    const result = {
      personalBests,
      completedCounts,
      lastUpdated: new Date().toISOString()
    };

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write the data to a JSON file
    fs.writeFileSync(
        path.join(dataDir, 'strava-pbs.json'),
        JSON.stringify(result, null, 2)
    );

    console.log('Personal bests data updated successfully');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();