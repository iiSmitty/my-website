const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Strava API credentials from environment variables
const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

// Standard running distances in meters - simplified to only what we need
const standardDistances = {
  '5k': 5000,
  '10k': 10000,
  'half_marathon': 21097.5
};

// Tolerance range (in meters) for identifying activities at standard distances
const distanceTolerance = {
  '5k': 300,       // ±300m for 5K
  '10k': 600,      // ±600m for 10K
  'half_marathon': 1200  // ±1200m for half marathon
};

// Helper function to format time for logging
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

async function fetchActivities(accessToken, page = 1, perPage = 200, allActivities = [], maxPages = 30) {
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchActivities(accessToken, page + 1, perPage, allActivities, maxPages);
    }

    console.log(`Fetched a total of ${allActivities.length} activities`);
    return allActivities;
  } catch (error) {
    console.error('Error fetching activities:', error.message);
    throw error;
  }
}

async function fetchSpecificActivity(accessToken, activityId) {
  try {
    console.log(`Fetching specific activity ${activityId}...`);
    const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching activity ${activityId}:`, error.message);
    return null;
  }
}

function isRunningActivity(activity) {
  return activity.type === 'Run' || activity.type === 'Trail Run';
}

async function findPersonalBests(activities, accessToken) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Found ${runningActivities.length} running activities`);

  // Initialize best times for standard distances
  const personalBests = {};
  Object.keys(standardDistances).forEach(distance => {
    personalBests[distance] = { time: Infinity, activity: null };
  });

  // First pass: Look for actual fastest times for each distance
  console.log("Looking for best times for each standard distance...");

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

        // Log potential matches for debugging
        console.log(`Potential ${distanceKey} match: ${activity.name} - ${formatTime(normalizedTime)}`);

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
              pace_per_km: Math.round((normalizedTime / (distanceValue / 1000)) * 10) / 10,
              strava_url: `https://www.strava.com/activities/${activity.id}`
            }
          };
          console.log(`New best time for ${distanceKey}: ${formatTime(normalizedTime)}`);
        }
      }
    });
  });

  // Define fallback values for when no activities match a distance category
  const fallbackPBs = {
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

  // Only use fallbacks if we didn't find ANY matching activity
  Object.entries(fallbackPBs).forEach(([distance, fallback]) => {
    if (!personalBests[distance].activity) {
      console.log(`No ${distance} activity found. Using fallback time ${formatTime(fallback.time)}`);
      personalBests[distance] = {
        time: fallback.time,
        activity: {
          id: "fallback-" + distance,
          name: fallback.name,
          start_date: new Date().toISOString(),
          elapsed_time: fallback.time,
          distance: standardDistances[distance],
          normalized_time: fallback.time,
          pace_per_km: Math.round((fallback.time / (standardDistances[distance] / 1000)) * 10) / 10,
          strava_url: "https://www.strava.com/athlete/you"
        }
      };
    }
  });

  // Remove intermediate time property and just keep the activities
  const finalBests = {};
  Object.keys(personalBests).forEach(key => {
    if (personalBests[key].activity) {
      finalBests[key] = personalBests[key].activity;
    }
  });

  // Format times for all PBs
  Object.keys(finalBests).forEach(key => {
    if (finalBests[key]) {
      const seconds = finalBests[key].normalized_time;
      finalBests[key].formatted_time = formatTime(seconds);

      // Format pace
      const paceSeconds = finalBests[key].pace_per_km;
      const paceMinutes = Math.floor(paceSeconds / 60);
      const paceRemainingSeconds = Math.round(paceSeconds % 60);
      finalBests[key].formatted_pace = `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`;
    }
  });

  // Add display names for distances
  const displayNames = {
    '5k': '5 Kilometers',
    '10k': '10 Kilometers',
    'half_marathon': 'Half Marathon'
  };

  Object.keys(finalBests).forEach(key => {
    if (finalBests[key]) {
      finalBests[key].display_name = displayNames[key] || key;
    }
  });

  // Log all found PBs for debugging
  console.log("Personal Bests found:");
  Object.keys(finalBests).forEach(key => {
    console.log(`${displayNames[key] || key}: ${finalBests[key].formatted_time}`);
  });

  return finalBests;
}

function countCompletedDistances(activities) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Total running activities for counting: ${runningActivities.length}`);

  // Initialize counters
  const completedCounts = {
    '5k': 0,
    '10k': 0,
    'half_marathon': 0,
    'marathon': 0
  };

  // Track uncategorized runs
  let uncategorizedRuns = [];
  let zeroDistanceRuns = 0;

  // Define distance thresholds (in meters)
  const distanceThresholds = {
    '5k': { min: 4700, target: 5000, max: 9499 },         // 5K range
    '10k': { min: 9500, target: 10000, max: 19999 },      // 10K range
    'half_marathon': { min: 20000, target: 21097.5, max: 39999 }, // Half-marathon range
    'marathon': { min: 40000, target: 42195, max: Infinity }  // Marathon and above
  };

  // Count activities, placing each in best matching category
  runningActivities.forEach(activity => {
    // Skip activities with no distance data
    if (!activity.distance || activity.distance <= 0) {
      zeroDistanceRuns++;
      return;
    }

    // Find the appropriate category for this activity
    let bestMatch = null;

    // Check which distance category this activity belongs to
    for (const [distanceKey, threshold] of Object.entries(distanceThresholds)) {
      if (activity.distance >= threshold.min && activity.distance < threshold.max) {
        bestMatch = distanceKey;
        break; // Stop at the first matching category (ordered from shortest to longest)
      }
    }

    // If we found a matching category, increment its counter
    if (bestMatch) {
      completedCounts[bestMatch]++;
    } else {
      // Track activities that don't match any category
      uncategorizedRuns.push({
        name: activity.name || "Unnamed activity",
        distance: activity.distance,
        type: activity.type,
        id: activity.id
      });
    }
  });

  // Calculate total categorized runs
  const totalCategorized = Object.values(completedCounts).reduce((sum, count) => sum + count, 0);

  console.log("Completed Runs Summary:");
  Object.entries(completedCounts).forEach(([distance, count]) => {
    console.log(`${distance}: ${count}`);
  });
  console.log(`Total categorized: ${totalCategorized}`);
  console.log(`Zero distance runs: ${zeroDistanceRuns}`);
  console.log(`Uncategorized runs: ${uncategorizedRuns.length}`);

  if (uncategorizedRuns.length > 0) {
    console.log("Sample of uncategorized runs:");
    uncategorizedRuns.slice(0, 5).forEach(run => {
      console.log(`  ${run.name}: ${run.distance}m (${run.type})`);
    });

    // Show distribution of uncategorized runs
    const distanceBuckets = {
      "< 1km": 0,
      "1-2km": 0,
      "2-3km": 0,
      "3-4km": 0,
      "4-4.7km": 0,
      "Other": 0
    };

    uncategorizedRuns.forEach(run => {
      const distance = run.distance;
      if (distance < 1000) distanceBuckets["< 1km"]++;
      else if (distance < 2000) distanceBuckets["1-2km"]++;
      else if (distance < 3000) distanceBuckets["2-3km"]++;
      else if (distance < 4000) distanceBuckets["3-4km"]++;
      else if (distance < 4700) distanceBuckets["4-4.7km"]++;
      else distanceBuckets["Other"]++;
    });

    console.log("Distribution of uncategorized runs:");
    Object.entries(distanceBuckets).forEach(([range, count]) => {
      console.log(`  ${range}: ${count}`);
    });
  }

  return completedCounts;
}

async function main() {
  try {
    // Get access token
    const accessToken = await getAccessToken();

    // Load existing PR data if available
    let existingData = {};
    const dataPath = path.join(process.cwd(), 'data', 'strava-pbs.json');

    if (fs.existsSync(dataPath)) {
      try {
        console.log('Loading existing PR data...');
        existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log('Existing PR data loaded successfully');
      } catch (error) {
        console.warn('Error loading existing PR data, will create new file:', error.message);
      }
    }

    // Get the date of the last processed activity
    let lastActivityDate = null;
    if (existingData.lastUpdated) {
      lastActivityDate = new Date(existingData.lastUpdated);
      console.log(`Last update was on ${lastActivityDate.toISOString()}`);
    }

    // Fetch activities, prioritizing newer ones
    console.log('Fetching activities...');
    const activities = await fetchActivities(accessToken);
    console.log(`Retrieved ${activities.length} activities`);

    // REMOVE THIS AFTER TESTING
    // DEBUG CODE - No await here, so it's safe
    const targetActivityId = 14003519637; // Your new PR activity ID
    const targetActivity = activities.find(a => a.id == targetActivityId);
    if (targetActivity) {
      console.log("\n====== DEBUGGING TARGET ACTIVITY ======");
      console.log("Found target activity:", targetActivity.name);
      console.log("Distance:", targetActivity.distance, "meters");
      console.log("Time:", formatTime(targetActivity.elapsed_time));

      // Force check this specific activity
      const distanceKey = '5k';
      const distanceValue = standardDistances[distanceKey];
      const pacePerMeter = targetActivity.elapsed_time / targetActivity.distance;
      const normalizedTime = Math.round(pacePerMeter * distanceValue);
      console.log("Normalized time for 5K:", formatTime(normalizedTime));

      // Get current PR for this distance
      if (existingData.personalBests && existingData.personalBests[distanceKey]) {
        const currentBestTime = existingData.personalBests[distanceKey].normalized_time;
        console.log("Current best time:", formatTime(currentBestTime));
        console.log("Is new time better?", normalizedTime < currentBestTime);
      } else {
        console.log("No existing PR found for 5K");
      }
      console.log("====================================\n");
    } else {
      console.log("\n⚠️ Target activity ID 14003519637 NOT found in fetched activities!");
      console.log("This could indicate the activity wasn't fetched or has a different ID");
      console.log("====================================\n");
    }

    // Identify activities we haven't processed yet
    // We'll still analyze all activities for counting purposes, but
    // for PR detection we'll focus on new ones
    let newActivities = activities;
    if (lastActivityDate) {
      // Filter to activities created or updated since last check
      newActivities = activities.filter(activity => {
        const activityDate = new Date(activity.start_date);
        return activityDate > lastActivityDate;
      });
      console.log(`Found ${newActivities.length} new activities since last update`);
    }

    // Initialize PR data structure if not exists
    if (!existingData.personalBests) {
      // This will do a full analysis of all activities
      console.log('No existing PR data, analyzing all activities...');
      existingData.personalBests = await findAllPersonalBests(activities, accessToken);
    } else {
      // Check if any new activities beat existing PRs
      console.log('Checking for new PRs among recent activities...');
      await checkForNewPRs(newActivities, existingData.personalBests, accessToken);
    }

    // Always update the completed counts with all activities
    console.log('Counting completed distances...');
    existingData.completedCounts = countCompletedDistances(activities);
    existingData.lastUpdated = new Date().toISOString();

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write the updated data to a JSON file
    fs.writeFileSync(
        dataPath,
        JSON.stringify(existingData, null, 2)
    );

    console.log('Personal bests data updated successfully');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Function to check new activities against existing PRs
async function checkForNewPRs(activities, existingPRs, accessToken) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Checking ${runningActivities.length} new running activities for PRs`);

  let prUpdates = 0;

  // For each activity, check if it beats any existing PR
  for (const activity of runningActivities) {
    // Skip activities with no distance data
    if (!activity.distance || activity.distance <= 0) {
      continue;
    }

    // Check each standard distance
    Object.entries(standardDistances).forEach(([distanceKey, distanceValue]) => {
      const minDistance = distanceValue - distanceTolerance[distanceKey];
      const maxDistance = distanceValue + distanceTolerance[distanceKey];

      // If this activity is in the right distance range
      if (activity.distance >= minDistance && activity.distance <= maxDistance) {
        // Calculate normalized time for the exact distance
        const pacePerMeter = activity.elapsed_time / activity.distance;
        const normalizedTime = Math.round(pacePerMeter * distanceValue);

        // Get current PR for this distance if it exists
        let currentBestTime = Infinity;
        if (existingPRs[distanceKey]) {
          currentBestTime = existingPRs[distanceKey].normalized_time;
        }

        // If this activity beats the existing PR
        if (normalizedTime < currentBestTime) {
          console.log(`New PR for ${distanceKey}!`);
          console.log(`Old time: ${formatTime(currentBestTime)}`);
          console.log(`New time: ${formatTime(normalizedTime)}`);
          console.log(`Activity: ${activity.name} (${new Date(activity.start_date).toLocaleDateString()})`);

          // Update the PR
          existingPRs[distanceKey] = {
            id: activity.id,
            name: activity.name,
            start_date: activity.start_date,
            elapsed_time: activity.elapsed_time,
            distance: activity.distance,
            normalized_time: normalizedTime,
            pace_per_km: Math.round((normalizedTime / (distanceValue / 1000)) * 10) / 10,
            formatted_time: formatTime(normalizedTime),
            strava_url: `https://www.strava.com/activities/${activity.id}`,
            display_name: getDisplayName(distanceKey)
          };

          // Update formatted pace
          const paceSeconds = existingPRs[distanceKey].pace_per_km;
          const paceMinutes = Math.floor(paceSeconds / 60);
          const paceRemainingSeconds = Math.round(paceSeconds % 60);
          existingPRs[distanceKey].formatted_pace =
              `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`;

          prUpdates++;
        }
      }
    });
  }

  console.log(`Updated ${prUpdates} personal records`);
  return prUpdates > 0;
}

// Helper function to get display name for a distance
function getDisplayName(distanceKey) {
  const displayNames = {
    '5k': '5 Kilometers',
    '10k': '10 Kilometers',
    'half_marathon': 'Half Marathon'
  };
  return displayNames[distanceKey] || distanceKey;
}

// Full analysis function (used only when no existing data is available)
async function findAllPersonalBests(activities, accessToken) {
  // This would be your original logic to find best times across all activities
  // Use the simpler version that just finds the best time for each distance

  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Found ${runningActivities.length} running activities for initial PR analysis`);

  // Initialize best times for standard distances
  const personalBests = {};

  // Check each activity against each standard distance
  runningActivities.forEach(activity => {
    // Skip activities with no distance data
    if (!activity.distance || activity.distance <= 0) {
      return;
    }

    // Check standard distances
    Object.entries(standardDistances).forEach(([distanceKey, distanceValue]) => {
      const minDistance = distanceValue - distanceTolerance[distanceKey];
      const maxDistance = distanceValue + distanceTolerance[distanceKey];

      if (activity.distance >= minDistance && activity.distance <= maxDistance) {
        // Normalize time to exact distance
        const pacePerMeter = activity.elapsed_time / activity.distance;
        const normalizedTime = Math.round(pacePerMeter * distanceValue);

        // If we don't have a PR for this distance yet, or this is faster
        if (!personalBests[distanceKey] || normalizedTime < personalBests[distanceKey].normalized_time) {
          personalBests[distanceKey] = {
            id: activity.id,
            name: activity.name,
            start_date: activity.start_date,
            elapsed_time: activity.elapsed_time,
            distance: activity.distance,
            normalized_time: normalizedTime,
            pace_per_km: Math.round((normalizedTime / (distanceValue / 1000)) * 10) / 10,
            strava_url: `https://www.strava.com/activities/${activity.id}`,
            display_name: getDisplayName(distanceKey)
          };

          // Format the time
          personalBests[distanceKey].formatted_time = formatTime(normalizedTime);

          // Format pace
          const paceSeconds = personalBests[distanceKey].pace_per_km;
          const paceMinutes = Math.floor(paceSeconds / 60);
          const paceRemainingSeconds = Math.round(paceSeconds % 60);
          personalBests[distanceKey].formatted_pace =
              `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`;

          console.log(`Found initial PR for ${distanceKey}: ${personalBests[distanceKey].formatted_time}`);
        }
      }
    });
  });

  // Log all found PRs
  console.log("Initial Personal Records found:");
  Object.keys(personalBests).forEach(key => {
    console.log(`${personalBests[key].display_name}: ${personalBests[key].formatted_time}`);
  });

  return personalBests;
}

main();