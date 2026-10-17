const { test, expect } = require('./fixtures');

// The third-party hosts in fixtures.js are answered locally, so no test waits
// on Google or Dropbox

test('third-party requests a page makes are answered by the stubs', async ({ page }) => {
    const analytics = page.waitForResponse(response => response.url().includes('googletagmanager.com'));
    await page.goto('/');
    expect(await (await analytics).text()).toBe('');

    // The achievement sound, played when a desktop icon is deleted, is the site's own file
    const sound = await page.evaluate(async () => {
        const response = await fetch('https://dl.dropboxusercontent.com/s/8qvrpd69ua7wio8/XboxAchievement.mp3');
        return { ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
    });
    expect(sound.ok).toBe(true);
    expect(sound.bytes).toBeGreaterThan(0);
});
