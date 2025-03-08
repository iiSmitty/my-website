const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Strava API credentials from environment variables
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

// Standard running distances in meters
const standardDistances = {
  '400m': 400,
  '800m': 800,      // Approximately 1/2 mile
  '1k': 1000,
  '1_mile': 1609.34,
  '2_mile': 3218.69,
  '5k': 5000,
  '10k': 10000,
  '15k': 15000,
  '10_mile': 16093.4,
  '20k': 20000,
  'half_marathon': 21097.5,
  '30k': 30000,
  'marathon': 42195
};

// Tolerance range (in meters) for identifying activities at standard distances
const distanceTolerance = {
  '400m': 20,      // ±20m for 400m
  '800m': 40,      // ±40m for 800m (1/2 mile)
  '1k': 100,       // ±100m for 1K
  '1_mile': 100,   // ±100m for 1 mile
  '2_mile': 150,   // ±150m for 2 mile
  '5k': 300,       // ±300m for 5K (expanded tolerance)
  '10k': 600,      // ±600m for 10K (expanded tolerance)
  '15k': 800,      // ±800m for 15K
  '10_mile': 800,  // ±800m for 10 mile
  '20k': 1000,     // ±1000m for 20K
  'half_marathon': 1200,  // ±1200m for half marathon (expanded tolerance)
  '30k': 1500,     // ±1500m for 30K
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

async function fetchActivities(accessToken, page = 1, perPage = 200, allActivities = [], maxPages = 15) {
  try {
    console.log(`Fetching page ${page} of activities...`);
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
    
    // If we received a full page of activities and haven't reached our max page limit, continue fetching
    if (activities.length === perPage && page < maxPages) {
      // Add a short delay to avoid hitting Strava API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      return fetchActivities(accessToken, page + 1, perPage, allActivities, maxPages);
    }
    
    console.log(`Fetched a total of ${allActivities.length} activities`);
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
  console.log(`Found ${runningActivities.length} running activities`);
  
  // Initialize best times for standard distances
  const personalBests = {};
  Object.keys(standardDistances).forEach(distance => {
    personalBests[distance] = { time: Infinity, activity: null };
  });
  
  // Find best activities for each standard distance
  runningActivities.forEach(activity => {
    // Skip activities with no distance data
    if (!activity.distance || activity.distance <= 0) {
      return;
    }
    
    // Calculate pace in seconds per meter
    const pacePerMeter = activity.elapsed_time / activity.distance;
    
    // Check standard distances
    Object.entries(standardDistances).forEach(([distanceKey, distanceValue]) => {
      const minDistance = distanceValue - distanceTolerance[distanceKey];
      const maxDistance = distanceValue + distanceTolerance[distanceKey];
      
      if (activity.distance >= minDistance && activity.distance <= maxDistance) {
        // Normalize time to exact distance (simple proportion)
        const normalizedTime = Math.round(pacePerMeter * distanceValue);
        
        // Log matches for debugging
        console.log(`Found potential ${distanceKey} match: ${activity.name} - ${activity.distance}m, normalized time: ${formatTime(normalizedTime)}`);
        
        if (normalizedTime < personalBests[distanceKey].time && normalizedTime > 0) {
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
          console.log(`New PB for ${distanceKey}: ${formatTime(normalizedTime)}`);
        }
      }
    });
  });
  
  // Helper function to format time for logging
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return hours > 0 
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
      : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
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
  
  // Add display names for distances
  const displayNames = {
    '400m': '400 meters',
    '800m': '1/2 mile (800m)',
    '1k': '1 Kilometer',
    '1_mile': '1 Mile',
    '2_mile': '2 Miles',
    '5k': '5 Kilometers',
    '10k': '10 Kilometers',
    '15k': '15 Kilometers',
    '10_mile': '10 Miles',
    '20k': '20 Kilometers', 
    'half_marathon': 'Half Marathon',
    '30k': '30 Kilometers',
    'marathon': 'Marathon'
  };
  
  Object.keys(personalBests).forEach(key => {
    if (personalBests[key]) {
      personalBests[key].display_name = displayNames[key] || key;
    }
  });
  
  // Log all found PBs for debugging
  console.log("Personal Bests found:");
  Object.keys(personalBests).forEach(key => {
    console.log(`${displayNames[key] || key}: ${personalBests[key].formatted_time}`);
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
