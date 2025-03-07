// Detect iOS device
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Show Clippy when the page loads for iOS users
document.addEventListener('DOMContentLoaded', function() {
    if (isIOS()) {
        setTimeout(showClippy, 3000); // Show Clippy after 3 seconds
    }
});

function showClippy() {
    // Create Clippy container
    const clippy = document.createElement('div');
    clippy.className = 'clippy-container';

    // Get random Clippy message
    const messages = [
        "It looks like you're using an Apple device. Would you like help switching to Windows 95?",
        "I see you've chosen the dark side. Let me show you what you're missing in Windows 95!",
        "Apple user detected! Would you like to experience the superior computing experience of Windows 95?",
        "Hi there! I noticed you're on iOS. Windows 95 misses you!",
        "It appears you're using an Apple device. Have you considered upgrading to Windows 95?"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Set Clippy HTML
    clippy.innerHTML = `
        <div class="clippy-popup win95-box">
            <div class="clippy-header">
                <div class="clippy-title">Clippy</div>
                <button class="win95-button win95-close" onclick="dismissClippy()">×</button>
            </div>
            <div class="clippy-content">
                <div class="clippy-image"></div>
                <div class="clippy-message">${randomMessage}</div>
            </div>
            <div class="clippy-buttons">
                <button class="win95-button-large" onclick="dismissClippy()">Yes</button>
                <button class="win95-button-large" onclick="clippyNo()">No</button>
            </div>
        </div>
    `;

    document.body.appendChild(clippy);

    // Play Clippy sound if sound is enabled
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && soundToggle.textContent === '🔊') {
        playClippySound();
    }
}

function dismissClippy() {
    const clippy = document.querySelector('.clippy-container');
    if (clippy) {
        clippy.classList.add('clippy-exit');
        setTimeout(() => {
            clippy.remove();
        }, 500);
    }
}

function clippyNo() {
    const clippyMessage = document.querySelector('.clippy-message');
    if (clippyMessage) {
        clippyMessage.textContent = "I'll ask again later. Enjoy your browsing experience!";

        // Change buttons
        const buttonsContainer = document.querySelector('.clippy-buttons');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = `
                <button class="win95-button-large" onclick="dismissClippy()">OK</button>
            `;
        }
    }
}

function playClippySound() {
    // Create and play the classic Windows sound
    const audio = new Audio('https://www.myinstants.com/media/sounds/ba-ding.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio play failed:', e));
}