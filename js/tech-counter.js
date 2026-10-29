// My Computer's status bar counts the rows in the window, so it never goes
// stale when a device is added to or removed from the HTML
function updateTechItemCounter() {
    const techItems = document.querySelectorAll('.tech-item');
    const statusBarCounter = document.getElementById('tech-item-counter');

    if (statusBarCounter) {
        statusBarCounter.textContent = `${techItems.length} object(s)`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    updateTechItemCounter();

    // Keep counting if rows are added or removed while the page is open
    const folderView = document.querySelector('.folder-view');
    if (folderView) {
        const observer = new MutationObserver(function() {
            updateTechItemCounter();
        });

        observer.observe(folderView, {
            childList: true,
            subtree: true
        });
    }
});
