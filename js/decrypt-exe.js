// DECRYPT.EXE Easter Egg
// On a desktop, "Decrypt Contact Info" opens a Notepad with a half-written
// Caesar cipher decrypt() and an MS-DOS Prompt that runs its self-test. Once
// the visitor's own function passes, it decrypts the real contact email.
//
// The challenge is the fun part, not the security. The email still comes
// through the same Turnstile gate as everyone else's (decrypt.js), and
// "I'm not a developer" skips straight to the normal decryption.
//
// Visitor code runs in a throwaway Web Worker, so an infinite loop can be
// killed instead of freezing the page. Nothing is built until it's first
// opened, so the home page doesn't pay for it.

const DECRYPT_EXE_STARTER = `// DECRYPT.EXE
//
// The contact details were encrypted with a Caesar cipher:
// every letter moved \`shift\` places forward in the alphabet,
// wrapping Z round to A.
//
// Finish decrypt() so it moves them back. Keep upper and
// lower case, and leave anything that isn't a letter (like
// @ and .) as it is.
//
// Press F5 to run the self-test.

function decrypt(cipherText, shift) {
    let plainText = '';

    // Your code here

    return plainText;
}
`;

const DECRYPT_EXE_TESTS = [
    { args: ['KHOOR', 3], expected: 'HELLO' },
    { args: ['zruog', 3], expected: 'world' },
    { args: ['DEF abc', 3], expected: 'ABC xyz' },
    { args: ['ifmmp@fybnqmf.dpn', 1], expected: 'hello@example.com' },
];

const DECRYPT_EXE_HINTS = [
    'Letters have character codes: A-Z are 65-90 and a-z are 97-122. Try charCodeAt() and String.fromCharCode().',
    'Moving back 3 from "a" has to land on "x". The % operator wraps round, but add 26 first so it never goes negative.',
    'Only letters move. Check each character with a regex like /[a-z]/i and leave everything else untouched.',
];

// How long decrypt() may run before Windows decides it has hung
const DECRYPT_EXE_TIMEOUT = 1000;
// Clippy offers help after this many failed runs in a row
const DECRYPT_EXE_CLIPPY_AFTER = 2;
// Side-by-side layout needs a desktop-sized screen and a mouse (coding on a
// phone is no fun); everyone else gets the normal decryption
const DECRYPT_EXE_MEDIA = '(min-width: 720px) and (pointer: fine)';

let decryptExeStylesPromise = null;
let decryptExeRunnerUrl = null;
let decryptExeRunning = false;
let decryptExeSolved = false;
let decryptExeFailedRuns = 0;
let decryptExeClippyDismissed = false;
let decryptExeHintIndex = 0;
let decryptExeReturnFocus = null;

// --- Running visitor code ----------------------------------------------------

// Runs inside the Web Worker. It's stringified into the worker, never called
// here, so it must be self-contained.
function decryptExeRunner() {
    const describe = (error) => ({
        name: (error && error.name) || 'Error',
        message: String(error && error.message !== undefined ? error.message : error),
    });
    const show = (value) => (typeof value === 'string' ? JSON.stringify(value) : String(value));

    self.onmessage = (event) => {
        self.postMessage({ started: true });
        const { code, cases } = event.data;

        let decrypt;
        try {
            decrypt = new Function(`${code}\n;return typeof decrypt === 'function' ? decrypt : undefined;`)();
        } catch (error) {
            self.postMessage({ error: describe(error), results: [] });
            return;
        }
        if (!decrypt) {
            self.postMessage({ error: { name: 'ReferenceError', message: 'decrypt is not defined' }, results: [] });
            return;
        }

        const results = [];
        for (const args of cases) {
            try {
                const value = decrypt(...args);
                results.push({ value: typeof value === 'string' ? value : null, shown: show(value) });
            } catch (error) {
                self.postMessage({ error: describe(error), results });
                return;
            }
        }
        self.postMessage({ results });
    };
}

// Resolves with { results }, { error, results } or { timedOut: true }
function runVisitorCode(code, cases) {
    if (!decryptExeRunnerUrl) {
        const source = `(${decryptExeRunner})();`;
        decryptExeRunnerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    }

    return new Promise((resolve) => {
        const worker = new Worker(decryptExeRunnerUrl);
        let timer = null;
        const finish = (outcome) => {
            clearTimeout(timer);
            worker.terminate();
            resolve(outcome);
        };

        worker.onmessage = (event) => {
            if (event.data.started) {
                // Time the visitor's code, not the worker starting up
                timer = setTimeout(() => finish({ timedOut: true }), DECRYPT_EXE_TIMEOUT);
            } else {
                finish(event.data);
            }
        };
        worker.onerror = (event) => {
            event.preventDefault();
            finish({ error: { name: 'Error', message: event.message }, results: [] });
        };
        worker.postMessage({ code, cases });
    });
}

// The reference cipher, used to encrypt the real email for the final run
function caesarShift(text, shift) {
    return text.replace(/[a-z]/gi, (letter) => {
        const base = letter <= 'Z' ? 65 : 97;
        return String.fromCharCode((letter.charCodeAt(0) - base + shift) % 26 + base);
    });
}

// --- Helpers -------------------------------------------------------------------

// Load the egg's stylesheet on first use. Resolves even if it fails, so the
// windows still open (unstyled) rather than not at all.
function loadDecryptExeStyles() {
    if (!decryptExeStylesPromise) {
        decryptExeStylesPromise = new Promise(resolve => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/decrypt-exe.min.css';
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    }
    return decryptExeStylesPromise;
}

function decryptExeIsOpen() {
    const notepad = document.getElementById('decryptExeNotepad');
    return Boolean(notepad && !notepad.hidden);
}

// Same "bring to front" behaviour as the other desktop windows
function bringDecryptExeWindowToFront(win) {
    document.querySelectorAll('.win95-window').forEach(other => {
        other.style.zIndex = 10;
    });
    win.style.zIndex = 100;
}

// Notepad and the DOS prompt side by side if they fit, otherwise cascaded
function placeDecryptExeWindows(notepad, dos) {
    const gap = 16;
    const margin = 8;
    const notepadRect = notepad.getBoundingClientRect();
    const dosRect = dos.getBoundingClientRect();
    const sideBySide = notepadRect.width + gap + dosRect.width;

    if (sideBySide <= window.innerWidth - margin * 2) {
        const left = (window.innerWidth - sideBySide) / 2;
        const top = Math.max(margin, (window.innerHeight - Math.max(notepadRect.height, dosRect.height)) / 2);
        notepad.style.left = left + 'px';
        dos.style.left = (left + notepadRect.width + gap) + 'px';
        notepad.style.top = dos.style.top = top + 'px';
    } else {
        notepad.style.left = notepad.style.top = margin + 'px';
        dos.style.left = Math.max(margin, window.innerWidth - dosRect.width - margin) + 'px';
        dos.style.top = Math.max(margin, window.innerHeight - dosRect.height - margin) + 'px';
    }
}

function titleBarButtons(closeLabel) {
    return `
        <div class="win95-buttons">
            <button class="win95-button win95-minimize" type="button" tabindex="-1" aria-hidden="true">_</button>
            <button class="win95-button win95-maximize" type="button" tabindex="-1" aria-hidden="true">&#9633;</button>
            <button class="win95-button win95-close" type="button" aria-label="${closeLabel}">&times;</button>
        </div>`;
}

// --- MS-DOS Prompt -------------------------------------------------------------

function dosConsole() {
    return document.getElementById('decryptExeConsole');
}

// Text only (never HTML): visitor output ends up in here
function dosPrint(text = '', className) {
    const log = dosConsole();
    const line = document.createElement('div');
    line.textContent = text;
    if (className) line.className = className;
    log.querySelector('.decrypt-exe-prompt')?.remove();
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

// A blinking C:\> prompt waiting for the next command
function dosReady() {
    const log = dosConsole();
    log.querySelector('.decrypt-exe-prompt')?.remove();
    const prompt = document.createElement('div');
    prompt.className = 'decrypt-exe-prompt';
    prompt.innerHTML = 'C:\\&gt;<span class="decrypt-exe-cursor" aria-hidden="true">_</span>';
    log.appendChild(prompt);
    log.scrollTop = log.scrollHeight;
}

function dosType(command) {
    dosPrint(`C:\\>${command}`);
}

// --- Notepad editing -------------------------------------------------------------

const DECRYPT_EXE_INDENT = '    ';

// Tab and Shift+Tab indent like a code editor. That would trap keyboard users
// in the textarea, so Esc steps out of it (a second Esc closes the windows).
function onEditorKeydown(e) {
    const editor = e.currentTarget;

    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const run = document.getElementById('decryptExeRun');
        (run.disabled ? document.getElementById('decryptExeNotepad') : run).focus();
        return;
    }

    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        indentEditor(editor, e.shiftKey);
    }
}

// Replace a range as if typed, so Ctrl+Z still works (setRangeText doesn't
// record undo, so it's only the fallback)
function replaceEditorRange(editor, start, end, text) {
    editor.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) {
        editor.setRangeText(text, start, end, 'end');
    }
}

function indentEditor(editor, outdent) {
    const { value, selectionStart, selectionEnd } = editor;

    // Tab with nothing selected just indents at the cursor
    if (!outdent && selectionStart === selectionEnd) {
        replaceEditorRange(editor, selectionStart, selectionEnd, DECRYPT_EXE_INDENT);
        return;
    }

    // Otherwise (un)indent every line the selection touches. A selection that
    // ends at the very start of a line doesn't include that line.
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lastChar = selectionEnd > selectionStart && value[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd;
    const nextNewline = value.indexOf('\n', lastChar);
    const blockEnd = nextNewline === -1 ? value.length : nextNewline;

    const lines = value.slice(lineStart, blockEnd).split('\n');
    const changed = lines.map(line => (outdent ? line.replace(/^( {1,4}|\t)/, '') : DECRYPT_EXE_INDENT + line));
    const text = changed.join('\n');
    if (text === lines.join('\n')) return;

    replaceEditorRange(editor, lineStart, blockEnd, text);

    if (selectionStart === selectionEnd) {
        // Shift+Tab on a single line: keep the cursor where it was in the text
        const cursor = Math.max(lineStart, selectionStart - (lines[0].length - changed[0].length));
        editor.setSelectionRange(cursor, cursor);
    } else {
        editor.setSelectionRange(lineStart, lineStart + text.length);
    }
}

// --- Windows ---------------------------------------------------------------------

function buildDecryptExe() {
    const notepad = document.createElement('div');
    notepad.className = 'win95-window decrypt-exe-window decrypt-exe-notepad';
    notepad.id = 'decryptExeNotepad';
    notepad.hidden = true;
    notepad.tabIndex = -1;
    notepad.setAttribute('role', 'dialog');
    notepad.setAttribute('aria-labelledby', 'decryptExeNotepadTitle');
    notepad.innerHTML = `
        <div class="win95-title-bar" id="decryptExeNotepadTitleBar">
            <div class="win95-title" id="decryptExeNotepadTitle">decrypt.js - Notepad</div>
            ${titleBarButtons('Close DECRYPT.EXE')}
        </div>
        <div class="win95-menu-bar decrypt-exe-menu-bar" aria-hidden="true">
            <div class="win95-menu-item">File</div>
            <div class="win95-menu-item">Edit</div>
            <div class="win95-menu-item">Search</div>
            <div class="win95-menu-item">Help</div>
        </div>
        <textarea class="decrypt-exe-editor" id="decryptExeEditor" aria-label="decrypt.js" aria-describedby="decryptExeKeys"
                  spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea>
        <div class="decrypt-exe-actions">
            <span class="decrypt-exe-keys" id="decryptExeKeys">Tab indents &middot; Esc leaves the editor</span>
            <button class="win95-button-large" type="button" id="decryptExeRun">Run (F5)</button>
            <button class="win95-button-large" type="button" id="decryptExeSkip">I'm not a developer</button>
        </div>`;

    const dos = document.createElement('div');
    dos.className = 'win95-window decrypt-exe-window decrypt-exe-dos';
    dos.id = 'decryptExeDos';
    dos.hidden = true;
    dos.tabIndex = -1;
    dos.setAttribute('role', 'dialog');
    dos.setAttribute('aria-labelledby', 'decryptExeDosTitle');
    dos.innerHTML = `
        <div class="win95-title-bar" id="decryptExeDosTitleBar">
            <div class="win95-title" id="decryptExeDosTitle">MS-DOS Prompt</div>
            ${titleBarButtons('Close MS-DOS Prompt')}
        </div>
        <div class="decrypt-exe-console" id="decryptExeConsole" role="log" aria-live="polite"></div>
        <fieldset class="decrypt-turnstile" id="decryptExeTurnstilePanel">
            <legend>Security Check</legend>
            <p>Windows needs to confirm you are not a robot.</p>
            <div class="decrypt-turnstile-widget" id="decryptExeTurnstile"></div>
        </fieldset>`;

    document.body.appendChild(notepad);
    document.body.appendChild(dos);

    const editor = document.getElementById('decryptExeEditor');
    editor.value = DECRYPT_EXE_STARTER;
    editor.addEventListener('keydown', onEditorKeydown);
    document.getElementById('decryptExeRun').addEventListener('click', runSelfTest);
    document.getElementById('decryptExeSkip').addEventListener('click', skipDecryptExe);

    [notepad, dos].forEach(win => {
        win.querySelector('.win95-close').addEventListener('click', closeDecryptExe);
        win.addEventListener('mousedown', () => bringDecryptExeWindowToFront(win));
    });

    // Drag by the title bar, consistent with the other windows (program-icons.js)
    if (typeof makeWindowDraggable === 'function') {
        makeWindowDraggable('decryptExeNotepad', 'decryptExeNotepadTitleBar');
        makeWindowDraggable('decryptExeDos', 'decryptExeDosTitleBar');
    }

    dosPrint('Microsoft(R) Windows 95');
    dosPrint('   (C)Copyright Microsoft Corp 1981-1995.');
    dosPrint();
    dosType('type README.TXT');
    dosPrint('The contact details are encrypted. Finish decrypt() in');
    dosPrint('Notepad, then press F5 to run the self-test.');
    dosPrint();
    dosReady();
}

async function openDecryptExe() {
    const opener = document.activeElement;
    await loadDecryptExeStyles();

    if (!document.getElementById('decryptExeNotepad')) {
        buildDecryptExe();
    }
    const notepad = document.getElementById('decryptExeNotepad');
    const dos = document.getElementById('decryptExeDos');

    if (notepad.hidden) {
        decryptExeReturnFocus = opener && opener !== document.body ? opener : null;
        notepad.hidden = false;
        dos.hidden = false;
        placeDecryptExeWindows(notepad, dos);
    }

    bringDecryptExeWindowToFront(dos);
    bringDecryptExeWindowToFront(notepad);
    document.getElementById('decryptExeEditor').focus({ preventScroll: true });
}

function closeDecryptExe() {
    if (!decryptExeIsOpen()) return;

    document.getElementById('decryptExeNotepad').hidden = true;
    document.getElementById('decryptExeDos').hidden = true;
    closeDecryptExeError();
    removeDecryptExeClippy();

    if (decryptExeReturnFocus && decryptExeReturnFocus.isConnected) {
        decryptExeReturnFocus.focus();
    }
}

// The escape hatch: the normal progress-bar decryption, still behind Turnstile
function skipDecryptExe() {
    closeDecryptExe();
    window.ContactGate.startDecryption();
    document.getElementById('decrypt-animation').scrollIntoView({ block: 'center' });
}

function setDecryptExeBusy(busy) {
    decryptExeRunning = busy;
    document.getElementById('decryptExeRun').disabled = busy || decryptExeSolved;
    document.getElementById('decryptExeSkip').disabled = busy || decryptExeSolved;
}

// --- The challenge ---------------------------------------------------------------

async function runSelfTest() {
    if (decryptExeRunning || decryptExeSolved) return;
    setDecryptExeBusy(true);

    const code = document.getElementById('decryptExeEditor').value;
    dosType('decrypt.exe --self-test');

    const outcome = await runVisitorCode(code, DECRYPT_EXE_TESTS.map(test => test.args));
    let passed = 0;

    if (outcome.timedOut) {
        dosPrint('decrypt() is not responding.');
        showDecryptExeBsod();
    } else {
        outcome.results.forEach((result, i) => {
            const test = DECRYPT_EXE_TESTS[i];
            const call = `decrypt(${JSON.stringify(test.args[0])}, ${test.args[1]}) `;
            const ok = result.value === test.expected;
            dosPrint(`  ${call.padEnd(34, '.')} ${ok ? 'OK' : 'FAIL'}`, ok ? null : 'decrypt-exe-fail');
            if (ok) {
                passed++;
            } else {
                dosPrint(`      expected ${JSON.stringify(test.expected)}`);
                dosPrint(`      got      ${result.shown}`);
            }
        });

        if (outcome.error) {
            dosPrint(`  ${outcome.error.name}: ${outcome.error.message}`, 'decrypt-exe-fail');
            showDecryptExeError(outcome.error);
        } else {
            dosPrint(`  ${passed} of ${DECRYPT_EXE_TESTS.length} tests passed.`);
        }
    }

    dosPrint();
    if (passed === DECRYPT_EXE_TESTS.length) {
        decryptExeFailedRuns = 0;
        await decryptContact(code);
    } else {
        decryptExeFailedRuns++;
        if (decryptExeFailedRuns >= DECRYPT_EXE_CLIPPY_AFTER) showDecryptExeClippy();
    }

    dosReady();
    setDecryptExeBusy(false);
}

// The visitor's decrypt() passed, so let it decrypt the real thing
async function decryptContact(code) {
    dosType('decrypt.exe contact.enc');
    dosPrint('Requesting contact.enc from secure server...');

    let email;
    try {
        const panel = document.getElementById('decryptExeTurnstilePanel');
        const token = await window.ContactGate.getTurnstileToken(panel, {
            onInteractive: () => dosPrint('Security check: please confirm you are not a robot.'),
            onInteractiveDone: () => {},
        });
        email = await window.ContactGate.fetchContactEmail(token);
    } catch {
        dosPrint('Access denied by secure server. Press F5 to try again.', 'decrypt-exe-fail');
        dosPrint();
        return;
    }

    const shift = 1 + Math.floor(Math.random() * 25);
    dosPrint(`Decrypting with shift ${shift}...`);
    const outcome = await runVisitorCode(code, [[caesarShift(email, shift), shift]]);

    if (outcome.timedOut) {
        dosPrint('decrypt() is not responding.');
        dosPrint();
        showDecryptExeBsod();
        return;
    }
    if (outcome.error) {
        dosPrint(`${outcome.error.name}: ${outcome.error.message}`, 'decrypt-exe-fail');
        dosPrint();
        showDecryptExeError(outcome.error);
        return;
    }
    if (outcome.results[0].value !== email) {
        dosPrint('CRC error: contact.enc decrypted to garbage.', 'decrypt-exe-fail');
        dosPrint(`Does decrypt() work for every shift from 1 to 25?`);
        dosPrint('(Hard-coding the test answers won\'t cut it.)');
        dosPrint();
        return;
    }

    decryptExeSolved = true;
    dosPrint();
    dosPrint(`  ${email}`, 'decrypt-exe-bright');
    dosPrint();
    dosPrint('Access granted. Nice work!');
    dosPrint();
    removeDecryptExeClippy();
    playDecryptExeSound();
    window.ContactGate.showDecryptedEmail(email);
}

function playDecryptExeSound() {
    try {
        const sound = new Audio('sounds/win95-access.mp3');
        sound.volume = 0.7;
        sound.play().catch(() => {});
    } catch (e) {
        // Sound is a nice-to-have
    }
}

// --- "This program has performed an illegal operation" --------------------------

function showDecryptExeError(error) {
    closeDecryptExeError();

    const dialog = document.createElement('div');
    dialog.className = 'decrypt-exe-error';
    dialog.id = 'decryptExeError';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'decryptExeErrorTitle');
    dialog.setAttribute('aria-describedby', 'decryptExeErrorMessage');
    dialog.innerHTML = `
        <div class="win95-title-bar">
            <div class="win95-title" id="decryptExeErrorTitle">DECRYPT</div>
            <div class="win95-buttons">
                <!-- Same as the Close button below, so only that one is announced -->
                <button class="win95-button win95-close" type="button" tabindex="-1" aria-hidden="true">&times;</button>
            </div>
        </div>
        <div class="decrypt-exe-error-body">
            <img src="images/win95-error.png" alt="" width="32" height="32">
            <div id="decryptExeErrorMessage">
                <p>This program has performed an illegal operation and will be shut down.</p>
                <p>If the problem persists, contact the program vendor.</p>
            </div>
            <div class="decrypt-exe-error-buttons">
                <button class="win95-button-large" type="button" data-action="close">Close</button>
                <button class="win95-button-large" type="button" data-action="details"
                        aria-expanded="false" aria-controls="decryptExeErrorDetails">Details &gt;&gt;</button>
            </div>
        </div>
        <pre class="decrypt-exe-error-details" id="decryptExeErrorDetails" hidden></pre>`;

    dialog.querySelector('.decrypt-exe-error-details').textContent =
        `DECRYPT caused ${/^[aeiou]/i.test(error.name) ? 'an' : 'a'} ${error.name}\nin module DECRYPT.JS:\n\n${error.message}`;

    dialog.querySelector('.win95-close').addEventListener('click', closeDecryptExeError);
    dialog.querySelector('[data-action="close"]').addEventListener('click', closeDecryptExeError);
    dialog.querySelector('[data-action="details"]').addEventListener('click', function () {
        const details = dialog.querySelector('.decrypt-exe-error-details');
        details.hidden = !details.hidden;
        this.setAttribute('aria-expanded', String(!details.hidden));
        this.innerHTML = details.hidden ? 'Details &gt;&gt;' : '&lt;&lt; Details';
    });

    document.body.appendChild(dialog);
    dialog.querySelector('[data-action="close"]').focus();
}

function closeDecryptExeError() {
    const dialog = document.getElementById('decryptExeError');
    if (!dialog) return;
    dialog.remove();
    if (decryptExeIsOpen()) document.getElementById('decryptExeEditor').focus();
}

// --- Blue screen for code that never finishes ------------------------------------

function showDecryptExeBsod() {
    const bsod = document.createElement('div');
    bsod.className = 'decrypt-exe-bsod';
    bsod.id = 'decryptExeBsod';
    bsod.tabIndex = -1;
    bsod.setAttribute('role', 'alertdialog');
    bsod.setAttribute('aria-labelledby', 'decryptExeBsodTitle');
    bsod.setAttribute('aria-describedby', 'decryptExeBsodMessage');
    bsod.innerHTML = `
        <div class="decrypt-exe-bsod-screen">
            <p class="decrypt-exe-bsod-title"><span id="decryptExeBsodTitle">Windows</span></p>
            <div id="decryptExeBsodMessage">
                <p>A fatal exception 0E has occurred at 0028:C0DEDBAD in VXD DECRYPT(01) +
                00001995. The current application will be terminated.</p>
                <p>decrypt() was still running after ${DECRYPT_EXE_TIMEOUT / 1000} second.
                Is there a loop that never ends?</p>
            </div>
            <p>*  Press any key to terminate the current application.<br>
               *  Press CTRL+ALT+DEL again to restart your computer. You will<br>
               &nbsp;&nbsp;&nbsp;lose any unsaved information in all applications.</p>
            <p class="decrypt-exe-bsod-continue">Press any key to continue <span class="decrypt-exe-cursor" aria-hidden="true">_</span></p>
        </div>`;

    const dismiss = (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.removeEventListener('keydown', dismiss, true);
        bsod.remove();
        if (decryptExeIsOpen()) document.getElementById('decryptExeEditor').focus();
    };
    // Capture phase, so this key press doesn't also close the windows behind it
    document.addEventListener('keydown', dismiss, true);
    bsod.addEventListener('click', dismiss);

    document.body.appendChild(bsod);
    bsod.focus();
}

// --- Clippy ------------------------------------------------------------------------

function showDecryptExeClippy() {
    if (decryptExeClippyDismissed || document.getElementById('decryptExeClippy')) return;

    const clippy = document.createElement('div');
    clippy.className = 'clippy-container decrypt-exe-clippy';
    clippy.id = 'decryptExeClippy';
    clippy.setAttribute('role', 'dialog');
    clippy.setAttribute('aria-label', 'Office Assistant');
    clippy.innerHTML = `
        <div class="clippy-popup">
            <div class="clippy-content">
                <div class="clippy-message" id="decryptExeClippyMessage" aria-live="polite">
                    It looks like you're trying to decrypt something! Would you like help?
                </div>
                <ul class="clippy-options">
                    <li><button type="button" data-action="hint"><span class="clippy-bullet">&#9679;</span>Give me a hint</button></li>
                    <li><button type="button" data-action="skip"><span class="clippy-bullet">&#9679;</span>Just decrypt it for me</button></li>
                </ul>
                <button class="clippy-cancel" type="button" data-action="cancel">Cancel</button>
            </div>
            <div class="clippy-pointer"></div>
            <div class="clippy-image"></div>
        </div>`;

    clippy.querySelector('[data-action="hint"]').addEventListener('click', function () {
        document.getElementById('decryptExeClippyMessage').textContent = DECRYPT_EXE_HINTS[decryptExeHintIndex];
        decryptExeHintIndex++;
        if (decryptExeHintIndex < DECRYPT_EXE_HINTS.length) {
            this.lastChild.textContent = 'Another hint';
        } else {
            this.closest('li').remove();
        }
    });
    clippy.querySelector('[data-action="skip"]').addEventListener('click', skipDecryptExe);
    clippy.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        decryptExeClippyDismissed = true;
        removeDecryptExeClippy();
    });

    document.body.appendChild(clippy);
}

function removeDecryptExeClippy() {
    const clippy = document.getElementById('decryptExeClippy');
    if (clippy) clippy.remove();
}

// --- Wiring --------------------------------------------------------------------------

document.addEventListener('keydown', function (e) {
    if (!decryptExeIsOpen() || document.getElementById('decryptExeBsod')) return;

    if (e.key === 'Escape') {
        if (document.getElementById('decryptExeError')) {
            closeDecryptExeError();
        } else {
            closeDecryptExe();
        }
        return;
    }

    // F5 (or Ctrl+Enter) runs the self-test instead of reloading the page
    const inDecryptExe = e.target.closest && e.target.closest('.decrypt-exe-window');
    if (inDecryptExe && (e.key === 'F5' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        runSelfTest();
    }
});

// Used by decrypt.js when "Decrypt Contact Info" is clicked
window.DecryptExe = {
    isAvailable: () => Boolean(window.matchMedia && window.matchMedia(DECRYPT_EXE_MEDIA).matches) &&
        typeof Worker === 'function',
    open: openDecryptExe,
};
