# ADR 0004: A lesson note is not a service session

**Status:** Accepted
**Date:** 4 November 2026

## Context

The Welina platform's execution layer has three things: a **lesson** (a
reusable group of programs), a **lesson note** (a dated instance of a lesson,
holding captured data and a signature), and a service session (an appointment,
in the platform's wider vocabulary).

This workspace has `serviceSessions` — 589 of them, a fixture constant, never
persisted. Each carries a date, start, end, minutes, therapist, role, service
code, setting, status, and sometimes supervision, fidelity, and setting events.
Observations link to a session through `sessionData.serviceSessionId`.

Two facts from the fixture shape the decision:

- Every one of the 490 data-bearing sessions spans **3 to 8 programs**. The
  program grouping of a session is already derivable from the data.
- 99 sessions carry no observations at all.

So a session already implies a program grouping. The genuinely new thing the
platform's lesson layer adds is a **reusable** grouping: a shape defined once
and used each time it runs.

## Decision

**Two new collections, and the service session is left alone.**

**Lesson** — `{ id, clientId, name, programIds, createdAt }`. A reusable,
named group of programs for one client. It is the thing a clinician builds once.

**Lesson note** — `{ id, clientId, lessonId, date, title, status, signature,
programIds, targetIds }`. A dated instance of a lesson, with a status of `Draft`,
`Unapproved` or `Approved`, and a signature carrying a role (`Staff`,
`Caregiver`, `Approver`) and a timestamp. It can be edited only while
`Unapproved`.

Observations gain an **optional** `lessonNoteId` alongside the existing
`serviceSessionId`. An observation may belong to a lesson note, to a session, or
to neither — the last being the manual-entry path that already exists. ABC
records gain the same optional link.

`serviceSessions` remains a fixture constant and is **not** made writable.

## Consequences

- A lesson note is about **what was planned and what was delivered**. A service
  session is about **the billable encounter** — who attended, for how long,
  under what supervision, with what fidelity. Merging them would make a note
  un-creatable without an appointment, which is wrong: a lesson runs on a
  schedule, not only on an appointment.
- The existing 3,676 observations stay valid with no `lessonNoteId` — they
  simply have no lesson note. No migration is needed, and the clinical-seed
  integrity suite keeps passing.
- The derived program grouping of a session (3–8 programs) stays derivable. The
  lesson layer adds a *declared* grouping on top of an *observed* one, and the
  interface can show the difference: what was planned against what was
  delivered.
- Data capture into a lesson note reuses the existing recorder, pre-loaded with
  the note's targets. A separate capture interface is not built, so there is one
  validation surface for all six measurement types rather than two that can
  disagree.
- Making `serviceSessions` writable was deliberately avoided. It is a fixture
  constant; turning it into a persisted collection would mean the fixture's
  supervision, fidelity and setting-event data could be edited, which is a
  different feature with a different honesty burden.

## Alternatives considered

**Make the service session the lesson note.** Cheapest, and it reuses an
existing dated container. Rejected: `serviceSessions` is a fixture constant, so
a user-created note would have nothing to attach to unless that collection
became writable — a larger change than adding two new collections — and a
session's identity is its appointment, not its plan.

**Use a `lessonId` on the existing session and call appointments "lesson
notes".** Rejected for the same reason, plus it conflates the plan with the
encounter.

**No lessons; show the derived program set on the session view.** Rejected: it
gives no reusable grouping, and the platform's "Add to Lesson" is the mechanism
that makes a plan executable rather than merely described.

**A lesson note owning its own data format.** Rejected: it would fork the
observation model that every analytic reads.
