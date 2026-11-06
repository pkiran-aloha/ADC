# Handoff: current state and planned work

**Read this first, every session.** It is the only place that says where the project actually is. Update it during a pass, not only at the end, and never let it claim something git does not show.

| | |
|---|---|
| **Working repo** | <https://github.com/pkiran-aloha/ADC> (`origin`) |
| **Organization repo** | <https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics> (`ghe`), synced after bigger waves |
| **Live demo** | <https://pkiran-aloha.github.io/ADC/> |
| **Rules** | [`AGENTS.md`](../AGENTS.md) |
| **Last updated** | 6 November 2026 |

## Where the project is

The Welina Analytics Module is a **fictional** ABA analytics workspace: six workflow screens (Progress overview, Target analysis, Programs, ABC observations, Service and data quality, Reports) over one deterministic shared clinical fixture, with a parallel ASP.NET Core 8 API that the frontend does not call.

As of the last update:

- `origin/main` is at `f6b22b8` ("Merge pull request from origin/docs/agent-handoff"), which carries the agent rules and the handoff document on top of the guided target-analysis redesign (PR #27), the resilient sharded Pages deployment (PR #26), and the target-analysis navigation and chart-workspace work (PR #21 to #25).
- On `origin/main` the frontend suite is **151 node:test cases**. With the Program Management merge (6 November 2026) it is **247 node:test cases across 14 suites**, a server-render smoke matrix, and **172 Playwright + axe scenarios** (86 each on desktop and mobile; two shards in CI).
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
- **ABC entry is only a minimal form inside a lesson note** (on the branch). The ABC tab edits the vocabulary and a lesson note can record one observation, but there is no standalone entry form and no way to edit or delete an existing episode. Whether to build one is still an open decision.
- **The .NET API is not exercised by the frontend.** Its controllers and services are a parallel implementation with no integration or contract tests, so the two can drift.
- **The API is not built locally.** The SDK is absent in this workspace; it is verified by CI only.
- **Observations are all Primary in the fixture.** IOA and supervision exist as session-level checks, not as separate chart rows.
- **Fixture scale is fixed** at five clients, 26 weeks and 3,676 observations. The UI is not stress-tested at production volumes.
- **Print and PDF depend on the browser.** The report is print-ready HTML; server-side PDF generation is not implemented.
- **No service worker or offline cache**, and no internationalization or time-zone configuration.

## Next, in order

1. **Land the Program Management branch.** It is complete and green but not merged: merging to `main` publishes the demo to GitHub Pages, so it needs the maintainer's go-ahead and a review of the decisions listed under "Work started".
2. **Manual accessibility pass**: a screen-reader run over the five workflows and the generated report, with the findings written into `UX_AUDIT.md`. This needs a human with a screen reader; automation cannot stand in for it.
3. **Contract tests for the API** if the API is meant to stay a real implementation rather than a reference model.
4. **Look at the audit backlog** in `UX_AUDIT.md` and `ANALYTICS_LANDING_FINDINGS.md` 8.4 for anything still open.

The GHE sync is done (4 November 2026), so it is no longer on this list. `UX_AUDIT.md` was re-read on 4 November 2026 and has no open remediation rows left; everything in it is marked fixed.

## Program Management

The authoring counterpart to the analytics, **implemented on branch `feat/program-management-spec` and not yet merged into `main`**. A new **Programs** workspace defines programs, behaviors, targets, lessons, lesson notes and the ABC vocabulary; everything is saved in the browser, shows up in the analytics with no reload, and is described in `docs/wiki/Home.md` section 5.6.

| Artifact | Where |
|---|---|
| The spec | `docs/specs/program-management.md` |
| Published issue | [GHE issue #1](https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics/issues/1) |
| The tickets | GHE issues #2 to #15, each commented with what was built and how it was verified |
| The language | `GLOSSARY.md` |
| The decisions | `docs/adr/0001` to `0005` |
| The source document | `Program Management.docx` at the repository root (untracked; add it or keep it out of git deliberately) |

What each ticket became on the branch:

| Issue | Ticket | Commit |
|---|---|---|
| #2 | Write the missing documentation generator | `6a29bdd` |
| #3 | The Programs workflow and the skill acquisition listing | `be5ba8c` |
| #4 | Create a skill acquisition program | `78eeef1` |
| #5 | Edit, duplicate and archive a program | `164ed05` (the listing status control it required arrived in `5598ea7`) |
| #6, #7 | Define a target; manage targets and complete the program view | `951e2e0` |
| #8 | Phase and status changes with the phase change line prompt | `5598ea7` |
| #9 | Behavior reduction | `5c6d54b` |
| #10 | ABC configuration | `f096fbb` |
| #11 | Lessons | `0e87293` |
| #12 | Lesson notes and the capture path | `5caed91` |
| #13 | Analytics integration | `f0a8be5` |
| #14 | Search and filtering | `0eb272d` |
| #15 | Learning materials | the last commit on the branch |

Things a later change must not get wrong: a behavior is a program with one target and carries an operational definition; archiving removes a program from today's surfaces and keeps its history and data; everything persists in the browser and nothing transmits; a lesson note is not a service session; Cancel on the phase-line prompt changes nothing; and a blank is never a zero.

**Decisions made while building, for the maintainer to review:**

- Lesson notes: Draft and Unapproved are both editable; only Approved is locked (the spec's wording said "only while Unapproved"). Signatures are a list, one per signer, rather than the single object ADR 0004 sketched, and record the demo date, not a wall-clock time.
- Learning materials accept **text files only** (.txt, .md, .csv; 5 per program, 200 KB each, 1 MB total). The platform spec allows PDF, DOCX and MP4 up to 100 MB, which a browser-local demo cannot honestly hold, so those are refused with the reason.
- A manual-mastery decision is authoritative where one is recorded; with none recorded, a mastered phase counts. The fixture records none.
- Behaviors that predate the behavior-phase field read their phase from their target.

**Known limits, none hidden:** the weekly map, success feed and health matrix read target phases, not the manual-decision field. There is no Organization or Public scope, no per-user audit (the activity log says what changed, not who), no drag-and-drop reordering, no task-analysis target type and no signature location capture. ABC entry is the minimal lesson-note form described above.

## Work started (not yet landed)

UI audit pass (6 November 2026, from `/impeccable audit`, 15 of 20): side-stripe borders replaced with full borders and tints, the 11px text floor raised to 12px, the one `width` transition removed, and CSS `#fff` and translucent whites moved onto `--surface` and `--on-accent` tokens. Dark mode is the next pass (`feat/dark-mode`). The docs test and `docs:check` now ignore CRLF, which a Windows checkout adds to the generated module.

Nothing else is pending. The Program Management branch (`feat/program-management-spec`) was merged into `main` with `--no-ff` after the gate passed (247 of 247 node tests, oxlint with no warnings, docs check, smoke, build, 172 of 172 Playwright scenarios), and `main` was then synced to GHE with the `-s ours` route in `Claude outputs/SYNC_ADC_TO_GHE.md` on 6 November 2026.

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
