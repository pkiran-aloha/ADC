# Welina Analytics Module (Web)

An interactive, clinical data visualization and reporting platform for **Applied Behavior Analysis (ABA)**, built with **.NET Core 8 (ASP.NET Core Web API)** and **React 19**, deployed to **GitHub Pages**.

---

## Live Demo & GitHub Pages
- **GitHub Pages URL**: [https://pkiran-aloha.github.io/ADC/](https://pkiran-aloha.github.io/ADC/)
- **Repository**: [pkiran-aloha/ADC](https://github.com/pkiran-aloha/ADC)
- **Deployment**: The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and publishes the frontend.

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
│   │   │   ├── Header.jsx                 # Client selector, quick trial recorder
│   │   │   ├── Sidebar.jsx                # Welina web platform navigation
│   │   │   ├── OverallMasterySection.jsx  # Section A: Cumulative mastery graph
│   │   │   ├── ClientSpecificSection.jsx  # Section B: Granular target analytics
│   │   │   ├── AbcDataSection.jsx         # Section C: ABCL contextual behavior
│   │   │   └── Modals/                    # Phase lines, ranges, notes, trials
│   │   ├── services/apiService.js         # LocalStorage demo analytics service
│   │   ├── utils/exportUtils.js           # SVG, PNG, CSV & Zip exporters
│   │   └── data/mockData.js               # Shared fixture adapter
│   └── vite.config.js                     # GitHub Pages subfolder config
├── data/clinicalSeed.json                # Shared fictional clinical fixture
├── scripts/generate_clinical_seed.py     # Reproducible fixture generator
├── tests/clinicalSeed.test.mjs           # Fixture integrity and demo-service tests
├── docs/                                  # Pre-built static bundle for GitHub Pages
└── .github/workflows/deploy.yml           # Automated CI/CD deployment to Pages
```

---

## Fictional Demo Seed

`data/clinicalSeed.json` is the **single source of demo data** for the GitHub Pages frontend and the .NET in-memory API (embedded at build time). As of **2026-10-14**, it contains 3 fictional clients, 13 Skill Acquisition (SA) programs with multiple targets where appropriate, 9 **unitary** Behavior Reduction (BR) programs, 38 targets, 297 session observations, and 42 ABC entries. It covers all 8 program statuses and 8 target phases. No real patient data is included.

- SA targets exercise Trial by Trial, Frequency, Duration, Interval Data, Anecdotal, and Fluency/Rate. BR targets exercise only Frequency, Duration, and Interval Data. Each numeric observation carries tool-appropriate counts, seconds, intervals or probe minutes; anecdotes carry narrative text. An explicit BR zero means *observed with no occurrence*; `DataNotTracked` means *no measurement* and is omitted from analytics but retained in raw exports.
- Program definitions include objectives, teaching instructions, optional tags, baseline, treatment area, master-defined custom fields, and actual downloadable demo learning materials. Target definitions include discriminative stimuli, manual/automatic mastery, prompt-template references **only** for Trial by Trial, interval start/length/capture/count **only** for interval targets, and count-up/down start types **only** for Fluency/Rate. Expand **Program definition** in Section B to inspect these settings.
- Each client's ABC setup contains treatment area, teaching instructions and textual lists of antecedents, behaviors, consequences and locations. The 42 event records select from those lists. Expand **ABC recording setup** in Section C to inspect the catalog.
- The frontend demo stores editable records in localStorage. The first load after a fixture change (detected by a content-derived revision) replaces old **demo** localStorage records; **Reset Demo Data** restores the fixture again. The `asOfDate` is fixed so date filters illustrate the same story on every run. This is a demo fixture, not a production database or program-creation/upload implementation.

To change the fixture, edit `scripts/generate_clinical_seed.py`, then run:

```bash
python3 scripts/generate_clinical_seed.py
cd frontend && npm ci && npm test && npm run build
```

`npm test` checks cross-references, conditional fields, clinical measurement consistency, date windows, ABC catalogs, migration, and generator reproducibility. The API additionally exposes `GET /api/programs/catalogs` and `GET /api/abcanalytics/configuration?clientId=cli-liam`.

---

## PRD Features Implemented

### 1. Landing Page & Client Selection (Sections 3 & 4)
- **Initial Landing State**: When no client is selected, all sections and widgets remain inactive/disabled with the prompt: *"Please select a client at the top to view data."*
- **Client Selector**: Dropdown supporting client selection (e.g., Liam Miller, Emma Watson, Noah Davis). Selecting a client dynamically loads and unlocks all analytics sections.

### 2. Section A: Overall Targets Mastered (Section 5)
- High-level cumulative view of target mastery over time within a selected program.
- **Mastered Target Definition**: Targets in `Maintenance`, `Generalization`, or `Completed` state.
- **Change Tracking & Aggregation**: Only transition dates are plotted; multiple changes on the same date are aggregated into a single cumulative data point.
- **Export Options**: Download as **SVG**, **PNG**, or **CSV**.
- **Empty States**: Clear messaging when no mastered targets exist (`"No data available."`).

### 3. Section B: Client-Specific Program and Target Data (Sections 6–21)
- **Program & Behavior Selection Dropdown**:
  - Two distinct tabs: **Skill Acquisition (SA)** and **Behavior (BR)**.
  - Multi-behavior selection support (Section 19): compare multiple problem behaviors simultaneously with distinct series colors.
- **Dynamic Conditional Target Type Tabs** (Section 9.4):
  - Renders *only* target types that have recorded data (`Trial by Trial`, `Duration`, `Frequency`, `Interval Data`, `Anecdotal`, `Fluency / Rate`). First tab with data opens by default.
- **Target Type Visualizations**:
  - **Trial by Trial**: % accuracy with fractional response badge (`100% (5/5)`).
  - **Duration**: Formatted as `MM min SS sec` (e.g. `02 min 38 sec`). View dropdown: `Total Duration`, `Total Count`, `Average Duration` (Section 15).
  - **Frequency**: Raw frequency count and rate-normalized view (`Frequency ÷ Lesson Time`).
  - **Interval Data**: % of intervals with occurrence count (`(occurred / total intervals)`).
  - **Anecdotal Data**: Structured qualitative table grouped by target name, `All Targets (XX)` header, reverse chronological sort, target & duration filters (Section 5).
  - **Fluency / Rate**: Interactive switch between `Rate per Day`, `Rate per Minute`, `Rate per Hour`, rounded to 2 decimals (Section 6).
- **Behavior Reduction Tracking Handling** (Section 8):
  - Prompt: `Zero Out` (plots 0 to confirm absence of behavior) vs `Data Not Tracked` (skips point).
  - Toggle to show/hide dates with no data.
- **Aggregation Views** (Section 18):
  - `Per Day`, `Per Session` (with session pagination), `Weekly` (Mon–Sun average), `Monthly` (calendar month average).
- **Split Data by Therapist** (Section 17):
  - Available when single target selected; individual series per therapist with color-coded legend and visibility checkboxes.
- **Analytical Overlays**:
  - **Average Line** (Section 13): Horizontal line at mean Y-value with hover tooltip.
  - **Trend Line** (Section 14): Directional path and Linear Regression best fit (`y = mx + c`).
- **Annotations & Visual Markers** (Sections 10 & 11):
  - **Phase Change Lines**: Solid (chart visually breaks at phase point) or Dotted. Prompt triggers on target phase update.
  - **Phase Ranges**: Shaded time period bands.
  - **Graph Notes**: Observation pin markers with therapist attribution.
- **Chart Customization & Footer** (Sections 10 & 12):
  - Title customization (defaults to Program/Behavior name or "Multiple Behaviors").
  - Gridlines toggle & Color mode (`System Color` vs `Black & White`).
  - Target visibility legend (unchecking all targets renders blank chart).
  - Consolidated annotation summary with Edit and Delete options.
- **Raw Data Export & Multi-Selection Zip** (Section 21 & Future Scope #1):
  - Export trial-level non-aggregated CSV.
  - Multi-target structured ZIP package download.

### 4. Section C: ABC Data Recording (Section 24)
- Contextual behavior analysis using the **Antecedent–Behavior–Consequence–Location (ABCL)** model.
- **3 Interchangeable Views**:
  - `Graph`: Stacked bar chart showing daily distribution of behavior types with interactive tooltips.
  - `Data`: Structured table with columns: `Date & Time`, `Therapist`, `Antecedents`, `Behaviors`, `Consequences`, `Location`, `Notes`. Multi-value entries separated with subtle darker borders for high readability (Section 24.5).
  - `Graph + Data`: Stacked bar chart on top, synchronized data table below.
- Duration filter (`Past 1 Month` default, `Past 7 Days`, etc.), Gridline toggle, and Raw CSV Export.

---

## How to Run Locally

### 1. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

To build for production / GitHub Pages:
```bash
npm run build
```

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
1. In repository **Settings** ➔ **Pages**, set **Build and deployment** ➔ **Source** to **GitHub Actions**.
2. The workflow in `.github/workflows/deploy.yml` builds the React frontend and deploys it when a configured deployment branch is updated. It can also be run manually from the **Actions** tab using **Run workflow**.
3. The site is published at [https://pkiran-aloha.github.io/ADC/](https://pkiran-aloha.github.io/ADC/).
