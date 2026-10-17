const { test, expect } = require('./fixtures');

// My current job title and employer appear in four places: the role list on
// the experience page (the source of truth: the role that runs to "Present"),
// the structured data on both pages, and the home page's identity block. They
// stay plain HTML so search engines and the first paint don't need a script,
// and this keeps them from drifting apart after a promotion.

async function currentRole(page) {
    await page.goto('/experience');
    return page.evaluate(() => {
        const present = [...document.querySelectorAll('.xp-role')]
            .filter(role => role.querySelector('.xp-present'));
        return present.map(role => ({
            title: role.querySelector('.xp-role-title').textContent.trim(),
            company: role.closest('.xp-company').querySelector('.xp-company-name').textContent.trim()
        }));
    });
}

// The Person in a page's structured data
async function structuredPerson(page, path) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    return blocks.map(block => JSON.parse(block)).find(data => data['@type'] === 'Person');
}

test('the current role reads the same everywhere it appears', async ({ page }) => {
    const roles = await currentRole(page);
    // One job at a time; a second "Present" role would need deciding which one to show
    expect(roles, 'roles running to Present on the experience page').toHaveLength(1);
    const [{ title, company }] = roles;

    for (const path of ['/', '/experience']) {
        const person = await structuredPerson(page, path);
        expect(person, `structured data on ${path}`).toBeTruthy();
        expect(person.jobTitle, `jobTitle on ${path}`).toBe(title);
        expect(person.worksFor.name, `worksFor on ${path}`).toBe(company);
    }

    await page.goto('/');
    const now = page.locator('.identity-specs div', { has: page.locator('dt', { hasText: 'Now' }) }).locator('dd');
    await expect(now, 'the identity block on the home page').toHaveText(`${title} at ${company}`);
});
