const { test, expect } = require('@playwright/test');
const { TOKEN, stubTurnstile, stubContactApi, fastForwardUntil, openContactSection, waitForReveal } = require('./contact-helpers');

// DECRYPT.EXE: on a desktop, "Decrypt Contact Info" opens Notepad and an
// MS-DOS Prompt, and the visitor's own decrypt() has to pass a self-test and
// then decrypt the (stubbed) email.
const EMAIL = 'contact@example.org';

const SOLUTION = `function decrypt(cipherText, shift) {
    return cipherText.replace(/[a-z]/gi, (letter) => {
        const base = letter <= 'Z' ? 65 : 97;
        return String.fromCharCode((letter.charCodeAt(0) - base - shift + 26) % 26 + base);
    });
}`;

// Passes the self-test without decrypting anything
const HARD_CODED = `function decrypt(cipherText) {
    return { KHOOR: 'HELLO', zruog: 'world', 'DEF abc': 'ABC xyz', 'ifmmp@fybnqmf.dpn': 'hello@example.com' }[cipherText];
}`;

async function openDecryptExe(page) {
    const contact = await openContactSection(page);
    await page.locator('#decrypt-button').click();
    await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'MS-DOS Prompt' })).toBeVisible();
    return contact;
}

async function runCode(page, code) {
    const editor = page.getByRole('textbox', { name: 'decrypt.js' });
    await editor.fill(code);
    await editor.press('F5');
}

const dosConsole = (page) => page.locator('#decryptExeConsole');

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    // Startup, floppy loader and the challenge: among the longest flows in the
    // suite, so they get Playwright's tripled timeout under parallel load
    test.slow();

    test('nothing loads until Decrypt is clicked', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await openContactSection(page);
        await page.waitForLoadState('networkidle');

        expect(requested.filter((url) => /decrypt-exe\.min\.css|challenges\.cloudflare\.com|\/api\/contact/.test(url))).toEqual([]);
        await expect(page.locator('#decryptExeNotepad')).toHaveCount(0);
    });

    test('the starter code fails the self-test without fetching anything', async ({ page }) => {
        const requested = [];
        page.on('request', (request) => requested.push(request.url()));

        await openDecryptExe(page);
        await expect(page.getByRole('textbox', { name: 'decrypt.js' })).toBeFocused();
        await expect(page.getByRole('textbox', { name: 'decrypt.js' })).toHaveValue(/function decrypt\(cipherText, shift\)/);

        await page.getByRole('button', { name: 'Run (F5)' }).click();

        await expect(dosConsole(page)).toContainText('0 of 4 tests passed.');
        await expect(dosConsole(page)).toContainText('expected "HELLO"');
        expect(requested.filter((url) => /challenges\.cloudflare\.com|\/api\/contact/.test(url))).toEqual([]);
    });

    test('a working decrypt() decrypts the real email', async ({ page }) => {
        await stubTurnstile(page);
        const posted = await stubContactApi(page, EMAIL);
        const contact = await openDecryptExe(page);

        await runCode(page, SOLUTION);

        await expect(dosConsole(page)).toContainText('4 of 4 tests passed.');
        await expect(dosConsole(page)).toContainText('Access granted. Nice work!');
        await expect(dosConsole(page)).toContainText(EMAIL);
        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);

        expect(posted).toEqual([{ method: 'POST', body: { token: TOKEN } }]);
        expect(await page.evaluate(() => window.turnstileRenders)).toEqual([{ container: '#decryptExeTurnstile', action: 'contact' }]);
        // Solved: nothing left to run
        await expect(page.getByRole('button', { name: 'Run (F5)' })).toBeDisabled();
    });

    test('hard-coded test answers pass the self-test but not the real thing', async ({ page }) => {
        await stubTurnstile(page);
        await stubContactApi(page, EMAIL);
        const contact = await openDecryptExe(page);

        await runCode(page, HARD_CODED);

        await expect(dosConsole(page)).toContainText('4 of 4 tests passed.');
        await expect(dosConsole(page)).toContainText('CRC error: contact.enc decrypted to garbage.');
        await expect(dosConsole(page)).not.toContainText(EMAIL);
        await expect(contact).not.toContainText(EMAIL);
        await expect(page.getByRole('button', { name: 'Run (F5)' })).toBeEnabled();
    });

    test('a crash shows the illegal operation dialog', async ({ page }) => {
        await openDecryptExe(page);

        await runCode(page, 'function decrypt(cipherText) {\n    return cipherText.map((c) => c);\n}');

        const dialog = page.getByRole('alertdialog', { name: 'DECRYPT' });
        await expect(dialog).toContainText('This program has performed an illegal operation and will be shut down.');
        const details = page.locator('#decryptExeErrorDetails');
        await expect(details).toBeHidden();

        await dialog.getByRole('button', { name: 'Details >>' }).click();
        await expect(details).toContainText('DECRYPT caused a TypeError');
        await expect(details).toContainText('cipherText.map is not a function');

        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: 'decrypt.js' })).toBeFocused();
    });

    test('an endless loop blue-screens instead of freezing the page', async ({ page }) => {
        await openDecryptExe(page);

        await runCode(page, 'function decrypt() {\n    while (true) {}\n}');

        const bsod = page.locator('#decryptExeBsod');
        await fastForwardUntil(page, () => bsod.isVisible(), true);
        await expect(bsod).toContainText('A fatal exception 0E has occurred');
        await expect(dosConsole(page)).toContainText('decrypt() is not responding.');

        // Any key goes back to Windows, without also closing DECRYPT.EXE
        await page.keyboard.press('Escape');
        await expect(bsod).toHaveCount(0);
        await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeVisible();
    });

    test('Clippy helps after two failed runs and can skip the challenge', async ({ page }) => {
        await stubTurnstile(page);
        await stubContactApi(page, EMAIL);
        const contact = await openDecryptExe(page);
        const clippy = page.getByRole('dialog', { name: 'Office Assistant' });

        await page.getByRole('button', { name: 'Run (F5)' }).click();
        await expect(dosConsole(page)).toContainText('0 of 4 tests passed.');
        await expect(clippy).toHaveCount(0);

        await page.getByRole('button', { name: 'Run (F5)' }).click();
        await expect(clippy).toContainText('It looks like you\'re trying to decrypt something!');

        await clippy.getByRole('button', { name: 'Give me a hint' }).click();
        await expect(clippy).toContainText('charCodeAt()');

        await clippy.getByRole('button', { name: 'Just decrypt it for me' }).click();
        await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeHidden();
        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toBeVisible();
    });

    test('"I\'m not a developer" skips to the normal decryption', async ({ page }) => {
        await stubTurnstile(page);
        await stubContactApi(page, EMAIL);
        const contact = await openDecryptExe(page);

        await page.getByRole('button', { name: 'I\'m not a developer' }).click();

        await expect(page.getByRole('dialog', { name: 'MS-DOS Prompt' })).toBeHidden();
        await waitForReveal(page);
        await expect(contact.getByRole('link', { name: EMAIL })).toBeVisible();
    });

    test('Tab indents, Shift+Tab outdents, and Esc steps out of the editor', async ({ page }) => {
        await openDecryptExe(page);
        const editor = page.getByRole('textbox', { name: 'decrypt.js' });

        await editor.fill('if (x) {\nreturn y;\n}');
        // Cursor at the start of "return y;"
        await editor.evaluate((el) => el.setSelectionRange(9, 9));
        await editor.press('Tab');
        await expect(editor).toHaveValue('if (x) {\n    return y;\n}');
        await expect(editor).toBeFocused();

        // Select all three lines and indent, then outdent them again
        await editor.evaluate((el) => el.setSelectionRange(0, el.value.length));
        await editor.press('Tab');
        await expect(editor).toHaveValue('    if (x) {\n        return y;\n    }');
        await editor.press('Shift+Tab');
        await expect(editor).toHaveValue('if (x) {\n    return y;\n}');

        // Undo still works after indenting
        await editor.press('Control+z');
        await expect(editor).toHaveValue('    if (x) {\n        return y;\n    }');

        // Esc leaves the editor (no keyboard trap); a second Esc closes
        await editor.press('Escape');
        await expect(page.getByRole('button', { name: 'Run (F5)' })).toBeFocused();
        await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeHidden();
    });

    test('typing isn\'t eaten by the menu shortcuts after Alt+Tab', async ({ page }) => {
        await openDecryptExe(page);
        const editor = page.getByRole('textbox', { name: 'decrypt.js' });
        await editor.fill('');

        // Alt+Tab away: the page sees Alt go down but never come back up
        await editor.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true })));
        await editor.pressSequentially('fevh');
        await expect(editor).toHaveValue('fevh');

        // Real Alt+F still opens the File menu
        await page.keyboard.press('Alt+f');
        await expect(page.locator('.win95-dropdown-content.show')).toBeVisible();
    });

    test('closing keeps the code, and Decrypt brings it back', async ({ page }) => {
        await openDecryptExe(page);
        await page.getByRole('textbox', { name: 'decrypt.js' }).fill('// work in progress');

        // The first Esc leaves the editor, the second closes
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'decrypt.js - Notepad' })).toBeHidden();
        await expect(page.locator('#decrypt-button')).toBeFocused();

        await page.locator('#decrypt-button').click();
        await expect(page.getByRole('textbox', { name: 'decrypt.js' })).toHaveValue('// work in progress');
    });
});
