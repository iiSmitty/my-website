# Proposal: Cheer up the PC

Status: Phase 2 live (shared cheers on since 2 November 2026), Phase 3 done
Owner: Andre Smit

## Summary

My Computer is having a long day. Visitors open a small PC Health window and cheer it up with preset actions: a pat, a coffee, a joke, a defrag, a dusted fan. Its mood is a blend of two things: how my own week is going, read from the data the site already collects, and a shared lift that every visitor's cheers add to and that slowly fades. Visitors see traces of the people before them ("14 cheers today, last one a coffee 3 hours ago"), never who they were.

It is wholesome by construction. Visitors only ever choose from things I wrote, so there is nothing to deface.

## Problem and goals

The site is a Windows 95 desktop that already rewards exploring, but every feature is one-way: visitors look, nothing they do leaves a mark. The goal is a small, kind interaction that:

1. Lets any visitor (recruiter, peer, friend) do something nice in a few seconds and see that it mattered.
2. Shows that other people were here, honestly, at the site's real traffic (about one visitor at a time).
3. Fits the Win95 world and feels personal to me rather than a generic widget.
4. Runs free forever on Cloudflare's free tier and never breaks the rest of the site.
5. Shows good engineering: tested, configured in the repo, deployed by CI, private by default.

## Non-goals

- Free text, freehand drawing, names, avatars or any visitor-made content.
- Live presence ("3 people online"), cursors or a real-time feed. Deferred until traffic shows it matters.
- Retention mechanics (streaks, notifications, guilt). A good first visit is the goal.
- Accounts, logins or anything that identifies a visitor.
- Moving the existing contact Worker to config-as-code. Worth doing, but as its own change.

## User stories

- As a recruiter skimming the home page, I see a Mood row in System Properties, tap "Check on it", give the PC a coffee and get a smile in under ten seconds.
- As a visitor on a phone, I can do all of the above with touch, without the desktop or taskbar.
- As a lone visitor at 3am, I still see a PC that reflects real life ("had a coffee yesterday", "humming Snotkop") and traces of earlier visitors, not an empty room.
- As a screen reader user, I hear my own action's result straight away and a short summary of what others did, without a stream of announcements.
- As a peer, I can read in Help how it works: a Durable Object, decay maths, no cookies.
- As the owner, I can turn the shared part off with one commit, and nothing on the site breaks when the backend is down or over its limit.

## Decisions made

| Decision | Choice |
| --- | --- |
| Mood source | Blend: my real data sets the baseline, visitor cheers lift it |
| Analytics and privacy | Replace Google Analytics with Cloudflare Web Analytics and add PRIVACY.TXT, as a separate change shipped first |
| Contact API protection | One free WAF rate-limit rule plus a self-imposed daily cap |
| Release | Local reactions and the shared counter ship together, behind a kill switch |
| Character | My Computer's identity, in its own PC Health window. The existing My Computer window stays the hardware list |
| Tray face | Yes, desktop only |
| Deploys | Config in the repo, deployed by a GitHub Action with a scoped Cloudflare API token |

## Options considered

| Option | Verdict | Why |
| --- | --- | --- |
| Local only (mood in localStorage) | Kept as the offline mode | Simple and free, but nothing is shared. It is what the client falls back to anyway |
| My data only (static JSON, no backend) | Kept as the baseline | Never empty and personal, but visitors can't move it |
| Shared state in Workers KV | Rejected | About 1,000 writes a day, about one write a second per key with last write wins, and eventual consistency |
| Shared state in D1 with fetch | Viable, not chosen | Atomic updates work, but per-minute caps need extra tables and there is no path to live updates later |
| One Durable Object with plain fetch | Chosen | Single-threaded, so no lost cheers. In-memory caps, SQLite storage on the free plan, and WebSockets can be added later with no migration |
| Durable Object with WebSockets | Deferred | At about one concurrent visitor a live feed talks to itself. It adds reconnects, bfcache and hibernation handling, and WAF rules can't see socket messages |
| PartyKit, Pusher or Ably | Rejected | A dependency or another account with its own free-tier risk, for about 150 lines of our own code |
| Separate Cloudflare account for the mood | Rejected for now | Fully isolates quota, but means a second account, token and set of limits to watch |

## Recommended approach

### Mood model

The displayed mood is a number from 20 to 100:

```
mood = clamp(baseline + lift(now), 20, 100)
```

**Baseline (client side, from static JSON the Actions already refresh, about 40 to 65):**

- Starts at 40.
- +15 if I bought a coffee in the last two days. This needs a `lastVisitAt` field in `data/coffee-stats.json`. The coffee fetcher sets it when `totalSiteVisits` goes up.
- +10 if I watched an episode in the last seven days (`data/watching.json`, `current.lastWatchedAt`).
- Flavour, not mood: the PC hums my top Spotify track (`data/spotify-data.json`, `topTracks[0]`).
- Strava is retired (its workflow only runs by hand), so it is left out.

**Lift (server side, shared, 0 to 50):**

- Stored as `{lift, at}`. Decay is worked out on read: `lift(now) = lift * 0.5 ^ ((now - at) / halfLife)`. There is no cron, no alarm and no timer, so an idle object costs nothing. The client gets `halfLife` in each snapshot and animates the decay itself.
- Each accepted cheer adds a diminishing amount: `lift += (50 - lift) * 0.08`. Spam has less and less effect, and the worst a bot can do is make the PC happy.
- The half-life (starting at 12 hours) and the gain are Worker vars, so they can be tuned without changing code.

**Bands** (face, word and number are always shown together, never colour alone):

| Range | State | Line |
| --- | --- | --- |
| 20 to 34 | Tired | Running a bit slow today. Could use a hand. |
| 35 to 54 | Okay | Ticking along. |
| 55 to 74 | Content | All drivers loaded. No complaints. |
| 75 to 89 | Happy | Fans spinning, lights blinking. Good day. |
| 90 to 100 | Great day | Best uptime of my life. |

The floor of 20 means the PC is never shown distressed.

### Architecture

```
index.html
  Mood row (System Properties)  --+
  Tray face (desktop only)      --+--> js/pc-health.js (small, always loaded)
                                        reads coffee-stats.json (already loaded on the home page)
                                        and the last-seen lift from localStorage
                                        no Worker request on page load
            "Check on it" / icon / Start menu
                         |
                         v
  js/pc-health-window.js + css/pc-health.css   (lazy, first open only)
    reads data/features.json, watching.json, spotify-data.json (static)
    GET  /api/mood        on open, and when the tab becomes visible (at most once a minute)
    POST /api/mood/cheer  per action
                         |
                         v
  Cloudflare WAF rate-limit rule on /api/*   (slows single-source floods, 10s blocks on Free)
                         |
                         v
  cf-mood/ Worker, route andresmit.co.za/api/mood*
    validates method, Origin, body size, action ID
    /api/mood/health answers without touching the Durable Object
                         |
                         v
  PcMood Durable Object (SQLite, idFromName('pc'))
    state: lift, at, last action and time
    daily aggregate counts per action
    global caps: 30 accepted cheers a minute, a daily request cap
```

**API**

- `GET /api/mood` returns `{lift, at, halfLifeHours, today: {pat, coffee, joke, defrag, dust}, total, last: {action, at}}`.
- `POST /api/mood/cheer` with `{"action": "coffee"}` returns the same snapshot plus `accepted`. Cheers over the per-minute cap are not counted, but they still animate in the browser.
- When the daily cap is reached, every call returns `{resting: true, until}`. The client stores this in localStorage and makes no more calls until `until`.
- Every response carries `Cache-Control: no-store`. POST rejects any Origin that isn't andresmit.co.za or www, and any body over 64 bytes. `workers_dev` is off.

**Storage.** One state row and one aggregates table (day, action, count). No IPs, no identifiers, no locations. Each accepted cheer is one row write, which the per-minute cap keeps well under the free row-write limit.

**Repo layout**

- `cf-mood/wrangler.jsonc`: the route, the Durable Object binding, a `new_sqlite_classes` migration, a pinned `compatibility_date`, `workers_dev: false`, vars (`ENABLED`, `HALF_LIFE_HOURS`, `GAIN`, `DAILY_CAP`), logs off.
- `cf-mood/src/mood-core.js`: pure functions (`decay`, `applyCheer`, `allowCheer`, `bandFor`), no Cloudflare imports.
- `cf-mood/src/worker.js`: request handling and a thin `PcMood` class.
- `cf-mood/test/*.test.js`: `node --test`, with a fake Durable Object `ctx` and storage, the same way the existing worker tests stub `fetch`.
- `.github/workflows/deploy-mood.yml`: runs on pushes to main that touch `cf-mood/**`. It runs the tests, then a pinned `npx wrangler@<version> deploy` with the `CLOUDFLARE_API_TOKEN` (Workers edit only) and `CLOUDFLARE_ACCOUNT_ID` secrets. It shows up in Task Manager as `DEPLOY.EXE`.
- `cf-worker/` (contact) is not touched.

### Frontend

- **Mood row** in `identity-specs`: "Mood: Content, 62%" with a "Check on it" button. This is the way in on phones, because the taskbar and desktop icons are hidden on touch devices.
- **PC Health window** registered through `DESKTOP_PROGRAMS` and `WindowManager`, so it gets a desktop icon, a Start menu entry, a taskbar button and focus handling for free. It loads on first open like Skype and Task Manager.
- **Tray face** next to the clock, desktop only. It shows the mood this visitor last saw (baseline plus the stored lift, decayed locally) and is labelled "Check on the PC". It never pretends to be live.
- **Art**: inline SVG pixel art of a beige CRT with `shape-rendering: crispEdges` and five faces swapped by class. Animations use only transform and opacity, run only while the window is open, and are off under reduced motion.
- **Writing**: all text lives in a table in the client and is rendered with `textContent`. The server only sends action IDs and numbers.
- **Accessibility**:
  - Real buttons, at least 44px tall on coarse pointers, with a single tap to open.
  - The cooldown uses `aria-disabled`, so focus stays put.
  - Esc closes the window and focus returns to whatever opened it.
  - The mood is a `role="meter"` with `aria-valuetext`.
  - One `role="status"` region announces your own action straight away, other visitors' cheers as a short summary ("since you opened: 12 pats, 3 coffees"), and the mood only when it changes band.
- **Failure**: a 3 second timeout. Any error, timeout or Cloudflare error page counts as offline. Reactions still play and the window says "Can't reach the network, but I still felt that." There are never console errors.
- **Kill switch**: `data/features.json` with `{"pcHealthShared": true}`. When false, the window runs local only and makes no API calls. Further back-up switches are the `ENABLED` var (the Worker returns 503 before touching the Durable Object) and removing the route.

### Draft content (edit freely)

**Actions**

| ID | Button | Reaction |
| --- | --- | --- |
| pat | Pat the case | Whirr. That's the spot, just above the floppy drive. |
| coffee | Pour a coffee | Andre's loyalty card says {totalSiteVisits} visits. Mine says one. Thank you. |
| joke | Tell a joke | One line from a pool of about 20, not repeated per browser |
| defrag | Run Defrag | A Win95 progress dialog, then: All my clusters are in a row. I feel organised. |
| dust | Dust the fan | Ahh. I can hear myself think again. It was mostly crumbs. |

**Sample jokes**

- Why did the PC go to the doctor? It had a virus. Turned out to be a screensaver.
- I asked the printer for some space. It said PC LOAD LETTER, which I am choosing to take as a yes.
- There are 10 kinds of computers: the ones that understand binary and the ones that need a pat.
- My clock is stuck in 1995. Honestly, great year.
- I tried to tell a UDP joke, but I'm not sure you got it.

**Other lines**

- Traces: "14 cheers today. Last one: a coffee, 3 hours ago." / "You've cheered me up 3 times."
- Humming: "Humming: Cool Soos Koos Kombuis by Snotkop."
- Resting (daily cap): "I've had a lot of visitors today and I need a rest. Come back tomorrow."
- Kill switch: "Visitor cheers are switched off for now. I still appreciate it."

### Privacy

- The browser stores nothing but the last mood seen, the number of times you have cheered, and the jokes already seen (localStorage, never sent).
- IP addresses are seen only by Cloudflare's WAF, briefly, to stop abuse. The Worker never reads, stores or logs them, and never logs request headers.
- Counts are anonymous and aggregate. Broadcasts and traces carry no location or identity.
- Phase 1 replaces Google Analytics, which sets cookies without consent today, with Cloudflare Web Analytics, which sets none, so no consent banner is needed. It also adds `/privacy`, a page styled as `PRIVACY.TXT` open in Notepad. It is a page rather than a desktop window because windows don't open on touch devices, and it works without JavaScript. The note covers who runs the site and how to reach me, Cloudflare as processor and the transfer outside South Africa (POPIA section 72), the lawful basis (legitimate interest in security: GDPR Article 6(1)(f), POPIA section 11(1)(f)), and visitors' rights, including complaining to the Information Regulator.

### Measuring success (free and private)

- The Durable Object keeps daily cheers per action, and how many page loads cheered at least once (the client sends `first: true` on the first cheer per page load, with no identifier).
- Cloudflare Web Analytics gives page views.
- Target: at least 10% of home page views lead to a cheer within the first month. If it is well under 5%, revisit placement before adding anything.
- Watch how often the lift is near zero, to tune the half-life.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A flood or viral spike uses up the shared 100k Worker requests a day and takes the contact form down until 02:00 SAST | The WAF rule slows single-source floods (it can only block for 10 seconds on Free). No requests on page load, so visitors who never open the window cost nothing. The daily cap (about 40,000) returns "resting" and the client stops calling, which keeps more than half the quota for contact. The mood route fails open. A separate account remains the fallback if this ever happens |
| Free-tier limits differ from what the panel found | Phase 0 is a go/no-go gate: if anything is not free, the feature stops. The caps are vars, so they can follow the real limits |
| Bots pin the mood at "Great day" | Diminishing gain and the per-minute cap. Accepted as harmless |
| A client sends made-up action strings to inject text | Action ID allowlist on the server, and the client renders only its own text with `textContent` |
| A sad PC on a recruiter's first look | Floor at "Tired", a baseline from my real life, gentle wording |
| Decay badly tuned for real traffic | Half-life and gain are vars. The Durable Object measures how long the lift sits near zero |
| Durable Object deleted or renamed by mistake, losing state | Migrations live in the repo and deploys go through CI. Losing the mood is acceptable: it decays anyway |
| Playwright specs hit production | `/api/mood` is stubbed in the shared `tests/fixtures.js` STUBS, and a spec asserts the home page makes no mood request |
| Upkeep for one person | No dependencies, a pinned wrangler and compatibility date, a pure tested core, and an UptimeRobot keyword monitor on `/api/mood/health` |
| Stale jokes | A pool of about 20, with the ones already seen tracked per browser. Adding a line is a one-line change |

## Delivery plan

**Phase 0: verify it is free (go/no-go gate, no code)**

Nothing else starts until this passes. Check against Cloudflare's own docs and the account dashboard:

- Durable Objects are available on the Workers Free plan with SQLite storage, with no payment method or paid plan required.
- Free limits for Workers requests, Durable Object requests, duration (GB-s) and rows written, and that going over a limit fails rather than bills.
- The free WAF rate-limit rule covers `/api/*`, and whether blocked requests count against the Workers quota.
- Cloudflare Web Analytics is free with no cookies.
- A Worker route under the site's domain works alongside Pages for `/api/mood*`, as it already does for `/api/contact`.

Go only if every item is free with no card on file and no way to be billed. If any item fails, stop: the feature does not go ahead in this form. Phase 1 (the privacy fix) is still worth doing on its own, and the fallback is the static "my data only" mood with local reactions, which needs no backend. Record the findings and the decision in this document.

**Phase 0 findings (checked against developers.cloudflare.com on 2 November 2026)**

| Check | Finding | Result |
| --- | --- | --- |
| Durable Objects on Free | Available on Workers Free, SQLite storage only | Pass |
| Over a limit | "Further operations of that type will fail with an error." Daily limits reset at 00:00 UTC. Charges only exist on the Paid plan | Pass |
| Durable Object limits | 100,000 requests a day (WebSocket messages count 20 to 1), 13,000 GB-s a day, 5 million rows read and 100,000 rows written a day, 5 GB storage per account, 1 GB per object | Pass, fits the design |
| Workers limits | 100,000 requests a day for the whole account, 10 ms CPU per request. Over the limit a route returns Error 1027 (fail closed) or skips the Worker (fail open). Static asset requests are free and unlimited | Pass |
| WAF rate limiting on Free | 1 rule, matched on Path, counted per IP, 10 second period, 10 second block | Pass, with a weaker rule than assumed (see below) |
| Blocked requests and the Workers quota | The docs don't say whether a request blocked by the WAF still counts against the Workers quota | Unconfirmed, not a cost risk |
| Web Analytics | Free, "does not collect or use your visitors' personal data", no site limit for proxied sites, automatic or manual snippet | Pass |

What this changes:

- The free WAF rule can only block for 10 seconds at a time, so a determined flood is slowed rather than stopped. The Durable Object's daily cap is the real backstop. Set it to about 40,000 requests a day so the contact form always keeps more than half of the shared Workers quota.
- Set the mood route to fail open. If the account ever hits its daily Workers limit, `/api/mood` falls through to the static site, returns an ordinary 404, and the client shows its offline state.
- Draft WAF rule: path starts with `/api/`, 10 requests per 10 seconds per IP, block for 10 seconds.

Checks only the owner can do in the Cloudflare dashboard (done 2 November 2026):

- [x] The account is on the Workers Free plan, with no Workers Paid subscription. Billing shows Workers Free, Teams Free Base and the Free zone plan, nothing paid.
- [ ] No payment method is on file. **Not met:** a card is on file, most likely for the Teams Free (Zero Trust) plan. Accepted, see below.
- [x] The site is served by Cloudflare Pages on andresmit.co.za (the `my-website` project, built from GitHub), and `andresmit-contact-api` is routed at `andresmit.co.za/api/contact`.
- [x] Security rules shows "Rate limiting rules 0/1" with Create rule available.

The card doesn't make the feature cost money: Workers Free has no overage billing, so a limit that is hit fails rather than bills. Charges would need a paid subscription, which means a deliberate upgrade. The owner chose to keep the card.

The account also runs four other Workers (`andresmit-travel`, `annie`, `annie-pin`, `walk-log-sync`) that share the 100,000 requests a day. Daily usage was 0 at the time of the check, and the mood feature's cap of about 40,000 leaves 60,000 for everything else.

**Decision: go.**

**Phase 1: privacy first (its own PR)**

- Remove Google Analytics from every page and the GA stubs from `tests/fixtures.js`.
- Turn on Cloudflare Web Analytics.
- Add the privacy notice at `/privacy` (`privacy.html`, styled as `PRIVACY.TXT` in Notepad), linked from the home page's "This site" row and from Help > Privacy Notice on every page. Phase 2 adds a section for the mood feature.
- Done in its own PR. Cloudflare Web Analytics uses automatic setup (a dashboard toggle), so nothing for it lives in the repo.

**Phase 2: Cheer up the PC (the smallest useful version)**

- Add `lastVisitAt` to the coffee fetcher, with a test.
- `cf-mood/` Worker and Durable Object, its node tests, the deploy workflow and `wrangler.jsonc`.
- The WAF rule (set in the dashboard, and documented in `cf-mood/README` so it isn't lost).
- `js/pc-health.js` (Mood row and baseline) and the lazy `js/pc-health-window.js`, with five actions, traces, local fallback and `data/features.json`.
- Playwright `pc-health.spec.js`:
  - success, abort and resting responses
  - decay under `page.clock`
  - no mood request on the home page
  - no console errors on failure
  - mobile from the Mood row
  - reduced motion
  - throttled announcements
- A Help entry on how it works. A privacy note line.
- Ship with `pcHealthShared: false`, check it in production, then flip it to true.

**Phase 2 status: live**

In the repo: `lastVisitAt` in the coffee fetcher, `cf-mood/` (Worker, Durable Object, 32 node tests, `wrangler.jsonc`), `.github/workflows/deploy-mood.yml`, the Mood row, the PC Health window and its desktop icon and Start menu entry, `data/features.json` (`false`), `tests/pc-health.spec.js`, a Help topic and a privacy notice section. The Worker was also run in local `workerd` with `wrangler dev`.

Changes from the plan while building it:

- A day's counts are one row with a column per action, rather than a row per action, so an accepted cheer writes two rows (state and day) at most. With the daily cap of 40,000 that's under 100,000 rows written a day, even in a flood.
- Days are UTC, to line up with when Cloudflare's free limits reset.
- `GET /api/mood/stats` was added so the success measures can be read: cheers per action, page loads that cheered, and cheers that found the lift faded below 1 (for tuning the half-life). It's anonymous totals only.
- The per-minute cap is a var too (`CHEERS_PER_MINUTE`).
- Status messages are spoken together with the cheer that caused them, so one never cuts off the other.

Left for the owner, in this order (details in `cf-mood/README.md`):

- [x] Create a Workers-only API token, and add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.
- [x] Merge, so Deploy Mood creates the Worker, the Durable Object and the route. The first deploy was green.
- [x] Set the route to fail open, and add the WAF rate-limit rule (`/api/` paths, 10 requests per 10 seconds per IP, block for 10 seconds).
- [x] Check `/api/mood/health` (`{"ok":true,"enabled":true}`), then set `pcHealthShared` to `true`.

**Phase 3: polish**

- The desktop tray face.
- `DEPLOY.EXE` in Task Manager, and PC Health in Task Manager's Applications tab.
- The rest of the joke pool, and time-of-day flavour (dozing at night in Cape Town).
- An UptimeRobot keyword monitor on `/api/mood/health`.

**Phase 3 status: done**

- [x] The tray face next to the clock. It shows the mood this browser last saw and opens PC Health. The taskbar is desktop only, so phones keep the Mood row.
- [x] `DEPLOY.EXE` in Task Manager. PC Health was already in the Applications tab while open, because that tab lists every window the window manager knows; a test now pins it.
- [x] 20 jokes, not repeated in a browser until all have been heard.
- [x] Time of day in Cape Town: a greeting for morning, afternoon and evening, and from 23:00 to 06:00 the PC dozes (a sleeping face in the window, the Mood row and the tray). A cheer wakes it for 10 minutes. Dozing changes the face and the line, never the mood word or number.
- [x] An UptimeRobot keyword monitor on `/api/mood/health`, looking for `"ok":true`, every 5 minutes ("PC Health API").

**Animation pass: done (3 November 2026)**

- [x] Each cheer reacts its own way, as frame-by-frame scenes on the 32x32 art: a pat gets happy closed eyes, a double wiggle and the heart; a coffee gets a steaming mug, then wide eyes and the jitters; a joke gets laughing bounces and a floating "HA"; Defrag packs coloured clusters on the PC's own screen while the progress bar runs; dusting blows dust out of the vent, then "ah... ah..." and a sneeze.
- [x] Idle life between cheers, in CSS like the blink: the eyes glance left and right, the disk light flickers in bursts (flat out while busy), a faint scanline rolls down the screen, and at Tired it now and then yawns and sags a pixel.
- [x] A change of mood flashes static on the screen before the new face. Not when the window opens, and after a reaction rather than over it.
- [x] Still transform and opacity only for anything that moves, nothing runs while the window is closed, and under reduced motion there are no scenes and no idle movement.

**Later, only if the data says so**

- WebSockets for live updates, on the same Durable Object, if the counts show visitors overlapping.
- Moving the contact Worker into config-as-code, as its own change.

## Open questions

1. Do requests blocked by the WAF still count against the Workers quota? Not in the docs. Check the Worker's request metrics once the rule is live.
2. Where should the Durable Object live: no location hint, or one near South Africa or Europe? About 200ms either way is fine for a cheer.
3. Starting half-life: 12 hours as drafted, or a full day?
4. Does a personal, non-commercial portfolio need to register an information officer with the Information Regulator? I need to check.
5. Should Cloudflare Web Analytics be the automatic Pages injection or a manual beacon in the HTML? Manual keeps it visible in the repo.
6. Final wording of the five actions, the bands and the joke pool.
