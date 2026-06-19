const { defineConfig, devices } = require('@playwright/test');

// Smoke-test config for the static site. Playwright starts its own copy of the
// same static server the site is served with, runs the specs in tests/, then
// shuts the server down.
module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3000',
    },
    projects: [
        // Use the system-installed Microsoft Edge (always present on Windows)
        // instead of downloading Playwright's bundled Chromium. Avoids the
        // ~180MB browser download, which a corporate proxy/firewall blocks.
        { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    ],
    webServer: {
        command: 'npx -y serve -l 3000 .',
        port: 3000,
        reuseExistingServer: !process.env.CI,
    },
});
