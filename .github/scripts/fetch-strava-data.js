const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Strava API credentials from environment variables
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

// Standard running distances in meters
const standardDistances = {
  '1k': 1000,
  '5k': 5000,
  '10k': 10000,
  'half_marathon': 21097.5,
  'marathon': 42195
};

// Tolerance range (in meters) for identifying activities at standard distances
const distanceTolerance = {
  '1k': 100,      // ±100m for 1K
  '5k': 250,      // ±250m for 5K
  '10k': 500,     // ±500m for 10K
  'half_marathon': 1000,  // ±1000m for half marathon
  'marathon': 2000        // ±2000m for marathon
};

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

async function fetchActivities(accessToken, page = 1, perPage = 100, allActivities = []) {
  try {
    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        per_page: perPage,
        page: page
      }
    });
    
    const activities = response.data;
    allActivities = [...allActivities, ...activities];
    
    // If we received a full page of activities, there might be more
    if (activities.length === perPage) {
      return fetchActivities(accessToken, page + 1, perPage, allActivities);
    }
    
    return allActivities;
  } catch (error) {
    console.error('Error fetching activities:', error.message);
    throw error;
  }
}

function isRunningActivity(activity) {
  return activity.type === 'Run';
}

function findPersonalBests(activities) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  
  // Initialize best times for standard distances
  const personalBests = {};
  Object.keys(standardDistances).forEach(distance => {
    personalBests[distance] = { time: Infinity, activity: null };
  });
  
  // Find fastest 1-mile time
  personalBests['1_mile'] = { time: Infinity, activity: null };
  
  // Find best activities for each standard distance
  runningActivities.forEach(activity => {
    // Calculate pace in seconds per meter
    const pacePerMeter = activity.elapsed_time / activity.distance;
    
    // Check standard distances
    Object.entries(standardDistances).forEach(([distanceKey, distanceValue]) => {
      const minDistance = distanceValue - distanceTolerance[distanceKey];
      const maxDistance = distanceValue + distanceTolerance[distanceKey];
      
      if (activity.distance >= minDistance && activity.distance <= maxDistance) {
        // Normalize time to exact distance (simple proportion)
        const normalizedTime = Math.round(pacePerMeter * distanceValue);
        
        if (normalizedTime < personalBests[distanceKey].time) {
          personalBests[distanceKey] = {
            time: normalizedTime,
            activity: {
              id: activity.id,
              name: activity.name,
              start_date: activity.start_date,
              elapsed_time: activity.elapsed_time,
              distance: activity.distance,
              normalized_time: normalizedTime,
              pace_per_km: Math.round((normalizedTime / (distanceValue / 1000)) * 10) / 10,  // seconds per km, 1 decimal
              strava_url: `https://www.strava.com/activities/${activity.id}`
            }
          };
        }
      }
      
      // Check for 1 mile (approximately 1609.34 meters)
      if (activity.distance >= 1550 && activity.distance <= 1700) {
        const normalizedTime = Math.round(pacePerMeter * 1609.34);
        
        if (normalizedTime < personalBests['1_mile'].time) {
          personalBests['1_mile'] = {
            time: normalizedTime,
            activity: {
              id: activity.id,
              name: activity.name,
              start_date: activity.start_date,
              elapsed_time: activity.elapsed_time,
              distance: activity.distance,
              normalized_time: normalizedTime,
              pace_per_km: Math.round((normalizedTime / 1.60934) * 10) / 10,  // seconds per km, 1 decimal
              strava_url: `https://www.strava.com/activities/${activity.id}`
            }
          };
        }
      }
    });
  });
  
  // Remove activities with no personal best
  Object.keys(personalBests).forEach(key => {
    if (personalBests[key].time === Infinity) {
      delete personalBests[key];
    } else {
      // Just keep the activity information, not the time
      personalBests[key] = personalBests[key].activity;
    }
  });
  
  // Format times in readable format for all PBs
  Object.keys(personalBests).forEach(key => {
    if (personalBests[key]) {
      const seconds = personalBests[key].normalized_time;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      
      personalBests[key].formatted_time = hours > 0 
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
        : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      
      // Format pace
      const paceSeconds = personalBests[key].pace_per_km;
      const paceMinutes = Math.floor(paceSeconds / 60);
      const paceRemainingSeconds = Math.round(paceSeconds % 60);
      personalBests[key].formatted_pace = `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`;
    }
  });
  
  return personalBests;
}

async function main() {
  try {
    // Get access token
    const accessToken = await getAccessToken();
    
    // Fetch all activities
    console.log('Fetching activities...');
    const activities = await fetchActivities(accessToken);
    console.log(`Retrieved ${activities.length} activities`);
    
    // Find personal bests
    console.log('Analyzing personal bests...');
    const personalBests = findPersonalBests(activities);
    
    // Add last updated timestamp
    const result = {
      personalBests,
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
