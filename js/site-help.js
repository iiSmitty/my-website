// Help > How This Site Works (the menu bar and the Start menu). Lands on the
// section (loading the profile from the floppy if it hasn't been), with focus
// on its heading.
function openSiteHelp() {
    const section = document.getElementById('how-it-works');
    const heading = document.getElementById('how-it-works-title');
    if (section && heading) return goToProfileSection(section, heading);
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
