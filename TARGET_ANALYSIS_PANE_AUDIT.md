# Target analysis left-pane audit

> **Current status (22 October 2026):** At the user's request, Target analysis has been restored to the 21 October snapshot at `fe8b9b3` (after PR #16, before the next-day UX refinements). The auto-closing list, separate browse/change-selection disclosures, rail tabs, consolidated Chart settings, program-first target grouping, and expandable chart workspace described below are historical findings or proposals—not the current UI. The current page is again the always-visible three-pane explorer with the original chart toolbar/popovers and context rail. Analytics and data semantics were not changed.

## Scope and verification
Audited main snapshot d051d7a, its first-parent diff, and the history of TrendExplorer. Traced rendering, selection callbacks, pure selection helpers, chart resets, focus management, CSS breakpoints, workflow mounting and existing browser-test expectations. Ran `node --test tests/trendExplorer.test.mjs`: 12/12 passed. This is a source/history audit; no browser session or visual/mobile verification was performed. No application code changed.

## Root cause — confirmed
`frontend/src/components/overview/TrendExplorer.jsx:225-300` wraps all program groups in a native `<details>` with no initial `open` attribute. Every target-row click calls `onSelectTargetItem(entry)`, then explicitly sets `targetListRef.current.open = false` and schedules focus on the summary.

Consequently the chart selection can succeed while the whole navigation disappears. Keyboard Enter/Space follows the same button click path. This is not evidence of corrupt data, a failed request, click bubbling into a parent summary, or a React crash: the close is directly programmed.

### Provenance
- 4a62a7a (Compact target analysis selection controls) put search/category/program controls under Change selection.
- 144de81 (Implement page-estate UX recommendations), merged through PR #18, introduced the Browse targets disclosure, default-closed behavior, explicit auto-close, and summary-focus transfer.
- Latest merge d051d7a (PR #20) did not change TrendExplorer or this handler. Its first-parent diff concerns overview ordering and related UI/tests. The behavior exists in the latest main snapshot but was introduced earlier.

## Related interaction findings

| Priority | Finding | Consequence / recommendation |
| --- | --- | --- |
| High | Target selection closes the entire navigation; program-header selection does not. | Inconsistent behavior for adjacent controls. Selection should update the chart, not navigation expansion. Preserve expansion and row focus for both pointer and keyboard. |
| High | Search/filter controls and their results live under two independent disclosures. | Users can search while results remain hidden, or view filtered results with the active filter hidden. Keep search/category controls next to visible results; show active filters/count and a clear action. |
| High | Existing browser tests require the undesirable behavior. | `frontend/tests/ux.spec.js:74-79` reopens the list as a workaround; the explorer test around lines 1380-1435 asserts initial closure and closure after selection. Change the behavioral contract, not just the implementation. |
| Medium | `premium.css:465` overrides the base list's max-height/overflow, including the small-screen 18rem cap, with unlimited height and visible overflow. | Opening the list can produce a long page above the chart on stacked layouts; closing it causes a large layout change. Restore intentional bounded scrolling and validate small viewports and zoom. Actual scroll movement needs browser verification. |
| Medium | Category control is both a browse filter and a chart-selection command. | Skills/Behaviors call `onSelectCategory` and reset the chart; All changes only the list filter. Make category chips filter-only, with chart changes committed by selecting a program/target. |
| Medium | All target selections call `resetView(false)`, even reselecting the current target. | Clears chart/axis/zoom/overlay and inspection state. Make same-target selection idempotent; preserve presentation preferences where compatible and reset only target-specific state when necessary. |
| Medium | Program headings look like group headers but are selection buttons, not expansion controls. | A click overlays program targets rather than opening a group. If adding per-program folding, use separate labeled expand/collapse and select-program controls. Never overload one click with both actions. |

## Selection semantics to retain
The underlying helpers intentionally isolate one target, switch its measurement type, and align analysis/annotation focus. A program selection restores its target set (with the chart still scoped to one measurement type). Behavior row selection replaces a comparison with that single behavior; comparison checkboxes/presets remain the explicit multi-select route. These are not list-collapse bugs and should not be accidentally rewritten while repairing navigation.

The parent retains workflow panels after first visit, so normal workflow switching is not itself an unconditional remount. Client changes and overview focus requests intentionally change the component key; cross-client or deep-link restoration must be tested separately rather than promised by a local expansion fix.

## Recommended natural interaction contract
1. Desktop: show the target list and search/category controls by default. Keep current selection concise and visible. Selecting a target updates chart/context without closing, scrolling, or stealing focus from the navigation.
2. Preserve search, filter, list scroll, and any user-controlled group expansion while browsing. Keep the active row visually distinct from other plotted rows.
3. Mobile/tablet stacked layout: provide an explicit Show/Hide targets control and bounded list. Do not silently close on selection. If a later dedicated picker is introduced, make its Apply/Done action explicit and restore focus on dismissal.
4. Filtering changes visible results only; target/program selection changes chart scope. Explain the single-target versus whole-program actions in labels.
5. Keep the right-rail tabs and existing selection helpers; no need for a backend/schema change or wholesale rollback.

## Implementation sequence and acceptance tests
### Minimal repair
Remove the imperative auto-close and summary-focus scheduling. Default the list to expanded (or remove its desktop disclosure), retain explicit user collapse, and replace tests that mandate closure. Restore bounded scrolling with responsive sizing.

### Follow-up simplification
Unify search/category/results into one browsing surface, decouple category filtering from chart resets, and avoid resetting an already-selected target. Group folding is optional, not required to fix this regression.

### Browser coverage required before shipping
- Open Target analysis; targets are discoverable immediately on desktop.
- Click two successive targets without reopening anything; chart, context and annotation focus update each time, with list position/filters retained.
- Use Arrow/Home/End, then Enter/Space; selected row remains visible and focused and the next arrow still works.
- Selecting a program keeps navigation stable and restores the intended compatible series.
- Search, clear, no-results reset, hidden filters, and category filtering do not unexpectedly change the chart.
- Multi-behavior comparison remains available and single-behavior selection is clear.
- Explicit collapse/reopen works without lost selection; switching workflows retains state; client changes and overview deep links select the correct client/target.
- Validate mobile, tablet, desktop, keyboard focus, 200% zoom, bounded scrolling and accessibility. Assert chart identity, not just row CSS, to verify end-to-end selection.

## Revised recommendations — user feedback
These requirements supersede the earlier suggestion of browsing all programs' targets together under Skill acquisition. This remains a recommendation update, not an application implementation.

### 1. Program-first navigation for Skill acquisition
- Keep an always-discoverable Program selector at the top of the left pane. Once a program is selected, list **only that program's targets** until the user explicitly chooses another program.
- Apply target search, counts, grouping and empty states within the selected program. Searching must not silently switch programs or expose other programs' targets. Label the field “Search targets in this program”.
- Keep the program selector outside any target-list collapse. Provide a clear choose-program state if no program is selected.
- Switching programs replaces the target list and graph scope together, clears stale target-specific inspection, and resolves selection to valid targets in the new program. Reset program-local search on switch so the new list is not unexpectedly empty.
- Preserve the existing explicit behavior-comparison workflow separately; the program-only restriction is for Skill acquisition.
- Overview deep links must select the target's program first and reveal the requested target, even if another program was previously selected.

### 2. Make the central canvas the dominant workspace
- Audit both the outer page-width constraints and the three-pane grid; widening the chart alone will not help if its parent remains constrained.
- Let Target analysis use the available browser width with modest responsive gutters, without imposing a narrow reading-column limit on the graph workspace.
- Keep the program/target pane compact and resizable or explicitly collapsible. Make the right context rail collapsible into a labeled drawer/panel so it does not permanently consume chart width. Keep context, annotations and definitions accessible.
- Give recovered width to the center (`minmax(0, 1fr)`), not proportional expansion of both sidebars. Provide an explicit “Expand chart” mode that hides side panes while preserving their state and offers an obvious restore action.
- On smaller viewports, stack or use explicit panels rather than squeezing all three columns. Preserve readable labels, touch targets and chart scrolling; avoid horizontal overflow at page level.
- Verify the result at laptop, desktop and wide-monitor sizes, plus 200% zoom. Success means a visibly larger useful plotting area, not merely a wider empty container.

### 3. Group compatible targets and make graph inclusion explicit
- Within the selected skill program, group targets first by measurement type and compatible units/meaning, not just lifecycle stage or a vague “similar” label. Lifecycle can remain a badge or secondary grouping.
- Label groups clearly, for example Trial-by-trial (% correct), Duration, Frequency (count), or Interval (% intervals). Further separate incompatible denominators or measurement definitions where present; sharing a numeric range does not make measures comparable.
- Give each target a labeled plotted/not-plotted checkbox or toggle. Selecting a row sets analysis/annotation focus; toggling its checkbox changes graph inclusion without collapsing the list or unexpectedly isolating that target.
- Provide “Show all” and “Hide all” for each compatible group, with selected/total counts and an indeterminate group state where appropriate. These bulk actions affect only that group within the selected program.
- Use one compatible measurement group per comparison chart. Switching groups changes the chart's measurement context; never overlay incompatible units on one axis. Preserve each group's inclusion choices while switching groups within the current program.
- If all targets are disabled, show “No targets plotted” with a clear restore action rather than silently selecting a target. Handle focus/annotation scope explicitly if its target is no longer plotted.
- Keep aggregate summary lines optional and apply them only to compatible selected series. Retain individual series labels/colors and ensure legend controls and left-pane checkboxes reflect the same inclusion state.
- Existing single-target selection helpers need adapting for this revised distinction between **focus** and **inclusion**. They should not continue hiding peer targets on every row click. An explicit “View only this target” action can retain single-target isolation.

### 4. Replace the crowded graph controls with a clear hierarchy
Organize controls into stable, labeled areas rather than one wrapping ribbon:

| Area | Contents | Visibility |
| --- | --- | --- |
| Scope | Selected program and compatible measurement group | Left pane; concise scope summary above chart, without duplicate selectors |
| Primary chart controls | Date range and Group by | Always visible in a compact, aligned row |
| Chart header | Chart title; Expand chart; a restrained actions menu | Always visible; data entry/export/refresh remain easy to find but do not compete with analysis controls |
| View & display | Plot type, special chart view, measure/unit variant, grid, values, axes, markers and orientation | Labeled settings panel, grouped into sections |
| Analysis & comparison | Average, trend method, analytical overlays and optional compatible-series summary | Separate labeled settings section; show active-setting count/summary when closed |

- Put labels above controls or use consistent field groups; do not interleave unrelated labels, selects, toggles and buttons in a dense line.
- Render only relevant controls for the active measurement and plot. Do not remove capabilities simply to reduce clutter.
- Keep active date range/grouping visible and summarize active overlays/settings so hidden configuration is not misleading.
- Use an intentional responsive grid and logical keyboard order. On narrow screens stack labeled sections; do not shrink touch targets or force a horizontally scrolling toolbar.

### Updated implementation order
1. Establish program-scoped Skill acquisition navigation and persistent browsing; remove forced target-list collapse.
2. Introduce explicit compatible-group inclusion state and separate row focus from plotting; synchronize legend and checkbox state.
3. Rebalance outer layout and side panes to prioritize chart width.
4. Reorganize controls into the hierarchy above, retaining existing functionality and persistence policies.
5. Update browser tests and accessibility coverage together with each behavior change.

### Additional acceptance criteria
- Selecting program A lists no targets from program B; changing program replaces the list, counts, groups and plotted scope consistently.
- Search is program-local; program switching cannot leave stale targets, annotations, hidden search or incompatible graph selections behind.
- Two compatible targets can be enabled together, disabled individually and restored through group actions without collapsing navigation or losing focus.
- Group bulk actions never affect another program; incompatible measures are not combined on a shared axis. All-disabled and no-data states are explicit.
- Row focus, plot inclusion and legend visibility stay synchronized according to their distinct roles; single-target deep links still work.
- Center-canvas expansion and sidebar restoration preserve program, group, target inclusion and chart settings. Validate useful plotting width and no page overflow at responsive breakpoints.
- Every existing graphing capability remains reachable after toolbar reorganization; conditional settings, active summaries, keyboard navigation and screen-reader labels work on desktop and mobile.

## Implementation status
Implemented program-scoped skill browsing with always-visible scope/search controls, persistent target-list expansion, measurement-type groups, individual and indeterminate group inclusion checkboxes, group bulk actions, and an explicit all-disabled restore state. Skill row focus no longer hides peer series or resets chart presentation. Program switches reset local search. Existing behavior-comparison and overview deep-link paths remain separate.

The target workspace now removes outer width caps, prioritizes the central chart, uses bounded list scrolling, exposes a state-preserving expanded-chart mode, and makes context/annotations explicitly revealable below the chart. Date range and aggregation stay primary; view/comparison, trend/average, display, analytical overlays and axes are grouped in chart settings with an active-overlay summary.

Validation: production build, lint, 144 Node tests and all server-render smoke checks pass. Updated the explorer browser regression to cover program scoping, persistent keyboard selection, inclusion/bulk actions, program-local search reset, chart expansion and context restoration. Browser execution remains unverified: the normal browser download was blocked, and an npm-distributed Chromium fallback could not launch because this environment lacks `libnspr4.so`. The full legacy browser suite may need further expectation updates for controls moved into settings and context now being explicitly opened; it was not reported as passing.
