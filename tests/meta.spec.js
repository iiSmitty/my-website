const { test, expect } = require('./fixtures');

// Link previews (Open Graph and Twitter cards). The image is served from the
// site itself, so a third-party host going away can't break every shared link.

const SITE = 'https://andresmit.co.za/';

for (const page of ['/', '/experience']) {
    test(`${page} has a link preview image the site serves itself`, async ({ page: p, request }) => {
        await p.goto(page);
        const images = await p.locator('meta[property="og:image"], meta[property="twitter:image"]')
            .evaluateAll(tags => tags.map(tag => tag.content));
        expect(images.length).toBeGreaterThan(0);

        for (const url of images) {
            expect(url.startsWith(SITE), url).toBe(true);
            // The same file, as the local server has it
            const response = await request.get('/' + url.slice(SITE.length));
            expect(response.status(), url).toBe(200);
            expect(response.headers()['content-type'], url).toContain('image/jpeg');
        }
    });
}
