// Function to display distance counters
function displayDistanceCounters(counts) {
    const statsContainer = document.getElementById('statsContainer');

    // Create the main stats box
    const statsBox = document.createElement('div');
    statsBox.className = 'stats-box';

    // Create title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'stats-title-bar';
    titleBar.textContent = 'Running Stats';
    statsBox.appendChild(titleBar);

    // Create grid for counter cards
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    // Define display details for each distance type
    const distanceDetails = {
        '5k': {
            displayName: '5K Runs',
            icon: '🏃'
        },
        '10k': {
            displayName: '10K Runs',
            icon: '🏃'
        },
        'half_marathon': {
            displayName: 'Half Marathons',
            icon: '🏅'
        },
        'marathon': {
            displayName: 'Marathons',
            icon: '🏆'
        }
    };

    // Sort distances to display in logical order
    const distanceOrder = ['5k', '10k', 'half_marathon', 'marathon'];
    const sortedDistances = Object.keys(counts)
        .sort((a, b) => distanceOrder.indexOf(a) - distanceOrder.indexOf(b));

    // Create a card for each distance type
    sortedDistances.forEach(distanceKey => {
        const count = counts[distanceKey];
        const details = distanceDetails[distanceKey] ||
            { displayName: distanceKey, icon: '🏃' };

        const counterBox = document.createElement('div');
        counterBox.className = 'counter-box';

        counterBox.innerHTML = `
            <div class="counter-icon">${details.icon}</div>
            <div class="counter-title">${details.displayName}</div>
            <div class="counter-value">${count}</div>
        `;

        statsGrid.appendChild(counterBox);
    });

    statsBox.appendChild(statsGrid);
    statsContainer.appendChild(statsBox);

    // If no stats were found, hide the container
    if (sortedDistances.length === 0) {
        statsContainer.style.display = 'none';
    }
}

// Function to display personal bests
function displayPersonalBests(personalBests) {
    const pbCardsContainer = document.getElementById('pbCards');

    // Nice display names for distances
    const distanceNames = {
        '1k': '1 Kilometer',
        '5k': '5 Kilometers',
        '10k': '10 Kilometers',
        '1_mile': '1 Mile',
        'half_marathon': 'Half Marathon',
        'marathon': 'Marathon'
    };

    // Sort distances by increasing length
    const distanceOrder = ['1k', '1_mile', '5k', '10k', 'half_marathon', 'marathon'];
    const sortedDistances = Object.keys(personalBests)
        .sort((a, b) => distanceOrder.indexOf(a) - distanceOrder.indexOf(b));

    // Create Windows 95 style boxes for each PB
    sortedDistances.forEach(distance => {
        const pb = personalBests[distance];
        const date = new Date(pb.start_date);

        const pbBox = document.createElement('div');
        pbBox.className = 'pb-box';
        pbBox.innerHTML = `
            <div class="pb-title-bar">
                ${distanceNames[distance] || distance}
            </div>
            <div class="pb-content">
                <div class="pb-time strava-orange">${pb.formatted_time}</div>
                <ul class="pb-details">
                    <li>
                        <span>Pace:</span> <strong>${pb.formatted_pace}</strong>
                    </li>
                    <li>
                        <span>Date:</span> <strong>${date.toLocaleDateString()}</strong>
                    </li>
                    <li>
                        <span>Activity:</span> <strong>${pb.name}</strong>
                    </li>
                </ul>
                <div class="button-container">
                    <a href="${pb.strava_url}" class="strava-link win95-button-large" target="_blank">
                        View on Strava
                    </a>
                </div>
            </div>
        `;

        pbCardsContainer.appendChild(pbBox);
    });

    // Show a message if no PBs are found
    if (sortedDistances.length === 0) {
        pbCardsContainer.innerHTML = `
            <div class="win95-box">
                <div class="section-content">
                    No personal bests found yet. Make sure you have running activities in your Strava account.
                </div>
            </div>
        `;
    }
}

// Main function to load and display Strava data
async function loadAndDisplayStravaData() {
    try {
        // Show loading indicator
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }

        const response = await fetch('./data/strava-pbs.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const { personalBests, completedCounts, lastUpdated } = data;

        // Update last updated time with new formatting
        if (lastUpdated) {
            const formattedTime = formatCustomDateTime(lastUpdated);

            // Check if we need to create the structure or just update the text
            const lastUpdatedContainer = document.getElementById('lastUpdated');

            if (lastUpdatedContainer) {
                // Check if we have the new structure with LED indicator
                const textElement = lastUpdatedContainer.querySelector('.sync-text-content');

                if (textElement) {
                    // Just update the text content
                    textElement.textContent = `LAST UPDATED: ${formattedTime}`;
                } else {
                    // Create the new structure completely
                    lastUpdatedContainer.innerHTML = `
                        <div class="refresh-time">
                            <div class="sync-indicator"></div>
                            <div class="sync-text-content">LAST UPDATED: ${formattedTime}</div>
                        </div>
                    `;
                }
            }
        }

        // Hide loading indicator
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        // Display personal bests
        if (personalBests) {
            displayPersonalBests(personalBests);
        }

        // Display distance counters
        if (completedCounts) {
            displayDistanceCounters(completedCounts);
        }

    } catch (error) {
        console.error('Error loading data:', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="win95-box">
                    <div class="section-content">
                        Error loading personal bests data. Please check the console for details.
                    </div>
                </div>
            `;
        }

        // Also update the last updated text if it exists
        const textElement = document.getElementById('lastUpdated')?.querySelector('.sync-text-content');
        if (textElement) {
            textElement.textContent = "Error loading data.";
        }
    }
}

// Home link navigation handler
function setupHomeNavigation() {
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', function() {
            // Set a session storage flag to indicate internal navigation
            sessionStorage.setItem('internalNavigation', 'true');
            // Navigate to the home page without extension
            window.location.href = './index';
        });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayStravaData()
        .catch(error => {
            console.error('Failed to load Strava data:', error);
        });
    setupHomeNavigation();
});