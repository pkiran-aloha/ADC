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

- `origin/main` carries the full Program Management module, the UI audit remediation and the dark theme, and then the Program Management UX pass described below. The frontend suite is **274 node:test cases across 16 suites**, a server-render smoke matrix, and **190 Playwright + axe scenarios** (95 each on desktop and mobile; two shards in CI).
- The GHE mirror is synced by a single tree-only commit (`git commit-tree <origin/main tree> -p ghe/main`), so its history never carries the commits that exist only on `origin`. Follow `Claude outputs/SYNC_ADC_TO_GHE.md`, and only when the maintainer says so.

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
| Program Management | Client, organization and public scopes with Add to organization (clearing learner text) and Add to client; a full-page program form, a unified filter panel, program and behavior pages, hand-set target order, bulk edit, history export, lesson notes that take behaviors | `docs/wiki/Home.md` 5.6, `docs/adr/0006` |
| UI audit and theme | Side-stripe borders and tiny text removed, colours on tokens, a dark theme that follows the system and can be switched | `docs/wiki/Home.md` 2.4 |
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

1. **Manual accessibility pass**: a screen-reader run over the six workflows, the program form and the generated report, with the findings written into `UX_AUDIT.md`. This needs a human with a screen reader; automation cannot stand in for it.
2. **Contract tests for the API** if the API is meant to stay a real implementation rather than a reference model.
3. **Look at the audit backlog** in `UX_AUDIT.md` and `ANALYTICS_LANDING_FINDINGS.md` 8.4 for anything still open.
4. **Decide the Program Management items that were left out** (below): task analysis, geotagged signatures and a mobile sync need a product decision, not just code.

`UX_AUDIT.md` was re-read on 4 November 2026 and has no open remediation rows left; everything in it is marked fixed.

## Program Management

The authoring counterpart to the analytics. A **Programs** workspace defines programs, behaviors, targets, lessons, lesson notes and the ABC vocabulary; everything is saved in the browser, shows up in the analytics with no reload, and is described in `docs/wiki/Home.md` section 5.6.

| Artifact | Where |
|---|---|
| The spec | `docs/specs/program-management.md` |
| Published issue | [GHE issue #1](https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics/issues/1), tickets #2 to #15 |
| The language | `GLOSSARY.md` |
| The decisions | `docs/adr/0001` to `0006` |
| The source document | `Program Management.docx` at the repository root (untracked; add it or keep it out of git deliberately) |

**First pass (landed 6 November 2026):** the module end to end, in 14 tickets, but with a thin interface: a drawer form, a flat listing, and the organization and public scopes left out.

**Second pass, the UX pass (6 November 2026):** the module was rebuilt against the source document. What changed:

- **Scopes.** Client, Organization and Public (ADR 0006). Add to organization copies and clears the learner's text (teaching instructions, objective, baseline, target instructions) after a warning, and writes the clearing to the copy's history. Add to client copies into each chosen client. The organization library lives in its own collection (`welina_org_programs`) so the analytics never read it. The public library is a fixed, fictional set in `frontend/src/data/publicLibrary.js`.
- **Screens.** A full-page program form with a section list that marks what is missing and a Save that waits for every required field (the behavior form is two steps). A listing with a scope switch, search, a unified filter panel with counts, an archived list, and bulk actions per scope. A program page with Targets, Program details and History tabs, target cards that say what mastery means, drag and arrow reordering with a reset, bulk edit, and CSV export of the history. A behavior page with the definition, a phase control and a recent measurement that keeps a blank apart from a zero. The ABC tab and the lesson notes share the design.
- **Logic fixes.** A plain edit can no longer change a status or behavior phase (it skipped the cascade, the dated history and the phase-line question); a status or phase changed in the edit form is one action, and Cancel on the question saves nothing. A target edited to a new phase now actually changes phase, through the same question. Duplicates keep the mastery rule. Lesson notes take behaviors and chosen targets, record the time an ABC observation happened, and can remove one while editable. Behavior treatment area and objective are required, as in the source document. Seeded behaviors now carry an operational definition and a real objective (fixture regenerated, so browsers reseed).
- **Bugs found by the new scenarios and fixed:** a program page cached its targets against an object the store changes in place, so adding, deleting or reordering a target did not show until a reload; and an error message appearing on blur moved the control the user was pressing, so the click was lost (errors now have reserved space).

**Decisions made while building, for the maintainer to review:**

- Lesson notes: Draft and Unapproved are both editable; only Approved is locked. Signatures are a list, one per signer, and record the demo date, not a wall-clock time.
- Learning materials accept **text files only** (.txt, .md, .csv; 5 per program, 200 KB each, 1 MB total). The platform allows PDF, DOCX and MP4, which a browser-local demo cannot hold, so those are refused with the reason.
- A manual-mastery decision is authoritative where one is recorded; with none recorded, a mastered phase counts.
- A copy starts again (status Pending, targets Pending, no history) and keeps the target definition and mastery rule. A copy into the library drops a recorded mastery decision, because it is about one learner.
- A library program changes status and phase without the phase-line question, because it has no chart.
- A behavior's status is not shown on its form (its phase is the lifecycle the document describes); new behaviors are stored with the status Teaching, as the seeded ones are.
- `PHASE_LABELS.OnHold` is now "On hold" everywhere, where target cards said "Paused" while the program said "On hold".

**Known limits, none hidden:** no per-user audit (the history says what and when, not who), no task-analysis target type, no signature location (a readable address needs an external service), no mobile sync of target order or fluency/rate changes, learning materials are text only, and the public library is a fixed set rather than one a super user manages. The weekly map, success feed and health matrix read target phases, not the manual-decision field. A hand-set target order shows on the program page; the recorder still lists targets in its own order.

## Work started (not yet landed)

Nothing is pending once the Program Management UX pass is merged. Until then it lives on `feat/program-management-ux`: the work is complete, its gate is described in the pass notes above, and it has not been synced to GHE.

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
