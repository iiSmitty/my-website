const { test, expect } = require('./fixtures');

// The third-party host in fixtures.js is answered locally, so no test waits
// on Dropbox

test('the achievement sound is answered by the stub', async ({ page }) => {
    await page.goto('/');

    // The achievement sound, played when a desktop icon is deleted, is the site's own file
    const sound = await page.evaluate(async () => {
        const response = await fetch('https://dl.dropboxusercontent.com/s/8qvrpd69ua7wio8/XboxAchievement.mp3');
        return { ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
    });
    expect(sound.ok).toBe(true);
    expect(sound.bytes).toBeGreaterThan(0);
});

// PC Health's API is answered as switched off, so no test reaches the real one
test('the mood API is answered by the stub', async ({ page }) => {
    await page.goto('/');
    const answer = await page.evaluate(async () => {
        const response = await fetch('/api/mood/cheer', { method: 'POST', body: '{"action":"pat"}' });
        return { status: response.status, body: await response.json() };
    });
    expect(answer).toEqual({ status: 503, body: { error: 'disabled' } });
});
