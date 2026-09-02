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
        // Set HEADFUL=1 locally to watch the browser drive the login;
        // CI stays headless by default.
        browser = await puppeteer.launch({
            headless: process.env.HEADFUL ? false : 'new',
            slowMo: process.env.HEADFUL ? 50 : 0,
            // Bound how long a single CDP command may hang. The default is 180s,
            // which let one wedged call (a cross-origin iframe redirect) freeze a
            // run for ~191s x 3 retries = ~11min. Nothing we do legitimately
            // exceeds the poll budget, so fail fast and let the retry wrapper
            // start a clean attempt instead.
            protocolTimeout: 60000,
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

        // Block only heavy, non-essential resources by type. We now load the
        // loyalty SPA directly (no ad-laden WordPress wrapper), so the old
        // URL-substring blocklist is unnecessary and risky — a substring like
        // "tracking"/"google" could match one of the app's own script or API
        // requests and silently break login. Type-based blocking can't do that.
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' ||
                resourceType === 'font' ||
                resourceType === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1024, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Drive the loyalty SPA directly instead of through the WordPress page's
        // lazy-loaded iframe. The old path (load seattlecoffeecompany.co.za/
        // loyalty/ -> wait for a WP-Rocket lazy iframe -> promote data-src ->
        // let coffee.toget.me redirect cross-origin to
        // seattle.loyalty-electronicline.com) was deeply flaky: driving a frame
        // that redirects underneath Puppeteer would wedge a CDP call for ~3min.
        // The app is fully usable standalone, so we go straight to its real URL
        // and interact with the top-level page — no iframe, no redirect, no
        // WordPress. coffee.toget.me still redirects here, but we skip that hop.
        console.log('Loading loyalty app...');
        await page.goto('https://seattle.loyalty-electronicline.com/#/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('Logging in...');

        // Re-platformed, Tailwind-rebuilt form: input.mobile-input,
        // input[type="password"], button[type="submit"]. A country-code <select>
        // defaults to +27, matching the stored ZA username, so we leave it.
        // CI (US runners) is slow to reach this ZA app, so allow a wide budget.
        const [mobileField, passwordField] = await Promise.all([
            page.waitForSelector('input.mobile-input', { timeout: 30000 }),
            page.waitForSelector('input[type="password"]', { timeout: 30000 })
        ]);

        await mobileField.click({ clickCount: 3 });
        await mobileField.type(SEATTLE_USERNAME, { delay: 20 });

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(SEATTLE_PASSWORD, { delay: 20 });

        // The submit button stays `disabled` until Angular's reactive form
        // validates the typed input, so clicking too early is a silent no-op.
        // Wait for it to enable, then click.
        await page.waitForFunction(() => {
            const b = document.querySelector('button[type="submit"]');
            return b && !b.disabled;
        }, { timeout: 10000 });
        await page.click('button[type="submit"]');

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
                coffeeData = await page.evaluate(() => {
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
            // labels/structure change, dump what the logged-in page actually
            // shows so the fix is obvious instead of a blind timeout. We report
            // the card labels+values if any cards exist, else fall back to raw
            // numeric leaves (which also flags a login that silently failed).
            // Best-effort only.
            try {
                const diag = await page.evaluate(() => {
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
        // runner actually saw. Most failures here are timing; logging the live
        // URL turns a blind timeout into an obvious "we ended up at X" (e.g. an
        // unexpected redirect or a maintenance gate) and the screenshot shows
        // any new login/consent wall.
        if (page) {
            try {
                console.error('Current page URL:', page.url());
            } catch (e) {
                console.error('Could not read page URL:', e.message);
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
    getTotalVisitsOptimized,
    getCoffeeStatsOptimized,
    updateCoffeeStatsFileOptimized
};

if (require.main === module) {
    updateCoffeeStatsFileOptimized().then(() => {
        console.log('Update complete');
        process.exit(0);
    });
}