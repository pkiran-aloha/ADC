# ADR 0002: Archived means inactive, not deleted

**Status:** Accepted
**Date:** 4 November 2026

## Context

The Welina platform says archived programs "are excluded from analytics and
active workflows". Read literally, archiving a program would remove its
targets' observations from the charts.

In this workspace that is a materially different act. The fixture holds 3,676
observations across 66 targets; behavior-reduction programs alone account for
1,065 of them. Removing a program's data from the charts because someone tidied
a list is the opposite of what a clinical record should do.

The platform's intent, read in context, is that an archived program should not
drive *today's* decisions — not that the past should disappear.

## Decision

**Archiving removes a program from active surfaces and retains its data.**

An archived program:

- leaves the **portfolio triage** attention list and the **recent successes**
  feed;
- leaves the **weekly progress map** and the **target health matrix**'s active
  rows;
- is **excluded from the mastery counts** — an archived target is not a
  mastered target;
- does not appear in the Program Management listing's default view; it appears
  under the archived list.

An archived program:

- **keeps its observations on the charts**, marked as archived where it is
  plotted;
- **keeps its phase history, phase lines and status history**;
- can be **unarchived**, returning it to the active list.

Archived behavior-reduction programs behave the same way.

## Consequences

- Two concepts must be kept apart in the code: *active* (the program's current
  state, used to decide what surfaces it in) and *archived* (a retained
  historical state). A program is never both.
- The analytics need an `archived` filter rather than a removal step. The
  health matrix and the weekly map gain an "exclude archived" rule; the chart
  renderers gain an archived marker.
- A user who archives a program sees the dashboard change — that is intended —
  but does not see holes appear in the graphs. This is the behaviour a clinical
  record requires, and it is the difference between the platform's literal
  wording and its intent.
- The platform's own wording is not reproduced verbatim. Where the interface
  describes archiving, it says the program is archived and its history is kept,
  rather than claiming it is excluded from analytics.

## Alternatives considered

**Hard exclusion, as written.** Matches the platform's text exactly, and is the
simplest to implement. Rejected because archiving would silently erase
collected data from the charts, and because a user who archives a program would
see a broken-looking dashboard with no explanation.

**Hard exclusion plus a "show archived" control.** Preserves the literal text
and lets a user reveal what disappeared. Rejected: a reveal control is
future-scope work, and the underlying erasure still happens on the default
view.

**Archive with no analytics effect at all.** Rejected: then archiving is
cosmetic, and an archived program would still drive triage and mastery counts,
which is the opposite of what the platform means by it.
