# Welina Analytics — Tech Stack and Architecture

**Artifact type:** engineering reference
**System:** Welina Analytics, a fictional ABA (Applied Behavior Analysis) clinical analytics workspace
**Repository:** [pkiran-aloha/ADC](https://github.com/pkiran-aloha/ADC)
**Live demo:** [pkiran-aloha.github.io/ADC](https://pkiran-aloha.github.io/ADC/)
**Branch described:** `arena/63031e1a-adc` (baseline `6a7cc72`)
**Data snapshot:** 14 October 2026, fixture revision `3c8b5ee51fb6024c`
**Prepared:** 21 October 2026

> [!IMPORTANT]
> This is a **demonstration system with fictional data**. It has no authentication, no server-side persistence, no encryption, and no HIPAA/GDPR compliance. The technology choices below are optimized for a reproducible, inspectable, browser-local analytics demo — not for production clinical use.

---

## 1. At a glance

| Layer | Choice | Version |
|---|---|---|
| **UI runtime** | React + React DOM | 19.3.0 (declared `^19.2.8`) |
| **Language** | JavaScript (ES modules, JSX) | ECMAScript 2022+ |
| **Build tool** | Vite (Rolldown pipeline) | 8.3.4 (declared `^8.3.0`) |
| **React plugin** | `@vitejs/plugin-react` | 6.1.2 |
| **Styling** | Tailwind CSS v4 via `@tailwindcss/vite` | 4.3.3 |
| **Icons** | Phosphor Icons for React | 2.1.10 |
| **Charts** | Hand-built accessible SVG components | in-repo |
| **Zip export** | JSZip | 3.10.2 |
| **Unit/domain tests** | Node.js built-in test runner | Node 22.22.3 |
| **Lint** | oxlint | 1.88.0 (declared `^1.81.0`) |
| **Browser tests** | Playwright + axe-core | 1.64.1 / 4.13.0 |
| **API** | ASP.NET Core Web API | .NET 8 (`net8.0`) |
| **API docs** | Swashbuckle / Swagger UI | 6.5.0 |
| **Fixture generator** | Python, standard library only | 3.11.2 in this workspace |
| **Local storage** | Browser `localStorage` | ~5 MB typical quota |
| **Hosting** | GitHub Pages (static) | GitHub Actions |
| **Container** | Multi-stage Docker, SDK 8 → ASP.NET 8 | `backend/Dockerfile` |

**Architecture in one sentence:** a static React single-page application owns the full analytics experience and persists fictional records in `localStorage`; a deterministic Python generator produces the single JSON fixture that both the SPA and an optional in-memory .NET 8 API consume.

---

## 2. System context

```
                         ┌──────────────────────────────────────────┐
                         │            GitHub repository             │
                         │                                          │
  scripts/generate_      │  data/clinicalSeed.json  (1.8 MB JSON)   │
  clinical_seed.py ─────▶│        │                                 │
  (SplitMix64, stdlib)   │        ├──▶ frontend/src/data/mockData.js│
                         │        │        │                        │
                         │        │        ▼                        │
                         │        │   Vite build ──▶ clinical-seed  │
                         │        │                 chunk (130 kB   │
                         │        │                 gzip) + app     │
                         │        │                                 │
                         │        └──▶ embedded resource in        │
                         │             Welina.Analytics.Api.dll     │
                         └──────────────────────────────────────────┘
                                        │
             ┌──────────────────────────┴───────────────────────────┐
             ▼                                                      ▼
  ┌─────────────────────────────┐                       ┌──────────────────────────┐
  │ Static SPA on GitHub Pages  │                       │ Optional .NET 8 API      │
  │                             │                       │                          │
  │ React 19                    │   no runtime calls    │ Controllers              │
  │  ├─ workflow shell          │ ◀───────────────────▶ │  ├─ Clients/Programs     │
  │  ├─ SVG charts + tables     │     (independent)     │  ├─ TargetAnalytics      │
  │  ├─ analytics utilities     │                       │  ├─ AbcAnalytics         │
  │  └─ apiService              │                       │  ├─ Annotations          │
  │       │                     │                       │  ├─ Export               │
  │       ▼                     │                       │  ├─ ServiceSessions      │
  │  localStorage (9 keys)      │                       │  ├─ OverallMastery       │
  │                             │                       │  └─ LessonNotes          │
  │ Exports: CSV/SVG/PNG/ZIP/   │                       │                          │
  │ HTML report/print PDF       │                       │ InMemoryAnalyticsService │
  └─────────────────────────────┘                       │ (singleton, seeded once) │
             │                                          └──────────────────────────┘
             ▼                                                      │
      User's browser                                                ▼
      (data never leaves it)                              Docker / dotnet run
                                                           port 5000, /swagger
```

### 2.1 Runtime topology

| Component | Required at runtime? | Persistence | Network calls |
|---|---|---|---|
| React SPA | Yes, for the demo | `localStorage` | Static assets only |
| .NET API | No | In-process memory, reset on restart | None outbound |
| Fixture generator | No | Writes `data/clinicalSeed.json` | None |
| GitHub Actions | No | Build artifacts, Pages deployment | GitHub services |

The deployed demo is entirely static. The API exists to demonstrate a server-side implementation of the same domain and is not called by the frontend.

---

## 3. Repository layout

```
ADC/
├── frontend/
│   ├── src/
│   │   ├── main.jsx                 React root, StrictMode, icon context, error boundary, toasts
│   │   ├── App.jsx                  Workflow shell, client scope, dialogs, hash routing
│   │   ├── components/              Panels, charts, inspectors, modals, UI primitives
│   │   ├── services/apiService.js   Browser-local data service + pub/sub
│   │   ├── utils/                   All analytics, validation, exports, reporting
│   │   ├── data/mockData.js         Fixture adapter and catalog constants
│   │   └── index.css, premium.css   Tailwind v4 theme + custom surfaces
│   ├── public/                      Favicon, self-hosted fonts, 404, legal pages, social art
│   ├── tests/                       render-smoke.jsx, dom-stub.js, ux.spec.js
│   ├── scripts/serve-pages.mjs      /ADC/ path emulator for local preview and tests
│   ├── vite.config.js               Base path, chunking, dev/preview hosts
│   ├── playwright.config.js         Desktop + iPhone 13 projects
│   └── package.json / package-lock.json
├── backend/
│   ├── Welina.Analytics.sln
│   ├── Dockerfile
│   └── src/Welina.Analytics.Api/
│       ├── Controllers/             9 REST controllers
│       ├── Models/                  Entities, enums, seed container
│       ├── Services/                IAnalyticsService + InMemoryAnalyticsService
│       ├── Program.cs               DI, CORS, Swagger, routing
│       └── Welina.Analytics.Api.csproj
├── data/clinicalSeed.json           Single shared fixture
├── scripts/generate_clinical_seed.py
├── tests/                           6 Node test suites, 89 tests
├── docs/
│   ├── wiki/Home.md                 Platform wiki (features, science, workflows)
│   └── ...                          Legacy static snapshot (not deployed)
├── UX_AUDIT.md                      Usability/accessibility audit and verification
├── TECH_STACK.md                    This document
├── README.md                        Product and setup overview
└── .github/workflows/deploy.yml     CI/CD
```

---

## 4. Frontend

### 4.1 Runtime and rendering

- **React 19.3.0** with `createRoot`, `StrictMode`, function components, and hooks.
- **No router library.** The active workflow is React state, synchronized to `location.hash` (`#overview`, `#target-analysis`, `#abc-observations`, `#service-quality`, `#reports`) and to the sidebar. Unknown hashes fall back to the overview.
- **No state-management library.** A single `AnalyticsService` instance is subscribed with `useSyncExternalStore`; it emits `welina-data-change` after writes.
- **Lazy panels.** Target analysis, ABC, service quality, reports, the progress map, and the data-entry modal are `React.lazy` chunks behind `Suspense`. Visited panels stay mounted so chart state survives tab switches.
- **No chart library.** Charts are semantic SVG with explicit scales, tick generation, marker shapes, clip paths, and `<title>`/description text. The data table is always available as the accessible equivalent.
- **Error containment.** A class `ErrorBoundary` catches render failures and shows a recovery surface; a `FeedbackProvider` supplies toasts and confirmation dialogs.
- **StrictMode** double-invokes render in development, which surfaces accidental side effects.

### 4.2 UI composition

| Area | Components | Responsibility |
|---|---|---|
| Shell | `App.jsx`, `Header.jsx`, `Sidebar.jsx`, `WorkflowTabs` | Client scope, workflow navigation, access level, reset, entry points |
| Overview | `OverallMasterySection`, `ProgressHeatmap` | Client metric strip, cumulative mastery, 12-week target map |
| Target analysis | `ClientSpecificSection`, `analysis/TargetChart`, `SpecialCharts`, `ObservationInspector`, `AnalysisPanel` | Filters, chart, drill-down, visual analysis, program status |
| ABC | `AbcDataSection`, `abc/AbcVisuals`, `AbcPatterns`, `AbcForecast` | Timeline, log, matrices, function profile, scatterplot, chains, forecasts |
| Service quality | `ServiceQualitySection` | Dosage, attendance, IOA, fidelity, supervision, live documentation |
| Reports | `ReportsSection`, `utils/reportBuilder.js` | Template builder, roster, standalone HTML, print view |
| Modals | `RecordSessionModal`, `DataEntryModal`, `PhaseLineModal`, `PhaseRangeModal`, `GraphNoteModal`, `Dialog` | Recording, import, annotations, confirmations |
| Primitives | `Field`, `Popover`, `ExportMenu`, `SegmentedControl`, `EmptyState`, `Feedback` | Accessible form, menu, and status patterns |

### 4.3 Data service and state flow

`frontend/src/services/apiService.js` is the only persistence boundary.

**Read path**

```
bundled fixture (mockData.js)
        │ first load or seed-version mismatch
        ▼
localStorage keys ──▶ AnalyticsService instance ──▶ useSyncExternalStore ──▶ React panels
```

**Write path**

```
recorder / manual entry / import / annotation / correction
        │
        ▼
validation + normalisation (recording.js, dataEntry.js, observations.js)
        │
        ▼
AnalyticsService method
        ├─ mutate in-memory collections
        ├─ persist only changed localStorage keys
        ├─ publish snapshot + dispatch `welina-data-change`
        └─ dispatch `welina-storage-status` on write failure
```

**Storage keys**

| Key | Contents |
|---|---|
| `welina_clients` | Clients, including service model and authorized hours |
| `welina_programs` | Programs and their targets |
| `welina_sessions` | Observations |
| `welina_phase_lines` | Manual and automated phase lines |
| `welina_phase_ranges` | Shaded phase ranges |
| `welina_graph_notes` | Dated graph notes |
| `welina_abc_entries` | ABC records |
| `welina_deletion_audit` | Removed observations with reason and staff (capped at 500) |
| `welina_seed_version` | Fixture revision; mismatch triggers a reseed |

Additional UI preferences use their own keys: `welina_access_level`, `welina_recorder_prefs`, `welina_graph_preferences:<clientId>`, `welina_navigation_collapsed`.

**Seed-version behaviour.** `SEED_VERSION` is derived from the fixture revision. A returning visitor with an older version is reset to the current demo data; this is intentional so demo links show current content. The reset replaces the demo keys and audit, not unrelated origin storage.

### 4.4 Analytics modules

All clinical mathematics lives in plain ES modules with no React dependency, which makes it directly testable in Node.

| Module | Responsibility |
|---|---|
| `stats.js` | Mean/median/quantile/SD, OLS regression, normal CDF/quantile, t quantile, binomial tails and critical counts, Poisson quantile, linear solvers, AUC/Brier, date arithmetic |
| `visualAnalysis.js` | Split-middle, stability envelopes, moving average, phase description, PND/PEM/NAP/Tau/Tau-U, CDC, magnitude bands, celeration, linear projection, threshold dates, mastery/IOA/reduction rules |
| `abcAnalytics.js` | Contingency tables, conditional probability, lift, function profiles, flow weights, observation coverage, Touchette scatterplot, exposure-adjusted weekday blocks, 10-minute precursor chains, setting-event observed/expected ratios, intensity trend, Pareto, time-of-day |
| `predictiveModels.js` | Ridge logistic IRLS, Hanley–McNeil AUC interval, Poisson session forecast with rolling-origin validation, naive Bayes with chronological 70/30 evaluation, Poisson trend, weeks-to-threshold |
| `insights.js` | Data-based decision prompts with tone, pattern, and reference |
| `analyticsMetrics.js` | Observation keys, grouping/aggregation, metric points, chart statistics |
| `targetAnalytics.js` | Program/target progress, condition spans, prompt breakdowns, milestones, acquisition rate, formatting |
| `recording.js` | Measurement inputs, recorder rows, copying, validation, record construction, next-session date |
| `dataEntry.js` | Six collection sources, manual-entry validation, point construction |
| `dataImport.js` | CSV/TSV parsing, header aliasing, mapping suggestions, row validation, templates, error CSV |
| `observations.js` | Observation types, correction/deletion validation, audit entries, notes, billing flags |
| `permissions.js` | Full vs view-only capability matrix |
| `graphPreferences.js` | Graphing policy, suppression eligibility, per-client persistence |
| `groupSeries.js` | Target presets, stage grouping, average/total summaries |
| `exportUtils.js` | SVG/PNG, CSV, ZIP, download plumbing |
| `chartScale.js` | 1/2/2.5/5 tick steps, bounds validation, label wrapping and note layout |
| `markerShapes.js` | Colour-blind-safe marker sequence and legend swatches |
| `reportBuilder.js` | Report templates/ranges, roster, data-quality summary, standalone HTML and inline report charts |
| `sessionActivity.js` | Demo clock, appointment states, documentation rate, weekly activity |

### 4.5 Styling and assets

- **Tailwind CSS v4** through the Vite plugin, with the design tokens declared in `src/index.css` under `@theme` (custom slate palette, display font, spacing).
- **Self-hosted fonts**: Geist (UI) and Outfit (display) as WOFF2 in `public/fonts`. No Google Fonts request.
- **Hand-authored CSS** (`premium.css`, component classes) for surfaces, gradients, focus rings, print styles, and motion.
- **Theme behaviour**: the app follows the system colour scheme and offers a chart colour mode; monochrome chart mode removes colour dependence.
- **Icons**: Phosphor components with a global `IconContext` (`regular` weight, `aria-hidden`), so icons never announce as text.
- **Social/legal assets**: `favicon.svg`, `social-preview.png/svg`, `privacy.html`, `terms.html`, `404.html`, `legal.css`.

### 4.6 Build configuration

`frontend/vite.config.js`:

| Setting | Value | Reason |
|---|---|---|
| `base` | `'./'` | Relative asset URLs work at a domain root and under `/ADC/` on GitHub Pages |
| `plugins` | `react()`, `tailwindcss()` | JSX transform and v4 utility generation |
| `build.chunkSizeWarningLimit` | `2200` kB | The fixture is intentionally a large, cacheable chunk |
| `build.rolldownOptions.output.codeSplitting.groups` | one group for `clinicalSeed.json` | Keeps the fixture in its own long-lived cache entry |
| `server.host` / `preview.host` | `0.0.0.0` | Works in containers and remote workspaces |
| `server.allowedHosts` | `true` | Allows proxied preview hosts |
| `server.port` / `preview.port` | `5173` | Local convention |

**Production build observed on this branch** (Vite 8.3.4, Node 22.22.3):

| Artifact | Raw | Gzip |
|---|---|---|
| `index-*.js` (React + shell + overview) | 380.33 kB | 111.10 kB |
| `ClientSpecificSection-*.js` | 151.87 kB | 43.91 kB |
| `clinical-seed-*.js` | 1,625.50 kB | 129.87 kB |
| `index-*.css` | 88.78 kB | 17.75 kB |
| `jszip.min-*.js` (lazy) | 95.93 kB | 28.48 kB |
| `dist/` total | 2.8 MB | — |

The fixture is the dominant download. It is bundled deliberately so the demo works with no API and can be cached independently after the first visit.

---

## 5. Backend API

### 5.1 Runtime and composition

- **ASP.NET Core Web API**, `net8.0`, nullable enabled, implicit usings, XML documentation generated (warnings suppressed).
- **Swashbuckle 6.5.0** for OpenAPI and Swagger UI at `/swagger`.
- **One singleton service**, `InMemoryAnalyticsService`, implements `IAnalyticsService`. It loads the embedded `Welina.Analytics.Api.clinicalSeed.json` once at construction and keeps collections in memory.
- **CORS policy `AllowAll`** (`AllowAnyOrigin`, `AllowAnyHeader`, `AllowAnyMethod`). Appropriate only for a demo.
- **Swagger is mapped in every environment** because the startup condition is `IsDevelopment() || true`; `/swagger` is reachable from the container.
- **No database, no EF Core, no identity, no authentication, no rate limiting, no health checks, no OpenTelemetry.**
- **Write scope**: annotations (phase lines, ranges, notes), target phase changes, and lesson-note/session recording mutate the in-memory lists. They are lost on restart and are not wired into the SPA.

### 5.2 Controllers and principal routes

| Controller | Routes | Purpose |
|---|---|---|
| `ClientsController` | `GET /api/clients`, `GET /api/clients/{id}` | Client roster and detail |
| `ProgramsController` | `GET /api/programs?clientId=&category=`, `GET /api/programs/catalogs`, `POST /api/programs/targets/{targetId}/phase` | Programs, prompt/custom-field catalogs, phase change |
| `OverallMasteryController` | `GET /api/overallmastery?clientId=&programId=`, `GET /api/overallmastery/export/csv` | Cumulative mastery series and CSV |
| `TargetAnalyticsController` | `GET /api/targetanalytics/data?clientId=&targetIds=…` | Filtered/aggregated observations |
| `AbcAnalyticsController` | `GET /api/abcanalytics?clientId=…`, `GET /api/abcanalytics/configuration`, `GET /api/abcanalytics/export/csv` | ABC records, catalog, CSV |
| `AnnotationsController` | `GET /api/annotations/summary`, `POST/DELETE /api/annotations/phase-lines`, `.../phase-ranges`, `.../graph-notes` | Annotation CRUD |
| `ExportController` | `GET /api/export/raw`, `GET /api/export/raw/zip` | Raw CSV and ZIP |
| `ServiceSessionsController` | `GET /api/servicesessions?clientId=…`, `GET /api/servicesessions/staff`, `GET /api/servicesessions/standards` | Appointments, staff, clinical standards |
| `LessonNotesController` | `POST /api/lessonnotes/record` | Record session data |

The controller names are pluralized by routing (`api/[controller]`), so the paths above match the implementation's conventions.

### 5.3 Domain model (server)

`Models/Entities.cs` contains `Client`, `TherapyProgram`, `Target`, `PhaseHistoryEntry`, `MasteryRule`, `IntervalSettings`, `FluencySettings`, `PromptHierarchyTemplate`, `CustomFieldDefinition`, `ClinicalSeed`, `SessionDataPoint`, `IoaRecord`, `ServiceSession`, `SupervisionRecord`, `FidelityRecord`, `StaffMember`, clinical standard objects, `AbcConfiguration`, `AbcEntry`, `PhaseChangeLine`, `PhaseRange`, `GraphNote`, and `MasteryDataPoint`.

`Models/Enums.cs` defines target type, program category, target status, line style, aggregation, duration/rate views, and behavior missing-data mode as JSON string enums.

The server is a mirror of the fixture, not an independent schema. Changing a field requires changing the generator, both consumers, and the tests.

### 5.4 Configuration and container

`backend/src/Welina.Analytics.Api/appsettings.json` holds logging defaults; there are no connection strings or secrets.

**Embedded fixture** (`Welina.Analytics.Api.csproj`):

```xml
<EmbeddedResource Include="../../../data/clinicalSeed.json"
                  LogicalName="Welina.Analytics.Api.clinicalSeed.json" />
```

**Docker** (`backend/Dockerfile`, build context = repository root):

```bash
docker build -f backend/Dockerfile -t welina-api .
docker run --rm -p 5000:5000 welina-api
# Swagger: http://localhost:5000/swagger
```

Stages: `mcr.microsoft.com/dotnet/sdk:8.0` restores and publishes; `mcr.microsoft.com/dotnet/aspnet:8.0` runs the published output on port 5000 (`ASPNETCORE_URLS=http://+:5000`).

---

## 6. Shared data pipeline

### 6.1 One fixture, two consumers

`data/clinicalSeed.json` is the single source of demo content. It is:

1. **Imported by Vite** through `frontend/src/data/mockData.js`, bundled into the SPA.
2. **Embedded** into the API assembly at build time.

There is no runtime synchronization between the two. They agree because both are built from the same committed file.

### 6.2 Generator

`scripts/generate_clinical_seed.py` is a standard-library-only Python program. It uses:

- `hashlib` to seed labelled streams from SHA-256,
- a **SplitMix64** PRNG (`0x9E3779B97F4A7C15` increment and the standard mix constants),
- `json`, `math`, `sys`, `datetime`, `pathlib`.

It deliberately avoids platform-dependent transcendental functions so the output is byte-identical across platforms and Python versions. All dates are relative to `AS_OF = 2026-10-14`, not the machine clock.

**Reproduce the fixture:**

```bash
python3 scripts/generate_clinical_seed.py
```

The committed fixture is checked by `tests/clinicalSeed.test.mjs` ("committed fixture is reproducible from the source generator"). There is currently no dedicated CI `--check` step; reproducibility is enforced by the test suite.

### 6.3 What the generator produces

| Section | Count | Notes |
|---|---|---|
| Clients | 5 | Comprehensive and Focused models, 7–25 authorized hours/week |
| Staff | 12 | BCBA, BCaBA, RBT roles |
| Programs | 37 | 22 Skill Acquisition, 15 Behavior Reduction |
| Targets | 66 | 6 measurement types, 8 phases, structured mastery rules |
| Observations | 3,676 | Includes 7,837 coded trials and 715 IOA checks |
| ABC records | 826 | Sampled from measured episodes |
| Service sessions | 589 | 547 completed, 42 cancelled; 97153/97155/97156 |
| Supervision records | 143 | Overlap minutes + fidelity checklists |
| Annotations | 101 phase lines, 7 ranges, 8 notes | Per target |
| History | 26 weeks | 2026-04-13 → 2026-10-14 |

The fixture also encodes clinical standards (`clinicalStandards`), ABC catalogs per client, three prompt hierarchies, and custom-field definitions.

### 6.4 Change workflow

```
edit generator
   │
   ├─▶ python3 scripts/generate_clinical_seed.py
   │        └─▶ data/clinicalSeed.json (new revision hash)
   │
   ├─▶ cd frontend && npm test        # fixture integrity + reproducibility + analytics
   ├─▶ npm run lint && npm run build
   └─▶ dotnet build backend/Welina.Analytics.sln -c Release
```

The revision is content-derived; a new fixture automatically reseeds returning demo browsers.

---

## 7. Testing and quality gates

### 7.1 Node test suites

`npm test` runs `node --test ../tests/*.test.mjs` from `frontend/`. It uses only Node built-ins and imports the same ES modules the UI uses.

| Suite | Tests | Focus |
|---|---|---|
| `analytics.test.mjs` | 13 | Statistics, binomial/CDC criteria, split-middle, stability, PND/PEM/NAP/Tau-U, segmentation, celeration, forecasts, mastery, IOA, ABC patterns, planted clinical signals |
| `charting.test.mjs` | 8 | Tick steps, axis bounds and validation, plot types, condition spans, manual phase lines |
| `clinicalSeed.test.mjs` | 10 | Generator reproducibility, program/target completeness, conditional settings, measurement integrity, zero vs untracked, ABC catalogs, phase/mastery agreement, session linkage, IOA methods, reseeding |
| `recording.test.mjs` | 12 | Measurement inputs, row defaults, last-row selection, copy-last, previews, validation, untracked rows, record construction, phase-change lines, next-session date |
| `round2.test.mjs` | 23 | Graph policy, marker shapes, summaries, presets, view-only, manual entry, import, corrections/audit, excluded IOA/supervision, activity, reduction rule, milestones, request-time scatterplot, roster, report HTML, raw export context, annotation scope |
| `uxLogic.test.mjs` | 23 | Date/phase/note validation, measurement validation, weighted accuracy, duration/rate distinctness, interval counts, weekly grouping, missing data, regression alignment, palette contrast, CSV quoting |
| **Total** | **89** | |

**Observed locally:** 89 passed, 0 failed (`node --test`, Node 22.22.3).

### 7.2 Render smoke test

`npm run smoke` builds `tests/render-smoke.jsx` in SSR mode with a DOM stub, renders `App` and each panel (including view-only and all five workflows), and fails on render/prop/helper errors that a bundle alone would not catch. Dialogs that require a browser portal are intentionally skipped.

**Observed locally:** all sections rendered; 3 dialogs skipped by design.

### 7.3 Playwright and accessibility

`frontend/playwright.config.js`:

- `testDir: ./tests`, `ux.spec.js`
- Base URL `http://127.0.0.1:4173/ADC/` (override with `PLAYWRIGHT_BASE_URL`)
- Web server: `node scripts/serve-pages.mjs` (serves `dist/` under the Pages path, with a real 404)
- Projects: **desktop Chromium 1440×1000** and **mobile Chromium, iPhone 13**
- Serial execution (`workers: 1`), 45 s test timeout, trace/screenshot on failure
- Chromium launched with `--no-sandbox --disable-dev-shm-usage --disable-gpu`

The suite covers workflow navigation and hashes, state preservation, chart drill-down, chart functions, phase/range/note editing, prompt and celeration views, ABC patterns/forecasts, progress map, service quality, report generation, view-only enforcement, live activity, time-of-day scatterplots, import provenance, 320 px layout, 44 px targets, 404 contrast, metadata/assets, and **axe-core scans** on desktop and mobile.

**Observed in this workspace:** not executed — Chromium is not installed and the Playwright browser CDN is outside the sandbox's allowed hosts. The suite is part of the CI job and is documented as passing in `UX_AUDIT.md`.

### 7.4 Lint

`npm run lint` runs oxlint over `src` (72 files, 104 rules). Current result: **0 errors, 1 warning** — `setState` inside an effect in `ClientSpecificSection.jsx` when the selected client changes and graph preferences are re-read. The warning is advisory; the state is intentionally synchronized to an external (storage-backed) preference source.

### 7.5 Verification summary for this branch

| Gate | Result |
|---|---|
| `npm test` | 89 / 89 pass |
| `npm run lint` | 0 errors, 1 advisory warning |
| `npm run smoke` | All sections render; 3 portal dialogs skipped |
| `npm run build` | Success; `dist/` 2.8 MB, main JS 111 kB gzip, seed 130 kB gzip |
| `npx playwright test` | Not run locally (no Chromium); runs in CI |
| `dotnet build` | Not run locally (.NET SDK absent); runs in CI |

---

## 8. CI/CD and deployment

`.github/workflows/deploy.yml` runs on pushes and pull requests to `main`, plus manual dispatch.

### 8.1 Pipeline

| # | Step | Working directory | Fails when |
|---|---|---|---|
| 1 | `actions/checkout@v7` | root | — |
| 2 | `actions/setup-node@v7`, Node 22, npm cache on `frontend/package-lock.json` | — | — |
| 3 | `npm ci` | `frontend` | Lockfile and manifest disagree |
| 4 | `npm test` | `frontend` | Any of the 89 tests fails |
| 5 | `npm run lint` | `frontend` | Any lint error |
| 6 | `npm run smoke` | `frontend` | A panel fails to render |
| 7 | `npm run build` | `frontend` | Bundle error |
| 8 | `npx playwright install --with-deps chromium` | `frontend` | Browser install fails |
| 9 | `npx playwright test` | `frontend` | UX or axe failure |
| 10 | `actions/setup-dotnet@v4`, `8.0.x` | — | — |
| 11 | `dotnet build backend/Welina.Analytics.sln --configuration Release` | root | API or embedded fixture fails |
| 12 | `actions/upload-pages-artifact@v5` (`frontend/dist`) | root | Only on `main`, not PRs |

### 8.2 Deployment model

- **Trigger:** push to `main` (including merged PRs) or manual dispatch.
- **PR behaviour:** the full build/test/lint/smoke/Playwright/API pipeline runs, but the artifact upload and deploy jobs are skipped.
- **Permissions:** workflow-level `contents: read`; the deploy job adds `pages: write` and `id-token: write`.
- **Concurrency:** group `pages-<PR number or ref>`; PR runs cancel superseded runs, production runs do not.
- **Environment:** `github-pages`, with the deployment URL from `actions/deploy-pages@v5`.
- **Artifact:** the static `frontend/dist` directory. No server runtime is deployed.
- **Pages path:** the app is served from `/ADC/`; Vite's relative base makes assets work there and at a domain root.
- **Routing:** hash-based workflows need no server rewrite; `public/404.html` handles unknown paths.
- **Caching:** hashed asset filenames; the clinical seed is a separate content-hashed chunk.

### 8.3 Local Pages emulation

`frontend/scripts/serve-pages.mjs` is a small Node HTTP server that:

- redirects `/` and `/ADC` to `/ADC/`,
- serves `dist/` with correct MIME types and `Cache-Control: no-store`,
- rejects path traversal outside `dist/`,
- returns the built `404.html` with status 404 for unknown paths.

```bash
cd frontend
npm run build
npm run preview:pages     # http://localhost:4173/ADC/
```

This is also Playwright's `webServer`, so tests exercise the same subpath as production.

---

## 9. Local development

### 9.1 Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| Node.js | 22.22.3 (CI: 22) | Frontend, tests, build, Playwright |
| npm | 10.9.8 | Dependency install and scripts |
| Python | 3.11.2 | Regenerating the fixture |
| .NET SDK | 8.0.x | API build/run (not installed in this workspace) |
| Docker | any recent | Optional API container |
| Chromium | Playwright-managed | UX tests |

### 9.2 Commands

```bash
# Frontend
cd frontend
npm ci
npm run dev            # Vite dev server on 0.0.0.0:5173
npm test               # 89 Node tests
npm run lint           # oxlint
npm run smoke          # SSR render of every panel
npm run build          # production bundle in dist/
npm run preview        # Vite preview of dist/
npm run preview:pages  # emulate https://host/ADC/
npm run test:ux        # builds, then runs Playwright (needs Chromium)
```

```bash
# API
dotnet build backend/Welina.Analytics.sln --configuration Release
dotnet run --project backend/src/Welina.Analytics.Api
# Swagger UI: http://localhost:5000/swagger

# API container
docker build -f backend/Dockerfile -t welina-api .
docker run --rm -p 5000:5000 welina-api
```

```bash
# Fixture
python3 scripts/generate_clinical_seed.py
```

### 9.3 Environment variables

| Variable | Where | Effect |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | Playwright | Overrides the default `http://127.0.0.1:4173/ADC/` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Playwright | Uses a system Chromium instead of the managed download |
| `CI` | Playwright | GitHub reporter, no server reuse |
| `PORT` | `serve-pages.mjs` | Preview port (default 4173) |
| `ASPNETCORE_URLS` | API container | Binds to `http://+:5000` |
| `ASPNETCORE_ENVIRONMENT` | API | Standard ASP.NET environment name (Swagger is mapped regardless) |

No `.env` file, secret, API key, or database URL is required.

---

## 10. Performance characteristics

| Concern | Approach |
|---|---|
| **Large fixture** | Separate content-hashed chunk (`clinical-seed`), 1.63 MB raw / 130 kB gzip, cached independently of app code |
| **Initial load** | Overview panel is in the main chunk; heavier workflows are lazy `Suspense` chunks |
| **Re-render cost** | Memoized derived series and `useDeferredValue` for expensive filtering; a single store subscription at the shell |
| **Chart rendering** | Pure SVG, no canvas or WebGL; tick and label layout computed in `chartScale.js`; labels limited to avoid collisions |
| **Large tables** | Pagination (sessions 12 per page; ABC log 8 per page); scroll regions with keyboard access |
| **Exports** | Generated on demand; ZIP and 2× PNG use browser APIs; no blocking network work |
| **Print report** | A single HTML string with inline SVG; written into a hidden iframe for printing |
| **Bundle warnings** | Threshold raised to 2200 kB because the fixture is intentionally large; app code remains split |
| **Storage writes** | Only changed keys are written; failures do not throw into render |

The design target is a demo that opens quickly on a modest connection after the first cache, not a high-throughput clinical system.

---

## 11. Security and privacy posture

| Control | Status |
|---|---|
| Authentication | **None** |
| Authorization | UI-only access level (`FULL` / `VIEW_ONLY`), stored in `localStorage`; not a security boundary |
| Encryption in transit | HTTPS provided by GitHub Pages |
| Encryption at rest | None; browser storage is plain text |
| Server-side data | None for the SPA; the API holds in-memory fictional records |
| PHI | **Must not be entered**; the UI says so in the recorder description |
| Third-party requests | None for application data; fonts are self-hosted; no analytics/tracking |
| Cookies | None used by the app |
| CSP | No Content-Security-Policy header/meta is configured |
| Dependency audit | `npm ci` reported 0 vulnerabilities at the time of this build |
| Secrets | None in the repository; no `.env` required |
| Audit trail | Browser-local correction/deletion history, capped at 500 deletions; not tamper-evident |
| Data retention | None; clearing site data deletes everything |
| Export handling | Exports contain the displayed data; the user is responsible for distribution |

**Production gap:** a real deployment would need identity, per-role authorization, server-side persistence with backups, field-level encryption, audit immutability, BAA/HIPAA controls, CSP, rate limiting, and a retention policy. None of those are implemented.

---

## 12. Accessibility engineering

| Layer | Implementation |
|---|---|
| **Semantics** | Landmarks, headings, real tables with captions, fieldsets/legends, labelled controls |
| **Keyboard** | Full tab order, visible focus, roving tab semantics for workflows (arrows/Home/End), Enter/Space to inspect chart points, Escape to close dialogs |
| **Dialogs** | Native `<dialog>` with `showModal()` for inertness, explicit focus trap and restore, `data-autofocus` targets |
| **Live regions** | `role="status"`, `aria-live` for saves, imports, validation summaries, and storage warnings |
| **Charts** | Accessible names/descriptions, `<title>` on marks, data tables, printed values, distinct marker shapes, monochrome mode, hatching for unobserved cells |
| **Forms** | Inline errors tied to fields, error summary focus, hints, `aria-describedby`, no placeholder-only labels |
| **Motion/contrast** | Reduced reliance on animation; contrast-checked palettes; print stylesheet in black on white |
| **Touch** | 44 px targets or full-size associated labels; tested at iPhone 13 and 320 px |
| **Automation** | axe-core scans in Playwright on desktop and mobile |
| **Limits** | Automated checks do not prove WCAG conformance; no formal audit or screen-reader certification is claimed |

---

## 13. Version matrix

### 13.1 Frontend (declared vs locked)

| Package | Declared | Locked |
|---|---|---|
| `react` | `^19.2.8` | 19.3.0 |
| `react-dom` | `^19.2.8` | 19.3.0 |
| `vite` | `^8.3.0` | 8.3.4 |
| `@vitejs/plugin-react` | `^6.1.1` | 6.1.2 |
| `tailwindcss` | `^4.3.3` | 4.3.3 |
| `@tailwindcss/vite` | `^4.3.3` | 4.3.3 |
| `@phosphor-icons/react` | `^2.1.10` | 2.1.10 |
| `jszip` | `^3.10.2` | 3.10.2 |
| `oxlint` | `^1.81.0` | 1.88.0 |
| `@playwright/test` | `^1.64.1` | 1.64.1 |
| `@axe-core/playwright` | `^4.13.0` | 4.13.0 |
| `@types/react` | `^19.2.18` | 19.3.0 (resolved) |
| `@types/react-dom` | `^19.2.7` | 19.3.0 (resolved) |

The lockfile is the reproducible source of installed versions; `package.json` ranges are intentionally compatible.

### 13.2 Backend and tooling

| Component | Version |
|---|---|
| .NET target | `net8.0` |
| ASP.NET Core | 8.0 (SDK/runtime images `8.0`) |
| Swashbuckle.AspNetCore | 6.5.0 |
| Node (CI) | 22 |
| Node (this workspace) | 22.22.3 |
| npm | 10.9.8 |
| Python | 3.11.2 |
| GitHub Actions | checkout v7, setup-node v7, setup-dotnet v4, upload-pages-artifact v5, configure-pages v6, deploy-pages v5 |

---

## 14. Architecture decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| **Static SPA, no backend dependency** | The demo runs anywhere, including GitHub Pages, with no server, database, or secrets | No multi-user collaboration, no server-side validation, no durable storage |
| **localStorage as the store** | Zero infrastructure; instant reads; easy reset; per-browser isolation | ~5 MB quota, origin-bound, not shareable, not secure, cleared by the user |
| **Single shared JSON fixture** | Frontend and API cannot drift; one generator; one review surface | Large bundle; fixture changes require rebuild and reseed |
| **Deterministic SplitMix64 generator** | Reproducible screenshots, tests, and demos across platforms | Generated data are synthetic; clinical patterns are deliberately planted |
| **Hand-built SVG charts** | Full control of accessibility, annotation layers, print output, and bundle size; no chart-library API limits | More code to maintain; fewer chart types out of the box |
| **No router/state library** | Small dependency surface; workflows are a handful of tabs; hash links suffice | Manual hash/state synchronization; no nested routes or code-splitting by route |
| **Analytics in pure modules** | Directly testable in Node; reusable by the API conceptually; no React coupling | Duplicate domain knowledge in C# if both implementations evolve |
| **In-memory .NET API** | Demonstrates a realistic API surface and Docker packaging without a database | Writes are ephemeral; endpoints are not consumed by the SPA; no integration tests |
| **Tailwind v4 with design tokens** | Fast consistent UI; tokens express the brand; small CSS | Utility-heavy markup; custom CSS still needed for charts/print |
| **Client-side exports** | No server rendering cost; data never leaves the browser | Large ZIPs/PNGs run on the main thread; print behaviour varies by browser |
| **Demo-only security posture** | Keeps the artifact reproducible and safe to host publicly | Not suitable for real PHI; view-only is a UX guard, not a control |

---

## 15. Known constraints and technical debt

1. **No production security.** No auth, roles, encryption, CSP, rate limiting, or audit immutability. See §11.
2. **ABC data are read-only in the UI.** The fixture holds 826 records; there is no entry form, so the demo cannot add or edit an ABC episode.
3. **Observations are all Primary in the fixture.** IOA and supervision exist as session-level checks (715 IOA, 143 supervision), not as separate observation rows in the chart.
4. **The API is not exercised by the frontend.** Its controllers and in-memory service are a parallel implementation; there are no API integration tests or contract tests.
5. **.NET is not built locally in this workspace.** The SDK is absent, so the backend is verified only by CI.
6. **Playwright is not runnable in this sandbox.** Chromium and its CDN are unavailable; the suite is verified in CI and documented in `UX_AUDIT.md`.
7. **One lint advisory remains**: a `setState`-in-effect warning for per-client graph preferences. It is intentional synchronization, but a future refactor could derive the value or key the component by client.
8. **Fixture scale is fixed.** Five clients, 26 weeks, and 3,676 observations. The UI is not stress-tested at production volumes.
9. **Browser storage limits.** Large imports or long histories can exceed quota; the app warns but cannot recover the failed write.
10. **Print/PDF depends on the browser.** The report is print-ready HTML; server-side PDF generation is not implemented.
11. **No i18n and no time-zone configuration.** Dates are ISO and rendered in the browser locale; the demo clock is a fixture timestamp.
12. **`docs/` also contains a legacy static snapshot.** Deployment publishes only `frontend/dist`; the wiki in `docs/wiki` is documentation, not a built site.
13. **Swagger is exposed in all environments** (`IsDevelopment() || true`), which is acceptable only because the API is a demo.
14. **No service worker/offline cache.** The app needs the host on each load; the fixture is cached as a normal asset.

---

## 16. Related documents

| Document | Purpose |
|---|---|
| [`README.md`](README.md) | Product overview, feature walkthrough, setup, deployment |
| [`docs/wiki/Home.md`](docs/wiki/Home.md) | The platform wiki: features, workflows, measurement science, data dictionary, glossary |
| [`UX_AUDIT.md`](UX_AUDIT.md) | Usability/accessibility baseline, feedback rounds, resolutions, verification |
| [`data/clinicalSeed.json`](data/clinicalSeed.json) | The shared fictional fixture |
| [`scripts/generate_clinical_seed.py`](scripts/generate_clinical_seed.py) | Deterministic fixture generator |
| [`tests/`](tests) | 89 Node tests |
| [`frontend/tests/ux.spec.js`](frontend/tests/ux.spec.js) | Playwright + axe end-to-end suite |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | CI/CD pipeline |

---

*End of artifact. The wiki explains what the platform does and why the numbers mean what they mean; this document explains how it is built, tested, and shipped.*
