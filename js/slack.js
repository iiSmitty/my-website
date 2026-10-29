// Dev Community: an invite to the ZATech Slack

function openSlackInviteWindow() {
    WindowManager.open(document.getElementById('slackWindow'));
}

function closeSlackWindow() {
    WindowManager.close(document.getElementById('slackWindow'));
}

// The Join Community button: ZATech's invite page, in a new tab
function joinSlackCommunity() {
    const slackInviteUrl = 'https://zatech.co.za/';
    window.open(slackInviteUrl, '_blank');
    closeSlackWindow();
}

document.addEventListener('DOMContentLoaded', function() {
    WindowManager.register(document.getElementById('slackWindow'));
});
