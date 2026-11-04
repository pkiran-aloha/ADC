# Handoff: current state and planned work

**Read this first, every session.** It is the only place that says where the project actually is. Update it during a pass, not only at the end, and never let it claim something git does not show.

| | |
|---|---|
| **Working repo** | <https://github.com/pkiran-aloha/ADC> (`origin`) |
| **Organization repo** | <https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics> (`ghe`), synced after bigger waves |
| **Live demo** | <https://pkiran-aloha.github.io/ADC/> |
| **Rules** | [`AGENTS.md`](../AGENTS.md) |
| **Last updated** | 4 November 2026 |

## Where the project is

The Welina Analytics Module is a **fictional** ABA analytics workspace: five workflow screens (Progress overview, Target analysis, ABC observations, Service and data quality, Reports) over one deterministic shared clinical fixture, with a parallel ASP.NET Core 8 API that the frontend does not call.

As of the last update:

- `origin/main` is at `f6b22b8` ("Merge pull request from origin/docs/agent-handoff"), which carries the agent rules and the handoff document on top of the guided target-analysis redesign (PR #27), the resilient sharded Pages deployment (PR #26), and the target-analysis navigation and chart-workspace work (PR #21 to #25).
- The frontend suite is **151 node:test cases** plus a server-render smoke matrix and a Playwright + axe suite (two shards in CI).
- The GHE mirror was synced on 4 November 2026 to `c453ca8`. Its **content tree is byte-identical to `origin/main`**, so the organization repo carries the same code as the working repo. The two differ only in history: GHE keeps the old zip-route "Sync from ADC main" commit `7ef5bd1`, so `ghe/main` is not an ancestor of `origin/main` and a plain `git push ghe main` is rejected. Future syncs should use the "Simpler route" in `Claude outputs/SYNC_ADC_TO_GHE.md` or repeat the `-s ours` merge described there.

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
- **ABC data are read-only in the UI.** The fixture holds 826 records and there is no entry form, so an episode cannot be added or edited. The Program Management spec adds the ABC *configuration* screen (the A/B/C/L value lists) but deliberately does not add an ABC entry form; that remains an open decision.
- **The .NET API is not exercised by the frontend.** Its controllers and services are a parallel implementation with no integration or contract tests, so the two can drift.
- **The API is not built locally.** The SDK is absent in this workspace; it is verified by CI only.
- **Observations are all Primary in the fixture.** IOA and supervision exist as session-level checks, not as separate chart rows.
- **One lint advisory remains**: a `setState`-in-effect warning for per-client graph preferences. It is deliberate synchronization, but a future refactor could derive the value or key the component by client.
- **Fixture scale is fixed** at five clients, 26 weeks and 3,676 observations. The UI is not stress-tested at production volumes.
- **Print and PDF depend on the browser.** The report is print-ready HTML; server-side PDF generation is not implemented.
- **No service worker or offline cache**, and no internationalization or time-zone configuration.

## Next, in order

1. **Review and land the Program Management spec branch**, then start implementation at issue #2 (the documentation generator). See "Program Management" below.
2. **Manual accessibility pass**: a screen-reader run over the five workflows and the generated report, with the findings written into `UX_AUDIT.md`. This needs a human with a screen reader; automation cannot stand in for it.
3. **Contract tests for the API** if the API is meant to stay a real implementation rather than a reference model.
4. **Look at the audit backlog** in `UX_AUDIT.md` and `ANALYTICS_LANDING_FINDINGS.md` 8.4 for anything still open.

The GHE sync is done (4 November 2026), so it is no longer on this list. `UX_AUDIT.md` was re-read on 4 November 2026 and has no open remediation rows left; everything in it is marked fixed.

## Program Management

A new module is specced and ready to be built. It is the authoring counterpart to the analytics: programs, targets and behaviors become editable, lessons group programs for delivery, lesson notes capture session data, and every change shows up in the analytics that already exist.

| Artifact | Where |
|---|---|
| The spec | `docs/specs/program-management.md` |
| Published issue | [GHE issue #1](https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics/issues/1) (`ready-for-agent`) |
| The tickets | GHE issues #2 to #15, one per slice, each labelled `ready-for-agent` and each naming the issues that gate it |
| The language | `GLOSSARY.md` |
| The decisions | `docs/adr/0001` to `0005` |

The tickets, in dependency order:

| Issue | Ticket | Blocked by |
|---|---|---|
| #2 | Write the missing documentation generator | — |
| #3 | The Programs workflow and the skill acquisition listing | #2 |
| #4 | Create a skill acquisition program | #3 |
| #5 | Edit, duplicate and archive a program | #4 |
| #6 | Define a target | #4 |
| #7 | Manage targets and complete the program view | #6 |
| #8 | Phase and status changes with the phase change line prompt | #5, #7 |
| #9 | Behavior reduction | #5 |
| #10 | ABC configuration | #3 |
| #11 | Lessons | #5 |
| #12 | Lesson notes and the capture path | #9, #10, #11 |
| #13 | Analytics integration | #8, #12 |
| #14 | Search and filtering | #9 |
| #15 | Learning materials | #4 |

The source document is `Program Management.docx` at the repository root (untracked; add it or keep it out of git deliberately). It describes the Welina platform's own Program Management module.

Six things a build must not get wrong, all recorded in the ADRs: a behavior is a program with a reduction purpose and carries an operational definition; archiving removes a program from today's surfaces and keeps its history and its data; everything persists in the browser and nothing transmits; a lesson note is not a service session; the phase-change prompt's Cancel aborts the change; and a blank is never a zero.

**The one prerequisite nobody can skip:** `frontend/src/data/docs/wikiPages.js` says it is generated, but no generator exists in this repository. ADR 0005 says write it. Until that lands, a new wiki part has to be hand-patched into a file that says not to hand-edit it.

## Work started (not yet landed)

- **Branch `feat/program-management-spec`** (pushed to `origin`): the Program Management spec, `GLOSSARY.md`, ADRs 0001 to 0005, and the ticket breakdown recorded above. Docs only, no code. Needs review and a merge into `main`.

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
