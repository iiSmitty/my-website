document.addEventListener('DOMContentLoaded', function() {
    console.log('Coffee stats script loaded');
    loadCoffeeStats();
});

async function loadCoffeeStats() {
    try {
        console.log('Loading coffee stats...');

        const response = await fetch('data/coffee-stats.json');

        if (!response.ok) {
            throw new Error(`Failed to load coffee data: ${response.status}`);
        }

        const data = await response.json();
        console.log('Coffee data loaded:', data);

        // Use the enhanced display function instead of the simple one
        updateEnhancedCoffeeDisplay(data);

    } catch (error) {
        console.error('Error loading coffee data:', error);
        updateEnhancedCoffeeDisplay(null, true);
    }
}

// Updated JavaScript to use real balance data
function updateEnhancedMetrics(totalVisits, currentBalance = null) {
    console.log('updateEnhancedMetrics called with:', { totalVisits, currentBalance });

    // Estimated cups (assuming 1.5 cups per visit on average)
    const estimatedCups = Math.round(totalVisits * 1.5);
    const estimatedCupsElement = document.getElementById('coffee-estimated-cups');
    if (estimatedCupsElement) {
        estimatedCupsElement.textContent = estimatedCups.toLocaleString();
    }

    // Monthly average (assuming started in 2024)
    const startDate = new Date('2024-01-01');
    const now = new Date();
    const monthsDiff = Math.max(1, (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth()));
    const monthlyAvg = Math.round(totalVisits / monthsDiff);

    const monthlyElement = document.getElementById('coffee-monthly-avg') ||
        document.getElementById('coffee-monthly');
    if (monthlyElement) {
        monthlyElement.textContent = `~${monthlyAvg}`;
    }

    // Loyalty status based on visit count
    const loyaltyElement = document.getElementById('coffee-loyalty-status');
    if (loyaltyElement) {
        if (totalVisits >= 150) {
            loyaltyElement.textContent = 'Platinum';
            loyaltyElement.style.background = 'linear-gradient(to right, #E5E4E2, #C0C0C0)';
        } else if (totalVisits >= 100) {
            loyaltyElement.textContent = 'Gold';
            loyaltyElement.style.background = 'linear-gradient(to right, #FFD700, #FFA500)';
        } else if (totalVisits >= 50) {
            loyaltyElement.textContent = 'Silver';
            loyaltyElement.style.background = 'linear-gradient(to right, #C0C0C0, #A0A0A0)';
        } else {
            loyaltyElement.textContent = 'Bronze';
            loyaltyElement.style.background = 'linear-gradient(to right, #CD7F32, #B8860B)';
        }
    }

    // UPDATED: Progress to next free coffee using REAL balance data
    const progressElement = document.getElementById('coffee-progress-fill');
    const progressTextElement = document.getElementById('coffee-progress-text');

    console.log('Progress elements found:', {
        progressElement: !!progressElement,
        progressTextElement: !!progressTextElement
    });

    if (progressElement && progressTextElement) {
        if (currentBalance !== null && currentBalance !== undefined) {
            // Use real balance from Seattle Coffee API
            const progressPercent = (currentBalance / 10) * 100;
            progressElement.style.width = `${progressPercent}%`;
            progressTextElement.textContent = `${currentBalance}/10 visits`;

            console.log(`✅ Updated progress with REAL balance: ${currentBalance}/10 (${progressPercent}%)`);
        } else {
            // Fallback to calculated estimate if balance not available
            const visitsTowardsFree = totalVisits % 10;
            const progressPercent = (visitsTowardsFree / 10) * 100;
            progressElement.style.width = `${progressPercent}%`;
            progressTextElement.textContent = `${visitsTowardsFree}/10 visits`;

            console.log(`⚠️ Using fallback progress calculation: ${visitsTowardsFree}/10 (currentBalance was ${currentBalance})`);
        }
    }
}

function updateEnhancedCoffeeDisplay(data, isError = false) {
    console.log('updateEnhancedCoffeeDisplay called with:', data);

    // Basic total visits
    const coffeeCountElement = document.getElementById('coffee-total-visits');

    if (coffeeCountElement) {
        if (isError || !data || !data.success) {
            coffeeCountElement.textContent = 'Error';
            coffeeCountElement.classList.add('coffee-error');
        } else {
            coffeeCountElement.textContent = data.totalSiteVisits.toLocaleString();
            coffeeCountElement.classList.remove('coffee-loading', 'coffee-error');

            // Calculate and update enhanced metrics WITH current balance
            console.log('Calling updateEnhancedMetrics with currentBalance:', data.currentBalance);
            updateEnhancedMetrics(data.totalSiteVisits, data.currentBalance);
        }
    }

    // Update last updated timestamp with SA date format (DD/MM/YYYY)
    const coffeeUpdatedElement = document.getElementById('coffee-last-updated');
    if (coffeeUpdatedElement && data && data.lastUpdated) {
        const updateDate = new Date(data.lastUpdated);

        // Format as DD/MM/YYYY for South Africa
        const day = String(updateDate.getDate()).padStart(2, '0');
        const month = String(updateDate.getMonth() + 1).padStart(2, '0');
        const year = updateDate.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        coffeeUpdatedElement.textContent = `Last synced: ${formattedDate}`;
    }
}