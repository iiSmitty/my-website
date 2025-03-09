document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./data/strava-pbs.json');
        const data = await response.json();

        const { personalBests, lastUpdated } = data;

        // Update last updated time
        if (lastUpdated) {
            const date = new Date(lastUpdated);
            document.getElementById('lastUpdated').textContent = `Last updated: ${date.toLocaleString()}`;
        }

        // Hide loading indicator
        document.getElementById('loading').style.display = 'none';

        // Create cards for each personal best
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

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').innerHTML = `
            <div class="win95-box">
                <div class="section-content">
                    Error loading personal bests data. Please check the console for details.
                </div>
            </div>
        `;
    }
});

// Home link navigation handler
document.getElementById('home-link').addEventListener('click', function() {
    // Set a session storage flag to indicate internal navigation
    sessionStorage.setItem('internalNavigation', 'true');
    // Navigate to the home page without extension
    window.location.href = './index';
});