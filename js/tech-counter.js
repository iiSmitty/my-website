// Function to update the counter in the status bar
function updateTechItemCounter() {
    // Get all tech items within the My Tech window
    const techItems = document.querySelectorAll('.tech-item');

    // Get the status bar counter element
    const statusBarCounter = document.getElementById('tech-item-counter');

    // Update the counter text with the actual count
    if (statusBarCounter) {
        statusBarCounter.textContent = `${techItems.length} object(s)`;
    }
}

// Initialize the counter when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initial count update
    updateTechItemCounter();

    // Update the counter whenever the My Tech window is opened
    const myTechWindow = document.getElementById('myTechWindow');
    if (myTechWindow) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'style' &&
                    myTechWindow.style.display !== 'none') {
                    updateTechItemCounter();
                }
            });
        });

        observer.observe(myTechWindow, { attributes: true });
    }

// Set up a MutationObserver to automatically update the counter
// when tech items are added or removed
    const folderView = document.querySelector('.folder-view');
    if (folderView) {
        const observer = new MutationObserver(function() {
            updateTechItemCounter();
        });

        observer.observe(folderView, {
            childList: true, // Watch for changes to the child elements
            subtree: true    // Watch for changes in all descendants
        });
    }
});