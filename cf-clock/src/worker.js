// Alfred's clock. Starts the repo's scheduled GitHub workflows on time.
//
// GitHub's own cron starts them hours late (often eight or more), so the
// workflows have no `schedule` of their own. This Worker wakes at the top of
// every hour (triggers.crons in wrangler.jsonc) and starts the ones due then
// (src/schedule.js) through their workflow_dispatch trigger. The work itself
// still runs on GitHub Actions.
//
// No routes and no workers.dev address: nothing can call it over HTTP.
//
// Secret: GITHUB_TOKEN, a fine-grained token with Actions read and write on
// iiSmitty/my-website and nothing else (README.md).

import { runDue } from './clock.js';

export default {
  async scheduled(controller, env) {
    await runDue(controller.scheduledTime, env);
  },
};
