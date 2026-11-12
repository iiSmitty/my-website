// Win95 message boxes: an icon, a line or two and a row of buttons, in the
// same .dead-dialog frame as My Computer's dead headset (styles.css). The
// Recycle Bin (recycle-bin.js) and Coffee Properties (coffee-properties.js)
// use them.
//
// A message box can sit on top of another modal dialog, like Win95's errors
// on top of a property sheet. It's the newest overlay, so it's in front, and
// it keeps Escape and Tab to itself.

const MESSAGE_BOX_ICONS = {
    error: 'icons/error-32.png',
    warning: 'icons/warning-32.png'
};

// Each box gets its own ids, so its title and text label it
let messageBoxCount = 0;

// Resolves with the label of the button that closed it, or null for Escape,
// the title bar's close button or a click on the backdrop.
//
//   title    - the title bar, e.g. the program's name
//   icon     - 'error' or 'warning'
//   heading  - an optional first line, in bold
//   message  - the lines underneath, one paragraph each
//   buttons  - their labels; the first one has focus
function showMessageBox({ title, icon = 'warning', heading, message = [], buttons = ['OK'] }) {
    return new Promise(resolve => {
        const returnFocus = document.activeElement;
        const id = `messageBox${++messageBoxCount}`;

        const overlay = makeElement('div', 'dead-dialog-overlay open message-box-overlay');
        const dialog = makeElement('div', 'dead-dialog win95-window message-box');
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', `${id}Title`);
        dialog.setAttribute('aria-describedby', `${id}Text`);

        const titleBar = makeElement('div', 'win95-title-bar');
        const titleText = makeElement('div', 'win95-title', title);
        titleText.id = `${id}Title`;
        const close = makeElement('button', 'win95-button win95-close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.innerHTML = '&times;';
        if (buttons.includes('Close')) {
            // Same as the Close button below, so only that one is announced
            close.tabIndex = -1;
            close.setAttribute('aria-hidden', 'true');
        }
        const titleButtons = makeElement('div', 'win95-buttons');
        titleButtons.append(close);
        titleBar.append(titleText, titleButtons);

        const body = makeElement('div', 'dead-dialog-body');
        const iconFrame = makeElement('div', 'dead-dialog-icon');
        const image = makeElement('img');
        image.src = MESSAGE_BOX_ICONS[icon];
        image.alt = '';
        image.width = image.height = 32;
        iconFrame.append(image);
        const text = makeElement('div', 'dead-dialog-text message-box-text');
        text.id = `${id}Text`;
        if (heading) text.append(makeElement('strong', null, heading));
        message.forEach(line => text.append(makeElement('p', null, line)));
        body.append(iconFrame, text);

        const buttonRow = makeElement('div', 'dead-dialog-buttons message-box-buttons');
        buttons.forEach(label => {
            const button = makeElement('button', 'win95-btn', label);
            button.type = 'button';
            button.addEventListener('click', () => finish(label));
            buttonRow.append(button);
        });

        dialog.append(titleBar, body, buttonRow);
        overlay.append(dialog);
        document.body.append(overlay);

        function finish(result) {
            overlay.remove();
            if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
            resolve(result);
        }

        close.addEventListener('click', () => finish(null));
        overlay.addEventListener('click', event => {
            if (event.target === overlay) finish(null);
        });
        overlay.addEventListener('keydown', event => {
            // Only this box, never the dialog or window behind it
            event.stopPropagation();
            if (event.key === 'Escape') {
                finish(null);
            } else if (event.key === 'Tab') {
                // It's modal, so Tab cycles through its buttons
                const focusable = [...buttonRow.querySelectorAll('button')];
                const index = focusable.indexOf(document.activeElement);
                const next = event.shiftKey ? index - 1 : index + 1;
                event.preventDefault();
                focusable[(next + focusable.length) % focusable.length].focus();
            }
        });

        WindowManager.makeDraggable(dialog, titleBar);
        centerInViewport(dialog);
        buttonRow.querySelector('button').focus();
    });
}
