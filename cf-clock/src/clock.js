// Starts GitHub workflows through their workflow_dispatch trigger, the same
// route as the "Run workflow" button. No Cloudflare imports, so Node can test it.

import { jobsDue } from './schedule.js';

export const REPOSITORY = 'iiSmitty/my-website';
export const REF = 'main';
export const ATTEMPTS = 3;
export const RETRY_MS = 30_000;

const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A failure worth trying again: GitHub busy or briefly down. A 4xx (a bad or
// expired token, a renamed workflow, an undeclared input) won't fix itself.
function retryable(status) {
  return status === 429 || status >= 500;
}

// Starts one workflow, trying up to ATTEMPTS times. Throws when it couldn't.
export async function dispatch(job, token, { fetch: fetchFn = fetch, sleep = sleepFor } = {}) {
  const url = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${job.workflow}/dispatches`;
  const body = JSON.stringify(job.inputs ? { ref: REF, inputs: job.inputs } : { ref: REF });
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RETRY_MS);
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'content-type': 'application/json',
          // GitHub refuses requests without one
          'user-agent': 'andresmit-clock',
        },
        body,
      });
      if (response.ok) return;
      const detail = (await response.text()).slice(0, 300);
      lastError = new Error(`${job.workflow}: GitHub answered ${response.status} ${detail}`);
      if (!retryable(response.status)) break;
    } catch (error) {
      // Network trouble reaching GitHub
      lastError = new Error(`${job.workflow}: ${error.message}`);
    }
  }
  throw lastError;
}

// Starts every job due at scheduledTime, side by side. Returns the workflows
// started. Throws if any couldn't be, after starting the rest, so the failure
// shows in the Worker's Cron Events and logs.
export async function runDue(scheduledTime, env, deps = {}) {
  const jobs = jobsDue(scheduledTime, deps.schedule);
  if (jobs.length === 0) return [];
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set: add it with `npx wrangler secret put GITHUB_TOKEN` (cf-clock/README.md)');

  const results = await Promise.allSettled(jobs.map((job) => dispatch(job, env.GITHUB_TOKEN, deps)));
  const started = jobs.filter((_, i) => results[i].status === 'fulfilled').map((job) => job.workflow);
  const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);

  if (started.length) console.log(`Started ${started.join(', ')}`);
  if (failures.length) {
    for (const failure of failures) console.error(failure.message);
    throw new AggregateError(failures, `Could not start ${failures.length} of ${jobs.length} workflows`);
  }
  return started;
}
