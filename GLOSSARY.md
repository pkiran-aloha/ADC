# Glossary

The domain language of the Welina Analytics workspace. Terms here mean what this
document says they mean, everywhere in the code, the interface and the wiki.

This is a glossary, not a specification. It defines words. It does not describe
behaviour, and it carries no implementation detail.

## The plan

**Program** — A named plan for one client: what is taught or reduced, how it is
delivered, and what it is trying to achieve. A program belongs to exactly one
client. It is the unit a clinician authors, reviews and moves through its
lifecycle.

**Behavior** — A program whose purpose is to reduce something: a behavior is a
program with a reduction purpose, not a separate kind of thing. A behavior
carries an **operational definition**, the statement of exactly what qualifies
as the behavior, so that two staff record it the same way.

**Target** — One measurable unit inside a program: a single thing that will be
recorded during a session. A program with no targets is documentation; a
program with targets is executable. A behavior-reduction program carries exactly
one target.

**Measurement tool** — The way a target's data is collected. Six tools exist:
trial by trial, frequency, duration, interval data, anecdotal, and fluency/rate.
A target's measurement tool is fixed once data exists against it, so that
measurements stay comparable.

**Mastery** — The judgement that a target has been learned to criterion. Mastery
is either reached automatically from a stated rule, or decided by a clinician.
Either way it is explainable: a rule says what was measured, and a decision says
who decided and when.

**Phase** — Where a target sits in its own progression, from not yet started
through acquisition, maintenance and generalization to completed, plus the
paused and ended states. A phase describes a *measurement's* progress.

**Program status** — Where a program sits in its own lifecycle. It is a broader
question than phase: a program can be teaching while its individual targets are
at different phases, but a program that is pending, completed, on hold or
discontinued carries its targets with it.

**Behavior phase** — Where a behavior sits in *its* lifecycle: open, meaning
defined but not yet reduced; maintenance; generalization; completed; plus the
paused and ended states. It is distinct from the phase of the behavior's target,
which describes the measurement rather than the behavior.

**Scope** — Where a program lives and who may use it. Client scope is a single
client's working plan. Organization scope is a shared internal library. Public
scope is a broadly shared library. Only client scope exists today.

**Archived** — A program or behavior that is no longer active but is not
deleted. Archiving tidies the working list. It never removes the record or the
data collected against it.

**Duplicate** — A copy of a program, its fields and its targets, with new
identities, no observations and no history. A duplicate begins again.

## The delivery

**Lesson** — A reusable, named group of programs for one client: the shape of a
recurring session, defined once and used each time it runs.

**Lesson note** — A dated instance of a lesson: one occurrence of that session,
with what was planned, what was recorded, and who signed for it. A lesson note's
**status** says whether its content can still change.

**Service session** — An appointment: a date, a time, a clinician, a setting,
and the supervision and fidelity checks that belong to it. A service session is
not a lesson and not a lesson note; it is the billable encounter that a lesson
note may sit inside.

**Session number** — The count of observations recorded against one target.
It counts that target's records, not the appointments they were taken in.

**Observation** — One recorded measurement. It belongs to a target, carries the
time it was taken and who took it, and may belong to a service session, to a
lesson note, or to neither when it was entered manually.

**Recorded data** — The set of observations held for a client. The blank is not
a zero: a target with no observations has no measurement, which is a different
statement from a target measured as zero.

**ABC record** — One structured observation of what happened before a behavior,
what the behavior was, what followed it, and where it occurred.

**ABCL value** — A reusable item in one of the four ABC vocabularies: an
antecedent, a behavior, a consequence or a location. The four lists are
configuration; the records are the evidence.

**Setting event** — A context that may change the likelihood of a behavior, such
as poor sleep or a schedule change. Setting events are recorded against a
session or a behavior observation.

## The record

**Phase line** — A dated, labelled marker on a chart, recording that something
changed at that point. It is the visual trace of a phase or status change.

**Phase range** — A dated span marked on a chart, recording a period rather
than an instant.

**Graph note** — A dated note attached to a target's chart, carrying context
that a data point cannot.

**Activity log** — The running record of every change made to a plan: what
changed, when, and to which entity. It is what makes a change traceable.

**Deletion audit** — The record kept when an observation is removed. The
observation leaves the data; the audit entry stays.

## The analysis

**Program analytics** — The summary of a program's progress, read from its
targets and their records. It is the same analysis the target charts provide,
seen at the level of the whole program.

**Decision support** — A conclusion the analytics offer about fictional data,
with the threshold it came from stated. The analytics inform a judgement; they
do not make one.
