// The Experience window shows experience.html in embedded mode
function openExperienceWindow() {
    const frame = document.getElementById('experienceFrame');

    // Load the page on first open only, so the home page doesn't pay for it
    if (!frame.getAttribute('src')) {
        frame.setAttribute('src', frame.dataset.src);
    }

    WindowManager.open(document.getElementById('experienceWindow'));
}

function closeExperienceWindow() {
    WindowManager.close(document.getElementById('experienceWindow'));
}

document.addEventListener('DOMContentLoaded', function() {
    WindowManager.register(document.getElementById('experienceWindow'), { maximizable: true });
});
