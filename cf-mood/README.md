# cf-mood: the PC Health API

The shared half of [Cheer up the PC](../docs/proposals/cheer-up-the-pc.md). Visitors cheer up My Computer from the PC Health window on the home page. Each cheer lifts its mood for everyone, and the lift fades with a half-life.

- `src/mood-core.js`: the maths (decay, diminishing gain, per-minute cap, bands, UTC days). No Cloudflare imports.
- `src/worker.js`: the Worker (routing, Origin and body checks, the off switch) and the `PcMood` Durable Object (SQLite storage, daily cap).
- `test/`: `node --test`, with the Durable Object's storage played by an in-memory `node:sqlite` database. Needs Node 22.13 or later.
- `wrangler.jsonc`: the route, the Durable Object and its migration, the vars, logs off.
- `../.github/workflows/deploy-mood.yml`: tests, then deploys, on every push to main that touches this folder.

The contact Worker in `../cf-worker` is separate and is still deployed by hand.

## API

| Request | Answer |
| --- | --- |
| `GET /api/mood` | `{ lift, at, halfLifeHours, today: { pat, coffee, joke, defrag, dust }, total, last: { action, at } }` |
| `POST /api/mood/cheer` with `{"action": "coffee", "first": true}` | The same, plus `accepted`. Over 30 a minute, `accepted` is false and nothing is counted |
| `GET /api/mood/stats` | Anonymous totals per UTC day for the last 30 days: cheers per action, page loads that cheered (`firstCheers`), cheers that found the lift faded below 1 (`coldCheers`), requests |
| `GET /api/mood/health` | `{"ok":true,"enabled":true}`, without touching the Durable Object |

`lift` is already faded to `at`, the server's time. The page fades it further from when the answer arrives, so the two clocks never need to agree.

Past `DAILY_CAP` requests in a UTC day, every call answers `429 {"resting": true, "until": <next 00:00 UTC>}` and the page stops calling until then. With `ENABLED` set to `"false"`, every call but health answers `503` without touching the Durable Object.

POST only accepts an `Origin` of `https://andresmit.co.za` or `https://www.andresmit.co.za`, a body of 64 bytes or less, and one of the five action IDs. Every answer is `Cache-Control: no-store`.

## Privacy

The Worker never reads, stores or logs an IP address or a request header other than `Origin` and `Content-Length`. Request logs are off (`observability.enabled: false`). The Durable Object stores the lift, when it was set, the all-time total, the last action and when, and per-day counts. That's everything; the tests check the column list.

## Set up (once, by the owner)

These live in the Cloudflare dashboard or GitHub, not in this repo.

1. **API token.** Cloudflare dashboard > My Profile > API Tokens > Create Token > "Edit Cloudflare Workers" template. Limit it to this account and to the `andresmit.co.za` zone. No other permissions.
2. **GitHub secrets.** In the repo's Settings > Secrets and variables > Actions, add `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (from the dashboard's Workers overview).
3. **First deploy.** Merge to main, or run "Deploy Mood" from the Actions tab. This creates the `andresmit-mood` Worker, its Durable Object and the route.
4. **Fail open.** Workers & Pages > `andresmit-mood` > Settings > Domains & Routes > the `andresmit.co.za/api/mood*` route > Request limit failure mode: **Fail open (proceed)**. If the account ever runs out of free Worker requests, `/api/mood` then falls through to Pages, which answers 404, and the window shows its offline state, rather than the request failing with Error 1027. Check it's still set after a deploy.
5. **WAF rate-limit rule** (the free plan allows one). Security > Security rules > Create rule > Rate limiting rule:
   - Name: `api rate limit`
   - If incoming requests match: URI Path starts with `/api/`
   - With the same characteristics: IP (the only option on Free)
   - When rate exceeds: 10 requests per 10 seconds
   - Then: Block, for 10 seconds (the only duration on Free)

   It covers the contact API too. It slows a flood from one address. Nothing in the Worker can protect the free quota: a request counts as soon as the Worker runs, whatever it answers, so `DAILY_CAP` only spares the Durable Object. Only rules like this one and the next, which block a request before the Worker, save Worker requests.
6. **WAF custom rule** (blocks before the Worker, so blocked requests cost nothing). Security > Security rules > Create rule > Custom rule:
   - Name: `api mood: block foreign callers`
   - Expression (Edit expression):

     ```
     (starts_with(http.request.uri.path, "/api/mood") and any(http.request.headers["sec-fetch-site"][*] == "cross-site"))
     or
     (http.request.method eq "POST" and http.request.uri.path eq "/api/mood/cheer" and not any(http.request.headers["origin"][*] in {"https://andresmit.co.za" "https://www.andresmit.co.za"}))
     ```

   - Then: Block

   The first half stops other sites from making their visitors' browsers call the API (an `<img>` pointing at `/api/mood`, say), which would spread a flood over many addresses and past the rate limit. The second stops cheers without the site's Origin, such as a plain `curl` loop, before they cost a Worker request. Both headers can be forged by a determined script, so it's a speed bump, not a wall. Check it with:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST -d '{"action":"pat"}' https://andresmit.co.za/api/mood/cheer
   ```

   It should answer `403` with Cloudflare's block page, not the Worker's `{"error":"forbidden"}`.
7. **Uptime.** (Phase 3) An UptimeRobot keyword monitor on `https://andresmit.co.za/api/mood/health` for `"ok":true`.

## Turning it on, and off again

The page only calls the API when `data/features.json` says `"pcHealthShared": true`. It ships `false`.

1. After the first deploy, check the API from a terminal:

   ```bash
   curl -s https://andresmit.co.za/api/mood/health
   ```

   ```bash
   curl -s https://andresmit.co.za/api/mood
   ```

   ```bash
   curl -s -X POST -H 'Origin: https://andresmit.co.za' -d '{"action":"pat"}' https://andresmit.co.za/api/mood/cheer
   ```

2. Set `"pcHealthShared": true` in `data/features.json` and push.

To switch the shared part off, in order of reach:

1. `data/features.json`: `"pcHealthShared": false`. The window keeps working, locally, and makes no API calls.
2. `wrangler.jsonc`: `"ENABLED": "false"`. The Worker answers 503 before touching the Durable Object.
3. Remove the route in the dashboard (or from `wrangler.jsonc`). `/api/mood` then falls through to Pages and answers 404.

## Tuning

`HALF_LIFE_HOURS`, `GAIN`, `DAILY_CAP` and `CHEERS_PER_MINUTE` are vars in `wrangler.jsonc`. Change one and push; the deploy picks it up. `CHEERS_PER_MINUTE` can't go above 30: each cheer writes two rows, and more than 30 a minute all day could use up the free plan's 100,000 Durable Object rows written a day. `/api/mood/stats` shows how often a cheer finds the lift faded (`coldCheers`), which says whether the half-life is too short.

## Running it locally

```bash
npm run test:mood
```

```bash
npx wrangler@4.150.0 dev
```

`wrangler dev` serves it at http://localhost:8787 (for example `/api/mood`), with a local Durable Object.
