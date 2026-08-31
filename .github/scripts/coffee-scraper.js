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
    let page;
    const startTime = Date.now();

    try {
        console.log('Starting Seattle Coffee scraper...');

        // Launch with optimization settings.
        // Set HEADFUL=1 locally to watch the browser (e.g. to see if the
        // login iframe ever appears); CI stays headless by default.
        browser = await puppeteer.launch({
            headless: process.env.HEADFUL ? false : 'new',
            slowMo: process.env.HEADFUL ? 50 : 0,
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

        page = await browser.newPage();

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
            timeout: 30000
        });

        console.log('Accessing login iframe...');
        // The loyalty page now lazy-loads the login iframe via WP Rocket: the
        // real URL sits in data-src and only becomes src once the iframe scrolls
        // into the viewport. Headless CI never scrolls it into view, so src
        // stayed empty and the old `iframe[src*="coffee.toget.me"]` wait timed
        // out. Match on data-src (or src, for backward compat), then promote
        // data-src -> src ourselves to force the login frame to load.
        // CI (US-based runners) is also slower to reach this ZA site than a
        // local machine, so allow a generous budget for the iframe to appear.
        await page.waitForSelector(
            'iframe[data-src*="coffee.toget.me"], iframe[src*="coffee.toget.me"]',
            { timeout: 25000 }
        );

        await page.evaluate(() => {
            const frames = Array.from(
                document.querySelectorAll('iframe[data-src*="coffee.toget.me"]')
            );
            // The page renders desktop + mobile variants; prefer a visible one.
            const target = frames.find(f => f.offsetParent !== null) || frames[0];
            if (target && !target.src) {
                target.src = target.getAttribute('data-src');
            }
        });

        // Wait for the frame to actually navigate to the loyalty app.
        const iframeElement = await page.waitForSelector(
            'iframe[src*="coffee.toget.me"]',
            { timeout: 25000 }
        );
        const iframe = await iframeElement.contentFrame();

        if (!iframe) {
            throw new Error('Could not access iframe content');
        }

        // Wait for form to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Logging in...');

        // The loyalty app was re-platformed (coffee.toget.me now redirects to
        // seattle.loyalty-electronicline.com) and rebuilt on Tailwind, so the
        // old Angular `formcontrolname` hooks and `.ui-button` are gone. The
        // form now exposes: input.mobile-input, input[type="password"], and a
        // submit button. A country-code <select> defaults to +27, which matches
        // the stored ZA username, so we leave it untouched.
        const [mobileField, passwordField] = await Promise.all([
            iframe.waitForSelector('input.mobile-input', { timeout: 25000 }),
            iframe.waitForSelector('input[type="password"]', { timeout: 25000 })
        ]);

        await mobileField.click({ clickCount: 3 });
        await mobileField.type(SEATTLE_USERNAME, { delay: 20 });

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(SEATTLE_PASSWORD, { delay: 20 });

        const loginButton = await iframe.$('button[type="submit"]');
        await loginButton.click();

        console.log('Extracting stats...');

        let coffeeData = null;
        let attempts = 0;
        // The info-grid holding the stat cards is `*ngIf`-gated on the
        // authenticated stats API resolving, which lags login noticeably on the
        // US-based CI runner (the loyalty backend is in ZA). The old 4s budget
        // (20 x 200ms) was fine locally but expired before the cards populated
        // in CI — the stamp circles rendered but the numbers hadn't. Poll for
        // up to ~30s so the cards have time to appear.
        const maxAttempts = 60;
        const pollInterval = 500;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            try {
                coffeeData = await iframe.evaluate(() => {
                    // The rebuilt dashboard renders each stat as an <app-info-card>
                    // with a `.heading` label and a `.info-card-value` number, so we
                    // match on the visible label rather than guessing by numeric
                    // range (the old approach couldn't tell "Beverages Points
                    // Balance" apart from "Free Beverages Available" — both 0-10).
                    const cards = Array.from(document.querySelectorAll('app-info-card'));
                    if (cards.length === 0) {
                        return null;
                    }

                    const readCard = (label) => {
                        for (const card of cards) {
                            const heading = card.querySelector('.heading')?.textContent?.trim();
                            if (heading === label) {
                                const value = parseInt(
                                    card.querySelector('.info-card-value')?.textContent?.trim(),
                                    10
                                );
                                return isNaN(value) ? null : value;
                            }
                        }
                        return null;
                    };

                    // totalSiteVisits <- "Total Site Visits"
                    // currentBalance  <- "Beverages Points Balance" (progress /10
                    //   toward the next free coffee, per js/coffee-simple.js)
                    const totalVisits = readCard('Total Site Visits');
                    const currentBalance = readCard('Beverages Points Balance');

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
            // Extraction relies on `app-info-card` labels ("Total Site Visits",
            // "Beverages Points Balance"). If the app is rebuilt again and those
            // labels/structure change, dump what the logged-in frame actually
            // shows so the fix is obvious instead of a blind timeout. We report
            // the card labels+values if any cards exist, else fall back to raw
            // numeric leaves (which also flags a login that silently failed).
            // Best-effort only.
            try {
                const diag = await iframe.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('app-info-card'));
                    if (cards.length) {
                        return {
                            kind: 'cards',
                            items: cards.map(c => ({
                                label: c.querySelector('.heading')?.textContent?.trim() || '(no label)',
                                value: c.querySelector('.info-card-value')?.textContent?.trim() || '(no value)'
                            }))
                        };
                    }
                    return {
                        kind: 'numeric-leaves',
                        items: Array.from(document.querySelectorAll('body *'))
                            .filter(el => el.children.length === 0
                                && /^\d{1,4}$/.test((el.textContent || '').trim()))
                            .slice(0, 30)
                            .map(el => `<${el.tagName.toLowerCase()} class="${el.className}">${el.textContent.trim()}`)
                    };
                });
                if (diag.kind === 'cards') {
                    console.error('app-info-card labels/values present (label match may have changed):',
                        diag.items.length ? diag.items : '(no cards)');
                } else {
                    console.error('No app-info-card found; numeric elements in frame (login may have failed):',
                        diag.items.length ? diag.items : '(none)');
                }
            } catch (e) {
                console.error('Could not enumerate dashboard:', e.message);
            }
            throw new Error(`Could not extract coffee data after ${totalTime}s (${attempts} attempts)`);
        }

    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`Error after ${totalTime}s:`, error.message);

        // Diagnostics: if we got far enough to have a page, capture what the
        // runner actually saw. A timeout on the iframe wait is almost always
        // timing, but if the site ever changes this turns a blind timeout into
        // an obvious "the iframe src is now X" (or a screenshot of a new gate).
        if (page) {
            try {
                const iframeSrcs = await page.$$eval('iframe', frames =>
                    frames.map(f => f.src || f.getAttribute('data-src') || '(no src)'));
                console.error('Iframes present on page:',
                    iframeSrcs.length ? iframeSrcs : '(none)');
            } catch (e) {
                console.error('Could not enumerate iframes:', e.message);
            }
            try {
                const shotPath = path.join(__dirname, 'coffee-scraper-failure.png');
                await page.screenshot({ path: shotPath, fullPage: true });
                console.error(`Saved failure screenshot to ${shotPath}`);
            } catch (e) {
                console.error('Could not capture screenshot:', e.message);
            }
        }

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

        // See getTotalVisitsOptimized: the login iframe is lazy-loaded via
        // WP Rocket (real URL in data-src), so promote data-src -> src ourselves.
        await this.page.waitForSelector(
            'iframe[data-src*="coffee.toget.me"], iframe[src*="coffee.toget.me"]',
            { timeout: 8000 }
        );
        await this.page.evaluate(() => {
            const frames = Array.from(
                document.querySelectorAll('iframe[data-src*="coffee.toget.me"]')
            );
            const target = frames.find(f => f.offsetParent !== null) || frames[0];
            if (target && !target.src) {
                target.src = target.getAttribute('data-src');
            }
        });
        const iframeElement = await this.page.waitForSelector(
            'iframe[src*="coffee.toget.me"]',
            { timeout: 8000 }
        );
        this.iframe = await iframeElement.contentFrame();

        await new Promise(resolve => setTimeout(resolve, 800));

        // See getTotalVisitsOptimized: the re-platformed app replaced the old
        // formcontrolname hooks / .ui-button with these selectors.
        const [mobileField, passwordField] = await Promise.all([
            this.iframe.waitForSelector('input.mobile-input', { timeout: 6000 }),
            this.iframe.waitForSelector('input[type="password"]', { timeout: 6000 })
        ]);

        await mobileField.click({ clickCount: 3 });
        await mobileField.type(SEATTLE_USERNAME, { delay: 15 });

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(SEATTLE_PASSWORD, { delay: 15 });

        const loginButton = await this.iframe.$('button[type="submit"]');
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
            // Match the "Total Site Visits" card by its label (see
            // getTotalVisitsOptimized for why label-based beats range-based).
            const cards = Array.from(document.querySelectorAll('app-info-card'));
            for (const card of cards) {
                const heading = card.querySelector('.heading')?.textContent?.trim();
                if (heading === 'Total Site Visits') {
                    const number = parseInt(
                        card.querySelector('.info-card-value')?.textContent?.trim(),
                        10
                    );
                    return isNaN(number) ? null : number;
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

            // Only persist when the meaningful numbers actually move.
            // lastUpdated alone changing every run is what caused the daily
            // "pointless" commits — skipping the write keeps git diff clean.
            let existing = {};
            if (fs.existsSync(dataPath)) {
                try {
                    existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                } catch (e) {
                    existing = {};
                }
            }

            const changed = existing.totalSiteVisits !== stats.totalSiteVisits
                || existing.currentBalance !== stats.currentBalance;

            if (!changed) {
                console.log('No change in visits or balance — leaving file untouched');
                return existing;
            }

            fs.writeFileSync(dataPath, JSON.stringify(stats, null, 2));
            console.log('Stats changed — file updated');
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