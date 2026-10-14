# Welina Analytics Module (Web)

A fictional **Applied Behavior Analysis (ABA)** analytics workspace built with **React 19**, **Vite 8**, and **Tailwind CSS v4**, with a separate **ASP.NET Core 8 Web API**. GitHub Pages serves the browser-local demo—not a production patient-record service or the API.

---

## Live Demo & GitHub Pages
- **GitHub Pages URL**: [https://pkiran-aloha.github.io/ADC/](https://pkiran-aloha.github.io/ADC/)
- **Repository**: [pkiran-aloha/ADC](https://github.com/pkiran-aloha/ADC)
- **Deployment**: Every push to `main` (including a merged pull request) automatically validates the project, builds the frontend, and publishes it via `.github/workflows/deploy.yml`. Pull requests targeting `main` run build checks without deploying.

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
│   │   │   ├── AbcDataSection.jsx         # Section C: ABCL contextual behavior
│   │   │   ├── ui/                         # Shared accessible workspace primitives
│   │   │   └── Modals/                    # Phase lines, ranges, notes, observations
│   │   ├── services/apiService.js         # LocalStorage demo analytics service
│   │   ├── utils/exportUtils.js           # SVG, PNG, CSV & Zip exporters
│   │   └── data/mockData.js               # Shared fixture adapter
│   ├── tests/ux.spec.js                   # Desktop/mobile production-path regressions
│   ├── playwright.config.js               # Browser + axe test configuration
│   └── vite.config.js                     # GitHub Pages subfolder config
├── data/clinicalSeed.json                # Shared fictional clinical fixture
├── scripts/generate_clinical_seed.py     # Reproducible fixture generator
├── tests/clinicalSeed.test.mjs           # Fixture integrity and demo-service tests
├── tests/uxLogic.test.mjs                # Validation, measures, calendar, CSV and contrast tests
├── UX_AUDIT.md                           # Findings, implemented fixes and verification scope
├── docs/                                  # Legacy static snapshot (not used by deployments)
└── .github/workflows/deploy.yml           # Automated CI/CD deployment to Pages
```

---

## Fictional Demo Seed

`data/clinicalSeed.json` is the **single source of demo data** for the GitHub Pages frontend and the .NET in-memory API (embedded at build time). As of **2026-10-14**, it contains 3 fictional clients, 13 Skill Acquisition (SA) programs with multiple targets where appropriate, 9 **unitary** Behavior Reduction (BR) programs, 38 targets, 297 session observations, and 42 ABC entries. It covers all 8 program statuses and 8 target phases. No real patient data is included.

- SA targets exercise Trial by Trial, Frequency, Duration, Interval Data, Anecdotal, and Fluency/Rate. BR targets exercise only Frequency, Duration, and Interval Data. Each numeric observation carries tool-appropriate counts, seconds, intervals or probe minutes; anecdotes carry narrative text. An explicit BR zero means *observed with no occurrence*; `DataNotTracked` means *no measurement* and is omitted from analytics but retained in raw exports.
- Program definitions include objectives, teaching instructions, optional tags, baseline, treatment area, master-defined custom fields, and actual downloadable demo learning materials. Target definitions include discriminative stimuli, manual/automatic mastery, prompt-template references **only** for Trial by Trial, interval start/length/capture/count **only** for interval targets, and count-up/down start types **only** for Fluency/Rate. Expand **Program setup** in Target analysis to inspect these settings.
- Each client's ABC setup contains treatment area, teaching instructions and textual lists of antecedents, behaviors, consequences and locations. The 42 event records select from those lists. Expand **Recording setup** in ABC observations to inspect the catalog.
- The frontend demo stores editable records in localStorage. The first load after a fixture change (detected by a content-derived revision) replaces old **demo** localStorage records; **Reset demo data** restores the fixture again. The `asOfDate` is fixed so date filters illustrate the same story on every run. This is a demo fixture, not a production database or program-creation/upload implementation.

To change the fixture, edit `scripts/generate_clinical_seed.py`, then run:

```bash
python3 scripts/generate_clinical_seed.py
cd frontend && npm ci && npm test && npm run build
```

`npm test` checks cross-references, conditional fields, clinical measurement consistency, date windows, ABC catalogs, migration, and generator reproducibility. The API additionally exposes `GET /api/programs/catalogs` and `GET /api/abcanalytics/configuration?clientId=cli-liam`.

---

## Analytics workspace

### Progress overview and client selection
- Start with the first fictional client, switch clients in the named header selector, or clear it to see the client-choice state. Recording and analytics are inactive without a client.
- Read counts derived from the actual fixture: programs, mastered skill targets, session observations, and ABC observations.
- Use real section navigation, collapse the desktop sidebar into a labeled icon rail, or open the keyboard-accessible mobile drawer.

### Skill mastery
- Plot only mastery transition dates for the selected program. Same-date transitions combine into one cumulative point.
- Targets count as mastered in `Maintenance`, `Generalization`, or `Completed`.
- Review the transition data table or export CSV, SVG, or PNG. Empty programs explain how to continue.

### Target analysis
- Switch between Skill acquisition and Behavior reduction; compare multiple unitary behavior programs.
- Measurement tabs appear only for tools with recorded data: trial by trial, duration, frequency, interval data, anecdotal, and fluency/rate.
- Preserve tool-specific measures: weighted trial/interval fractions, duration totals/counts/averages, occurrence counts, and per-minute/per-hour rates based on observation minutes. Daily fluency counts become grouped counts in session/weekly/monthly views; they are not invented daily rates.
- Group by day, numeric session (12 groups per page), Monday–Sunday week, or calendar month; use date filters, missing-date context, and measured-zero controls.
- Split a single visible target by clinician. Toggle target/clinician visibility, gridlines, monochrome, mean overlays, and directional or regression trends.
- Edit chart titles and add/edit/delete target-scoped phase lines, phase ranges, and graph notes. Phase updates use the observation date.
- Read the plotted-data table or full narrative notes without relying on color or hover. Inspect **Program setup** and download actual demo learning materials.
- Record all six measurement tools in a validated dialog. Blank input does not become zero. Untracked behavior records remain missing and are retained in raw CSV/ZIP exports.
- Export raw observations, a structured ZIP of all client targets, or available chart SVG/PNG files. Menus report preparation errors rather than silently failing.

### ABC observations
- View the stacked behavior chart, full observation log, or both; filter by date and paginate the log in groups of eight.
- Keep antecedent, behavior, consequence, location, clinician, and complete observation notes together.
- Inspect the client’s **Recording setup** catalog. These observations provide context, not proof of causation.
- Export filtered raw CSV and, when a chart is displayed, SVG/PNG.

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
npm test                  # Fixture, validation, measurement, calendar and CSV tests
npm run lint
npx playwright install --with-deps chromium
npm run test:ux           # Builds first; tests desktop and mobile at /ADC/
```

The browser suite checks responsive widths (320–1920px), client isolation, all recording tools, keyboard navigation/dialogs, validation, annotations, overlays, grouping/pagination, real downloads, loading/storage/export failures, and static legal/404/asset paths. It uses axe WCAG A/AA checks on selected states; it is not an accessibility certification or a substitute for assistive-technology testing.

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
- The workflow uses the built-in `GITHUB_TOKEN` and grants Pages/OIDC write permissions only to the deploy job. The checked-in `docs/` directory is a legacy snapshot and is **not** the deployment source.

**Hosting scope:** GitHub Pages serves only the static React frontend and its fictional, browser-local demo data. The .NET API is compiled as a validation check, not hosted by Pages; running the API in production requires a separate backend host.
