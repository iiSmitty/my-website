// Clippy pops up on iPhones and iPads to tease Apple users

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

document.addEventListener('DOMContentLoaded', function() {
    if (isIOS()) {
        setTimeout(showClippy, 3000); // Show Clippy after 3 seconds
    }
});

function showClippy() {
    const clippy = document.createElement('div');
    clippy.className = 'clippy-container';

    // One of these, at random
    const messageOptions = [
        {
            message: "It looks like you're using an Apple device.",
            options: [
                "Get help with switching to Windows 95",
                "Just continue with my inferior device"
            ]
        },
        {
            message: "I see you're browsing with an iOS device.",
            options: [
                "Show me what I'm missing in Windows 95",
                "Continue using this device anyway"
            ]
        },
        {
            message: "It appears you're using an Apple device.",
            options: [
                "Learn about upgrading to Windows 95",
                "Stay with my current device"
            ]
        }
    ];

    const randomOption = messageOptions[Math.floor(Math.random() * messageOptions.length)];

    clippy.innerHTML = `
        <div class="clippy-popup">
            <div class="clippy-content">
                <div class="clippy-message">${randomOption.message}</div>
                <ul class="clippy-options">
                    <li onclick="dismissClippy(true)">
                        <span class="clippy-bullet">●</span>
                        ${randomOption.options[0]}
                    </li>
                    <li onclick="dismissClippy(false)">
                        <span class="clippy-bullet">●</span>
                        ${randomOption.options[1]}
                    </li>
                </ul>
                <button class="clippy-cancel" onclick="dismissClippy(false)">Cancel</button>
            </div>
            <div class="clippy-pointer"></div>
            <div class="clippy-image"></div>
        </div>
    `;

    document.body.appendChild(clippy);
}

function dismissClippy(wasHelpful) {
    const clippy = document.querySelector('.clippy-container');
    if (clippy) {
        // Prevent multiple clicks during animation
        if (clippy.classList.contains('clippy-exit')) {
            return;
        }

        if (wasHelpful) {
            // The "help" option gets a punchline before Clippy leaves
            const message = document.querySelector('.clippy-message');
            const options = document.querySelector('.clippy-options');
            if (message && options) {
                message.textContent = "I'll help you experience the magic of Windows 95! Just kidding, this is just a nostalgic website.";
                options.style.display = 'none';

                setTimeout(() => {
                    clippy.classList.add('clippy-exit');
                    setTimeout(() => {
                        if (clippy.parentNode) {
                            clippy.parentNode.removeChild(clippy);
                        }
                    }, 500);
                }, 3000);
                return;
            }
        }

        // Fade away, then remove
        clippy.classList.add('clippy-exit');
        setTimeout(() => {
            if (clippy.parentNode) {
                clippy.parentNode.removeChild(clippy);
            }
        }, 500);
    }
}