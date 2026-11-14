# ADR 0006: Three scopes, and a library that keeps learners out

**Status:** Accepted
**Date:** 6 November 2026
**Supersedes:** the "organization and public scopes are out of scope" line in the Program Management spec.

## Context

The first build of Program Management recorded `scope: client` on every program and left
the other two scopes for later, as the spec allowed. The source document is clear that
they are not an extra: scope is "one of the most important concepts" in the module,
because it says where a program lives and who can use it. Without it a practice cannot
standardize a program across clients, and the "Add to organization", "Add to client" and
wipeout rules, which the document spends several sections on, have nothing to act on.

Two things made it riskier than it looks. First, the analytics read every program in the
store. A library entry that sat among client programs would show up in the overview, the
mastery counts and the recorder of whichever client it was filed under. Second, moving a
program out of a client carries a privacy duty: the baseline, objective, teaching
instructions and target instructions of one learner must not travel into a shared list.

## Decision

**There are three scopes, and the two libraries are kept apart from client data.**

- **Client** programs stay in the existing collection, each with a `clientId`, and are the
  only thing the analytics read.
- **Organization** programs live in their own persisted collection with no `clientId`. A
  library program has no learner, so it has no phases, charts or analytics, and the
  analytics never see it.
- **Public** programs are a fixed, read-only, fictional set shipped with the app. They are
  never written to the browser.

**A copy is a new program.** Adding to the organization or to a client copies the program
and its targets with new identities, the status Pending, targets Pending (a behavior and its
target Open), no phase history, and no recorded mastery decision. The target definition,
measurement settings and mastery rule are kept, because they are what standardizing means.

**Leaving a client clears the learner's text.** Copying from a client into the organization
library clears four fields: teaching instructions, program objective, baseline and target
instructions. The interface warns first, listing them. The source is never touched. The
history of the copy records exactly what was cleared, or that nothing was present, so the
clearing is auditable whether or not there was anything to clear. Copying into a client
clears nothing, because the library holds nothing about a learner. Copying from the public
library also clears nothing.

**Only the client scope has ABC recording and lesson notes**, because both are always about
one learner. Those tabs are present but unavailable in the other scopes, with the reason.

**Library programs relax one rule.** Teaching instructions are required for a client program
and optional in the library, because they are the text that is cleared on the way in.

## Consequences

- Every store method that looks a program or target up by identity searches both the client
  and the library collections, so editing, archiving, duplicating and the status cascade work
  the same way in the library. Methods that act on a client's analytics (phase lines, lessons,
  lesson notes) keep to the client collection.
- Status, behavior phase and scope can no longer be changed by a plain edit. A status moves
  only through its own action, which cascades to targets, writes the dated history and offers
  the phase line. This closes a gap where editing a program's status in the form bypassed all
  three.
- A library program changes status without the phase-line question, since there is no chart.
- The public library needs no storage and cannot go stale, but it is a fixed set. On the
  platform a super user manages it. The demo says so.
- A copy that cleared fields has fewer fields than its source. That is intended, and it is why
  those fields are optional on the library form.

## Alternatives considered

**One collection, with a scope field.** The smallest change, and it keeps `scope` honest. Rejected:
every consumer of programs would have to remember to filter by scope, and one forgotten filter
would put a library entry into a learner's overview. Keeping the library apart makes the safe
behaviour the default.

**Clearing the fields in the interface, not in the copy.** Rejected: the privacy rule has to hold
for every route, including the bulk route and any later one, so it lives in the one function that
makes a copy.

**Copying the learner's progress along with the program.** Rejected: a library entry that arrives
mid-way through someone's treatment is not a template, and carrying phase history across clients
would let one learner's record appear in another's.
