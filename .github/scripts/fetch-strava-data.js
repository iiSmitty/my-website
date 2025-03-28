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

function isRunningActivity(activity) {
  return activity.type === 'Run' || activity.type === 'Trail Run';
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

async function fetchDetailedActivity(accessToken, activityId) {
  try {
    console.log(`Fetching detailed activity ${activityId}...`);
    const response = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching detailed activity ${activityId}:`, error.message);
    return null;
  }
}

async function findCalculatedPersonalBests(activities) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Found ${runningActivities.length} running activities for calculating PRs`);

  // Initialize structure for storing PRs
  const personalBests = {};

  // Process each activity to find best times for each standard distance
  runningActivities.forEach(activity => {
    // Skip activities with invalid data
    if (!activity.distance || activity.distance <= 0 || !activity.elapsed_time || activity.elapsed_time <= 0) {
      return;
    }

    // Check each standard distance
    Object.entries(standardDistances).forEach(([distanceKey, distanceValue]) => {
      const minDistance = distanceValue - distanceTolerance[distanceKey];
      const maxDistance = distanceValue + distanceTolerance[distanceKey];

      if (activity.distance >= minDistance && activity.distance <= maxDistance) {
        // Calculate normalized time
        const pacePerMeter = activity.elapsed_time / activity.distance;
        const normalizedTime = Math.round(pacePerMeter * distanceValue);

        // If this is faster than current best (or we haven't found one yet)
        if (!personalBests[distanceKey] || normalizedTime < personalBests[distanceKey].normalized_time) {
          // Calculate pace
          const pacePerKm = Math.round((normalizedTime / (distanceValue / 1000)) * 10) / 10;
          const paceMinutes = Math.floor(pacePerKm / 60);
          const paceRemainingSeconds = Math.round(pacePerKm % 60);

          personalBests[distanceKey] = {
            id: activity.id,
            name: activity.name,
            start_date: activity.start_date,
            elapsed_time: activity.elapsed_time,
            distance: activity.distance,
            normalized_time: normalizedTime,
            pace_per_km: pacePerKm,
            formatted_time: formatTime(normalizedTime),
            formatted_pace: `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`,
            strava_url: `https://www.strava.com/activities/${activity.id}`,
            display_name: getDisplayName(distanceKey)
          };
        }
      }
    });
  });

  // Log results
  console.log("\nCalculated PRs found:");
  Object.keys(standardDistances).forEach(distance => {
    if (personalBests[distance]) {
      console.log(`${getDisplayName(distance)}: ${personalBests[distance].formatted_time}`);
    } else {
      console.log(`${getDisplayName(distance)}: Not found by calculation`);
    }
  });

  return personalBests;
}

// Find PRs using Strava's best efforts data
async function findPersonalBests(activities, accessToken) {
  // Filter only running activities
  const runningActivities = activities.filter(isRunningActivity);
  console.log(`Found ${runningActivities.length} running activities to check for best efforts`);

  // Initialize structure to store best efforts
  const personalBests = {};

  // Map effort names as they appear in Strava to our standardized keys
  const effortNameMap = {
    '5k': '5k',
    '10k': '10k',
    'Half-Marathon': 'half_marathon'
  };

  // Set of target distances we're looking for
  const targetDistances = new Set(Object.keys(effortNameMap));
  console.log(`Looking for PRs for these distances: ${Array.from(targetDistances).join(', ')}`);

  // Start with most recent activities (most likely to contain PRs)
  const sortedActivities = [...runningActivities].sort(
      (a, b) => new Date(b.start_date) - new Date(a.start_date)
  );

  // Take the top 30 most recent activities - adjust as needed
  const recentActivities = sortedActivities.slice(0, 30);

  console.log(`Analyzing ${recentActivities.length} most recent activities for best efforts...`);

  // Track which distances we've found PRs for
  const foundDistances = new Set();

  // Process activities until we've found all the PRs we're looking for
  for (const activity of recentActivities) {
    if (targetDistances.size === foundDistances.size) {
      console.log("Found all target PRs, stopping search");
      break;
    }

    console.log(`Checking activity ${activity.name} (${activity.id}) from ${new Date(activity.start_date).toLocaleDateString()} for best efforts...`);
    const detailedActivity = await fetchDetailedActivity(accessToken, activity.id);

    if (!detailedActivity || !detailedActivity.best_efforts || detailedActivity.best_efforts.length === 0) {
      console.log(`No best efforts found for activity ${activity.id}`);
      continue;
    }

    console.log(`Found ${detailedActivity.best_efforts.length} best efforts in activity`);

    for (const effort of detailedActivity.best_efforts) {
      // Skip if this isn't a standard distance we're tracking
      if (!targetDistances.has(effort.name)) continue;

      // Skip if we already found this distance
      if (foundDistances.has(effort.name)) continue;

      // Check if this is a PR (pr_rank of 1)
      if (effort.pr_rank === 1) {
        const ourKey = effortNameMap[effort.name];
        console.log(`Found PR for ${effort.name} (${ourKey}): ${formatTime(effort.elapsed_time)}`);

        // Calculate pace
        const pacePerKm = effort.elapsed_time / (effort.distance / 1000);
        const paceMinutes = Math.floor(pacePerKm / 60);
        const paceRemainingSeconds = Math.round(pacePerKm % 60);

        personalBests[ourKey] = {
          id: activity.id,
          name: activity.name,
          start_date: activity.start_date,
          elapsed_time: effort.elapsed_time,
          distance: effort.distance,
          normalized_time: effort.elapsed_time,
          pace_per_km: Math.round(pacePerKm * 10) / 10,
          formatted_time: formatTime(effort.elapsed_time),
          formatted_pace: `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/km`,
          strava_url: `https://www.strava.com/activities/${activity.id}`,
          display_name: getDisplayName(ourKey)
        };

        foundDistances.add(effort.name);
      } else {
        console.log(`Found effort for ${effort.name} but it's not a PR (rank: ${effort.pr_rank})`);
      }
    }
  }

  // Log final PRs found
  console.log("\nBest Efforts PRs found:");
  Object.keys(standardDistances).forEach(distance => {
    if (personalBests[distance]) {
      console.log(`${getDisplayName(distance)}: ${personalBests[distance].formatted_time}`);
    } else {
      console.log(`${getDisplayName(distance)}: Not found via best efforts`);
    }
  });

  return personalBests;
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

    // Fetch activities
    console.log('Fetching activities...');
    const activities = await fetchActivities(accessToken);
    console.log(`Retrieved ${activities.length} activities`);

    // Find personal bests using best efforts data
    console.log('Finding personal bests using Strava best efforts...');
    existingData.personalBests = await findPersonalBests(activities, accessToken);

    // If we couldn't find all PRs with best efforts, fall back to our calculation method
    const missingDistances = Object.keys(standardDistances).filter(
        distance => !existingData.personalBests[distance]
    );

    if (missingDistances.length > 0) {
      console.log(`\nCouldn't find PRs for these distances using best efforts: ${missingDistances.join(', ')}`);
      console.log('Falling back to calculated PRs for these distances...');

      // Get calculated PRs for all distances using the calculation method
      const calculatedPRs = await findCalculatedPersonalBests(activities);

      // Only use calculated PRs for distances where we couldn't find best efforts
      missingDistances.forEach(distance => {
        if (calculatedPRs[distance]) {
          console.log(`Using calculated PR for ${distance}: ${calculatedPRs[distance].formatted_time}`);
          existingData.personalBests[distance] = calculatedPRs[distance];
        }
      });
    }

    // Count completed distances
    console.log('Counting completed distances...');
    existingData.completedCounts = countCompletedDistances(activities);
    existingData.lastUpdated = new Date().toISOString();

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Validate PRs before writing to file
    if (validatePRs(existingData.personalBests)) {
      // Write the updated data to a JSON file
      fs.writeFileSync(
          dataPath,
          JSON.stringify(existingData, null, 2)
      );
      console.log('Personal bests data updated successfully');
    } else {
      console.error('Skipping file write due to invalid PR data');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
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

// Add this to your main function, right before saving the data
function validatePRs(personalBests) {
  console.log("\nValidating PRs before saving...");
  let hasInvalidPRs = false;

  Object.entries(personalBests).forEach(([key, pr]) => {
    if (!pr || !pr.normalized_time || pr.normalized_time <= 0 || pr.formatted_time === "0:00") {
      console.error(`ERROR: Invalid ${key} PR detected: ${pr ? pr.formatted_time : 'undefined'}`);
      hasInvalidPRs = true;
    } else {
      console.log(`✓ Valid ${key} PR: ${pr.formatted_time}`);
    }
  });

  if (hasInvalidPRs) {
    console.error("WARNING: Some PRs appear to be invalid. Check the data before proceeding.");
  } else {
    console.log("All PRs validated successfully!");
  }

  return !hasInvalidPRs;
}

main();