// What I Do: each program, shown the way Win95 showed a file's Properties.
// Which system I work on at Interfront isn't mine to name, so it says so the
// way Windows would. All of this is my own text, so it's set as HTML.
const ACCESS_DENIED = '<span class="access-denied"><span class="access-denied-icon" aria-hidden="true"></span>Access is denied.</span>';
const REDACTED = '<span class="redacted" role="img" aria-label="Access is denied"></span>';

const WHAT_I_DO = {
    integration: {
        name: 'Integration.dll',
        icon: 'IntegrationIcon_32x32',
        type: 'Application extension',
        location: 'C:\\Interfront\\' + REDACTED + '\\',
        modified: 'Jul 2026 &ndash; Present',
        story: `
            <p>I'm an integration developer at Interfront, working in .NET Framework and C# on one of
            South Africa's biggest systems. Which one? ${ACCESS_DENIED}</p>
            <p>My team owns the APIs between the frontend and the database, so when something breaks, we
            usually hear first:</p>
            <ul>
                <li>a date in the wrong format</li>
                <li>a value that won't convert</li>
                <li>a token that expires too early</li>
            </ul>
            <p>The job is to find out whether it's the frontend, the database or us, then fix it.
            Sometimes that takes a SQL query or two to prove which.</p>
            <p>There's always something new: projects and extensions to make it better for everyone who
            uses it.</p>`
    },
    pipeline: {
        name: 'LeadPipeline.exe',
        icon: 'PipelineIcon_32x32',
        type: 'Azure Function App',
        location: 'C:\\Interfront\\Clients\\',
        modified: 'Mar &ndash; Jul 2026',
        story: `
            <p>My first year and a half at Interfront was client work: two websites, one mostly frontend
            and one full stack in C#, then the biggest piece. We moved a client's ad leads off an old
            frontend setup and onto Azure, which is much faster and far easier to maintain.</p>
            <p>A senior colleague designed the architecture; I put the meat on the bones. Leads arrive
            from the website, TikTok, Facebook and WhatsApp, then pass through a chain of small Azure
            Functions joined by queues:</p>
            <ul>
                <li>normalise and validate</li>
                <li>check for duplicates</li>
                <li>route to the right call centre</li>
            </ul>
            <p>Every step records that it's done, so a retry never creates the same lead twice. I built
            the integrations for two of the four destination systems, with their API docs, and wrote the
            onboarding guide and runbooks for the developers taking over.</p>`
    },
    outsystems: {
        name: 'OutSystems.oml',
        icon: 'OutSystemsIcon_32x32',
        type: 'OutSystems module',
        location: 'C:\\Integralis\\Zuzani\\',
        modified: 'Oct 2021 &ndash; Feb 2025',
        story: `
            <p>My first big project, at Integralis: an internal document management system for our sister
            company, <a href="https://www.zuzanigroup.com/" target="_blank" rel="noopener noreferrer">Zuzani</a>.
            For most of it I was the only developer, so I learned OutSystems and built at the same time.
            Low-code isn't traditional coding, and it has limits you have to learn to work around.</p>
            <p>Later I trained a second developer to work on it with me. Along the way I was mentored by
            <a href="https://adplist.org/mentors/daniel-kuhlmann" target="_blank" rel="noopener noreferrer">Daniël Kuhlmann</a>,
            an OutSystems MVP, through ADPList.</p>`
    },
    claude: {
        name: 'Claude.exe',
        icon: 'ClaudeIcon_32x32',
        type: 'Application',
        location: 'C:\\Program Files\\Claude\\',
        modified: 'Every day',
        story: `
            <p>I make a deliberate effort to use Claude well. AI has changed the whole software development
            life cycle, and anyone who refuses to use it is going to miss the bus.</p>
            <p>We have seniors who keep us honest, so we learn from them and don't blindly trust what Claude
            writes. It's a process, and it takes time.</p>`
    }
};

function whatIDoProperties(program) {
    const field = (label, value) => `<div><dt>${label}:</dt><dd>${value}</dd></div>`;
    return `
        <div class="file-props">
            <div class="file-props-header">
                <span class="${program.icon}" aria-hidden="true"></span>
                <b class="file-props-name">${program.name}</b>
            </div>
            <dl class="file-props-fields">
                ${field('Type', program.type)}
                ${field('Location', program.location)}
                ${field('Modified', program.modified)}
            </dl>
            <div class="file-props-story">${program.story}</div>
        </div>`;
}

// Shows a program's Properties, and marks its icon as the chosen one
function showInfo(service, item) {
    const program = WHAT_I_DO[service];
    document.getElementById('infoBox').innerHTML = program
        ? whatIDoProperties(program)
        : 'Click an icon to see what I work on.';

    document.querySelectorAll('.program-item[role="button"]').forEach(other => {
        const chosen = other === item;
        other.classList.toggle('selected', chosen);
        other.setAttribute('aria-pressed', String(chosen));
    });
}

// What I Do's icons are role="button"s, so Enter and Space choose them too
function initializeProgramItems() {
    document.querySelectorAll('.program-item[role="button"]').forEach(item => {
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                item.click();
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeProgramItems);
