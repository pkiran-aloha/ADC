# Analytics landing and navigation — research findings

**Artifact type:** product research and incorporation blueprint
**Prepared:** 21 October 2026
**Branch:** `arena/3ff79e7d-adc`
**Inputs:** the live React workspace on this branch, the shared fixture `data/clinicalSeed.json` (revision `3c8b5ee51fb6024c`, snapshot 14 October 2026), and the supplied prototype **"Data Collection Analytics 2.0.html"**
**Method:** code-level click-path tracing, server-rendered DOM/control inventory via the repo's SSR smoke pipeline (`npm run smoke`), and a feasibility probe that recomputes the prototype's KPI model from the real fixture using the platform's **existing** analytics utilities. No browser binary is available in this environment, so rendered structure was verified through `renderToStaticMarkup`, not screenshots.

> [!IMPORTANT]
> This is a **findings document, not a schema change**. Every recommendation below is a new read-only presentation layer over the existing client → program → target → observation structure. Nothing in it renames, moves, or alters programs, targets, lessons, the recorder, or the fixture contract.

---

## 1. Executive summary

1. **The click-depth complaint is real and measurable.** Reaching one behavior target's chart currently takes **6–7 clicks across four selector layers** (workflow → category → popover picker → measurement tab), and a skill target takes **4–7 clicks plus scrolling**, because every target of the same measurement type is overlaid on one chart and must be isolated manually. Target *definitions* sit inside a collapsed `<details>` disclosure further down the same page. The SSR inventory of the default Target analysis screen shows **44 buttons, 8 select boxes, 4 toggle groups and 2 collapsed disclosures** before a reviewer reaches the visual-analysis panel.

2. **The landing page reports volumes, not direction.** "Progress overview" shows four *counts* (programs, mastered targets, observations, ABC records), a program-picker-gated mastery chart, and — below the fold — the weekly progress map. It contains **no improving/stable/declining summary, no attention list, no successes feed, and no client-level timeline**. Of the whole overview, **only the heatmap's 180 cells (for the default client) are a drilldown**; the metric strip, mastery chart and client card are not clickable. A whole-client review therefore requires visiting five separate workflows, each with its own filters and date range.

3. **The Analytics 2.0 prototype's feature set is feasible on the current data and mostly on the current code.** A probe against the real fixture produced prototype-style KPIs for all five clients (e.g., Liam Miller: **63% improving, 31% stable, 6% declining, 6 near mastery, 8 needing review**) using only existing primitives — `therapeuticDirection`, `linearRegression`, `stabilityEnvelope`, `evaluateMastery`, `projectThresholdDate`, `targetMilestones` and `processAggregation`. An intervention timeline merges cleanly from `phaseHistory` + phase lines + phase ranges + graph notes (**82 merged events for Liam**). Two calibration hazards were found and are specified in §7: stale mastered targets must not be trend-classified, and the ±25% stability envelope over-flags "variable" on weekly aggregates.

4. **Recommended response:** evolve the existing **Progress overview** into a directed clinical dashboard (KPI strip → attention center → successes → target health matrix → intervention timeline) where every card/row drills through the *existing* `initialFocus`/`focusRequest` channel, and later reshape Target analysis's selector stack into the prototype's three-pane **trend explorer**. Three phases, each independently shippable, are scoped in §8.

---

## 2. Evidence base

### 2.1 Fixture scale (the information the navigation must carry)

| Client | Programs (skill/behavior) | Targets (skill/behavior) | Trend-classifiable items* |
|---|---|---|---|
| Liam Miller | 9 (6/3) | 19 (16/3) | 17 (+2 insufficient history) |
| Emma Watson | 7 (4/3) | 11 (8/3) | 10 (+1) |
| Noah Davis | 6 (3/3) | 10 (7/3) | 10 |
| Isla Bennett | 8 (5/3) | 14 (11/3) | 13 (+1) |
| Mateo Alvarez | 7 (4/3) | 12 (9/3) | 12 |

Totals: 5 clients · 37 programs (22 skill, 15 behavior) · 66 targets · 3,676 observation rows · 826 ABC entries · 589 appointments · 101 phase lines · 7 phase ranges · 8 graph notes.
Footnote: trend-classifiable means at least four weekly aggregated points in the trailing 90 days; anecdotal targets are excluded.

A reviewer responsible for Liam must navigate **9 programs and 19 targets** through dropdowns that only reveal one program at a time.

### 2.2 Rendered control inventory (SSR, default client Liam Miller)

| Screen | Buttons | Selects | Toggle groups | Collapsed `<details>` | Notes |
|---|---|---|---|---|---|
| Target analysis (default state) | **44** | **8** | 4 (program category, measurement type, chart view, analysis view) | 2 | Program/target definitions are one of the disclosures |
| Weekly progress map | 116 | 0 | 1 | 0 | 15 target rows × 12 weeks = **180 cell buttons**, the only overview drilldown |
| Skill mastery | 3 | 1 | 0 | 0 | Auto-selects the first skill program; no all-programs aggregate, and shows an empty state when a program has no mastery transitions |
| Progress overview (whole panel) | 18 across the shell | 3 (client, access, mastery program) | 6 workflow tabs | 1 | Outline is only `Progress overview → Liam Miller → Skill mastery`; the heatmap mounts lazily below the fold |

Source: `renderToStaticMarkup` of `App`, `ClientSpecificSection`, `ProgressHeatmap` and `OverallMasterySection` with the smoke-test props.

### 2.3 Where drilldowns exist today

| Surface | Drillable? | Destination |
|---|---|---|
| Heatmap cell | Yes — `onOpen({program, target, week})` | `App.openTargetWeek` → `focusRequest` → Target analysis with `initialFocus` (category, program/behavior ids, week, measurement, target) |
| Metric strip (4 counts) | No | — |
| Skill mastery chart/points | No | Only a self-referential "choose a program" empty-state action and an in-page scroll link |
| Client summary card | No | "Change client" focuses the header selector |
| Target analysis chart point | Yes | Observation inspector (month → week → day → session → trials) |
| Analysis panel "analyze target" | Yes, but requires scrolling past the chart | Switches the analyzed target within the panel |

The `focusRequest`/`initialFocus` mechanism is the single, well-built cross-workflow drilldown channel. It already carries category, program id, behavior ids, target type, date range, aggregation, week and target id — the proposal generalizes it, it does not replace it.

### 2.4 Filter fragmentation

Each workflow owns independent scope controls, so an "end-to-end" review re-answers the same questions repeatedly:

- Target analysis: its own date-range select (`3 days` … `2 years`), default `1 month`.
- ABC observations: its own `abc-date-range` select.
- Weekly progress map and Service & data quality: hard-wired to the trailing 12 weeks.
- Skill mastery: all-time, program-scoped.
- No global program-scope or time-range filter exists; the client selector in the header is the only shared scope.

---

## 3. Issue 1 — too many clicks to a program's data and targets

### 3.1 Current task paths (interactions counted, native select open + option counted separately)

| Task | Current path | Clicks | Scrolls |
|---|---|---|---|
| Open one **behavior** target's chart | Target analysis tab → "Behavior reduction" segment → open "Choose behaviors" popover → tick/untick targets → close popover → measurement tab (if offered) | **6–7** | Chart is at top; visual analysis needs a scroll |
| Open one **skill** target's chart | Target analysis tab → open Program select → pick program → measurement tab (multi-type programs) → isolate the target via legend toggles *or* scroll to Visual analysis → "Analyze target" select | **4–7** | Yes, to isolate or analyze a single target |
| Read a target's **definition** (SD, prompt hierarchy, mastery criteria) | Target analysis → category → program → scroll to "Program setup" → expand disclosure | **5** | Yes |
| Compare two programs' progress | Open program A in the select, read, open program B, read — no side-by-side or list view | Repeated 3-click cycle | — |
| See what changed clinically around a regression | Find target → open phase-line/note annotation lists at the bottom of Target analysis; no client-level event list | 4+ | Yes |

### 3.2 Root causes in the code

1. **Selector-first architecture.** `ClientSpecificSection` renders the filter stack *before any data*: category `SegmentedControl` → program `<select>` (or behavior `Popover` of checkboxes) → date range → `ProgramDetails` disclosure → measurement tabs → grouping/plot selects. The chart only appears after this stack.
2. **Programs are revealed one at a time.** The program dropdown carries a one-line progress summary (`programProgressLabel`), which helps, but there is no scannable list or matrix — a reviewer opens programs serially. With 6–9 programs per client this is the dominant cost.
3. **The chart's unit of selection is a program, not a target.** All same-type targets in a program render as overlaid series; isolating one target means legend hide/show toggles or a second select inside the Visual analysis panel (below the chart).
4. **Definitions are treated as secondary.** `ProgramDetails` is a collapsed `<details>` even though discriminative stimuli, prompt hierarchy and mastery criteria are what a reviewer needs to interpret the chart.
5. **No cross-entity entry point.** The overview cannot send a reviewer to a specific program or target except through a heatmap *cell* (which also requires knowing the target's row and the right week).

---

## 4. Issue 2 — analysis mindset lands on volume counts, not trends

A reviewer opening the workspace to answer *"is this learner progressing end-to-end, and what needs me?"* currently gets:

1. A client identity card.
2. A metric strip of **volumes**: program count, mastered count, total observation rows, ABC row count. None of these has a direction, a trend, or a link.
3. A cumulative mastery chart scoped to **one skill program at a time** (it defaults to the first program; there is no all-programs aggregate) and all-time only.
4. After scrolling, the 12-week heatmap — genuinely useful triage, but a dense 15×12 grid that answers "which cells are pale", not "which items are declining, plateauing, variable, stale, or near mastery", and it has no forecast or status text.

What is missing versus an analysis-first landing page, all of which the prototype demonstrates:

- Portfolio direction: how many clinical items are improving, stable, or declining **in therapeutic direction** (for behaviors, down is good).
- A ranked **attention list** with the reason (wrong-direction trend, plateau, variability, no recent data) and one-click drill-in.
- A **successes** feed (recent mastery transitions) to balance risk with progress and feed reporting.
- A **health matrix** comparing every item on one screen: type, trend, status, forecast, current level versus criterion.
- A consolidated **intervention timeline** tying phase changes, program updates and supervisor notes to the movements seen on charts.
- A shared time range and program scope so every landing component answers the same question.

The existing `buildInsights()` engine already produces BACB-referenced clinical prompts (plateau, variability, prompt dependency, behavior increase/decrease, projection), but it only runs **inside Target analysis for one plotted target at a time**. The landing page has no equivalent portfolio-level rollup.

---

## 5. Issue 3 — teardown of the supplied Analytics 2.0 artifact

The prototype is a single self-contained HTML file with hard-coded sample data. Its functional inventory, mapped against today's workspace:

| # | Artifact element | What it does | Already in Welina? |
|---|---|---|---|
| 1 | Breadcrumb (Learners / name / Analytics) | Orientation within client scope | Partially — header client picker, no breadcrumb |
| 2 | Hero filters: learner, program scope, time range (30D/90D/6M/1Y) | One scope for the whole page | No — per-workflow filters (§2.4) |
| 3 | Five KPI cards: Improving %, Stable %, Declining %, Near mastery, Needs review | Portfolio direction with item counts | No — metric strip is volume-only |
| 4 | **Clinical attention center** | Status-pill cards (Declining/Plateau/Variable), delta, sparkline, subtitle; click scrolls to the explorer focused on that item | No — closest is per-target `buildInsights` inside Target analysis |
| 5 | **Recent successes** | Mastery/improvement feed with value | Partially — mastery transition *dates* exist in the mastery chart table and `phaseHistory` |
| 6 | **Trend explorer** | Tabs Behaviors/Programs/Goals/Targets; searchable item list with type + delta; center chart with 30D–ALL range; right "clinical context" insight rail; "Add clinical note" CTA | Partially — Target chart, annotation modals and `buildInsights` exist; the three-pane explorer, search and rail do not |
| 7 | **Intervention timeline** | Vertical feed of program/phase/reinforcement/note events | No — events exist per target (`phaseHistory`, phase lines/ranges, notes) but are never merged client-wide |
| 8 | **Target health matrix** | Table: item, type, trend, status pill, forecast, current-level bar; "open full matrix" | Partially — heatmap is a week-cell grid; no one-row-per-item status/forecast table |
| 9 | Export view, toast feedback | Page-level export and confirmations | Exists per section (`ExportMenu`, `useFeedback`) — reuse, don't rebuild |
| 10 | Responsive collapse (1200px / 800px breakpoints) | Rail wraps, panes stack | Existing responsive conventions cover this; follow the current token system, not the prototype's colors |

**Design principles worth taking:** triage before detail; every summary element is a drilldown; status vocabulary in plain language (Improving/Stable/Declining/Plateau/Variable/Near mastery/Needs review); sparklines for at-a-glance shape; a right rail that explains *why* before the reviewer acts.

**What not to take:** the prototype's teal palette and Inter font (the workspace uses its forest-green/mineral token system with Geist/Outfit per `UX_AUDIT.md`); its hard-coded thresholds and its "up is always good" color assumptions (the prototype itself colors Aggression's decrease green — direction must come from `therapeuticDirection`); its "Goals" taxonomy as a new entity (see §7.4).

---

## 6. Feasibility probe — the prototype's KPIs computed from the real fixture

A standalone Node probe classified every non-anecdotal target using the workspace's own utilities: weekly `processAggregation` over the trailing 90 days → OLS fit (`linearRegression`) on the last 12 weekly points → direction-aware classification via `therapeuticDirection` → variability via `stabilityEnvelope` (±25% around trend) → mastery proximity via `evaluateMastery` streak and `projectThresholdDate` → successes and timeline via `targetMilestones`, phase lines, ranges and notes.

### 6.1 Computed portfolio KPIs (rules in §7)

| Client | Improving | Stable | Declining | Near mastery | Needs review (any flag) | Insufficient history |
|---|---|---|---|---|---|---|
| Liam Miller | 63% (10) | 31% (5) | 6% (1) | **6** | 8 | 2 |
| Emma Watson | 100% (9) | 0 | 0 | **4** | 8 | 1 |
| Noah Davis | 78% (7) | 0 | 22% (2) | **2** | 8 | 0 |
| Isla Bennett | 67% (8) | 17% (2) | 17% (2) | **4** | 8 | 1 |
| Mateo Alvarez | 82% (9) | 9% (1) | 9% (1) | **1** | 11 | 0 |

Sample attention output (Liam, top items): `Label Community Helpers — Acquisition — plateau + high variability`; `Independent Block Play — Acquisition — improving 27% but high variability`; `Label Zoo Animals — Completed — no recent data` (correctly a staleness flag, not a trend failure — see §7.1).

Sample successes feed (Liam, trailing 30 days, from `phaseHistory`): Respond to Hello → Completed (5 Oct) · Share Materials with a Peer → Completed (2 Oct) · Action Naming Fluency → Maintenance (29 Sep) · Expressive Food Items → Generalization (28 Sep) · Turn Taking in Board Games → Maintenance (25 Sep).

Sample intervention timeline (Liam, newest first; 82 merged events in total):

```
2026-10-05  phase        Respond to Hello → Completed
2026-10-05  phase line   Target completed          (automated companion of the above — dedupe pair)
2026-10-02  phase        Share Materials with a Peer → Completed
2026-10-01  phase        Identify Shapes → Baseline
2026-09-30  note         Used familiar picture cards in a different therapy room.
2026-09-29  phase        Action Naming Fluency → Maintenance
```

**Conclusion:** every artifact KPI, card, feed, timeline row and matrix column is derivable from the current fixture and current utils with **zero schema changes**. The work is aggregation and presentation, not data collection.

### 6.2 Reuse map (no new analytics science required)

| Need | Existing primitive to reuse |
|---|---|
| Therapeutic up/down direction (behaviors improve downward) | `therapeuticDirection(target, programCategory)` |
| Trend slope and fit | `linearRegression`, `splitMiddle`, `celeration` |
| Plateau / variability flags | `stabilityEnvelope`; same thresholds already used by `buildInsights` |
| Mastery status and streak | `evaluateMastery`, `evaluateReductionMastery`, `reductionRuleFor` |
| Forecast / sessions-to-criterion | `projectThresholdDate`, `forecastLinear`, existing projection wording |
| Phase/success events | `targetMilestones`, `masteredOn`, `acquisitionRate`, `programProgress` |
| Weekly normalized values across mixed units | `processAggregation` + the heatmap's `ruleThreshold` normalization |
| Insight-rail cards | `buildInsights({...})` output shape (`tone`, `title`, `detail`, `reference`) — lift it to portfolio level |
| Drilldown | `App.focusRequest` → `ClientSpecificSection.initialFocus` (already supports target + week + measurement) |
| Charts and sparklines | Hand-built accessible SVG convention used by `TargetChart` and `OverallMasterySection` (no chart dependency, per `TECH_STACK.md`) |

---

## 7. Calibration rules and edge cases the implementation must honor

The probe surfaced four judgment calls that distinguish a credible clinical dashboard from a decorative one.

1. **Phase-aware suppression.** A target in Maintenance/Generalization/Completed/Discontinued with no recent measurements must be classified as **inactive/stale**, never as "declining". The first probe run naively flagged completed targets (e.g., *Imitate Actions with Objects*, *Sort Puzzle Pieces*) as declining because their last weeks were empty. Rules: trend-classify only targets with ≥4 weekly points in the trailing window; otherwise show "Insufficient history"; mastered items appear in the successes feed and matrix with a mastered pill, not in the declining KPI; `OnHold` items show "Paused".
2. **Direction, not raw sign.** Delta color and improving/declining labels always pass through `therapeuticDirection`. A −24% aggression rate is **improving** (the prototype gets this right); a −24% skill accuracy is declining. Never put raw rates/durations from different measurement types on one axis — use relative change and criterion/baseline-normalized levels, the same normalization the heatmap already uses.
3. **Minimum effect thresholds.** A fitted relative change under 10% across the 12-week window reads as **stable/plateau** rather than trend; plateau only becomes an *attention* flag in Acquisition with ≥6 points (mirroring `buildInsights`, which requires 8+ recent observations before its no-trend prompt). The ±25% stability envelope over-flagged variability in the probe; require the envelope failure **and** a minimum coefficient spread, and label honestly ("variable responding", not "failure"). All thresholds should live in one documented module so a clinical owner can tune them, with the BACB/Lane & Gast references the codebase already cites.
4. **No new "Goal" entity.** The prototype's Behaviors/Programs/Goals/Targets tabs assume a goal object that does not exist in the Welina schema, and the brief forbids altering the target/program/lesson structure. Map the tabs to **derived views of existing entities**: Behaviors = BehaviorReduction targets; Programs = program rollups from `programProgress`; Targets = all targets; "Goals" = each target's `masteryCriteria`/program `programObjective` rendered as an objective-level rollup (a query, not a collection). If a derived Goals view proves confusing, ship three tabs rather than inventing a fourth entity.

Additional rules: keep "measured zero ≠ missing data" semantics (`missingDataMode === 'DataNotTracked'` excluded, as everywhere today); every generated number needs a non-visual equivalent (accessible table or sr-only text) to preserve the axe-clean standard in `UX_AUDIT.md`; projections carry the existing "assumes conditions stay the same; planning, not a promise" caveat.

---

## 8. Incorporation blueprint (additive only)

### 8.1 Target information architecture

**Progress overview (reworked, same workflow id `overview`, same hash deep link):**

1. Hero row: existing client identity + **scope controls** (program scope: all / skill / behavior; range: 30D/90D/6M/1Y/ALL), lifted to `App` state and passed down; default 90D to match the prototype and the probe.
2. **Client KPI strip** — five cards (improving/stable/declining with item counts, near mastery, needs review), each a button that filters the matrix below; replaces nothing in the existing volume strip, which moves beneath as secondary context.
3. **Clinical attention center** — ranked cards with status pill, direction-aware delta, mini sparkline (SVG), reason subtitle; click fires the generalized focus drilldown straight into Target analysis.
4. **Recent successes** — latest mastery transitions with phase and date; "use in report" links into the existing Reports workflow.
5. **Target health matrix** — one row per target: item + program, measurement type, trend delta, phase status pill, forecast (criterion date or "review needed"), current-vs-criterion bar; row click drills down; the existing heatmap remains as the "full matrix" spatial view (the prototype's "Open full matrix" link maps to it).
6. **Intervention timeline** — merged, date-deduped client feed (phase transitions and their automated phase-line companions collapse into one event; graph notes and manual phase lines/ranges stay distinct), each event linking to its target's chart scoped to that date.
7. Retain Skill mastery and the Weekly progress map below the new components; the mastery program picker gains an "all programs" aggregate so the section answers the client-level mastery question instead of defaulting to whichever program sorts first.

**Target analysis (phase 3):** wrap the existing chart/inspector/visual-analysis machinery in the three-pane explorer — searchable entity list (targets grouped by program, showing phase + delta) replacing the category→program→popover stack; center pane unchanged `TargetChart`; right rail lifts `buildInsights` cards plus the existing "add phase line/note" actions and a compact target-definition card (moving `ProgramDetails` content out of the collapsed disclosure). All existing controls (measurement tabs, grouping, plot, functions, axis, annotations) remain available in the center pane's toolbar; nothing is removed, so saved links and habits survive.

### 8.2 Suggested file changes

| File | Change | Schema impact |
|---|---|---|
| `frontend/src/utils/targetHealth.js` | **New** pure module: `classifyTargetTrend`, `portfolioKpis`, `attentionItems`, `recentSuccesses`, `healthMatrixRows`, `clientTimeline`; thresholds as exported constants | None — reads sessions/programs as given |
| `frontend/src/utils/analyticsScope.js` | **New (phase 2)** pure module: `PROGRAM_SCOPES`, `SCOPE_RANGES`, `scopePrograms`, `resolveScopeWindow`, `weekCountFor`, `durationFilterForDate`, `scopeCaption` | None — derived views of the existing program categories |
| `frontend/src/utils/interventionTimeline.js` | **New (phase 2)** pure module: `buildInterventionTimeline`, `collapsePhaseLines`, `dedupeTimeline`, `sortTimelineEvents`, `groupTimelineByMonth` | None — merges phase history, phase lines, ranges and notes |
| `frontend/src/components/overview/OverviewScopeControls.jsx` | **New (phase 2)** program-scope and time-range controls | None |
| `frontend/src/components/overview/ClientKpiStrip.jsx` | **New** five KPI cards, clickable to filter the matrix | None |
| `frontend/src/components/overview/ClinicalAttentionCenter.jsx` | **New** attention cards + SVG sparklines | None |
| `frontend/src/components/overview/RecentSuccesses.jsx` | **New** mastery-transition feed | None |
| `frontend/src/components/overview/TargetHealthMatrix.jsx` | **New** one-row-per-target table with drilldown | None |
| `frontend/src/components/overview/InterventionTimeline.jsx` | **New** merged event feed with date dedupe | None |
| `frontend/src/components/overview/TrendExplorer.jsx` | **New (phase 3)** three-pane shell hosting current `TargetChart` + insight rail | None |
| `frontend/src/App.jsx` | Lift scope/range state; generalize `openTargetWeek` → `openTargetFocus({targetId, programId, week, date})` over the existing `focusRequest` shape; compose new overview components | None |
| `frontend/src/components/ClientSpecificSection.jsx` | Phase 3 only: accept explorer layout; `initialFocus` contract unchanged | None |
| `backend/.../Controllers/TargetHealthController.cs` + `InMemoryAnalyticsService` | **Optional** read-only parity endpoint (`api/target-health?clientId=&range=`) mirroring the util; the SPA stays browser-local regardless | Additive DTO only |
| `tests/targetHealth.test.mjs` | **New** node:test cases — direction flipping for behaviors, stale/mastered suppression, threshold boundaries, dedupe, insufficient-history | — |
| `frontend/tests/ux.spec.js`, `tests/render-smoke.jsx` | Add render/keyboard/axe coverage and smoke cases for each new component | — |
| `docs/wiki/Home.md` §5.1 | Document the reworked overview and status vocabulary | — |

### 8.3 Before/after click budget

| Task | Today | Proposed |
|---|---|---|
| Open a behavior target's chart | 6–7 clicks | **1 click** from attention card or matrix row (2 via explorer: tab + entity) |
| Open a skill target's chart | 4–7 clicks + scroll | **1 click** from matrix/attention; explorer list is searchable |
| Compare all programs' status | Serial dropdown visits | **0 clicks** — matrix and KPI strip on landing |
| Read a target's definition | 5 interactions + scroll + disclosure | **1 click** — definition card in the explorer rail / matrix detail |
| See what changed around a regression | 4+ clicks, per-target annotation lists | **1 click** — intervention timeline event → date-scoped chart |
| Whole-client end-to-end review | 5 workflow switches, 3 different date controls | One landing page; one shared range; drilldowns carry context forward |

### 8.4 Phased rollout

- **Phase 1 — portfolio triage on the overview (IMPLEMENTED, 21 October 2026):** `utils/targetHealth.js` plus `overview/PortfolioTriage.jsx` (KPI strip, attention center with sparklines, recent successes, one-row-per-target health matrix) mounted above the existing mastery chart and progress map. Drilldowns reuse the generalized `App.openTargetFocus`/`focusRequest` channel — Target analysis, its controls and every entity structure are untouched. Coverage: 14 node:test cases in `tests/targetHealth.test.mjs`, an SSR smoke case, a Playwright interaction/axe spec, and wiki §5.1 documentation. One refinement against the §6.1 probe: trend percentages use the **active, classifiable** denominator per §7.1 (mastered/paused/ended targets are excluded and shown with status pills instead), so implemented percentages differ from the exploratory probe, which counted every item.
- **Phase 2 — context and shared scope (IMPLEMENTED, 21 October 2026):** `utils/analyticsScope.js` plus `overview/OverviewScopeControls.jsx` lift one program scope (all / skill / behavior) and one time range (30D / 90D / 6M / 1Y / ALL, default 90D) into `App` state and pass them to the triage (`windowDays`), the mastery chart (range-filtered series), the weekly progress map (column count) and the new `overview/InterventionTimeline.jsx`. `utils/interventionTimeline.js` merges each target's phase history, phase lines, ranges and graph notes into one chronological, date-deduped feed; a phase change absorbs its automated companion line (and any manual line that repeats the same transition on the same date), while intervention lines, ranges and notes stay distinct. Every event drills through `openTargetFocus({ date })` into the target's chart with a date filter wide enough to include it. Skill mastery gains an **All programs** aggregate (the default) and states mastered overall separately from newly mastered in the range. Coverage: 23 additional node:test cases across `tests/analyticsScope.test.mjs` and `tests/interventionTimeline.test.mjs`, five new SSR smoke cases, a Playwright scope/timeline/mastery spec, and wiki §5.1 documentation. No entity, fixture, recorder, or Target-analysis control changed.
- **Phase 3 — trend explorer (IMPLEMENTED, 21 October 2026):** `utils/trendExplorer.js` plus `overview/TrendExplorer.jsx` and the visible rail cards in `ProgramDetails.jsx` reshape **Target analysis** (`ClientSpecificSection.jsx`) into the three-pane explorer without removing any control, hash deep link (`#target-analysis`) or `initialFocus`/`focusRequest` drilldown field. The left pane lists every target grouped by program with search, category scope (`All` / `Skills` / `Behaviors`), keyboard arrow/Home/End navigation, current phase and direction-aware 90-day trend delta from `utils/targetHealth.js` (plus `Program` quick-jump and `Choose behaviors` comparison). The center pane hosts the unchanged `TargetChart`, alternate charts, full toolbar, `ObservationInspector` and four-tab `AnalysisPanel`. The right **Clinical context** rail surfaces `buildInsights` prompt cards, the annotation actions and list (`Phase line`, `Phase range`, `Note`), and visible `Target definition` and program cards with downloadable learning materials and an expandable `Program setup` block. Coverage: 12 node:test cases in `tests/trendExplorer.test.mjs`, new SSR smoke cases for `TrendExplorer` and `initialFocus` drilldown, Playwright/axe coverage, and wiki §5.2 documentation.

Each phase keeps the current fixture, `apiService` entity shapes, .NET entities, recorder and lesson/program/target structuring untouched.

---

## 9. Quality obligations (from the repo's own standards)

- **Accessibility:** semantic tables with captions (as `ProgressHeatmap` does), `aria-pressed` filter cards, keyboard-operable drilldowns with the existing focus-return pattern, visible focus rings, 44px targets, reduced-motion-safe sparklines, sr-only numeric alternatives, color never the sole signal (status pills carry text).
- **Performance:** memoize per-target aggregation with the existing `useDeferredValue` pattern; 66 targets × 3,676 rows is comfortably client-side but the health rollup should be a memoized selector keyed by client/range, not recomputed per card. Reuse lazy `Suspense` boundaries like the current overview.
- **Tests:** pure-util node:test coverage first (deterministic fixture makes exact-value assertions practical), then SSR smoke entries, then Playwright/axe interaction tests; assert the §7 edge cases explicitly (stale mastered target, behavior direction flip, insufficient history).
- **Honesty:** retain the fictional-demo framing; label derived classifications as decision support with documented thresholds; keep projections caveated; no new compliance claims.
- **Visual language:** use current tokens (forest-green accent, mineral neutrals, Geist/Outfit, Phosphor icons) and the existing card/panel classes — the prototype's layout is the inspiration, not its stylesheet.

## 10. Scope and limitations

- Findings are based on static code tracing and server-rendered markup; no live browser pass was possible in this environment (no system Chromium, Playwright CDN outside the network allowlist). Interaction counts were derived from the component state machine and control inventory rather than video observation, and should be confirmed with a moderated click-through once Phase 1 is built.
- The probe's thresholds (10% relative trend boundary, 12-week/90-day window, ≥4 weekly points, 21-day near-mastery horizon) are defensible starting values, not validated clinical cutoffs; they are centralized and tunable by design.
- This document intentionally stops at the blueprint. No application code, fixture, or API contract was changed while producing it; the working tree contains only this report.

## Appendix A — reproducing the evidence

1. Install and render: `cd frontend && npm ci && npm run smoke` — confirms every section SSR-renders and prints per-section markup sizes.
2. Control inventory: SSR-render `App`, `ClientSpecificSection` and `ProgressHeatmap` with the `render-smoke.jsx` props and count `<button>`, `<select>`, `role="group"` and `<details>` elements (values in §2.2).
3. KPI probe rules: for each non-anecdotal target, take trailing-90-day rows → `processAggregation(rows, 'Weekly', …)` → last 12 points → `linearRegression` relative slope vs. mean; `|Δ| < 10%` → stable, else improving/declining via `therapeuticDirection`; `stabilityEnvelope(…, {around:'trend'})` for variability; `evaluateMastery` streak within one session of the rule or `projectThresholdDate` ≤ 21 days → near mastery; phase transitions in the trailing 30 days → successes; merge `phaseHistory`, phase lines, ranges and notes keyed by target → timeline, deduping automated phase-line/phase pairs on the same date and target.
4. Drilldown channel: read `App.openTargetWeek` and `ClientSpecificSection` `initialFocus` consumption — the generalized `openTargetFocus` proposed here reuses this exact state contract.
