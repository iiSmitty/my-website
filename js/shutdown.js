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

    // Create the dialog window
    const dialog = document.createElement('div');
    dialog.className = 'win95-dialog';

    // Create the dialog title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'win95-title-bar';

    // Title text
    const titleText = document.createElement('span');
    titleText.textContent = 'Shut Down Windows';
    titleBar.appendChild(titleText);

    // Close button in title bar
    const closeButton = document.createElement('span');
    closeButton.className = 'shutdown-close';
    closeButton.innerHTML = '&#x2715;'; // X symbol
    closeButton.addEventListener('click', function() {
        document.body.removeChild(overlay);
    });
    titleBar.appendChild(closeButton);

    // Create dialog content
    const content = document.createElement('div');
    content.className = 'win95-dialog-content';

    // Create dialog message
    const message = document.createElement('div');
    message.className = 'shutdown-message';

    const text = document.createElement('p');
    text.textContent = 'Are you sure you want to shut down this website?';
    message.appendChild(text);

    content.appendChild(message);

    // Create buttons container
    const buttons = document.createElement('div');
    buttons.className = 'shutdown-buttons';

    // Yes button
    const yesButton = document.createElement('button');
    yesButton.className = 'win95-button';
    yesButton.textContent = 'Yes';
    yesButton.addEventListener('click', function() {
        // Play Windows 95 shutdown sound and video
        playShutdownVideo();
    });
    buttons.appendChild(yesButton);

    // No button
    const noButton = document.createElement('button');
    noButton.className = 'win95-button';
    noButton.textContent = 'No';
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
    videoOverlay.className = 'shutdown-video';

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
    fallback.className = 'shutdown-video-fallback';
    fallback.textContent = 'Trouble loading? ▸ Watch on YouTube';
    fallback.addEventListener('click', closeOverlay);
    videoOverlay.appendChild(fallback);

    // Close button so the overlay is never a dead-end
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'shutdown-video-close';
    closeBtn.setAttribute('aria-label', 'Close video');
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
