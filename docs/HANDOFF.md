# Handoff: current state and planned work

**Read this first, every session.** It is the only place that says where the project actually is. Update it during a pass, not only at the end, and never let it claim something git does not show.

| | |
|---|---|
| **Working repo** | <https://github.com/pkiran-aloha/ADC> (`origin`) |
| **Organization repo** | <https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics> (`ghe`), synced after bigger waves |
| **Live demo** | <https://pkiran-aloha.github.io/ADC/> |
| **Rules** | [`AGENTS.md`](../AGENTS.md) |
| **Last updated** | 2 November 2026 |

## Where the project is

The Welina Analytics Module is a **fictional** ABA analytics workspace: five workflow screens (Progress overview, Target analysis, ABC observations, Service and data quality, Reports) over one deterministic shared clinical fixture, with a parallel ASP.NET Core 8 API that the frontend does not call.

As of the last update:

- `origin/main` is at `fffe0e5` ("Merge pull request #28"), which carries the guided target-analysis redesign (PR #27), the resilient sharded Pages deployment (PR #26), and the target-analysis navigation and chart-workspace work (PR #21 to #25).
- The frontend suite is **151 node:test cases** plus a server-render smoke matrix and a Playwright + axe suite (two shards in CI).
- The GHE mirror was last synced from commit `8814e72` (23 October 2026). It is **behind** `origin/main` and needs a sync whenever the maintainer asks for one.

## Shipped

Recorded here so the next agent does not have to read every commit. Each entry links the place the behaviour is described.

| Area | What shipped | Where it is described |
|---|---|---|
| Portfolio triage | KPI strip, clinical attention center, recent successes, KPI cards that filter the target health matrix | `docs/wiki/Home.md` 5.1 |
| Shared scope | One program scope and one time range lifted into `App` and shared by the overview modules | `docs/wiki/Home.md` 5.1 |
| Weekly progress map | Targets by weeks, drilldown into the target's chart with the week and grouping carried over | `docs/wiki/Home.md` 5.1 |
| Target health matrix | Its own overview module with trend, phase, forecast and current-level columns | `docs/wiki/Home.md` 5.1 |
| Intervention timeline | One chronological, date-deduped feed of phase changes, lines, ranges and notes, with drilldown | `docs/wiki/Home.md` 5.1 |
| Module order | User-controlled overview order, migrated from the earlier four-module key | `docs/wiki/Home.md` 5.1, `tests/overviewOrder.test.mjs` |
| Target analysis | Three-pane trend explorer: target explorer, chart workspace, clinical context rail | `docs/wiki/Home.md` 5.2 |
| Guided selection | Choose Programs, Behaviors or ABC Data before targets; capped, keyboard-focusable ABC lists | `docs/wiki/Home.md` 5.2.1 |
| Reports | Builder that collapses after generation, in-page preview with focus transfer, self-contained HTML export | `docs/wiki/Home.md` 7 |
| Page estate | Labeled in-page section navigation, primary action plus overflow menus, condensed context rail | `PAGE_ESTATE_AUDIT.md` |
| CI/CD | Build and browser jobs split so a stalled browser download cannot cost the deployment; browser suite sharded two ways | `.github/workflows/deploy.yml` |

## Direction

Analysis-first, evidence-linked. Every summary surface exists to get the reader to the underlying measurement, and every derived label states the threshold it came from. Clinical honesty is the product constraint: a blank is never a zero, ABC data are descriptive rather than functional, and the analytics are decision support rather than a determination.

Two repositories, one source of truth for development: `origin` (GitHub) is where every pass lands; `ghe` (the organization repo) receives a sync after bigger waves, on the maintainer's word.

## Not done, or only partly done

The honest list. Each line is a real gap, not a placeholder.

- **No manual screen-reader run.** Every Playwright scenario carries an axe WCAG A/AA scan, but no VoiceOver, NVDA or TalkBack pass has been done.
- **No physical-device or non-Chromium check.** Automation is Chromium-only, and the responsive review was emulation at 1440x900 down to 320px.
- **ABC data are read-only in the UI.** The fixture holds 826 records and there is no entry form, so an episode cannot be added or edited.
- **The .NET API is not exercised by the frontend.** Its controllers and services are a parallel implementation with no integration or contract tests, so the two can drift.
- **The API is not built locally.** The SDK is absent in this workspace; it is verified by CI only.
- **Observations are all Primary in the fixture.** IOA and supervision exist as session-level checks, not as separate chart rows.
- **One lint advisory remains**: a `setState`-in-effect warning for per-client graph preferences. It is deliberate synchronization, but a future refactor could derive the value or key the component by client.
- **Fixture scale is fixed** at five clients, 26 weeks and 3,676 observations. The UI is not stress-tested at production volumes.
- **Print and PDF depend on the browser.** The report is print-ready HTML; server-side PDF generation is not implemented.
- **No service worker or offline cache**, and no internationalization or time-zone configuration.

## Next, in order

1. **Sync `ghe` with `origin/main`** when the maintainer asks. Follow `Claude outputs/SYNC_ADC_TO_GHE.md`. The local `origin` remote now points at GitHub and the organization repo is the `ghe` remote, so the old instructions that say "its `origin` remote = GHE" are out of date.
2. **Manual accessibility pass**: a screen-reader run over the five workflows and the generated report, with the findings written into `UX_AUDIT.md`.
3. **A decision on the ABC entry form.** Either keep the honest read-only path with a clear "this demo cannot record ABC" message (current state), or design the entry form and its validation. Do not leave it ambiguous.
4. **Contract tests for the API** if the API is meant to stay a real implementation rather than a reference model.
5. **Look at the audit backlog** in `UX_AUDIT.md` and `ANALYTICS_LANDING_FINDINGS.md` 8.4 for anything still open.

## Work started (not yet landed)

Nothing outstanding. The `docs/agent-handoff` branch (agent rules, this handoff) was verified green locally and landed into `main` on 2 November 2026.

When a pass is half-finished, record it here before ending the session: branch, what is done, what is next. Do not leave a pass unrecorded.

## How a pass ends

1. `git fetch origin && git switch main && git pull --ff-only`.
2. Branch: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
3. Work, with tests and with the docs updated as you go.
4. Verify locally in `frontend`: `npm test`, `npm run lint`, `npm run smoke`, `npm run build`.
5. Merge `origin/main` into the branch, re-verify, then `git switch main && git pull --ff-only && git merge --no-ff <branch> && git push origin main`.
6. CI publishes the demo to GitHub Pages once the merge to `main` succeeds.
7. Update this file so it matches git.

On the maintainer's Windows PC, call npm through node: `node --preserve-symlinks --preserve-symlinks-main C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js <script>`, with `$env:NODE_OPTIONS="--no-experimental-webstorage"` set first.
