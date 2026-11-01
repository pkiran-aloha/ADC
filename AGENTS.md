# AGENTS.md: rules for every coding agent on this repo

This file is the single source of truth for any AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini, Jules, Aider, …) and for humans. `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` only point here. If an instruction elsewhere conflicts with this file, this file wins. **Read `docs/HANDOFF.md` first** for current state and next steps.

Welina Analytics Module: a fictional **Applied Behavior Analysis (ABA)** analytics workspace. React 19 + Vite 8 + Tailwind CSS v4 frontend, separate ASP.NET Core 8 Web API backend, one shared deterministic clinical fixture (`data/clinicalSeed.json`). GitHub Pages serves the browser-local demo. It is **not** a patient-record service, not a billing system, not a diagnostic tool.

## Two repositories, two purposes

| Remote | Repository | Role |
|---|---|---|
| `origin` | <https://github.com/pkiran-aloha/ADC> | **The working repo.** All development lands here. |
| `ghe` | <https://alohaaba.ghe.com/aloha/aba-dc-web-app-analytics> | **The organization's repo.** The maintainer syncs to it after bigger waves of development. |

Never push to `ghe` on your own initiative. When the maintainer says "push to GHE", "sync to GHE" or anything similar, they mean: take the latest code on `origin/main` and publish it to the organization repo, following [`Claude outputs/SYNC_ADC_TO_GHE.md`](Claude%20outputs/SYNC_ADC_TO_GHE.md).

## Development cycle (every session, every machine)

Development happens through agents. Every pass ends the same way.

1. **Start from the latest code.** `git fetch origin && git switch main && git pull --ff-only`. Never start from a stale local copy.
2. **One branch per pass** (`feat/…`, `fix/…`, `chore/…`, `docs/…`, `ci/…`).
3. **Keep the docs current while you work.** Update `docs/HANDOFF.md` (current state and planned work) and the other `.md` files you touch as part of the same pass, not afterwards. The handoff is how the next agent knows where things stand.
4. **Add or update tests with every change.**
5. **Verify before landing:** the frontend suite, lint, the render smoke and the production build must all pass locally. `.NET` is verified by CI only (the SDK is not installed in this workspace).
6. **Land it.** Merge `origin/main` into the branch, re-run the checks, merge the branch into `main` with `--no-ff`, and push `main` to GitHub. CI/CD publishes the demo to GitHub Pages automatically once the merge to `main` succeeds.
7. **End the pass with the repo up to date on GitHub.** After each pass, `origin/main` must carry all of the work and all of the files, with `docs/HANDOFF.md` updated to match. Never end a pass with unrecorded work: if a pass is only half-finished, commit and push the branch and record it in `docs/HANDOFF.md` under "Work started (not yet landed)" with the branch, what is done, and what is next.

Where the agent shell cannot push (no credentials), commit locally and tell the maintainer which branch to push. `docs/HANDOFF.md` must never claim work landed, passed or was pushed unless it is true in git.

## Non-negotiables

1. **No real PHI.** Every client, appointment, observation, ABC record and note is fictional. Never put real names, DOBs, member IDs or notes in code, fixtures, tests, commits or screenshots.
2. **Honest software.** Nothing transmits. UI copy must say exactly what happened and never imply an external action. The analytics are decision *support* for fictional data, not a clinical determination.
3. **Clinical semantics are load-bearing.** A blank is not a zero: `Tracked` / `ZeroOut` / `DataNotTracked` are distinct states and the difference is enforced in the recorder, the charts, the analytics and the exports. Weighted percentages aggregate raw counts, never averages of percentages. Effect-size direction follows the target's therapeutic direction.
4. **One user action, one state change.** A recording, a correction, a phase change and a status change are separate operations with a written audit trail.
5. **`main` must stay green.** Pushes to `main` run the full pipeline and publish the demo, so a broken `main` ships a broken site. Never merge with known failing tests.
6. **Smallest change that works.** No speculative abstractions, no new dependencies for what a few lines do, no unrelated refactors in a feature change.

## Commands

```sh
cd frontend
npm ci                # install
npm test              # node --test ../tests/*.test.mjs (pure logic + fixture checks)
npm run lint          # oxlint
npm run smoke         # SSR-render every analytics section
npm run build         # production bundle in dist/
npm run test:ux       # Playwright + axe (needs Chromium)
npm run preview:pages # serve the built site under /ADC/ on 4173
```

```sh
# API (CI only; the SDK is not installed in this workspace)
dotnet build backend/Welina.Analytics.sln --configuration Release

# Fixture (only when the demo data itself must change)
python3 scripts/generate_clinical_seed.py
```

On the maintainer's Windows PC `npm` fails to start; call it through node:
`node --preserve-symlinks --preserve-symlinks-main C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js <script>`, with `$env:NODE_OPTIONS="--no-experimental-webstorage"` set first.

## Layout

- `frontend/src/components/`: the five workflow screens (`overview/`, `analysis/`, `abc/`, plus the client, service-quality and reports sections), shared `ui/` primitives and `Modals/`.
- `frontend/src/utils/`: pure analytics — `stats.js`, `visualAnalysis.js`, `abcAnalytics.js`, `predictiveModels.js`, `insights.js`, `targetHealth.js`, `analyticsScope.js`, `trendExplorer.js`, `interventionTimeline.js`, `exportUtils.js`.
- `frontend/src/services/apiService.js`: the browser-local demo data service.
- `frontend/tests/`: `render-smoke.jsx` (SSR smoke) and `ux.spec.js` (Playwright + axe).
- `tests/`: `node:test` suites for the pure logic and the shared fixture.
- `backend/src/Welina.Analytics.Api/`: ASP.NET Core 8 controllers, models and analytics services. The API is a parallel implementation; the frontend does not call it.
- `data/clinicalSeed.json`: the shared fixture, embedded into the API at build time.
- `docs/wiki/Home.md`: the platform wiki (features, workflows, measurement science, data dictionary, glossary). It is documentation, not the deployed site.

## Testing rules

- Pure logic first (`node:test` in `tests/`), then the SSR smoke case, then the Playwright/axe scenario.
- Tests are date-independent. The demo clock is a fixture timestamp (`SEED_AS_OF_DATE`), not the wall clock.
- The fixture is deterministic, so exact-value assertions are practical and preferred over loose ones.
- When a change alters existing behaviour, search the suites for the old assumption and update them in the same change.
- A change to a clinical default or threshold needs a test that pins the new value, plus the matching wiki update.

## Architecture rules

- Pure measurement and analytics logic belongs in `frontend/src/utils/`, free of React, and is unit-tested in `tests/`.
- The clinical standards (IOA, fidelity, supervision, stability, non-overlap, dual-criterion, graphing, behavior reduction) live in `clinicalStandards` in the fixture. Change a threshold there, not in a component.
- The .NET API mirrors the domain model but has no integration or contract tests against the frontend. Do not assume the two implementations agree.
- The fixture is the single source of truth for demo data and is generated, not hand-edited. Regenerate it with the Python script and commit the result.
- Accessibility is part of correctness, not a later pass: semantic tables with captions, keyboard-operable drilldowns with focus return, visible focus rings, 44px targets, `prefers-reduced-motion` respected, status never carried by color alone. Every Playwright scenario carries an axe WCAG A/AA scan.
- UI copy is calm and literal. No em dashes. No emoji or unicode as icons (use Phosphor). Keep the demo honesty framing: label derived classifications as decision support with documented thresholds, and keep projections caveated.

## Git workflow

- One feature per branch, landed and green before the next.
- Conventional Commits, body explains why.
- Land with `git merge origin/main` into the branch, a green local suite and build, then `git switch main && git pull --ff-only && git merge --no-ff <branch> && git push origin main`.
- Never force-push main, rewrite published history, or delete branches or data you did not create.
- The GHE repo is private and the GitHub repo is public for the demo, so an agent may be able to read CI status on GitHub but not on GHE. The local gate is what an agent verifies.

## Docs that must stay honest

- `docs/HANDOFF.md`: current state, planned work, and anything started but not landed. Update it during the pass, not only at the end.
- `docs/wiki/Home.md`: the user-facing description of the platform. Update it when behaviour a user can notice changes.
- `UX_AUDIT.md`, `PAGE_ESTATE_AUDIT.md`, `TARGET_ANALYSIS_PANE_AUDIT.md`, `ANALYTICS_LANDING_FINDINGS.md`: the audit trail. Mark findings as implemented when they are.
- `TECH_STACK.md`: architecture, dependencies, testing, CI/CD and deployment.
- `README.md`: what the platform does and how to run it.
