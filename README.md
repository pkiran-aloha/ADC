# Welina Analytics Module (Web)

A fictional **Applied Behavior Analysis (ABA)** analytics workspace built with **React 19**, **Vite 8**, and **Tailwind CSS v4**, with a separate **ASP.NET Core 8 Web API**. GitHub Pages serves the browser-local demo—not a production patient-record service or the API.

---

## Live Demo & GitHub Pages
- **GitHub Pages URL**: [https://pkiran-aloha.github.io/ADC/](https://pkiran-aloha.github.io/ADC/)
- **Repository**: [pkiran-aloha/ADC](https://github.com/pkiran-aloha/ADC)
- **Deployment**: Every push to `main` (including a merged pull request) automatically validates the project, builds the frontend, and publishes it via `.github/workflows/deploy.yml`. Pull requests targeting `main` run build checks without deploying.

**Documentation**
- **Platform wiki** — features, workflows, measurement science, data dictionary and glossary: [docs/wiki/Home.md](docs/wiki/Home.md)
- **Tech stack and architecture** — dependencies, data pipeline, testing, CI/CD and deployment: [TECH_STACK.md](TECH_STACK.md)
- **UX and accessibility audit** — findings, fixes and verification: [UX_AUDIT.md](UX_AUDIT.md)

---

## System Architecture

```
ADC/
├── backend/                               # ASP.NET Core 8 Web API
│   ├── Welina.Analytics.sln               # Solution file
│   ├── Dockerfile                         # Container definition
│   └── src/Welina.Analytics.Api/
│       ├── Controllers/                   # REST Controllers
│       │   ├── ClientsController.cs
│       │   ├── ProgramsController.cs
│       │   ├── OverallMasteryController.cs
│       │   ├── TargetAnalyticsController.cs
│       │   ├── AbcAnalyticsController.cs
│       │   ├── AnnotationsController.cs
│       │   ├── ExportController.cs
│       │   ├── ServiceSessionsController.cs # Appointments, staff, data-quality standards
│       │   └── LessonNotesController.cs
│       ├── Models/                        # Domain entities, DTOs & Enums
│       ├── Services/                      # Analytics calculus & seed data store
│       └── Program.cs                     # API startup, Swagger OpenAPI & CORS
├── frontend/                              # React 19 + Vite Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx                 # Client selector, six-tool observation recorder
│   │   │   ├── Sidebar.jsx                # Welina web platform navigation
│   │   │   ├── OverallMasterySection.jsx  # Section A: Cumulative mastery graph
│   │   │   ├── ClientSpecificSection.jsx  # Section B: Granular target analytics
│   │   │   ├── analysis/                  # Interactive chart, inspector, visual analysis, SCC/prompt views
│   │   │   ├── AbcDataSection.jsx         # Section C: ABC timeline, patterns and forecasts
│   │   │   ├── abc/                       # Heat maps, function profiles, scatterplot, flow, forecasts
│   │   │   ├── overview/ProgressHeatmap.jsx # Targets × weeks map that drills into target analysis
│   │   │   ├── ServiceQualitySection.jsx  # Dosage, attendance, IOA, fidelity, supervision
│   │   │   ├── ui/                         # Shared accessible workspace primitives
│   │   │   └── Modals/                    # Phase lines, ranges, notes, observations
│   │   ├── services/apiService.js         # LocalStorage demo analytics service
│   │   ├── utils/stats.js                 # Regression, distributions, binomial/Poisson helpers
│   │   ├── utils/visualAnalysis.js        # Split-middle, envelopes, PND/PEM/NAP/Tau-U, CDC, celeration
│   │   ├── utils/abcAnalytics.js          # Conditional probabilities, scatterplots, chains, setting events
│   │   ├── utils/predictiveModels.js      # Poisson forecasts, naive Bayes, logistic regression
│   │   ├── utils/insights.js              # Data-based decision prompts
│   │   ├── utils/exportUtils.js           # SVG, PNG, CSV & Zip exporters
│   │   └── data/mockData.js               # Shared fixture adapter
│   ├── tests/ux.spec.js                   # Desktop/mobile production-path regressions
│   ├── playwright.config.js               # Browser + axe test configuration
│   └── vite.config.js                     # GitHub Pages subfolder config
├── data/clinicalSeed.json                # Shared fictional clinical fixture
├── scripts/generate_clinical_seed.py     # Reproducible fixture generator
├── tests/clinicalSeed.test.mjs           # Fixture integrity and demo-service tests
├── tests/analytics.test.mjs              # Visual-analysis, ABC and predictive-model tests
├── tests/uxLogic.test.mjs                # Validation, measures, calendar, CSV and contrast tests
├── UX_AUDIT.md                           # Findings, implemented fixes and verification scope
├── docs/                                  # Platform wiki (docs/wiki) + legacy static snapshot
└── .github/workflows/deploy.yml           # Automated CI/CD deployment to Pages
```

---

## Fictional Demo Seed

`data/clinicalSeed.json` is the **single source of demo data** for the GitHub Pages frontend and the .NET in-memory API (embedded at build time). It is **simulated, not hand-typed**, by a deterministic generator (portable SplitMix64 random numbers, no platform-dependent math), so the graphs, phase changes and ABC context tell one consistent clinical story. As of **2026-10-14** it contains:

| | |
|---|---|
| Clients | 5 fictional learners (ages 4–12; comprehensive and focused models, 7–25 authorized hours/week) |
| History | 26 weeks (2026-04-13 → 2026-10-14) of recurring appointments with holidays, vacations, illness, cancellations and substitutes |
| Service sessions | 589 (547 completed, 42 cancelled): 97153 direct treatment, 97155 BCBA treatment, 97156 caregiver guidance; clinic, home, school, community and telehealth |
| Programs / targets | 22 Skill Acquisition and 15 unitary Behavior Reduction programs, 66 targets, all 8 statuses and 8 phases |
| Observations | 3,676 rows, including 7,837 individually coded trials, 715 interobserver-agreement checks, interval-by-interval scores, duration episodes and fluency errors |
| Context | 826 ABC records, 143 supervision overlaps with procedural-fidelity checklists, 93 sessions with setting events, 101 phase lines, 7 ranges, 8 notes, 12 staff (BCBA, BCaBA, RBT) |

How the simulation works:

- **Skills** follow explicit phase timelines (Baseline → Acquisition → Maintenance → Generalization → Completed, plus OnHold/Discontinued). Trial-by-trial targets record a prompt code per trial from their hierarchy (least-to-most, most-to-least with errorless fading, verbal fading). Automatic promotions happen the day after the **structured mastery rule** (`masteryRule`: measure, comparison, threshold, consecutive sessions) is first met; manual targets can meet the rule before a supervisor promotes them. Tests verify the data and the phase history agree. Generalization probes dip, maintenance probes are weekly, and one discontinued goal shows a flat trend.
- **Problem behavior** is generated as episodes from function-specific models (escape, attention, tangible, automatic) with a worsening baseline, extinction bursts, decay during treatment, weekday/time-of-day patterns, setting events acting as motivating operations (poor sleep, illness, medication change, substitutes, breaks), resurgence after breaks and precursor chains (e.g., task refusal → drop to floor). Session rows summarize those episodes, and the ABC log samples them (rare episodes are always narrated), so ABC counts never exceed measured counts. Consequences reflect natural contingencies before intervention and the treatment protocol afterwards, with integrity failures when procedural fidelity is low.
- **Measurement quality** is recorded as Cooper, Heron & Heward describe it: trial-by-trial, interval-by-interval, total-count and total-duration IOA in ~27% of sessions (including a documented low-agreement episode before a new RBT's retraining), supervisor-scored procedural fidelity, and BCBA/BCaBA overlap supervision.
- An explicit BR zero means *observed with no occurrence*; `DataNotTracked` means *no measurement* and is omitted from analytics but retained in raw exports. An observation also carries its collection context (`dataSource`, `collectionContext`, `enteredManually`) so a graph and the raw export can distinguish a session recording from a probe, school, paper, assessment or imported point.
- Organisation policy lives in `clinicalStandards` and is applied by the workspace: `graphing.minimumTrialsPerDataPoint` (5) and `minimumMinutesPerDataPoint` before a session is plotted, `behaviorReduction` (80% below baseline sustained for 14 days) for behaviour-target mastery, plus the IOA, fidelity, supervision, stability, non-overlap and CDC thresholds the analysis panels quote. Each client's ABC setup lists antecedents (with motivating-operation categories), behaviors, consequences (with the reinforcer each would deliver), locations and setting events.
- The frontend demo stores editable records in localStorage and only rewrites the keys that change. The first load after a fixture change (detected by a content-derived revision) replaces old **demo** records; **Reset demo data** restores the fixture again. The fixture is bundled as its own cacheable chunk (~129 kB gzipped).

To change the fixture, edit `scripts/generate_clinical_seed.py`, then run:

```bash
python3 scripts/generate_clinical_seed.py
cd frontend && npm ci && npm test && npm run build
```

`npm test` checks cross-references, conditional fields, clinical measurement consistency (prompt codes, interval scores, episode sums), phase histories versus mastery rules, appointment linkage, IOA arithmetic, ABC-versus-measured episode counts, migration, generator reproducibility, and that the simulated data contain the patterns the analytics claim to detect. The API additionally exposes `GET /api/programs/catalogs`, `GET /api/abcanalytics/configuration?clientId=cli-liam`, and `GET /api/servicesessions?clientId=cli-liam` (plus `/staff` and `/standards`).

---

## Analytics workspace

The workspace opens on one workflow at a time instead of one long page. Five tabs group the screens around naturally occurring jobs — **Progress overview**, **Target analysis**, **ABC observations**, **Service & data quality**, and **Reports** — with keyboard tab semantics (arrow keys, Home/End), a session snapshot chip, and URL hashes (`#target-analysis`, …) that open the matching workflow. The sidebar stays in sync with the active tab, and screens keep their state when you switch back to them.

### Progress overview and client selection
- Start with the first fictional client, switch clients in the named header selector, or clear it to see the client-choice state. Recording and analytics are inactive without a client.
- Read counts derived from the actual fixture: programs, mastered skill targets, session observations, and ABC observations.
- Jump between workflows from the tab strip or the sidebar, collapse the desktop sidebar into a labeled icon rail, or open the keyboard-accessible mobile drawer.

### Skill mastery and weekly progress map
- Plot only mastery transition dates for the selected program. Same-date transitions combine into one cumulative point. A target counts from the first date its phase history enters `Maintenance`, `Generalization`, or `Completed`.
- Review the transition data table or export CSV, SVG, or PNG. Empty programs explain how to continue.
- The **weekly progress map** shows every target × the last 12 weeks: skill cells darken as they approach the mastery criterion, behavior cells as they fall below baseline; dots mark phase changes. Select any cell to open that target, week and weekly grouping in the target analysis with its details already open.

### Target analysis
- Switch between Skill acquisition and Behavior reduction; compare multiple unitary behavior programs.
- Measurement tabs appear only for tools with recorded data: trial by trial, duration, frequency, interval data, anecdotal, and fluency/rate.
- Preserve tool-specific measures: weighted trial/interval fractions, duration totals/counts/averages, occurrence counts, and per-minute/per-hour rates based on observation minutes. Daily fluency counts become grouped counts in session/weekly/monthly views; they are not invented daily rates.
- Group by day, numeric session (12 groups per page), Monday–Sunday week, or calendar month; use date filters, missing-date context, and measured-zero controls.
- Split a single visible target by clinician. Toggle target/clinician visibility, gridlines, monochrome, mean overlays, and directional or regression trends.
- Edit chart titles and add/edit/delete target-scoped phase lines, phase ranges, and graph notes. Phase updates use the observation date and extend the target's phase history.
- **Phase changes are labelled in their own strip** above the plot (the target's phase history plus manual phase lines), so a condition name is always readable and never sits on an observation. The change itself is drawn as a thin, semi-transparent divider *behind* the series with a light casing, so phase lines never cover a data point; *Phase labels* hides the strip and *Values* prints every plotted measurement.
- **Set the vertical axis yourself:** fix the minimum, the maximum, or both from the *Y axis* control (blank scales that end to the data). Gridlines use readable 1/2/2.5/5 steps, observations outside a fixed range are clipped rather than dropped, and the chart states how many points fall outside — they remain in the data table and exports.
- **Interact with the graph:** hover or move a keyboard crosshair (arrow keys, Home/End) for an accessible tooltip; select a point (click or Enter) to open the **observation inspector**, which drills month → week → day → session and shows the clinician and role, setting and service code, setting events, IOA (method, observer, agreements), supervision and procedural fidelity, plus trial-by-trial prompt chips, interval-by-interval grids, duration episodes, fluency corrects/errors, and the ABC records from that session. Zoom with the accessible timeline brush.
- **Chart functions** (toggle any combination): median, three-point moving average, Lane & Gast stability envelope, condition means, the target's mastery criterion (when its unit matches the view), an 80% linear projection, IOA markers (dashed below 80%), and a ratio (log) scale. Trend lines can be linear regression, first-to-last, or White & Haring's split-middle line of progress.
- **Plot exactly what you need to see:** *Plot* offers line, grouped bars, points and a cumulative record, and the *Graph view* popover adds the organization's cleanliness controls — *Show dates with no data* (off by default, so the default graph plots only dates that were measured), *Hide sessions below the minimum trial count* (with the organization's floor shown and an override box), the *Data-point marker* (solid circles are the default for a single target; multi-target graphs get a distinct, colour-blind-safe sequence) and the *Chart orientation*. Hidden sessions are counted in a status line above the plot, so nothing disappears silently.
- **Flip the axes when a target reads better sideways:** *Chart orientation → Dates on the left* draws time down the left edge and the measurement along the bottom, keeping every label horizontal and moving phase labels, notes and milestones with it.
- **Plot types for every measurement:** line, grouped bars, points (variability) and a cumulative record, chosen from the *Plot* control. Cumulative needs counts rather than percentages, so it is offered for frequency, fluency and duration, and disabled for percentage tools.
- **Alternate views:** prompt-level stacked bars and a **trial-by-trial strip** for trial-by-trial targets (one cell per trial, coloured by the prompt recorded, with the independent share), a **duration episode** view (each session's total split into the episodes recorded for it), and a daily per-minute **celeration chart** for fluency and rate-measured frequency (corrects as dots, errors as crosses, record floor, ×/÷ per-week celeration lines).
- **Visual analysis panel:** compare adjacent conditions from the phase history and procedure-change lines on the six WWC features (level, trend, variability with stability envelope, immediacy, overlap, consistency), with PND, PEM, NAP (p value), Tau and Tau-U, and the **conservative dual-criterion** (draw its criterion lines on the chart). *Progress & decisions* reports the mastery streak, sessions/trials/days to criterion, celeration and decision prompts (no trend, variability, prompt dependency, criterion met awaiting review, extinction burst, resurgence after breaks, low IOA coverage). *Data quality* summarizes IOA coverage and agreement by observer, low-agreement sessions (open in the inspector) and fidelity; *Context* breaks results down by clinician, setting, time of day, weekday or setting event and highlights the matching points.
- **Annotations apply across a program in one pass.** Phase lines, phase ranges and graph notes carry an *Apply to* list: the target you opened plus any others in the same program (or every target, from the quick action). Each target keeps its own copy, duplicates on a date are skipped, and the saved toast reports how many targets were updated. Note text is also drawn on the graph itself in staggered labelled rows with leader lines, so it is readable without hovering — and it travels into the report and the exported SVG.
- **Milestones and mastery are visible on the chart:** the date each target was introduced, mastered and moved into maintenance appears as a labelled marker on the time axis and again in *Progress & decisions*, with days-to-mastery and acquisition rate.
- **Behaviour-reduction mastery uses a reduction rule:** for behaviour targets the progress tab compares the current phase with the baseline (mean, median, or the last three baseline sessions) and reports the configured reduction percentage (`clinicalStandards.behaviorReduction`, 80% sustained for 14 days by default) as *met* or as days-to-go, with the criterion drawn on the graph.
- **Update the program from the analytics workflow.** *Progress & decisions* ends with a program-status control: choose Teaching, Maintaining, Generalizing, Baselining, On hold, Completed or Discontinued, add an optional reason, and the change is written to the program's status history with the review date — no trip to Program setup. The status and progress of each program are also shown in the program selector.
- **Correction and deletion after billing.** Open a point in the inspector to correct its measurement, add the reason and staff member, or remove it. Both paths keep a change-history entry (what changed, when, by whom, and the reason) and a post-billing correction is flagged *Post-billing change* with a note explaining that the appointment is not released and rebilled. Supervision and IOA observations are stored with the session, listed in the inspector under *Supervision & IOA observations*, and excluded from the learner's chart totals.
- Read the plotted-data table or full narrative notes without relying on color or hover. Inspect **Program setup** and download actual demo learning materials.
- **Record a whole session in one pass.** The recorder opens on *Whole program*: pick the program (or all programs) and every target appears as a row with one shared date, clinician and optional session length. Tick the targets you worked on, leave the rest blank, and save once — or *Save & next session* to keep the sheet open, cleared, and moved to the client's next appointment. *Copy last session* refills each row from its previous observation, *Apply minutes to all rows* shares one observation length, and each row can also record a phase change.
- *Single target* mode keeps the one-target flow for a quick standalone record. All six measurement tools stay validated: blank input does not become zero, and behavior targets choose between a measured zero (*Observed*) and *Not tracked*, which stays missing and is retained in raw CSV/ZIP exports. The clinician, program and target set are remembered per client for the next session.
- Export raw observations, a structured ZIP of all client targets, or available chart SVG/PNG files. Menus report preparation errors rather than silently failing.

### ABC observations
- **Timeline:** view the stacked behavior chart, full observation log, or both; filter by date (including all records) and paginate the log in groups of eight. Select a bar segment, or use the behavior/antecedent/consequence filters, to narrow the log; filters appear as removable chips. Intensity, duration and setting events stay with each record.
- **Patterns:** antecedent × behavior and consequence × behavior heat maps (counts, conditional probability or lift; every cell opens the matching records), a descriptive function profile from pre-intervention records compared with the documented FBA hypothesis, a Touchette scatterplot that separates unobserved time from observed zeros, exposure-adjusted risk windows, an antecedent → behavior → consequence flow, setting-event rate ratios (stratified by time), lag-sequential escalation chains, and weekly intensity.
- **Forecast:** a next-session outlook from a Poisson regression of episode counts (exposure offset, time trend, setting events and appointment context) with an 80% range, adjustable scenario and rate-ratio drivers; a two-week trend outlook with the projected date for the criterion level; and a naive-Bayes “which behavior is likely in this situation” explorer. Each model states how it performed on later sessions it never saw (rolling-origin evaluation against a recent-average baseline or the majority class).
- Inspect the client’s **Recording setup** catalog. These observations provide context, not proof of causation; confirm functions with a functional analysis.
- Export the filtered log as CSV and, when a chart is displayed, SVG/PNG.

### Service & data quality
- Weekly service hours by service code against authorized hours (with cancellations), attendance, IOA coverage and agreement, procedural fidelity, cancellation reasons, and RBT supervision by month (percentage and contacts against the BACB minimum of 5% and two contacts; case-level only).

### Data entry and import
- **Add a data point** (header, or the sidebar on phones) records probe, school, paper, assessment, historical or session data straight onto the graphs: target, collection source, date, time, clinician and the measurement fields for that target's tool, plus an optional note that explains an unusual high or low. *Save & add another* keeps the sheet open and lists what was added in this session. Nothing here needs a lesson note.
- **Import spreadsheet** accepts a pasted table or a CSV/TSV file. Columns are matched by name (Date, Target, Correct/Total, Scored/Intervals, Duration, Occurrences + Minutes, Clinician, Source, Note), the dialog previews every row with its date, target, values, source and status, converts ten-trial percentages where a spreadsheet recorded only one number, explains each assumption as a row note, and offers *Download template* and *Rows to fix (CSV)*. Imported points are stamped with their collection context, so the graph and the raw export show they came from a probe, a school or a paper sheet rather than a session.
- Both flows validate exactly like session recording (blank is never zero, *Not tracked* stays missing) and write into the same browser-local store as recorded sessions.

### Reports
- **Report templates** for clinical review, authorization request, reassessment and treatment-plan progress. Choose a template, a date range, the programs to include, the prepared-by line and whether to include the target list; the builder states what the template contains and how many targets and graphs are in scope.
- **Download report** produces one HTML document with every selected graph (mastery criteria, phase changes, notes and data-quality summary already applied), the learner and service summary, the goal list, acquisition-rate table and signature blocks. **Open print view** renders the same document in a hidden frame and opens the browser's print dialog for a PDF.
- **Targets by status** lists the current acquisition, maintenance or mastered targets for the learner, filtered by status, program scope and an introduction/mastery date range, and exports to CSV. Each row carries the measurement, phase, introduction date, mastery date with days-to-mastery and the last data date.

### Service & data quality
- Weekly service hours by service code against authorized hours (with cancellations), attendance, IOA coverage and agreement, procedural fidelity, cancellation reasons, and RBT supervision by month (percentage and contacts against the BACB minimum of 5% and two contacts; case-level only).
- **Session activity** is the live view of the fictional current day: what is scheduled, what is in progress, how many observations have been recorded per appointment and per target, the minutes recorded, the last recorded time, which appointments still need documentation, and a seven-day strip of observation counts. It never requires opening a session note.

### Access levels
- The header *Access* switch (in the drawer on phones) demonstrates role-based analytics: **Full access** can record, correct, delete, annotate, configure axes and change program status; **View only** keeps every graph, table, analysis and export available while disabling data entry, annotation, axis/orientation settings, program-status changes, the recorder and the demo reset. The choice persists in this browser and the workspace explains what is disabled and why, with a one-click switch back.

### Methods and references
The analytics implement conventions from the BACB *BCBA Test Content Outline* (6th ed.; e.g., C.8 IOA, C.10–C.11 graphing and interpretation, C.12 procedural integrity, D.4–D.7 single-case designs, F.5–F.6 descriptive and functional assessment, G.7–G.8 prompting and fading, H.5–H.7 data-based decisions, I.7 supervision) and the *BCBA Handbook*, together with: Cooper, Heron & Heward (2020) on measurement and IOA; Kratochwill et al. (2010) WWC single-case standards; Fisher, Kelley & Lomas (2003) dual-criterion methods; Parker & Vannest (2009) NAP; Parker et al. (2011) Tau-U; Scruggs & Mastropieri (1998) PND; Ma (2006) PEM; Vannest & Ninci (2015) Tau magnitudes; Lane & Gast (2014) stability envelopes; White & Haring (1980) split-middle; Lindsley's Standard Celeration Chart; Touchette, MacDonald & Langer (1985) scatterplots; Pence et al. (2009) and Vollmer et al. (2001) on descriptive ABC probabilities; Lerman & Iwata (1995) and Lerman, Iwata & Wallace (1999) on extinction bursts; Hanley & McNeil (1982) for AUC intervals; and Ferina et al. (2023) on individualized, forward-evaluated behavior prediction. Thresholds live in `clinicalStandards` in the fixture. Every analysis is decision support for fictional data, not a clinical determination.

### Feedback, accessibility and demo information
- Named controls, semantic sections, visible focus, 44px interaction targets, a skip link, native modal dialogs with explicit Tab wrapping/Escape/focus restoration, and reduced-motion support.
- Actual lazy-code loading uses layout skeletons. Storage failures show a persistent warning and retry action. Reset requires an in-app confirmation and defaults to keeping changes.
- Self-hosted Geist/Outfit fonts, Phosphor icons, a custom favicon/share image, truthful privacy/terms pages, and a project-path-safe 404 page.
- Detailed baseline findings, decisions, and verification scope: [UX_AUDIT.md](UX_AUDIT.md).

---

## How to Run Locally

### 1. Frontend (React + Vite)
```bash
cd frontend
npm ci
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

To build for production / GitHub Pages:
```bash
npm run build
```

### Frontend verification

```bash
cd frontend
npm ci
npm test                  # Fixture, analytics, model, validation, measurement, calendar and CSV tests
npm run lint
npm run smoke             # Renders every analytics section headlessly (prop/helper errors fail the build)
npx playwright install --with-deps chromium
npm run test:ux           # Builds first; tests desktop and mobile at /ADC/
```

The browser suite checks responsive widths (320–1920px), client isolation, all recording tools (single target and whole-session), keyboard navigation/dialogs, validation, annotations, overlays and chart functions, plot types, the axis-range control, the phase strip and value labels, pointer and keyboard drill-down, visual analysis, prompt/trial/episode/celeration views, ABC patterns and forecasts, the progress-map drill-down, service quality, grouping/pagination, real downloads, loading/storage/export failures, static legal/404/asset paths, the report builder and target roster, view-only access, the session-activity panel, the time-of-day scatterplot, and manual entry plus spreadsheet import. It uses axe WCAG A/AA checks on selected states; it is not an accessibility certification or a substitute for assistive-technology testing.

`npm run preview:pages` serves an existing `dist` build on `0.0.0.0:4173`, redirecting `/` to `/ADC/` and returning the branded page with a real 404 status for unknown URLs. This local preview server is **not** part of the deployed application. `PLAYWRIGHT_BASE_URL` can target another project-prefixed preview; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a preinstalled Chromium. Test traces and screenshots are ignored by Git.

After editing `frontend/public/social-preview.svg`, regenerate the checked-in 1200×630 PNG with `node scripts/generate-social-preview.mjs` from `frontend` (requires Playwright Chromium). The source artwork identifies its chart as illustrative.

### 2. Backend (.NET Core 8 Web API)
```bash
cd backend/src/Welina.Analytics.Api
dotnet run
```
API runs on `http://localhost:5000`. Access Swagger UI documentation at [http://localhost:5000/swagger](http://localhost:5000/swagger).

Or run via Docker:
```bash
# From the repository root (includes data/clinicalSeed.json):
docker build -t welina-analytics-backend -f backend/Dockerfile .
docker run -p 5000:5000 welina-analytics-backend
```

---

## GitHub Pages Deployment

The repository is configured to publish at [https://pkiran-aloha.github.io/ADC/](https://pkiran-aloha.github.io/ADC/) using **GitHub Actions**. No deployment secrets or manual bundle updates are needed.

### Automatic deployment

1. Open a pull request targeting `main`. The `build` job in `.github/workflows/deploy.yml` installs locked frontend dependencies with `npm ci`, runs fixture/validation/analytics tests and lint, builds the React frontend, verifies desktop/mobile UX and accessibility against the built `/ADC/` site, and builds the .NET 8 API. Pull requests do **not** publish to Pages.
2. Merge the pull request into `main`. Every push to `main` triggers the same checks, uploads the newly built `frontend/dist` bundle, and deploys it to the `github-pages` environment after the build succeeds. There are no path filters, so changes anywhere in the repository trigger the workflow.
3. Follow the run under **Actions → Deploy Welina Analytics to GitHub Pages** to see build/deployment status and the published site URL. A failed build skips deployment and leaves the previous site live.

Only `main` can publish: the deploy job checks the branch, and the repository's `github-pages` environment allows deployments from `main` only. Production runs are serialized without canceling a deployment in progress; superseded pull-request checks are canceled independently.

### Manual redeployment and repository settings

- To redeploy, select **Actions → Deploy Welina Analytics to GitHub Pages → Run workflow** and choose **main**. Manual runs on other branches validate the build only.
- In **Settings → Pages**, keep **Build and deployment → Source** set to **GitHub Actions** (already enabled for this repository).
- In **Settings → Environments → github-pages**, keep the deployment branch policy restricted to `main`. Do not add required reviewers if deployment should remain fully automatic.
- The workflow uses the built-in `GITHUB_TOKEN` and grants Pages/OIDC write permissions only to the deploy job. The checked-in `docs/` directory contains the platform wiki plus a legacy snapshot and is **not** the deployment source.

**Hosting scope:** GitHub Pages serves only the static React frontend and its fictional, browser-local demo data. The .NET API is compiled as a validation check, not hosted by Pages; running the API in production requires a separate backend host.

<!-- Deploy trigger: 2026-10-22T17:25:25Z -->
