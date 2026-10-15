# Welina UX audit and remediation

Audited October 14, 2026 against the supplied `redesign-existing-projects` skill. Scope: the React analytics demo, recording/annotation flows, exports, responsive navigation, and the static GitHub Pages experience. The existing React 19, Vite 8, Tailwind CSS **v4**, shared clinical fixture, and .NET API remain in place.

## Baseline

A Chromium review at 1440 × 1040 and 390 × 844 found a **589px document on a 390px viewport** (199px overflow). An axe WCAG A/AA scan of the default desktop view reported four unnamed selectors and three text-contrast failures. Automated checks do not replace a manual accessibility audit.

## Implementation priorities

1. **Access and correctness:** eliminate horizontal page overflow, unnamed selectors and contrast failures; repair dialog/keyboard behavior, validation, annotation context, missing-versus-zero handling and export failure feedback.
2. **Visual system:** change fonts, reduce the palette, strengthen hierarchy, consolidate summaries and make the mastery view compact; retain a generous, readable target-analysis canvas.
3. **Polish and resilience:** consistent hover/pressed/focus states, real loading/empty/error paths, accessible chart equivalents, honest demo information, branding/static pages and regression coverage.

## Findings and fixes

| Area | Findings | Remediation |
| --- | --- | --- |
| Typography | System-default sans; many 10–12px labels; long, specification-like headings; all-caps subheadings; weak hierarchy; inconsistent chart fonts and numeric alignment. | Self-hosted Geist body and Outfit display type, readable control sizes, medium/semibold hierarchy, sentence-case labels, balanced headings, constrained prose, and tabular numerals. |
| Palette | Saturated blue/purple architecture banner, blue/green/red/amber/purple controls, a dark sidebar inside a light app, cool-gray generic card shadows. | One forest-green interaction accent, a consistent warm mineral neutral family, same-tone navigation, restrained tinted elevation, and a subtle workspace micro-pattern. Multiple muted, labeled chart colors remain where they encode different data series; error/destructive colors remain semantic. |
| Information hierarchy | Implementation badges lead the page instead of the client's progress; duplicate recording CTAs; a tall two-point chart overwhelms the overview; no compact dataset summary. | Task-led overview, explicit fictional-demo context, a single primary recording action, factual client metrics in one shared strip, and a compact mastery summary alongside the chart. |
| Navigation | Cursor-styled divs with no destinations; no usable mobile navigation; no active-section semantics; no collapse control; unsupported HIPAA/version claims. | Real section destinations, an expanded desktop sidebar with an opt-in labeled icon rail, touch/keyboard tooltips, a modal off-canvas drawer below the tablet breakpoint, current-section indication that follows both anchors and manual scrolling, a single sticky-header offset, and truthful browser-local demo information. |
| Responsive layout | Header runs off-screen; wide control rows cannot wrap; chart minimum widths compete with the page width; table contents squeeze into unreadable columns. | `minmax(0, 1fr)` layout, a constrained content width, responsive toolbars, appropriately contained/focusable chart and table scrolling, and `100dvh` sizing. |
| Keyboard and touch | Help and behavior selection are hover-only; overlay checkboxes are hidden from keyboard users; chart-title editing uses an un-focusable div; icon controls rely on title text; missing skip link and global focus treatment. | Clickable disclosures, named controls, native inputs/pressed states, accessible title editing, 44px control targets, visible focus rings, skip navigation, and reduced-motion support. |
| Dialogs and forms | No dialog semantics, focus trap, Escape behavior, background inertness, or small-screen scrolling; labels are not bound to inputs; coercion replaces blank numeric input; no inline validation; date ranges can be reversed; color input includes an invalid eight-digit value. | Shared native-dialog/sheet primitives, restored focus and locked background scrolling, explicitly labeled fields, inline validation and first-error focus, required/range/measurement checks, and valid color-picker values with preserved chart opacity. |
| Annotation context | Add forms always attach to the first program's first target; the summary promises editing but only supports deletion; refreshed data resets the mastery selection. | Pass the actual chart-target context; implement edit using existing service update methods; preserve valid selections after saves and refreshes; empty-program recording preselects that program’s target. |
| Chart controls | Frequency-rate state has no control; the regression equation does not match the drawn directional line; unused session/empty-date state; weekly labels are truncated; no nonvisual numeric chart equivalent. | Wire real view controls to the existing measurement engine, distinguish regression/directional trends, expose empty-date and session pagination controls, format cross-month weekly categories, make units explicit, show only current-measurement targets/clinicians in legends, and provide an accessible processed-data table. Note markers have contrast-aware text and a separate row so they do not collide with date labels. |
| Feedback and exports | Refresh spins for a fixed delay although data is synchronous; some image exports silently do nothing in table/empty views; asynchronous PNG/ZIP failures have no feedback; localStorage errors only reach the console; reset uses a browser confirm. | No artificial refresh delay; layout-shaped loading states for actual code loading; valid export choices only, progress/success/error feedback, a persistent browser-storage warning, and a clear in-app reset confirmation. CSV quoting preserves comma/quote/newline content and target names without inventing absent intensity/duration values. |
| Empty and error states | Generic “No data” messages with no recovery action; all-hidden targets poorly explained; no fatal-render recovery. | Contextual empty states with relevant actions, a distinct hidden-target explanation, and a branded error boundary. |
| Content and trust | Specification section numbers, technical hosting copy, title-case labels, long tooltip prose, and unsupported compliance claims. | Plain task-focused copy, concise explanations, clear snapshot date and demo/local-storage scope; preserve the fictional clinical fixture rather than manufacturing marketing statistics. |
| Icons and branding | Lucide-only interface; leftover Vite favicon and unused starter assets/CSS. | A consistent Phosphor icon weight, a custom Welina mark/favicon/social image, and removal of unused starter artifacts. |
| Code quality | Duplicated overlay/form logic; artificial revision dependencies; cascading selection effects; unused starter CSS/assets and inconsistent icon imports. | Shared dialogs, fields, popovers, feedback/export menus and section headers; pure validation/chart/CSV helpers; stable external-store subscriptions and derived selections; removal of unused assets and zero-warning lint. |
| Structure and sharing | Missing descriptions/social metadata; mostly undifferentiated div sections; no privacy/terms destinations or branded 404. | Semantic labeled sections, tables/captions, useful metadata, real static privacy/terms pages describing the demo, and a project-path-safe custom 404. |

## Deliberate omissions

- No stock team photos, marketing card grids, carousels, pricing tables, testimonial walls, decorative animation, or parallax: this is a clinical data workspace, not a marketing site. Texture and restrained spacing provide depth without obscuring data.
- No theme switch: the interface intentionally uses one coherent light theme.
- No cookie-consent banner: the app sets no tracking cookies and includes no analytics/advertising SDK. Demo localStorage is functional storage; the privacy page explains it. Reassess consent if tracking is introduced.
- No clinical/compliance claims. GitHub Pages still hosts the static demo, not the .NET API or a production patient-record system.

## Analytical charting (October 2026)

Behavior analysts live in their graphs: they inspect level, trend, variability, immediacy and overlap; drill from a weekly summary to the trials behind it; check whether measurement was reliable and treatment was delivered as written; and look for the antecedents, consequences and conditions that predict problem behavior. This update turns the charts into that workflow without adding chart dependencies (all visuals are hand-written, labeled SVG or HTML tables).

| Need | Before | Now |
|---|---|---|
| Data depth | 3 clients, ~2 months, 297 rows of aggregate values; ABC records hand-written. | Simulated 26-week fixture for 5 clients: 589 appointments, 3,676 rows with per-trial prompt codes, interval scores, episodes, fluency errors and IOA; 826 ABC records sampled from function-specific behavior models; phase histories consistent with structured mastery rules; supervision, fidelity and setting events. |
| Reading a point | Native `<title>` tooltips only. | Accessible tooltip, keyboard crosshair (arrows/Home/End with a polite live announcement), and select-to-drill inspector (month → week → day → session → trial chips, interval grid, episodes, IOA, fidelity, supervision, setting events, ABC context). |
| Chart functions | Average and two trend options. | Median, moving average, stability envelope, condition means, mastery criterion, projection band, IOA markers, ratio scale, split-middle trend, CDC criterion lines; prompt-level and celeration views; timeline zoom with two labeled range inputs. |
| Interpretation | None beyond the regression equation. | WWC six-feature table, PND/PEM/NAP/Tau/Tau-U with literature bands, conservative dual-criterion, mastery efficiency (sessions/trials/days to criterion), decision prompts keyed to BACB TCO tasks, data-quality and context breakdowns. Copy states these support—not replace—visual inspection. |
| ABC analysis | Stacked daily counts and a paged log. | Clickable bars and filter chips; antecedent/consequence heat maps (counts, conditional %, lift) that open matching records; descriptive function profiles from pre-intervention records compared with the FBA hypothesis (with an explicit “descriptive ≠ functional analysis” caveat); scatterplot that distinguishes unobserved time; flow diagram; setting-event rate ratios; escalation chains; intensity trend. |
| Prediction | None. | Poisson next-session forecast (exposure offset, trend, setting events) with scenario controls and 80% ranges, two-week trend outlook, naive-Bayes situation explorer. Every model reports rolling-origin performance on later sessions against a naive baseline and labels itself when it is not better. |
| Overview | Cumulative mastery only. | Weekly progress map (targets × 12 weeks, goal- or baseline-relative color with text values) whose cells open the target analysis at that week; Service & data quality section (hours vs authorization, attendance, IOA coverage, fidelity, cancellations, RBT supervision vs the BACB 5% minimum). |

Accessibility and performance decisions:

- Heat maps are real tables with captions and 44px button cells whose labels carry the value, sessions and context; color is never the only encoding (values are printed) and cell ink is pure black or white chosen by luminance so every cell clears 4.5:1.
- Only one `svg.chart-svg` renders per section at a time; auxiliary charts use separate classes and named, focusable scroll regions. Interactive SVG marks are pointer conveniences—keyboard users have the crosshair, inspector navigation buttons, tables and filters.
- New panels avoid `role="alert"` and duplicate control names so screen-reader and test landmarks stay unambiguous.
- The fixture is a separate cacheable chunk (~129 kB gzipped); Patterns, Forecast, the progress map and the service section are lazy chunks; localStorage writes only the keys that change.

## Verification

### Final results

- **Pure/fixture tests:** 46 passing. Besides validation, measures, calendar labels, CSV and contrast, they cover fixture integrity (prompt codes, interval scores, episode sums, phase histories versus mastery rules, appointment linkage, IOA arithmetic, ABC never exceeding measured episodes, generator reproducibility), the visual-analysis library (split-middle, stability envelopes, PND/PEM/NAP/Tau-U, the Fisher et al. binomial table, CDC, celeration, projections, mastery efficiency), ABC analytics (contingencies, function profiles, scatterplot coverage, exposure-adjusted rates, chains, setting events), the models (logistic, naive Bayes, Poisson with exposure, trend forecasts), and that the simulated data contain the patterns the UI claims to surface.
- **Lint:** 0 warnings, 0 errors (original baseline: 53 warnings).
- **Production build:** passes. Application JavaScript is approximately 346kB / 102kB gzip; the fictional fixture is a separate 1.6MB / 129kB gzip chunk (the size warning limit is raised deliberately for that data chunk only); target analysis, ABC (with lazy Patterns/Forecast), the progress map, the service section and JSZip are split into separate chunks. Fonts are self-hosted and licensed; no third-party font requests.
- **Responsive checks:** document width stays within the viewport at **320, 390, 768, 1024, 1440 and 1920px** in desktop and mobile-emulation contexts. The original 199px page overflow is eliminated. Chart/table scrolling remains intentionally contained in named, focusable regions.
- **Accessibility:** zero axe WCAG A/AA violations in the checked desktop/mobile defaults, validated recording states (including a 320px sheet), no-client view, behavior comparison, clinician-split view, annotation forms, mobile drawer, privacy, terms and nested 404. Additional focused checks covered the ABC log and excluded-zero/missing-date behavior view. The 404 return button is checked at rest, hover and keyboard focus; its foreground/background no longer interpolate through a low-contrast frame. Accessibility scans wait for loaded fonts and finite UI transitions, and CI reports detailed failures as GitHub annotations. Native dialog Tab wrapping, Escape, focus restoration, skip navigation, help/behavior popovers, 44px controls and associated checkbox labels were exercised.
- **Exports:** actual CSV, SVG, PNG and ZIP downloads verified, plus real learning-material downloads. Parsed CSV retains target names and distinguishes a measured zero from an untracked blank; simulated canvas failure produces visible retryable feedback.
- **Deployment checks:** workflow schema and main-only upload/deploy guards pass; `npm audit` reports no vulnerabilities; `git diff --check` passes. The existing push-to-main deployment behavior is retained, with lint and production-prefix UX checks added before publication.

**Browser suite: 100/100 passing** (50 scenarios in desktop and touch/mobile-emulation projects), against the latest production build under `/ADC/`. New scenarios cover pointer and keyboard drill-down to trial chips, chart functions and overlays, the visual-analysis panel and CDC lines, prompt-level and celeration views, ABC heat-map drill-down and forecasts, the progress-map drill-down, and service quality—each with axe scans. No uncaught browser errors in those scenarios. Generated traces, downloads, browser dependencies and screenshots are kept out of Git.

### Reproduce

```bash
cd frontend
npm ci
npm test
npm run lint
npx playwright install --with-deps chromium
npm run test:ux
```

`test:ux` builds first and serves the actual output under **/ADC/**, including project-prefixed fonts/assets/legal pages and a real 404 response. Desktop and touch/mobile-emulation projects run the same functional coverage. See `frontend/tests/ux.spec.js` and `frontend/playwright.config.js`; `README.md` explains the Pages preview and share-image regeneration.

### Scope and limitations

- The original UX pass left the fixture and backend unchanged; the analytical-charting update replaced the fixture with a simulated one (same schema plus optional fields) and added typed .NET models, phase-history mastery and a service-sessions endpoint. Measured values, raw records, six recording tools, annotation CRUD, setup/material inspection and exports are retained. Predictive models are transparent demonstrations on fictional data, evaluated on later sessions; they are not validated clinical tools, and descriptive ABC patterns are not a functional analysis.
- Automated axe checks and Chromium mobile emulation are not a WCAG certification or physical-device/screen-reader audit. Safari/Firefox, VoiceOver/TalkBack/NVDA and production-scale patient workflows need separate validation before any real clinical use.
- The .NET SDK is unavailable in this workspace, so no new local .NET build is claimed. The existing CI API build remains configured. This static demo still does not host the API or authenticate/store production patient records.
- Implementation and local verification were performed on the working branch without a production deployment. Merging to `main` triggers GitHub Pages publication only after the workflow succeeds.
