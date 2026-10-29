// Source Code: a mock installation wizard that ends at my GitHub profile

// Each step shows for its delay (in ms) before the next one
const installationSteps = [
    { text: "Checking system requirements...", delay: 1000 },
    { text: "Searching for existing GitHub installations...", delay: 1500 },
    { text: "Initializing connection protocols...", delay: 1200 },
    { text: "Configuring repository access...", delay: 1300 },
    { text: "Optimizing connection settings...", delay: 900 },
    { text: "Installing Octocat drivers (1/3)...", delay: 1100 },
    { text: "Installing Octocat drivers (2/3)...", delay: 1400 },
    { text: "Installing Octocat drivers (3/3)...", delay: 1000 },
    { text: "Configuring SSH keys...", delay: 1200 },
    { text: "Testing connection speed...", delay: 1300 },
    { text: "Finalizing installation...", delay: 1000 },
    { text: "Installation complete!", delay: 500 }
];

let currentStep = 0;
// The next step's timer, so closing the wizard stops it
let installationTimer = null;

function openGitHubInstallerWindow() {
    const installerWindow = document.getElementById('githubInstallerWindow');

    // Re-opening an open window just brings it forward
    if (!WindowManager.open(installerWindow)) {
        startInstallation();
    }
}

function closeGitHubInstallerWindow() {
    clearTimeout(installationTimer);
    WindowManager.close(document.getElementById('githubInstallerWindow'));
}

// The installer's Next button: the GitHub profile, in a new tab
function openGitHubPage() {
    const githubUrl = 'https://github.com/iiSmitty';
    window.open(githubUrl, '_blank');
    closeGitHubInstallerWindow();
}

// Starts the installation over from the first step
function startInstallation() {
    clearTimeout(installationTimer);
    currentStep = 0;
    const progressBar = document.getElementById('progressBar');
    const installationLog = document.getElementById('installationLog');
    const nextBtn = document.getElementById('nextBtn');

    progressBar.style.width = '0%';
    nextBtn.disabled = true;
    installationLog.innerHTML = '<div>Starting installation process...</div>';

    processNextStep();
}

function processNextStep() {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const nextBtn = document.getElementById('nextBtn');

    if (currentStep < installationSteps.length) {
        const step = installationSteps[currentStep];

        statusText.textContent = step.text;
        addLogEntry(step.text);

        const progress = ((currentStep + 1) / installationSteps.length) * 100;
        progressBar.style.width = `${progress}%`;

        installationTimer = setTimeout(processNextStep, step.delay);

        currentStep++;

        // The last step enables Next straight away, without waiting out its delay
        if (currentStep === installationSteps.length) {
            nextBtn.disabled = false;
            addLogEntry("Ready to connect to GitHub repositories!", "completed");
        }
    }
}

function addLogEntry(text, className = '') {
    const installationLog = document.getElementById('installationLog');
    const entry = document.createElement('div');
    entry.textContent = text;
    if (className) {
        entry.className = className;
    }
    installationLog.appendChild(entry);
    installationLog.scrollTop = installationLog.scrollHeight;
}

document.addEventListener('DOMContentLoaded', function() {
    WindowManager.register(document.getElementById('githubInstallerWindow'));
});
