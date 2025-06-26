const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Environment variables for credentials
const SEATTLE_USERNAME = process.env.SEATTLE_COFFEE_USERNAME;
const SEATTLE_PASSWORD = process.env.SEATTLE_COFFEE_PASSWORD;

// Validate required environment variables
if (!SEATTLE_USERNAME || !SEATTLE_PASSWORD) {
    console.error('Missing required environment variables');
    console.error('Required: SEATTLE_COFFEE_USERNAME, SEATTLE_COFFEE_PASSWORD');
    process.exit(1);
}

async function getTotalVisitsOptimized() {
    let browser;
    const startTime = Date.now();

    try {
        console.log('Starting Seattle Coffee scraper...');

        // Launch with optimization settings
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript-harmony-shipping',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        });

        const page = await browser.newPage();

        // Block non-essential resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();

            if (resourceType === 'image' ||
                resourceType === 'font' ||
                resourceType === 'media' ||
                resourceType === 'manifest' ||
                url.includes('analytics') ||
                url.includes('gtag') ||
                url.includes('facebook') ||
                url.includes('google') ||
                url.includes('tracking') ||
                url.includes('ads') ||
                url.includes('.png') ||
                url.includes('.jpg') ||
                url.includes('.jpeg') ||
                url.includes('.gif') ||
                url.includes('.svg') ||
                url.includes('.woff') ||
                url.includes('.ttf')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1024, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('Loading loyalty page...');
        await page.goto('https://www.seattlecoffeecompany.co.za/loyalty/', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        console.log('Accessing login iframe...');
        await page.waitForSelector('iframe[src*="coffee.toget.me"]', { timeout: 8000 });

        const iframeElement = await page.$('iframe[src*="coffee.toget.me"]');
        const iframe = await iframeElement.contentFrame();

        if (!iframe) {
            throw new Error('Could not access iframe content');
        }

        // Wait for form to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Logging in...');

        // Wait for login fields
        const [mobileField, passwordField] = await Promise.all([
            iframe.waitForSelector('input[formcontrolname="mobileNumber"]', { timeout: 6000 }),
            iframe.waitForSelector('input[formcontrolname="password"]', { timeout: 6000 })
        ]);

        await mobileField.click({ clickCount: 3 });
        await mobileField.type(SEATTLE_USERNAME, { delay: 20 });

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(SEATTLE_PASSWORD, { delay: 20 });

        const loginButton = await iframe.$('.ui-button');
        await loginButton.click();

        console.log('Extracting stats...');

        let coffeeData = null;
        let attempts = 0;
        const maxAttempts = 20;
        const pollInterval = 200;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            try {
                coffeeData = await iframe.evaluate(() => {
                    const overviewBoxes = document.querySelectorAll('.overview-box-count.ng-star-inserted');

                    if (overviewBoxes.length === 0) {
                        return null;
                    }

                    let totalVisits = null;
                    let currentBalance = null;

                    for (const box of overviewBoxes) {
                        const text = box.textContent?.trim();
                        if (!text) continue;

                        const number = parseInt(text, 10);
                        if (isNaN(number)) continue;

                        // Total visits: larger number (50-2000 range)
                        if (number >= 50 && number <= 2000 && totalVisits === null) {
                            totalVisits = number;
                        }
                        // Current balance: smaller number (0-10 range)
                        else if (number >= 0 && number <= 10 && currentBalance === null) {
                            currentBalance = number;
                        }
                    }

                    return (totalVisits !== null && currentBalance !== null)
                        ? { totalVisits, currentBalance }
                        : null;
                });

                if (coffeeData !== null) {
                    break;
                }
            } catch (e) {
                // Continue polling
            }
        }
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        if (coffeeData !== null) {
            console.log(`Coffee data extracted in ${totalTime}s:`, coffeeData);
            return coffeeData;
        } else {
            throw new Error(`Could not extract coffee data after ${totalTime}s (${attempts} attempts)`);
        }

    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`Error after ${totalTime}s:`, error.message);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Reusable session class for multiple requests
class OptimizedCoffeeSession {
    constructor() {
        this.browser = null;
        this.page = null;
        this.iframe = null;
        this.isLoggedIn = false;
        this.lastLoginTime = null;
    }

    async initialize() {
        if (this.browser) return;

        console.log('Initializing session...');

        this.browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-images',
                '--disable-extensions'
            ]
        });

        this.page = await this.browser.newPage();

        // Block non-essential resources
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' ||
                resourceType === 'font' ||
                resourceType === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        });

        await this.page.setViewport({ width: 1024, height: 768 });
    }

    async login() {
        // Check if session is still valid (5 minutes)
        if (this.isLoggedIn && this.lastLoginTime &&
            (Date.now() - this.lastLoginTime) < 300000) {
            return;
        }

        console.log('Logging in...');

        await this.page.goto('https://www.seattlecoffeecompany.co.za/loyalty/', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await this.page.waitForSelector('iframe[src*="coffee.toget.me"]', { timeout: 8000 });
        const iframeElement = await this.page.$('iframe[src*="coffee.toget.me"]');
        this.iframe = await iframeElement.contentFrame();

        await new Promise(resolve => setTimeout(resolve, 800));

        const [mobileField, passwordField] = await Promise.all([
            this.iframe.waitForSelector('input[formcontrolname="mobileNumber"]', { timeout: 6000 }),
            this.iframe.waitForSelector('input[formcontrolname="password"]', { timeout: 6000 })
        ]);

        await mobileField.click({ clickCount: 3 });
        await mobileField.type(SEATTLE_USERNAME, { delay: 15 });

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(SEATTLE_PASSWORD, { delay: 15 });

        const loginButton = await this.iframe.$('.ui-button');
        await loginButton.click();

        await new Promise(resolve => setTimeout(resolve, 1500));

        this.isLoggedIn = true;
        this.lastLoginTime = Date.now();
        console.log('Login complete');
    }

    async getTotalVisits() {
        if (!this.isLoggedIn) {
            await this.login();
        }

        console.log('Extracting visit count...');

        return await this.iframe.evaluate(() => {
            const overviewBoxes = document.querySelectorAll('.overview-box-count.ng-star-inserted');

            for (const box of overviewBoxes) {
                const number = parseInt(box.textContent?.trim(), 10);
                if (number >= 50 && number <= 2000 && !isNaN(number)) {
                    return number;
                }
            }
            return null;
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.iframe = null;
            this.isLoggedIn = false;
            this.lastLoginTime = null;
        }
    }
}

async function getCoffeeStatsOptimized() {
    const coffeeData = await getTotalVisitsOptimized();

    if (coffeeData && coffeeData.totalVisits) {
        return {
            totalSiteVisits: coffeeData.totalVisits,
            currentBalance: coffeeData.currentBalance || 0,
            lastUpdated: new Date().toISOString(),
            success: true
        };
    } else {
        return {
            totalSiteVisits: null,
            currentBalance: null,
            lastUpdated: new Date().toISOString(),
            success: false
        };
    }
}

async function updateCoffeeStatsFileOptimized() {
    try {
        const stats = await getCoffeeStatsOptimized();

        if (stats.success) {
            const dataDir = path.join(__dirname, '..', '..', 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            const dataPath = path.join(dataDir, 'coffee-stats.json');
            fs.writeFileSync(dataPath, JSON.stringify(stats, null, 2));
            return stats;
        } else {
            throw new Error('Failed to get coffee stats');
        }

    } catch (error) {
        console.error('Update failed:', error.message);
        process.exit(1);
    }
}

module.exports = {
    OptimizedCoffeeSession
};

if (require.main === module) {
    updateCoffeeStatsFileOptimized().then(() => {
        console.log('Update complete');
        process.exit(0);
    });
}