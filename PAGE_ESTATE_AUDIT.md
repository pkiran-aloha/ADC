# Page-estate and analytics visibility audit

**Audit date:** 22 October 2026  
**Status:** Findings and recommendations only; no UI changes made.  
**Purpose:** Identify avoidable vertical space and interaction overhead that delays access to useful analytics, then propose a compact, accessible information hierarchy. This supplements—not replaces—the broader usability, accessibility and visual-system work in [`UX_AUDIT.md`](UX_AUDIT.md).

## Executive summary

The largest opportunity is **Target analysis**. Its explorer begins with search, category switching, a program/behavior chooser and a result count before users reach the selected targets and chart. The visual-analysis panel and clinical context then add further stacked content. These controls are useful, but the page makes setup compete with the primary task (reading the graph), especially on laptop-height and mobile viewports.

The recommendation is not to hide essential controls or shrink clinical text. Instead, keep the active selection visible and compact, make secondary selection tools reveal-on-demand, reduce duplicated introductions, and let the chart/insight area claim the first viewport. Apply the same principle selectively to overview, ABC, service-quality and reports: show high-value summary or primary work first, make detail progressive, and avoid collapsing unrelated workflows into one long page.

## Audit method and confidence

Reviewed the React workflow structure and page/component implementations in `App.jsx`, `ClientSpecificSection.jsx`, `TrendExplorer.jsx`, `AnalysisPanel.jsx`, `AbcDataSection.jsx`, `ServiceQualitySection.jsx` and `ReportsSection.jsx`, along with the current UX audit. This is a **source-based visual/structural audit**, not a claim of a fresh browser screenshot or measured pixel benchmark. The reported risks follow directly from the rendered hierarchy; exact viewport fold positions should be verified in implementation at 1440×900, 1280×800, 1024×768, 390×844 and 320px width.

## Findings and recommendations

| Priority | Surface / evidence | Page-estate cost and user impact | Recommended direction |
|---|---|---|---|
| **P0** | **Target analysis — selection before evidence.** `TrendExplorer` stacks search, category segmented control, program select or behavior chooser, and result count in the explorer header. | Repeated setup controls consume the top of the explorer before the target list/chart supports interpretation. On short screens this pushes the graph and its decision-support content below the fold; on narrow screens, controls add a long scroll before analytic content. | Preserve a **single compact selection summary** (e.g. “Skills · Program name · 12 targets”) beside the active target/chart title. Put search, category and program/behavior changes in a clearly named **Change selection** disclosure/drawer. Keep the active target list readily available, with a compact/collapsible explorer pane and a persistent reopen affordance. Do not conceal current scope, selected behavior(s), or a way to change them. Default to chart-focused layout on constrained heights; retain the three-pane desktop layout when width allows. |
| **P0** | **Target analysis — multiple toolbar rows.** The measurement/date/group/chart controls are in `measurement-toolbar`; chart title and average/trend/functions/axis controls follow in `chart-toolbar`. | The graph can be pushed down by two dense control bands, including controls used infrequently and controls conditional on target type. | Use one responsive primary toolbar containing only frequent controls: measurement (when multiple), date range, grouping, chart view. Move advanced chart functions, axis configuration, marker shape and less-used options to one “Chart settings” menu/panel. Keep add-data/annotation actions distinct and permission-aware. On small screens wrap or use an overflow menu; never create horizontal page overflow. Preserve visible labels or accessible names and avoid icon-only mystery controls. |
| **P1** | **Target analysis — narrative duplication.** `SectionHeader` describes the page; the explorer adds a help paragraph; chart caption and analysis heading each explain the same chart/task. | Repeated instructional prose uses scarce initial-viewport height and adds reading burden for returning clinicians. | Keep one concise page-level description, with contextual help available on demand. Replace repeated prose with short, state-specific cues (selected scope, plotted count, data suppression notice). Avoid removing clinical caveats that change interpretation; provide those adjacent to the relevant metric or in accessible help. |
| **P1** | **Target analysis — insights and visual analysis stack.** Trend explorer includes a right clinical-context rail and `AnalysisPanel` has four analysis tabs (comparison, progress/decisions, quality, context). | On narrower screens side-rail content may stack under a tall chart/controls; similar context information can appear in multiple places, creating a long scroll and weakening the graph’s priority. | Keep chart and selected target as the primary column. On desktop use a restrained, independently scrollable context rail only if it does not reduce chart readability. On small widths make context a labeled “Insights” tab/drawer, with the highest-priority current insight summarized above/below the graph. Avoid duplicating the same context in both rail and analysis tabs; retain full data quality and decision details one interaction away. |
| **P1** | **Progress overview — multiple substantial modules.** The workflow contains client KPI strip, portfolio triage, intervention timeline, mastery, and progress heatmap in sequence. | Useful analytics are all available, but the stack can require scrolling through several distinct summaries to reach the desired chart/table. | Add a compact overview navigation/anchor index and prioritize the chosen task; consider a user-controlled order or “At a glance” summary that links to details. Keep the high-signal exception/triage information early. Avoid compressing heatmap cells or chart labels to fit more modules above the fold. |
| **P2** | **ABC observations and service quality — dense analytical pages.** These workflows bring together multiple analyses, lists and quality measures. | Long pages make it harder to return to the relevant subsection and can cause repeated scrolling, even when content itself is useful. | Group content into meaningful, labeled sections with a compact in-page contents/section jump control. Put the most actionable summary first, detail lists after it, and default optional deep-dive panels to collapsed only when their heading, status and expansion state remain discoverable. Do not default-hide safety/reliability warnings. |
| **P2** | **Reports — builder and roster/detail.** Reports combine configuration with large report outputs/tables. | When configuration precedes results, users may scroll past setup repeatedly; wide tabular detail can dominate the viewport. | Keep report parameters in a compact, sticky-within-page or collapsible builder after generation; focus generated output when ready. Keep tables in named, keyboard-scrollable regions, not squeezed to unreadable columns. Provide clear reset/edit actions and preserve settings when revisiting. |
| **P2** | **Shared page headers and action rows.** Workflow panels use section headers with description/help/actions and pages add their own controls. | Header copy, help and actions can create a tall page entry point, particularly when repeated across workflows. | Standardize a compact header pattern: title, one-line purpose, primary action, overflow for secondary actions. Keep help available without permanently occupying a full paragraph. Do not remove page identity or keyboard-accessible landmarks. |

## Target analysis: proposed first-viewport hierarchy

1. **Compact page header:** “Target analysis”, one concise description, and secondary actions in an overflow menu.
2. **Current selection bar:** category, program or selected behavior count, active target, and a clearly labeled Change selection action. The bar should wrap on mobile, not truncate essential scope.
3. **Primary graph controls:** only controls that materially change the displayed data; use concise labels and sensible defaults that preserve the existing analytic behavior.
4. **Graph and its interpretation context:** chart first, with data-quality/suppression information and measurement unit visible. Put the most useful active insight close to the graph without crowding it.
5. **Progressive detail:** advanced graph settings, target explorer, analysis tabs, annotations and extended clinical context remain available without monopolizing the first screen.

The exact placement of the target list is an implementation choice: a desktop collapsible left pane or a “Targets” drawer can work. The key requirement is that the currently plotted graph does not start below a large, always-expanded configuration surface.

## UX and accessibility guardrails (current best practice)

- **Progressive disclosure, not removal:** expose advanced or infrequent choices at the point they are needed, while making their existence and current state clear.
- **Maintain context:** selection changes must never silently alter the chart. Keep scope, active target, measurement, date range and units visible; preserve deep links and browser history behavior.
- **Stable, user-controlled density:** use responsive layouts and optional pane collapse rather than arbitrarily shrinking text, controls or analytic graphics. Keep user choices predictable across workflows.
- **Do not make scroll traps:** independently scrollable panes need visible boundaries, keyboard access, sensible focus behavior and a way to reach content on touch. Avoid nested scrolling where a normal page scroll is sufficient.
- **Accessible controls:** disclosures expose expanded/collapsed state; buttons have meaningful names; focus order follows visual order; keyboard users can open/close selection surfaces and return focus; targets remain comfortably touchable. No hover-only actions.
- **Preserve chart legibility:** labels, date axes, legends, phase markers, uncertainty/context and accessible data equivalents must not be sacrificed to increase the amount “above the fold.”
- **Avoid sticky UI collisions:** if a compact toolbar is sticky, account for browser zoom, keyboard focus, mobile safe areas and anchor offsets; do not cover chart points, headings or focused fields.
- **Respect reduced motion and user settings:** transitions are optional and subtle; density/pane state should not unexpectedly reset on navigation.
- **Measure outcomes:** compare time/scroll to first meaningful chart, first-viewport chart visibility, task completion for switching target/range, error rate, and accessibility checks—not just pixels saved.

## Suggested implementation sequence (for a later phase)

1. Prototype the Target analysis selection summary + on-demand selector, with desktop and mobile variants.
2. Consolidate primary and advanced chart controls without changing defaults or analytic calculations.
3. De-duplicate explanatory copy and determine which insight belongs beside the graph versus in the analysis tabs.
4. Review overview and other long workflows for section navigation and summary/detail ordering.
5. Validate with browser screenshots and manual keyboard/touch checks at the viewport sizes above; run existing lint, unit, smoke, Playwright and axe checks where available.

## Non-goals

This audit does not recommend removing meaningful analytics, suppressing data-quality cautions, shrinking clinical typography below readable sizes, replacing chart details with decorative KPI cards, or introducing a redesign that changes measurement/interpretation. Findings are recommendations; implementation should be reviewed against clinical workflow and tested with representative users before release.
