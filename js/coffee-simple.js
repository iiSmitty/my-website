document.addEventListener('DOMContentLoaded', function() {
    loadCoffeeStats();
});

// The loyalty card gives one point per drink bought; 10 points is a free one
const POINTS_PER_FREE = 10;

async function loadCoffeeStats() {
    try {
        const response = await fetch('data/coffee-stats.json');

        if (!response.ok) {
            throw new Error(`Failed to load coffee data: ${response.status}`);
        }

        const data = await response.json();
        updateEnhancedCoffeeDisplay(data);

    } catch (error) {
        console.error('Error loading coffee data:', error);
        updateEnhancedCoffeeDisplay(null, true);
    }
}

function loyaltyTier(totalVisits) {
    if (totalVisits >= 150) return 'platinum';
    if (totalVisits >= 100) return 'gold';
    if (totalVisits >= 50) return 'silver';
    return 'bronze';
}

/**
 * Everything the panel shows, worked out from the stats file. The free coffee
 * figures are null for a file written before the loyalty API was read for them.
 */
function deriveCoffeeMetrics(data) {
    const visits = data.totalSiteVisits;
    const balance = data.currentBalance || 0;
    const hasFree = Number.isFinite(data.freeBeveragesRedeemed) && Number.isFinite(data.freeBeveragesAvailable);
    const redeemed = hasFree ? data.freeBeveragesRedeemed : null;
    const available = hasFree ? data.freeBeveragesAvailable : null;
    const earned = hasFree ? redeemed + available : null;
    // Every point ever earned is a drink bought; free ones are on top of that
    const bought = hasFree ? earned * POINTS_PER_FREE + balance : null;
    const cups = hasFree ? bought + redeemed : null;

    // Monthly average (started in 2024)
    const startDate = new Date('2024-01-01');
    const now = new Date();
    const months = Math.max(1, (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth()));

    return {
        visits, balance, redeemed, available, earned, bought, cups,
        monthly: Math.round(visits / months),
        perVisit: cups !== null && visits > 0 ? cups / visits : null,
        tier: loyaltyTier(visits)
    };
}

function monthlyText(monthly) {
    if (monthly < 1) return 'under 1 visit a month';
    return `about ${monthly} ${monthly === 1 ? 'visit' : 'visits'} a month`;
}

// Arial draws "~" up near the top of the digits, so it gets its own span to
// sit it level with them
function setApproximate(element, value) {
    const tilde = document.createElement('span');
    tilde.className = 'coffee-approx';
    tilde.textContent = '~';
    element.replaceChildren(tilde, value.toLocaleString());
}

function freeCoffeeText(m) {
    if (m.earned === null) return '';
    if (m.earned === 0) return `First one at ${POINTS_PER_FREE} points`;
    if (m.available === 0) return `${m.redeemed} redeemed · none in the bank`;
    if (m.redeemed === 0) return `${m.available} in the bank`;
    return `${m.redeemed} redeemed · ${m.available} in the bank`;
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
    return element;
}

function updateEnhancedMetrics(m) {
    const dash = '—';

    setText('coffee-monthly-avg', monthlyText(m.monthly));

    const cupsElement = document.getElementById('coffee-cups');
    if (cupsElement) {
        if (m.cups === null) cupsElement.textContent = dash;
        else setApproximate(cupsElement, m.cups);
        // The cups figure rests on one point per drink, so show the working
        cupsElement.title = m.cups === null ? '' :
            `${m.bought.toLocaleString()} bought (1 point per drink) + ${m.redeemed.toLocaleString()} free = ${m.cups.toLocaleString()}`;
    }
    setText('coffee-cups-per-visit', m.perVisit === null ? '' : `about ${m.perVisit.toFixed(1)} per visit`);

    setText('coffee-free-earned', m.earned === null ? dash : m.earned.toLocaleString());
    const freeDetailElement = setText('coffee-free-detail', freeCoffeeText(m));
    if (freeDetailElement) freeDetailElement.classList.toggle('is-quiet', m.earned === 0);

    const label = m.tier.charAt(0).toUpperCase() + m.tier.slice(1);
    setText('coffee-loyalty-status', `${label} Member`);
    const medalElement = document.getElementById('coffee-loyalty-medal');
    if (medalElement) {
        medalElement.className = `coffee-loyalty-medal tier-${m.tier}`;
    }

    // Punch card toward the next free coffee
    const progressElement = document.getElementById('coffee-progress-fill');
    if (progressElement) {
        progressElement.style.width = `${(m.balance / POINTS_PER_FREE) * 100}%`;
    }
    setText('coffee-progress-text', `${m.balance}/${POINTS_PER_FREE} points`);
}

function updateEnhancedCoffeeDisplay(data, isError = false) {
    const coffeeCountElement = document.getElementById('coffee-total-visits');

    if (coffeeCountElement) {
        if (isError || !data || !data.success) {
            coffeeCountElement.textContent = 'Error';
            coffeeCountElement.classList.add('coffee-error');
        } else {
            coffeeCountElement.textContent = data.totalSiteVisits.toLocaleString();
            coffeeCountElement.classList.remove('coffee-loading', 'coffee-error');
            updateEnhancedMetrics(deriveCoffeeMetrics(data));
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

        coffeeUpdatedElement.textContent = `Last updated: ${formattedDate}`;
    }
}
