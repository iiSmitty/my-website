// Help > How This Site Works (the menu bar and the Start menu). Brings the
// main window back, loads the profile from the floppy if it hasn't been, then
// lands on the section, with focus on its heading so the keyboard is there too.
async function openSiteHelp() {
    const mainWindow = document.querySelector('.win95-container');
    if (mainWindow) WindowManager.open(mainWindow);

    await loadProfile({ quick: true });

    const heading = document.getElementById('how-it-works-title');
    if (!heading) return;
    // A jump, not a glide: Win95 never scrolled smoothly
    document.getElementById('how-it-works').scrollIntoView();
    heading.focus({ preventScroll: true });
}

// The help topics' shortcut buttons open the program they talk about, the way
// a WinHelp shortcut button opened the Control Panel item it described
function initializeSiteHelp() {
    document.querySelectorAll('.help-shortcut[data-program]').forEach(button => {
        const program = DESKTOP_PROGRAMS.find(candidate => candidate.name === button.dataset.program);
        if (program) button.addEventListener('click', () => program.open());
    });

    document.querySelectorAll('[data-site-help]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            openSiteHelp();
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeSiteHelp);
