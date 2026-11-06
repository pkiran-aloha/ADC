# ADR 0001: A behavior is a program with a reduction purpose

**Status:** Accepted
**Date:** 4 November 2026

## Context

The Welina platform treats Behavior Reduction as a separate module from Skill
Acquisition: its own listing, its own creation form, its own phase vocabulary
(`Open`, `Maintenance`, `Generalization`, `Completed`), and a required
**operational definition** field that has no counterpart in skill acquisition.

The Analytics workspace models things differently. Every program in the fixture
carries a `category` of either `SkillAcquisition` or `BehaviorReduction`, and
both kinds carry a `targets` array. The analytics read behavior-reduction
programs through exactly the same code path as skill programs. There is no
separate behavior collection.

The question: when the Program Management module is built, is a behavior a
separate entity, or a program with a category?

## Decision

**A behavior is a program whose category is `BehaviorReduction`.** It is not a
separate entity.

Two things are genuinely missing from the current model and are added to the
behavior program:

- **`operationalDefinition`** — the clinical statement of what qualifies as the
  behavior. Required for behavior-reduction programs, up to 5,000 characters.
  This is the artifact that makes a behavior record consistent across staff, and
  the analytics have no opinion about it either way.
- **`behaviorPhase`** — the behavior's own lifecycle, from the platform's
  behavior vocabulary. It is distinct from the phase of the behavior's target.

The behavior phase vocabulary is `Open`, `Maintenance`, `Generalization`,
`Completed`, `Pending`, `OnHold`, `Discontinued`. `Open` means *defined but not
yet reducing*. It is a pre-measurement state: never mastered, no trend, and
eligible for the attention centre's stale flag. It is **not** an alias for
`Baseline` — a baseline is data that was collected, while `Open` is a status
meaning no reduction work has started.

`Baseline` and `Acquisition` are deliberately absent from the behavior phase
vocabulary. Those are measurement concepts, and the behavior's target already
carries them.

## Consequences

- The analytics need no second path. Behavior-reduction programs are read by
  the same code that reads skill programs, with `Open` added to the non-mastered
  set and the label map.
- The program-status cascade (to `Pending`, `Completed`, `OnHold`,
  `Discontinued`) applies to a behavior program's target exactly as it does to a
  skill program's targets.
- The platform's separate behavior phase and the target's measurement phase are
  both visible on the behavior, which is the platform's own model. A reviewer
  will see two phase-like columns on a behavior; the interface must label them
  distinctly.
- A future move to a genuinely separate behavior entity would be a migration,
  not an addition. This is accepted: the platform's model is worth matching, and
  the migration cost is real but bounded.

## Alternatives considered

**A separate `behaviors` collection.** Faithful to the platform's navigation,
but it buys nothing in a single-tenant demo of five clients, and it would
require a second analytics path — the exact duplication this workspace has been
built to avoid.

**Drop the behavior phase entirely and use the target's phase.** Cheaper, but
the platform's behavior listing shows a Phase column, and the two lifecycles
answer different questions: *is this behavior being reduced?* versus *how is
the measurement progressing?*. Collapsing them loses the distinction that
makes a behavior-reduction program legible.

**Model `Open` as `Baseline`.** Rejected: a baseline is data that was
collected, and `Open` is a status meaning work has not started. Reading one as
the other would tell a clinician that a behavior has baseline data when it has
none.
