// The "Activate Windows" watermark, shown to Mac users as a joke. Add
// ?showWatermark=true to the URL to see it on any desktop.
document.addEventListener('DOMContentLoaded', function() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

    // Don't show watermark on mobile devices, or twice when a page is framed
    // inside another (e.g. the Experience desktop window)
    if (isMobile || window.self !== window.top) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forceWatermark = urlParams.get('showWatermark') === 'true';

    if (forceWatermark || navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        const watermark = document.createElement('div');

        // Placed and styled like the real Windows activation watermark
        watermark.style.position = 'fixed';
        watermark.style.bottom = '10px';
        watermark.style.right = '10px';
        watermark.style.fontFamily = 'Segoe UI, Arial, sans-serif';
        watermark.style.fontSize = '12px';
        watermark.style.color = 'rgba(255, 255, 255, 0.85)';
        watermark.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
        watermark.style.pointerEvents = 'none';
        watermark.style.zIndex = '9999';
        watermark.style.textAlign = 'left';
        watermark.style.lineHeight = '1.2';

        watermark.innerHTML = 'Activate Windows<br>Go to Settings to activate Windows.';

        document.body.appendChild(watermark);

        watermark.style.opacity = '0.9';
    }
});
