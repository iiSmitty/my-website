// The "Activate Windows" watermark, shown to Mac users as a joke. Add
// ?showWatermark=true to the URL to see it on any desktop.
document.addEventListener('DOMContentLoaded', function() {
    const isMobile = isTouchDevice();

    // Don't show watermark on mobile devices, or twice when a page is framed
    // inside another (e.g. the Experience desktop window)
    if (isMobile || window.self !== window.top) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forceWatermark = urlParams.get('showWatermark') === 'true';

    if (forceWatermark || navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
        const watermark = document.createElement('div');
        watermark.className = 'activate-watermark';
        watermark.innerHTML = 'Activate Windows<br>Go to Settings to activate Windows.';
        document.body.appendChild(watermark);
    }
});
