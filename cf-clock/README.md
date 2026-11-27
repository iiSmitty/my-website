# cf-clock: Alfred's clock

Starts the repo's scheduled GitHub workflows on time. GitHub's own cron started them 7 to 10 hours late, so the 04:00 watching run landed around lunchtime and missed the night before. The workflows now have no `schedule`. This Worker wakes at the top of every hour and starts the ones due then, through their `workflow_dispatch` trigger (the same route as the "Run workflow" button). The work itself still runs on GitHub Actions.

- `src/schedule.js`: what runs when. Change a time here; `wrangler.jsonc` stays as it is.
- `src/clock.js`: starts the workflows, retrying when GitHub is busy. No Cloudflare imports.
- `src/worker.js`: the Worker, a `scheduled` handler and nothing else.
- `test/`: `node --test`. Also checks every scheduled workflow exists and accepts `workflow_dispatch`, and that no workflow has a `schedule` of its own.
- `wrangler.jsonc`: one hourly cron trigger, no routes, logs on.
- `../.github/workflows/deploy-clock.yml`: tests, then deploys, on every push to main that touches this folder.

## Schedule

| SAST | Workflow |
| --- | --- |
| 02:00 Mondays | `spotify-data-update.yml` |
| 04:00 | `update-watching.yml` |
| 08:00 | `update-sponsors.yml` |
| 10:00, 14:00, 18:00 | `update-coffee-stats.yml`, with `scheduled=true` so the later two skip once the day's stats are in |
| 19:00 | `quiet-week.yml` |

## Free plan

One of the five cron triggers the Workers Free plan allows an account. 24 invocations a day out of the account's 100,000 requests. Each one makes at most a few calls to GitHub (50 allowed) and uses well under the 10 ms of CPU, since waiting on GitHub doesn't count.

## Set up (once, by the owner)

1. **First deploy.** Push to main, or run "Deploy Clock" from the Actions tab. It uses the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets as the mood Worker, and creates the `andresmit-clock` Worker with its cron trigger.
2. **GitHub token.** GitHub > Settings > Developer settings > Fine-grained personal access tokens > Generate new token:
   - Repository access: Only select repositories > `iiSmitty/my-website`
   - Permissions: Repository > Actions: **Read and write**. Nothing else (Metadata: read-only is added automatically).
   - Expiration: GitHub emails before it expires. When it does, the clock stops starting workflows, so renew it then.
3. **Give it to the Worker.** Cloudflare dashboard > Workers & Pages > `andresmit-clock` > Settings > Variables and Secrets > Add > Type **Secret**, name `GITHUB_TOKEN`, value the token. Or, from this folder: `npx wrangler@4.150.0 secret put GITHUB_TOKEN`. Deploys keep it.

## Checking it

- Workers & Pages > `andresmit-clock` > Settings > Trigger Events shows the cron, and the Logs tab shows each run: `Started update-watching.yml`, or why it couldn't.
- In GitHub, the runs it starts show as `workflow_dispatch` events, by the token's owner.
- A failure throws, so it also shows as an error in the Worker's metrics. A 401 means the token expired or was revoked; a 404, a workflow was renamed (the tests catch that before a deploy); a 422, an input the workflow doesn't declare.

## Running it locally

```bash
npm run test:clock
```

```bash
npx wrangler@4.150.0 dev --test-scheduled
```

Then `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"` runs one tick at the current hour. It really starts workflows if one is due and a `GITHUB_TOKEN` is in `.dev.vars`, so leave that file out unless you mean it.
