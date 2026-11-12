// Coffee Properties: how I take my coffee, as a Win95 property sheet. Opened
// by the Properties... button in Coffee Analytics (index.html).
//
//   General   - at home and out, and the best cups so far
//   Roast     - a slider that won't stay off Medium
//   Additives - milk, lots; sugar, disabled by the administrator
//
// Nothing is built until it's first opened: the stylesheet and DOM load on the
// first click, so the home page doesn't pay for them.

const COFFEE_ROASTS = ['Light', 'Medium', 'Dark'];
const COFFEE_MEDIUM = 1;

// Milk is the one setting that can change. OK and Apply keep it for the visit,
// Cancel puts it back.
let coffeeMilk = true;
let coffeePropertiesReturnFocus = null;

// A mug of something milky, drawn on the pixel grid like a Win95 icon
const COFFEE_MUG_SVG = `
    <svg viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">
        <path fill="#808080" d="M11 2h1v2h-1zM12 4h1v2h-1zM11 6h1v2h-1zM16 2h1v2h-1zM17 4h1v2h-1zM16 6h1v2h-1z"/>
        <rect x="6" y="10" width="18" height="17" fill="#000000"/>
        <rect x="7" y="11" width="16" height="15" fill="#ffffff"/>
        <rect x="19" y="14" width="4" height="12" fill="#dfdfdf"/>
        <rect x="7" y="11" width="16" height="3" fill="#b5835a"/>
        <rect x="24" y="13" width="4" height="10" fill="#000000"/>
        <rect x="24" y="14" width="3" height="8" fill="#ffffff"/>
        <rect x="24" y="16" width="1" height="4" fill="#000000"/>
        <rect x="3" y="27" width="24" height="2" fill="#000000"/>
        <rect x="4" y="27" width="22" height="1" fill="#c0c0c0"/>
    </svg>`;

// --- Building it -----------------------------------------------------------

function buildCoffeeProperties() {
    const overlay = document.createElement('div');
    overlay.id = 'coffeeProperties';
    overlay.className = 'dead-dialog-overlay';
    overlay.innerHTML = `
        <div class="dead-dialog win95-window coffee-props" id="coffeePropertiesWindow"
             role="dialog" aria-modal="true" aria-labelledby="coffeePropertiesTitle">
            <div class="win95-title-bar" id="coffeePropertiesTitleBar">
                <div class="win95-title" id="coffeePropertiesTitle">Coffee Properties</div>
                <div class="win95-buttons">
                    <button class="win95-button win95-close" type="button" aria-label="Close">&times;</button>
                </div>
            </div>

            <div class="coffee-props-tabs" role="tablist" aria-label="Coffee Properties">
                <button class="coffee-props-tab" type="button" role="tab" id="coffeeTabGeneral"
                        aria-controls="coffeePanelGeneral" data-tab="General">General</button>
                <button class="coffee-props-tab" type="button" role="tab" id="coffeeTabRoast"
                        aria-controls="coffeePanelRoast" data-tab="Roast">Roast</button>
                <button class="coffee-props-tab" type="button" role="tab" id="coffeeTabAdditives"
                        aria-controls="coffeePanelAdditives" data-tab="Additives">Additives</button>
            </div>

            <div class="coffee-props-sheet">
                <div class="coffee-props-panel" role="tabpanel" id="coffeePanelGeneral" aria-labelledby="coffeeTabGeneral">
                    <div class="coffee-props-head">
                        ${COFFEE_MUG_SVG}
                        <span>Coffee</span>
                    </div>
                    <fieldset class="coffee-props-group">
                        <legend>At home</legend>
                        <dl class="coffee-props-fields">
                            <dt>Type:</dt>
                            <dd>Instant</dd>
                            <dt>Brands:</dt>
                            <dd>Woolworths Italian Blend, Nescaf&eacute; Crema</dd>
                            <dt>Profile:</dt>
                            <dd>Milky, smooth, mild</dd>
                        </dl>
                    </fieldset>
                    <fieldset class="coffee-props-group">
                        <legend>Out</legend>
                        <dl class="coffee-props-fields">
                            <dt>Order:</dt>
                            <dd>Cappuccino with wings<span class="coffee-props-footnote" aria-hidden="true">*</span></dd>
                            <dt>At:</dt>
                            <dd>Seattle, Bootlegger, Woolworths, Plat&#333;</dd>
                        </dl>
                        <p class="coffee-props-note">*With wings: South African for takeaway.</p>
                    </fieldset>
                    <div class="coffee-props-favourites">
                        <span id="coffeeFavouritesLabel">Favourites:</span>
                        <ul class="coffee-props-list" aria-labelledby="coffeeFavouritesLabel">
                            <li>Truth Coffee</li>
                            <li>Origin Coffee Roasting (tasting)</li>
                            <li>Choir Speciality Coffee <span class="coffee-props-star" aria-hidden="true">&#9733;</span> Best cup so far</li>
                        </ul>
                    </div>
                </div>

                <div class="coffee-props-panel" role="tabpanel" id="coffeePanelRoast" aria-labelledby="coffeeTabRoast" hidden>
                    <fieldset class="coffee-props-group">
                        <legend>Roast</legend>
                        <label class="coffee-props-roast-label" for="coffeeRoast">Move the slider to change the roast.</label>
                        <input class="coffee-props-slider" type="range" id="coffeeRoast"
                               min="0" max="${COFFEE_ROASTS.length - 1}" step="1">
                        <div class="coffee-props-ticks" aria-hidden="true">
                            ${COFFEE_ROASTS.map(roast => `<span>${roast}</span>`).join('')}
                        </div>
                    </fieldset>
                </div>

                <div class="coffee-props-panel" role="tabpanel" id="coffeePanelAdditives" aria-labelledby="coffeeTabAdditives" hidden>
                    <fieldset class="coffee-props-group">
                        <legend>Additives</legend>
                        <label class="coffee-props-check">
                            <input type="checkbox" id="coffeeMilk"> Milk (lots)
                        </label>
                        <!-- A disabled input gets no mouse events, so the tooltip hangs off its wrapper -->
                        <span class="coffee-props-locked" id="coffeeSugar">
                            <label class="coffee-props-check">
                                <input type="checkbox" disabled aria-describedby="coffeeSugarTooltip"> Sugar
                            </label>
                            <span class="coffee-props-tooltip" role="tooltip" id="coffeeSugarTooltip">This option has been disabled by your administrator.</span>
                        </span>
                    </fieldset>
                </div>
            </div>

            <div class="coffee-props-buttons">
                <button class="win95-btn" type="button" data-action="ok">OK</button>
                <button class="win95-btn" type="button" data-action="cancel">Cancel</button>
                <button class="win95-btn" type="button" data-action="apply" disabled>Apply</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.win95-close').addEventListener('click', closeCoffeeProperties);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeCoffeeProperties);
    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => {
        applyCoffeeProperties();
        closeCoffeeProperties();
    });
    overlay.querySelector('[data-action="apply"]').addEventListener('click', applyCoffeeProperties);

    const tabs = overlay.querySelector('.coffee-props-tabs');
    tabs.addEventListener('click', event => {
        const tab = event.target.closest('.coffee-props-tab');
        if (tab) selectCoffeeTab(tab.dataset.tab);
    });
    tabs.addEventListener('keydown', onCoffeeTabKeydown);

    overlay.querySelector('#coffeeRoast').addEventListener('change', onCoffeeRoastChange);
    overlay.querySelector('#coffeeMilk').addEventListener('change', updateCoffeeApply);

    // Click outside the dialog (on the backdrop) cancels it
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeCoffeeProperties();
    });
    overlay.addEventListener('keydown', onCoffeePropertiesKeydown);

    WindowManager.makeDraggable(overlay.querySelector('#coffeePropertiesWindow'),
        overlay.querySelector('#coffeePropertiesTitleBar'));
    return overlay;
}

// --- Opening and closing ---------------------------------------------------

async function openCoffeeProperties() {
    const opener = document.activeElement;
    await loadStylesheet('css/coffee-properties.min.css');

    const overlay = document.getElementById('coffeeProperties') || buildCoffeeProperties();
    if (overlay.classList.contains('open')) return;

    coffeePropertiesReturnFocus = opener && opener !== document.body ? opener : null;

    // Every open starts from the saved settings, on the first tab
    overlay.querySelector('#coffeeMilk').checked = coffeeMilk;
    setCoffeeRoast(COFFEE_MEDIUM);
    updateCoffeeApply();
    selectCoffeeTab('General', { focus: false });

    overlay.classList.add('open');
    centerInViewport(overlay.querySelector('#coffeePropertiesWindow'));
    overlay.querySelector('.coffee-props-tab[aria-selected="true"]').focus({ preventScroll: true });
}

function closeCoffeeProperties() {
    const overlay = document.getElementById('coffeeProperties');
    if (!overlay || !overlay.classList.contains('open')) return;

    overlay.classList.remove('open');
    if (coffeePropertiesReturnFocus && coffeePropertiesReturnFocus.isConnected) {
        coffeePropertiesReturnFocus.focus({ preventScroll: true });
    }
}

function applyCoffeeProperties() {
    coffeeMilk = document.getElementById('coffeeMilk').checked;
    updateCoffeeApply();
}

// Apply is only worth pressing once something has changed
function updateCoffeeApply() {
    const overlay = document.getElementById('coffeeProperties');
    overlay.querySelector('[data-action="apply"]').disabled =
        overlay.querySelector('#coffeeMilk').checked === coffeeMilk;
}

function onCoffeePropertiesKeydown(event) {
    const overlay = document.getElementById('coffeeProperties');

    if (event.key === 'Escape') {
        // Only the dialog, not a window behind it
        event.stopPropagation();
        closeCoffeeProperties();
    } else if (event.key === 'Enter' && !event.target.closest('button')) {
        // Enter presses the default button, OK, unless a button has focus
        event.preventDefault();
        overlay.querySelector('[data-action="ok"]').click();
    } else if (event.key === 'Tab') {
        trapCoffeePropertiesFocus(event, overlay);
    }
}

// It's modal, so Tab cycles through what can be reached on the current tab
function trapCoffeePropertiesFocus(event, overlay) {
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled])')]
        .filter(element => element.tabIndex >= 0 && element.checkVisibility());
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

// --- Tabs ------------------------------------------------------------------

function selectCoffeeTab(name, { focus = true } = {}) {
    const overlay = document.getElementById('coffeeProperties');
    overlay.querySelectorAll('.coffee-props-tab').forEach(tab => {
        const selected = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus({ preventScroll: true });
    });
    overlay.querySelectorAll('.coffee-props-panel').forEach(panel => {
        panel.hidden = panel.id !== `coffeePanel${name}`;
    });
}

function onCoffeeTabKeydown(event) {
    const tabs = [...document.querySelectorAll('#coffeeProperties .coffee-props-tab')];
    const index = tabs.indexOf(event.target);
    if (index === -1) return;
    const moves = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (event.key in moves) {
        event.preventDefault();
        selectCoffeeTab(tabs[moves[event.key]].dataset.tab);
    }
}

// --- Roast -----------------------------------------------------------------

function setCoffeeRoast(value) {
    const slider = document.getElementById('coffeeRoast');
    slider.value = value;
    slider.setAttribute('aria-valuetext', COFFEE_ROASTS[value]);
}

// Medium is the only roast that stays. The slider waits where it was put
// while the message is up, then goes back.
async function onCoffeeRoastChange(event) {
    const value = Number(event.target.value);
    event.target.setAttribute('aria-valuetext', COFFEE_ROASTS[value]);
    if (value === COFFEE_MEDIUM) return;

    if (value > COFFEE_MEDIUM) {
        await showMessageBox({
            title: 'DARKROAST',
            icon: 'error',
            message: [
                'Dark roast has performed an illegal operation and will be shut down.',
                'If the problem persists, try Medium.'
            ],
            buttons: ['Close']
        });
    } else {
        await showMessageBox({
            title: 'Roast',
            message: ['That\'s a bit light. Medium is just right.']
        });
    }
    setCoffeeRoast(COFFEE_MEDIUM);
}

document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('coffee-properties-button');
    if (button) button.addEventListener('click', openCoffeeProperties);
});
