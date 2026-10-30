// Shut Down, from the main window's close button, File > Exit or the Start
// menu: asks first, then plays the Windows 95 shutdown video

function showClosingDialog() {
    document.body.appendChild(createClosingDialog());
}

// Create the dialog for closing/shutdown
function createClosingDialog() {
    // Create the overlay background
    const overlay = document.createElement('div');
    overlay.className = 'win95-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    // Above the windows and the taskbar, like the other modal dialogs
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';

    // Create the dialog window
    const dialog = document.createElement('div');
    dialog.className = 'win95-dialog';
    dialog.style.width = '400px';
    dialog.style.backgroundColor = '#c0c0c0';
    dialog.style.border = 'outset 2px #dfdfdf';
    dialog.style.boxShadow = '2px 2px 5px rgba(0, 0, 0, 0.2)';
    dialog.style.fontFamily = '"MS Sans Serif", sans-serif';
    dialog.style.padding = '2px';

    // Create the dialog title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'win95-title-bar';
    titleBar.style.backgroundColor = '#000080';
    titleBar.style.color = 'white';
    titleBar.style.padding = '3px 4px';
    titleBar.style.fontWeight = 'bold';
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.alignItems = 'center';

    // Title text
    const titleText = document.createElement('span');
    titleText.textContent = 'Shut Down Windows';
    titleBar.appendChild(titleText);

    // Close button in title bar
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '&#x2715;'; // X symbol
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginLeft = '4px';
    closeButton.addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    titleBar.appendChild(closeButton);

    // Create dialog content
    const content = document.createElement('div');
    content.className = 'win95-dialog-content';
    content.style.padding = '15px';

    // Create dialog message
    const message = document.createElement('div');
    message.style.display = 'flex';
    message.style.flexDirection = 'column';
    message.style.alignItems = 'center';
    message.style.justifyContent = 'center';
    message.style.textAlign = 'center';
    message.style.marginBottom = '20px';

    const text = document.createElement('p');
    text.textContent = 'Are you sure you want to shut down this website?';
    text.style.margin = '10px 0';
    message.appendChild(text);

    content.appendChild(message);

    // Create buttons container
    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.justifyContent = 'center';
    buttons.style.gap = '10px';

    // Yes button
    const yesButton = document.createElement('button');
    yesButton.className = 'win95-button';
    yesButton.textContent = 'Yes';
    yesButton.style.padding = '4px 10px';
    yesButton.style.backgroundColor = '#c0c0c0';
    yesButton.style.border = 'outset 2px #dfdfdf';
    yesButton.style.fontFamily = '"MS Sans Serif", sans-serif';
    yesButton.style.minWidth = '75px';
    yesButton.addEventListener('click', function() {
        // Play Windows 95 shutdown sound and video
        playShutdownVideo();
    });
    buttons.appendChild(yesButton);

    // No button
    const noButton = document.createElement('button');
    noButton.className = 'win95-button';
    noButton.textContent = 'No';
    noButton.style.padding = '4px 10px';
    noButton.style.backgroundColor = '#c0c0c0';
    noButton.style.border = 'outset 2px #dfdfdf';
    noButton.style.fontFamily = '"MS Sans Serif", sans-serif';
    noButton.style.minWidth = '75px';
    noButton.addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    buttons.appendChild(noButton);

    content.appendChild(buttons);

    // Assemble the dialog
    dialog.appendChild(titleBar);
    dialog.appendChild(content);
    overlay.appendChild(dialog);

    return overlay;
}

// Function to play the Windows 95 shutdown video
function playShutdownVideo() {
    // Hybrid approach: embed the YouTube player in-page for the majority of
    // visitors, but layer a "Watch on YouTube" fallback + close button on top.
    // The embedded player depends on third-party cookies for Google's consent
    // flow, which privacy browsers (Brave, etc.) block -- producing an endless
    // consent.google.com redirect loop. Those visitors can use the fallback,
    // which opens the normal watch page (a top-level, first-party context that
    // plays everywhere). Everyone else just watches the embed.
    const watchUrl = 'https://www.youtube.com/watch?v=lAkuJXGldrM&autoplay=1';

    // Fullscreen overlay for the video
    const videoOverlay = document.createElement('div');
    videoOverlay.style.position = 'fixed';
    videoOverlay.style.top = '0';
    videoOverlay.style.left = '0';
    videoOverlay.style.width = '100%';
    videoOverlay.style.height = '100%';
    videoOverlay.style.backgroundColor = 'black';
    videoOverlay.style.zIndex = '2000';
    videoOverlay.style.display = 'flex';
    videoOverlay.style.justifyContent = 'center';
    videoOverlay.style.alignItems = 'center';

    // The embedded player (works for most browsers)
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.src = 'https://www.youtube.com/embed/lAkuJXGldrM?autoplay=1&playsinline=1&rel=0';
    iframe.title = 'YouTube video player';
    iframe.frameBorder = '0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    videoOverlay.appendChild(iframe);

    const closeOverlay = function () {
        if (videoOverlay.parentNode) {
            document.body.removeChild(videoOverlay);
        }
        document.removeEventListener('keydown', onKey);
    };

    // Fallback link for visitors whose browser blocks the embed (Brave, etc.)
    const fallback = document.createElement('a');
    fallback.href = watchUrl;
    fallback.target = '_blank';
    fallback.rel = 'noopener';
    fallback.textContent = 'Trouble loading? ▸ Watch on YouTube';
    fallback.style.position = 'fixed';
    fallback.style.bottom = '16px';
    fallback.style.left = '50%';
    fallback.style.transform = 'translateX(-50%)';
    fallback.style.zIndex = '2001';
    fallback.style.color = '#ffffff';
    fallback.style.opacity = '0.8';
    fallback.style.fontFamily = '"MS Sans Serif", Tahoma, sans-serif';
    fallback.style.fontSize = '14px';
    fallback.style.textDecoration = 'underline';
    fallback.addEventListener('click', closeOverlay);
    videoOverlay.appendChild(fallback);

    // Close button so the overlay is never a dead-end
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close video');
    closeBtn.style.position = 'fixed';
    closeBtn.style.top = '12px';
    closeBtn.style.right = '16px';
    closeBtn.style.zIndex = '2001';
    closeBtn.style.background = 'rgba(0,0,0,0.5)';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.border = '1px solid rgba(255,255,255,0.5)';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.padding = '6px 10px';
    closeBtn.addEventListener('click', closeOverlay);
    videoOverlay.appendChild(closeBtn);

    // Escape also dismisses the overlay
    function onKey(e) {
        if (e.key === 'Escape') {
            closeOverlay();
        }
    }
    document.addEventListener('keydown', onKey);

    document.body.appendChild(videoOverlay);
}
