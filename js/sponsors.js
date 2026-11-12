// My GitHub sponsors, credited in coffees: a GroupBox in Coffee Analytics,
// and a "thanks to N patrons" link by the identity block's sponsor link
// that goes to it.
//
// Reads data/sponsors.json, which .github/scripts/sponsors-fetcher.js
// writes. It only has public sponsors, in the order they first sponsored,
// and what each has given is already counted in coffees. There are no
// amounts to show, and the list is never reordered: nobody is ranked.

// A row shows a cup per coffee up to this many; past it, one cup and "x12",
// so a generous sponsor's row doesn't turn into a bar chart
const SPONSORS_MAX_CUPS = 5;
const SPONSORS_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

document.addEventListener('DOMContentLoaded', function() {
    loadSponsors();

    const thanksLink = document.getElementById('sponsorsThanksLink');
    if (thanksLink) {
        thanksLink.addEventListener('click', event => {
            event.preventDefault();
            goToSponsors();
        });
    }
});

async function loadSponsors() {
    try {
        const response = await fetch('data/sponsors.json');
        if (!response.ok) throw new Error(`Failed to load sponsors: ${response.status}`);
        const data = await response.json();
        if (!data || !Array.isArray(data.sponsors)) throw new Error('Unexpected sponsors data');
        renderSponsors(data.sponsors.filter(isSponsor));
    } catch (error) {
        // Nothing to thank anyone for is better than an error box in a thank-you
        console.error('Error loading sponsors:', error);
    }
}

function isSponsor(sponsor) {
    return Boolean(sponsor) && typeof sponsor.login === 'string' && sponsor.login !== '' &&
        Number.isInteger(sponsor.coffees) && sponsor.coffees > 0;
}

// --- Words --------------------------------------------------------------------

// "cappuccino with wings" is South African for a takeaway cappuccino
function coffeesText(count) {
    return `${count} ${count === 1 ? 'cappuccino' : 'cappuccinos'} with wings`;
}

function patronsText(count) {
    return `thanks to ${count} ${count === 1 ? 'patron' : 'patrons'}`;
}

// "2026-11" -> "Nov 2026"
function sponsorMonth(since) {
    const match = /^(\d{4})-(\d{2})/.exec(since || '');
    const month = match && SPONSORS_MONTHS[Number(match[2]) - 1];
    return month ? `${month} ${match[1]}` : '';
}

// The first sponsor's credit is theirs for good
function sponsorStanding(sponsor, index) {
    const month = sponsorMonth(sponsor.since);
    const title = index === 0 ? 'Founding Patron' : 'Patron';
    return month ? `${title} · since ${month}` : title;
}

function sponsorLink(sponsor) {
    const link = makeElement('a', 'win95-link', sponsor.name || `@${sponsor.login}`);
    link.href = `https://github.com/${encodeURIComponent(sponsor.login)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
}

// --- Coffee Analytics and the identity block ----------------------------------------

// Pixel cups (icons/coffee-cup-16.svg), one per coffee, with the count in
// words for screen readers and on hover
function sponsorCups(count) {
    const cups = makeElement('span', 'sponsors-cups');
    cups.setAttribute('role', 'img');
    cups.setAttribute('aria-label', coffeesText(count));
    cups.title = coffeesText(count);

    const shown = count > SPONSORS_MAX_CUPS ? 1 : count;
    for (let i = 0; i < shown; i++) cups.append(makeElement('span', 'pixel-cup'));
    if (count > SPONSORS_MAX_CUPS) cups.append(makeElement('span', 'sponsors-cups-count', `x${count}`));
    return cups;
}

// One line each: cups, name, standing
function sponsorRow(sponsor, index) {
    const row = makeElement('li', index === 0 ? 'sponsors-item is-founding' : 'sponsors-item');
    row.append(sponsorCups(sponsor.coffees), sponsorLink(sponsor),
        makeElement('span', 'sponsors-standing', sponsorStanding(sponsor, index)));
    return row;
}

function renderSponsors(sponsors) {
    const group = document.getElementById('sponsors');
    const list = document.getElementById('sponsorsList');
    // Nobody yet: no box at all. The identity block's sponsor link is
    // invitation enough.
    if (!group || !list || sponsors.length === 0) return;

    list.replaceChildren(...sponsors.map(sponsorRow));
    group.hidden = false;

    // The thank-you by the sponsor link
    const thanks = document.getElementById('sponsorsThanks');
    const thanksLink = document.getElementById('sponsorsThanksLink');
    if (thanks && thanksLink) {
        thanksLink.textContent = patronsText(sponsors.length);
        thanks.hidden = false;
    }

    // A link straight to /#sponsors reveals the profile (floppy-disk.js) while
    // the group is still hidden, waiting for this data, so the browser
    // couldn't land on it then
    if (location.hash === '#sponsors') group.scrollIntoView();
}

function goToSponsors() {
    const group = document.getElementById('sponsors');
    if (group && !group.hidden) goToProfileSection(group);
}
