// My Computer: the hardware I use, as an Explorer Details view. The dead
// headset's row opens a "device not working" dialog instead.

function openMyTechWindow() {
    WindowManager.open(document.getElementById('myTechWindow'));
}

function closeMyTechWindow() {
    WindowManager.close(document.getElementById('myTechWindow'));
}

// Only one row of My Computer is selected at a time
function selectTechItem(element) {
    document.querySelectorAll('.tech-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
}

// Show a Win95-style "device not working" dialog for a retired/dead item.
// Used by the Sony WF-1000XM4 row, whose battery no longer holds a charge.
function showDeadDeviceDialog(element) {
    // Still behave like a normal row: mark it selected.
    selectTechItem(element);

    // Pull the device name straight from the row so the dialog stays in sync.
    // Prefer the struck-through name, falling back to the whole name cell.
    const nameNode = element.querySelector('.tech-item-name s') || element.querySelector('.tech-item-name');
    const name = (nameNode?.textContent || 'Device').trim();

    let overlay = document.getElementById('deadDeviceDialog');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'deadDeviceDialog';
        overlay.className = 'dead-dialog-overlay';
        overlay.innerHTML = `
            <div class="dead-dialog win95-window" id="deadDeviceWindow" role="dialog" aria-modal="true" aria-labelledby="deadDialogTitle">
                <div class="win95-title-bar" id="deadDeviceTitleBar" style="cursor: move;">
                    <div class="win95-title" id="deadDialogTitle"></div>
                    <div class="win95-buttons">
                        <button class="win95-button win95-close" type="button" aria-label="Close" onclick="closeDeadDeviceDialog()">&times;</button>
                    </div>
                </div>
                <div class="dead-dialog-body">
                    <div class="dead-dialog-icon" aria-hidden="true">
                        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="15" fill="#d00000" stroke="#800000" stroke-width="1"/>
                            <path d="M10 10 L22 22 M22 10 L10 22" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="dead-dialog-text">
                        <strong>This device is not working properly.</strong>
                        The battery no longer holds a charge, so Windows cannot start
                        this device. Served faithfully from first pairing to final charge.
                        <br><br>
                        <span class="dead-dialog-code">(Code 10: Device flatlined.)</span>
                    </div>
                </div>
                <div class="dead-dialog-buttons">
                    <button class="win95-btn" type="button" onclick="closeDeadDeviceDialog()">OK</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // Click outside the dialog (on the backdrop) closes it.
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeDeadDeviceDialog();
        });

        // Drag by the title bar, consistent with the other windows.
        WindowManager.makeDraggable(document.getElementById('deadDeviceWindow'),
            document.getElementById('deadDeviceTitleBar'));
    }

    overlay.querySelector('#deadDialogTitle').textContent = `${name} Properties`;
    overlay.classList.add('open');

    // Centered each time it opens
    centerInViewport(document.getElementById('deadDeviceWindow'));

    // Esc closes the dialog while it's open.
    document.addEventListener('keydown', deadDeviceEscHandler);
}

function deadDeviceEscHandler(e) {
    if (e.key === 'Escape') closeDeadDeviceDialog();
}

function closeDeadDeviceDialog() {
    const overlay = document.getElementById('deadDeviceDialog');
    if (overlay) overlay.classList.remove('open');
    document.removeEventListener('keydown', deadDeviceEscHandler);
}

// The status bar counts the rows in the window, so it never goes stale when
// a device is added to or removed from the HTML
function updateTechItemCounter() {
    const techItems = document.querySelectorAll('.tech-item');
    const statusBarCounter = document.getElementById('tech-item-counter');

    if (statusBarCounter) {
        statusBarCounter.textContent = `${techItems.length} object(s)`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    WindowManager.register(document.getElementById('myTechWindow'));

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
