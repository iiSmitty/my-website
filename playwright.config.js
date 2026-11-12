const { defineConfig, devices } = require('@playwright/test');

// Smoke-test config for the static site. Playwright starts its own copy of the
// same static server the site is served with, runs the specs in tests/, then
// shuts the server down.
//
// PORT lets two checkouts (git worktrees, say) run the suite at the same time
// without one reusing the other's server.
const PORT = Number(process.env.PORT) || 3000;
module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
    },
    projects: [
        // Use the system-installed Microsoft Edge (always present on Windows)
        // instead of downloading Playwright's bundled Chromium. Avoids the
        // ~180MB browser download, which a corporate proxy/firewall blocks.
        //
        // No proxy: with Windows' "Automatically detect settings" on, Edge spent
        // about 5 seconds looking for a proxy before every test's first page
        // load, and the slowest tests ran out of time. This machine connects
        // directly, so there's no proxy to find. If tests ever need a proxy to
        // reach the internet, remove this and raise the timeout instead.
        {
            name: 'msedge',
            use: {
                ...devices['Desktop Edge'],
                channel: 'msedge',
                launchOptions: { args: ['--no-proxy-server'] },
            },
        },
    ],
    webServer: {
        command: `npx -y serve -l ${PORT} .`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
    },
});
