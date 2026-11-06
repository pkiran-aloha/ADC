# ADR 0003: Program Management persists in the browser, not a backend

**Status:** Accepted
**Date:** 4 November 2026

## Context

Program Management is the first module in this workspace whose job is to
*change* things. Everything built so far — the overview, target analysis, ABC
observations, service quality, reports — reads a deterministic fixture.

There is a .NET Core 8 API in the repository. It is a parallel implementation:
the frontend does not call it, it has no integration or contract tests against
the frontend, and the SDK is not installed in this workspace, so it is verified
by CI only. There is no authentication, no user model and no database behind it.

The workspace's own rules are firm on two points: nothing transmits, and the
interface must say exactly what happened and never imply an external action.

## Decision

**Program Management writes to the existing browser-local store.** The pattern is
the one `apiService` already uses: one persisted collection per entity kind,
each with a storage key, loaded at construction and written on change, with a
snapshot published so every screen re-reads automatically.

New persisted collections follow the existing pattern exactly. The fixture stays
the read-only baseline, and a seed-version mismatch resets browser-local data
to the fixture, as it does today.

The .NET API is **not** extended with a write path in this work.

## Consequences

- The module is fully functional as a demo: a clinician creates a program,
  defines a target, captures data into a lesson note, and watches the analytics
  respond — in one browser, with no server.
- Every write is honestly describable. The interface says data is saved in this
  browser; the existing reset-to-demo-data control restores the fixture.
- The shape of the persisted data is what a real backend would return, so a
  later migration to the API is an addition at the service boundary rather than
  a redesign of the domain.
- There is no multi-user story, no shared workspace and no server-side audit.
  The activity log is a local record of local changes. Nothing in the interface
  may imply otherwise.
- The .NET API and the frontend can continue to drift, as `docs/HANDOFF.md`
  already records. This decision does not make that worse, and it does not fix
  it.

## Alternatives considered

**Extend the .NET API with a write API and make the frontend call it.** This is
the destination state. Rejected for this pass because the SDK is absent from
this workspace (CI-only verification), because it needs authentication and a
database before it is honest, and because it would put an untested contract
between the frontend and a service that has never been exercised by the
frontend.

**Keep the module read-only.** Rejected: the module's entire purpose is
authoring. A read-only Program Management is a second copy of the analytics.

**A separate localStorage namespace for Program Management state.** Rejected:
it would fork the store. The existing store's snapshot mechanism, its
seed-version reset and its per-collection write discipline are all reusable, and
a second namespace would mean two sources of truth for the same program.

**Simulated writes with no persistence.** Rejected outright. The workspace's
rules forbid an interface that implies an action it did not perform.
