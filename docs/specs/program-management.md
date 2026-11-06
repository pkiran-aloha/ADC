# Spec: Program Management module

**Status:** ready for tickets
**Source:** `Program Management.docx` (the Welina web platform program-management guide), extended per the decisions below.
**Target repo:** `pkiran-aloha/ADC` (`origin`); mirrored to GHE after landing.

---

## Problem Statement

A clinician running the Welina Analytics demo can see what happened, but cannot change what is planned. Everything downstream of a program — targets, sessions, observations, analytics — exists in a committed fixture that no one can edit. The analytics are therefore trustworthy about the past and powerless about the future: when a target needs a new mastery criterion, when a behavior needs an operational definition, when a program has been paused, when a session's data must be corrected, the platform has no place to record it.

Program Management is the module that closes that gap. It is where a program is defined (what is taught, how, and how progress is measured), where a target is specified (what will be recorded during a session), where a behavior is operationally defined, where lessons group programs for delivery, and where the clinician captures session data against all of it.

The product constraint is unchanged and non-negotiable: **nothing transmits**. Every change made here is browser-local, immediately visible in the existing analytics, and honest about being a demo.

## Solution

A new **Programs** workflow alongside the existing five, containing three tabs (Skill Acquisition, Behavior Reduction, ABC Data Recording) over one client-scoped workspace, with:

- **Program authoring** — create, edit, duplicate, archive and unarchive programs and behaviors; define targets with their measurement, phase, mastery rule and type-specific configuration.
- **Plan-to-execution** — reusable lessons group programs; lesson notes are dated instances of a lesson where session data is captured against the lesson's programs and targets, using the existing recorder.
- **Analytics integration** — every program, target and behavior is a door into the analytics that already exist. A program links to its targets' charts; a target links to the existing trend explorer with that target selected; changes made here show up immediately in the overview, health matrix, weekly map and reports.
- **Honest write surface** — every mutation is one user action, one state change, persisted in the browser, written to an activity log, and reflected in the analytics without a reload.

## User Stories

### Navigation and scope

1. As a clinician, I want a **Programs** entry in the workflow navigation, so that authoring is a first-class part of the workspace rather than a hidden mode.
2. As a clinician, I want the Programs workflow to be **client-scoped**, so that every program I see belongs to the client I am working with.
3. As a clinician, I want the Programs workflow to be **unavailable until a client is selected**, so that I never edit a client's plan by accident.
4. As a clinician, I want the three tabs — **Skill Acquisition**, **Behavior Reduction**, **ABC Data Recording** — to carry a **count of items** for the selected client, so that I can see the shape of the caseload before clicking.
5. As a clinician, I want the **ABC Data Recording tab disabled until a client is selected**, so that observations are never entered against an ambiguous learner.
6. As a clinician, I want a **deep link** to the Programs workflow (and to a specific program) so that I can share a link to a plan I am discussing.
7. As a clinician, I want the Programs workflow to honour the **view-only access level**, so that a read-only session cannot alter a plan.

### Listing and search

8. As a clinician, I want a **listing of skill acquisition programs** showing program name, number of targets, lesson membership, tags, status and actions, so that I can scan the caseload without opening anything.
9. As a clinician, I want a **listing of behaviors** showing behavior name, measurement tool, treatment area, phase, tags and actions, so that I can scan the reduction caseload.
10. As a clinician, I want **real-time search** across program name, tags, lesson name and status, so that I find a program by typing rather than scrolling.
11. As a clinician, I want **real-time search** across behavior name, tags, measurement tool, treatment area and phase, so that I find a behavior by typing rather than scrolling.
12. As a clinician, I want search to be **case-insensitive and partial-match**, so that "intro" finds "Introduction to Programming".
13. As a clinician, I want a **clear button** on the search field, so that I can restore the full list in one click.
14. As a clinician, I want a **"No results found"** message when a search matches nothing, so that I know the search ran and there is simply no match.
15. As a clinician, I want lists **sorted alphabetically by default**, so that the order is predictable.
16. As a clinician, I want to **combine a search term with a status filter**, so that I can narrow to "programs in Generalizing whose name mentions expressive".
17. As a clinician, I want to see **archived programs separately** from active ones, so that the working list stays focused.

### Skill acquisition programs

18. As a clinician, I want to **create a skill acquisition program** with a name, status, treatment area, baseline, objective, teaching instructions, tags, learning materials and custom fields, so that the plan is complete before anyone runs it.
19. As a clinician, I want the **program name capped at 100 characters**, so that listings stay readable.
20. As a clinician, I want the **baseline and objective capped at 1,000 characters** and the **teaching instructions capped at 1,000 characters**, so that each field stays one purposeful piece of writing.
21. As a clinician, I want to **choose a status from the platform's eight values** (Baselining, Teaching, Maintaining, Generalizing, Completed, Pending, On Hold, Discontinued), so that the program says where it stands.
22. As a clinician, I want to **add multiple treatment areas and tags by pressing Enter**, with each removable, so that categorisation does not need a free-text sentence.
23. As a clinician, I want a partially typed tag **saved when I move to the next field**, so that I never lose one to a stray click.
24. As a clinician, I want the **Save button disabled until every required field is complete**, with the missing fields highlighted, so that a half-defined program cannot be created.
25. As a clinician, I want the missing-field state to be visible **per section**, so that I know where to go.
26. As a clinician, I want to **cancel with a confirmation** when I have unsaved changes, so that I do not lose work to a stray click.
27. As a clinician, I want to be **offered the chance to add targets immediately after creating a program**, so that I finish the definition in one flow.
28. As a clinician, I want to **decline and land on the listing** if I am not ready for targets, so that creating a program is not blocked by its next step.
29. As a clinician, I want a **confirmation message** after any successful save, so that I know it worked.
30. As a clinician, I want to **attach learning materials** to a program, so that the staff running it have the context.
31. As a clinician, I want the material limits **enforced and stated** (a small number of files, a modest size), so that I know what will save.
32. As a clinician, I want to be told **plainly that materials are saved in this browser**, so that the demo never implies a file reached a server.
33. As a clinician, I want to **fill the practice's custom data fields** (preferred reinforcer, generalization setting, caregiver practice) on a program, so that the organization's required inputs are captured.
34. As a clinician, I want to **edit a program** with all prior values filled in, so that I modify rather than recreate.
35. As a clinician, I want to **duplicate a program**, copying its fields and its targets, so that I reuse a structure instead of retyping it.
36. As a clinician, I want the **duplicate to be independent** of the original, so that changing it does not change the source.
37. As a clinician, I want a duplicate to **start in Pending with no phase history**, so that a new copy is not treated as already generalised.
38. As a clinician, I want to **archive a program** with a confirmation, so that an inactive plan leaves the working list without being deleted.
39. As a clinician, I want to **unarchive** a program with a confirmation, so that a paused plan can come back.
40. As a clinician, I want an archived program to **keep its history and its recorded data**, so that archiving tidies the list without erasing the record.
41. As a clinician, I want to know that a program **cannot be both active and archived**, so that the list is never ambiguous.
42. As a clinician, I want to **change a program's status directly from the listing**, so that I do not open it to move it forward.
43. As a clinician, I want a **status change to be recorded with a reason, date and clinician name**, so that the history explains itself.
44. As a clinician, I want changing a program to **Pending, Completed, On Hold or Discontinued to cascade to its targets' phases**, so that program and target agree.
45. As a clinician, I want changing a program to **Baselining, Teaching, Maintaining or Generalizing to leave its targets alone**, so that individual targets keep progressing on their own.
46. As a clinician, I want to be **asked whether to plot a phase change line** whenever a phase or status changes, so that the chart reflects the decision I made.
47. As a clinician, I want the phase-line prompt's **Cancel to abort the change entirely**, so that a mis-click changes nothing.
48. As a clinician, I want a phase line to carry a **label, a date and a marker style**, so that the chart explains what happened and when.

### Targets

49. As a clinician, I want to **see a program's targets as cards** showing name, measurement tool, mastery setting, discriminative stimuli, phase and date, so that the structure is legible at a glance.
50. As a clinician, I want **tabs per measurement type** (Trial by Trial, Frequency, Duration, Interval Data, Anecdotal, Fluency/Rate) with an "All" tab, so that I can focus on one way of measuring.
51. As a clinician, I want **a type tab hidden when no target of that type exists**, so that the interface does not offer empty choices.
52. As a clinician, I want **no tabs at all when a program has no targets**, so that the absence is obvious.
53. As a clinician, I want to **create a target** with a name, type, phase, discriminative stimuli, mastery setting and instructions, so that sessions have something to record against.
54. As a clinician, I want to **enter several target names at once**, each becoming its own target, so that I can build a family of similar targets quickly.
55. As a clinician, I want a **prompt hierarchy required for Trial by Trial targets**, so that assistance levels are defined before teaching starts.
56. As a clinician, I want **interval settings required for Interval Data targets** (start type, interval length, capture type, optional interval count), so that the observation window is defined.
57. As a clinician, I want **timer settings required for Fluency/Rate targets**, so that the run format is defined.
58. As a clinician, I want the **mastery rule** to be either automatic (a measure, comparison, threshold and consecutive-session count) or manual (a clinician's decision with a date), so that mastery is always explainable.
59. As a clinician, I want to **edit a target** while keeping its measurement type fixed, so that collected data stays comparable.
60. As a clinician, I want to **delete a target with a confirmation**, so that a mis-click does not remove a measurable unit.
61. As a clinician, I want to **delete several targets at once with a confirmation**, so that cleanup is one action.
62. As a clinician, I want targets **ordered by phase, then alphabetically**, so that progression is readable down the list.
63. As a clinician, I want to **see the target count, the mastered count and a completion percentage** on a program, so that I know how far along the program is.
64. As a clinician, I want the **mastered count to exclude paused, ended and pending targets**, so that a discontinued target is never counted as an achievement.
65. As a clinician, I want to **click a target to open its chart in target analysis**, with that target selected, so that definition and measurement sit side by side.
66. As a clinician, I want a **phase-change prompt when I change a target's phase from the program view**, so that the chart records the transition.

### Behavior reduction

67. As a clinician, I want to **create a behavior** with a name, measurement tool, treatment area, baseline, objective, operational definition, tags, phase and attachments, so that the behavior is defined before it is counted.
68. As a clinician, I want a **required operational definition** that states exactly what qualifies as the behavior, so that two staff record it the same way.
69. As a clinician, I want the **measurement tool locked after creation**, so that data collected under one method is never compared against another.
70. As a clinician, I want the behavior's **measurement tool chosen from Frequency, Duration or Interval**, so that the counting method matches the behavior.
71. As a clinician, I want **interval configuration** (start type, length, number of intervals, capture type) required when the tool is Interval, so that the observation window is defined.
72. As a clinician, I want the behavior's **phase chosen from Open, Maintenance, Generalization, Completed, Pending, On Hold or Discontinued**, so that the behavior's own lifecycle is visible separately from its target's measurement progress.
73. As a clinician, I want **Open to mean "defined, not yet reducing"** — and to read that way in the analytics — so that a behavior awaiting work is not mistaken for one already mastered.
74. As a clinician, I want to **import behaviors from Behavior Reduction into the ABC behavior list**, so that one vocabulary serves both.
75. As a clinician, I want to **edit a behavior** with everything prefilled, keeping the measurement tool fixed.
76. As a clinician, I want to **duplicate, archive and unarchive a behavior** with the same semantics as a program.
77. As a clinician, I want a **Behavior View** showing the definition, the phase control and the behavior's analytics together, so that I do not move between screens to understand it.
78. As a clinician, I want a **behavior's phase changeable from the Behavior View**, so that I can update it without entering edit mode.
79. As a clinician, I want a behavior's **archived state to remove it from active workflows while keeping its recorded data**, so that history is preserved.

### ABC data recording configuration

80. As a clinician, I want to **see the client's treatment area and teaching instructions** for ABC recording, so that the capture context is explicit.
81. As a clinician, I want to **add, edit and remove antecedent, behavior, consequence and location values**, so that the vocabulary is standardised for the team.
82. As a clinician, I want to **remove several values at once with a confirmation** naming them, so that a bulk delete is deliberate.
83. As a clinician, I want to be **warned how many existing observations use a value I am about to delete**, so that I do not silently orphan the record.
84. As a clinician, I want the warning to let me **proceed if I choose**, so that the vocabulary can still be cleaned up.
85. As a clinician, I want an **existing observation to keep its recorded text** even after the value leaves the list, so that the observation remains readable.

### Lessons and lesson notes

86. As a clinician, I want to **create a lesson** as a named, reusable group of programs for a client, so that a recurring session shape is defined once.
87. As a clinician, I want to **add programs to a lesson**, so that the lesson reflects what will actually be run.
88. As a clinician, I want to **create a lesson note** — a dated instance of a lesson — so that a session has a record of what was planned.
89. As a clinician, I want a lesson note's **status to be Draft, Unapproved or Approved**, so that I know whether its content can still change.
90. As a clinician, I want to **edit a lesson note only while it is Unapproved**, so that an approved record is not quietly rewritten.
91. As a clinician, I want a lesson note to **carry a signature with a role** (Staff, Caregiver, Approver) and a timestamp, so that responsibility for the record is explicit.
92. As a clinician, I want to **capture session data into a lesson note**, across its programs' targets, so that what was planned and what was recorded live together.
93. As a clinician, I want the capture to use the **same recorder and the same validation** as the rest of the app, so that a lesson note's data is as trustworthy as any other.
94. As a clinician, I want to **record ABC observations into a lesson note** as well, so that behaviour observations and skill data share one session.
95. As a clinician, I want a lesson note's data to **appear in the analytics** immediately, so that the plan and the evidence stay in step.
96. As a clinician, I want to **see which programs a session touched**, so that I know what was actually delivered.

### Analytics integration

97. As a clinician, I want a **program's summary widgets** (total targets, mastered targets, completion percentage) on the program view, so that I know the state of the program without opening each target.
98. As a clinician, I want to **open a program in target analysis** with its targets in scope, so that the plan and its measurement are one step apart.
99. As a clinician, I want a **status change made here to be reflected in the portfolio triage, the health matrix and the weekly map**, so that today's decisions use today's plan.
100. As a clinician, I want an **archived program to leave the active surfaces** (triage, weekly map, mastery counts) while its recorded data stays on the charts, so that the list is tidy without losing the past.
101. As a clinician, I want a **newly created target to appear in the analytics with no recorded data** — as a target with nothing measured, not as a zero — so that the blank is never read as a measurement.
102. As a clinician, I want **everything I change to be reflected without a reload**, so that the app never shows me a stale plan.

### Audit and honesty

103. As a clinician, I want every change I make **written to an activity log** with what changed, when and which entity, so that the plan's history is traceable.
104. As a clinician, I want to **see a program's activity** on its own screen, so that I can see how it reached its current state.
105. As a clinician, I want **deleted observations and deleted programs both traceable**, so that a removal is documented rather than silent.
106. As a clinician, I want the app to **say plainly that changes are saved in this browser** and to offer a reset to the demo data, so that the demo's scope is never ambiguous.
107. As a clinician, I want the **scope of the program to be recorded** as Client even though only client scope exists today, so that organisation and public libraries can be added without a migration.
108. As a clinician, I want a **duplicate program name warning** when I create or rename a program to a name that already exists for the same client, so that I notice a likely mistake without being blocked.
109. As a clinician, I want the **same program name across different clients to be allowed**, so that shared templates stay possible.

## Implementation Decisions

### Module placement

- A new **Programs** workflow is added to the workflow registry, labelled *Programs*, with a summary that describes authoring rather than analysis. It is client-scoped: it is disabled in navigation until a client is selected, and the ABC tab within it is disabled until a client is selected.
- The workflow contains **three tabs** — Skill Acquisition, Behavior Reduction, ABC Data Recording — sharing one client scope header.
- The workflow panel is lazily mounted on first visit and stays mounted, matching every other workflow's behaviour.

### Persistence

- All new state follows the **existing browser-local store pattern**: one persisted collection per entity kind, each with a storage key, loaded at construction, written on change, and republished through the existing snapshot mechanism so every screen re-reads automatically.
- The fixture remains the read-only baseline. A **seed-version mismatch** resets browser-local data to the fixture, as it does today. New collections participate in that reset.
- **Full-list semantics**, matching the store's existing behaviour: an edit replaces a record, a delete removes it from the list, a create appends it. No tombstone concept is introduced for programs or targets.
- `serviceSessions` remains a fixture constant. It is not made writable.
- New persisted collections: **lessons**, **lesson notes**, **ABC configurations**, **activity log**, and **learning-material contents**.

### Data model changes

- **Program** gains: `scope` (default `client`), `operationalDefinition` (required for behavior-reduction programs, up to 5,000 characters), `behaviorPhase` (behavior-reduction programs only), `archivedAt` (null when active), and a populated `statusHistory`.
- **Target** gains: `manualMastery` (`{ achieved, decidedOn, note }` for manually-mastered targets), and an explicit phase list that includes `Open` for behavior-reduction targets that have not yet been reduced.
- **Behavior phase vocabulary**: `Open`, `Maintenance`, `Generalization`, `Completed`, `Pending`, `OnHold`, `Discontinued`. `Open` is a pre-measurement state: it is never mastered, it carries no trend, and it is eligible for the stale/attention flag. `Open` is not an alias for `Baseline` — a baseline is data that was collected.
- **Program status vocabulary**: the platform's eight values, including `Pending`, which the existing status control is missing and the fixture already uses.
- **Lesson**: `{ id, clientId, name, programIds, createdAt }` — a reusable grouping.
- **Lesson note**: `{ id, clientId, lessonId, date, title, status, signature: { signedBy, role, signedAt }, programIds, targetIds }`, where status is `Draft`, `Unapproved` or `Approved`, and the signature role is `Staff`, `Caregiver` or `Approver`.
- **Observations** gain an optional `lessonNoteId` alongside the existing `serviceSessionId`, so a new observation can belong to a lesson note, a session, or neither (the manual-entry path). Existing observations are untouched.
- **ABC entries** gain an optional `lessonNoteId` for the same reason.
- **ABC configuration** becomes a persisted per-client record, holding treatment area, teaching instructions and the four value lists. The value lists remain **strings**, not referenced rows.
- **Activity log**: an append-only collection of `{ id, at, kind, entityType, entityId, summary }`, capped the same way the existing deletion audit is capped.

### Domain rules

- **Program status cascades to target phases** for exactly four statuses: `Pending`, `Completed`, `OnHold`, `Discontinued`. The four active teaching statuses (`Baselining`, `Teaching`, `Maintaining`, `Generalizing`) do not cascade.
- A target in `OnHold`, `Discontinued` or `Pending` is **not counted as mastered**.
- **Mastery** is read from the structured rule for automatic targets and from the clinician's recorded decision for manual targets. The mastered count reads both.
- **Target order** is phase order (the not-yet-started group first, then acquisition, maintenance, generalization, completed, then paused and ended), alphabetical within a phase. Manual reordering is out of scope, so the order is a derived default rather than a stored value.
- **Program names are not unique**. An exact-duplicate name within the same client raises a warning that the user may proceed past.
- **Duplicate** copies the program's fields and its targets, with new identifiers, no observations, no phase history, and a starting status of `Pending`.
- **Archive** keeps history and recorded data. The archived program leaves the active surfaces but its observations stay on the charts, marked as archived.
- **Deleting an ABC value** that is used by existing observations warns with the count and offers to proceed; the existing observations keep their text.
- **Editing a target** keeps its measurement type fixed. **Editing a behavior** keeps its measurement tool fixed.
- **Cancel on the phase-line prompt aborts the phase or status change entirely**.

### Phase change lines

- One shared prompt is used for **both** target phase changes and program status changes: *Do you wish to plot a phase change line on analytics?* with Yes, No and Cancel.
- The prompt is a **new** interaction. The existing recorder currently always plots a line when a phase change is selected, and says so in its hint text; that behaviour is replaced by the shared prompt so that the three outcomes are available everywhere.
- A plotted line carries the label, the date, the marker style and a source, consistent with the existing phase-line records.

### Interfaces and reuse

- **The existing recorder is reused** for lesson-note data capture, pre-loaded with the lesson note's targets. A separate capture interface is not built.
- **The existing trend explorer is reused** for target-level analytics, reached from a program or target by deep link with the target selected.
- **The existing program-progress calculation is reused** for the program view's summary widgets.
- **The existing validation module** is extended with program, target, behavior and lesson-note validators, following the established pattern: return an error object, surface the first error, focus it.
- The existing per-measurement-type recording rules and the new per-measurement-type target-definition rules **share the type-specific configuration checks** (prompt hierarchy presence, interval configuration consistency, fluency timer configuration) so the two cannot drift.
- The existing **binary access level** governs editing in Program Management. The dormant granular permission matrix is not revived.
- The existing **annotation modal pattern** is followed: the modal owns transient field state and validation, the parent owns the persistence call and the toast.

### Documentation

- The **wiki generator is written** as a small script that parses the platform wiki and the tech-stack document and emits the generated documentation module. It is wired as a documentation build script and checked in CI so the generated file cannot drift from its sources. This closes a gap where the documentation module declares itself generated but no generator exists in the repository.

### Out-of-scope items taken from the source document

- Organization and Public scopes, including promotion between scopes and the field-wipeout rule that protects client-specific content.
- Per-program audit history with user identity, permission gating and spreadsheet export.
- The unified filter panel with status counts and multi-select.
- Drag-and-drop target reordering and its reset control.
- Real-time synchronisation of fluency/rate targets between web and mobile.
- Task analysis as a new target type.
- Geotagged signatures.

## Testing Decisions

**What makes a good test here.** These tests assert externally observable behaviour through the module's public surface — the store's mutation methods and the pure helpers they call — never the internal shape of a component. A test names the clinical rule it protects ("archiving a program keeps its recorded data"), not the function that implements it. Date-independent construction is mandatory: every fixture date is derived from the fixture's as-of date, and no test assumes a particular weekday.

**Where the tests go.** Pure logic lands in the repository's `node:test` suites under the shared test directory, alongside the existing analytics and recording suites. The store's mutation methods are tested directly — the store is already a plain class with no framework dependency, so it is the natural seam. Component-level rendering is covered by the existing server-render smoke matrix, which gains cases for each new screen and each new dialog.

**Prior art.** The existing suites are the model: the recording suite for per-measurement-type rules, the round-two suite for mutation and audit behaviour, the clinical-seed suite for fixture integrity, the analytics suite for derived calculations. The smoke matrix is the model for screen-level rendering, and the Playwright scenario suite is the model for interaction flows with an accessibility scan.

**Seams to be confirmed before implementation.** The store's public mutation methods (the highest seam available — one seam covers creation, editing, duplication, archiving, deletion, phase changes, lesson notes and activity logging), the pure validation module, and the generated documentation module's output shape. No new test seams are proposed beyond these three.

**Coverage required.** Every new store method gets at least one behavioural test; every validation rule gets a failing-then-passing case; the phase-change prompt's three outcomes are each tested; the status cascade is tested for both the cascading and non-cascading statuses; archiving is tested for both its removal from active surfaces and its retention of data; the duplicate is tested for independence and for its starting state; ABC value deletion is tested for the warning count and for the retained observation text; lesson-note editing is tested for its status gate; the observation's optional lesson-note link is tested for existing observations remaining valid.

**Fixture integrity.** The fixture is generated, not hand-edited. Any change to the demo data is made through the fixture generator and committed. The existing clinical-seed integrity suite must keep passing, including the checks that every observation's target exists and every observation's session exists.

## Out of Scope

- Organization and Public scopes, scope promotion, and the client-to-organization field-wipeout rule.
- Per-program audit history with user identity, permission gating, spreadsheet export, or tamper-proofing claims.
- The unified filter panel with counts and multi-select.
- Manual target reordering.
- Cross-device real-time synchronisation of session targets.
- Task analysis as a target type.
- Geotagged or location-captured signatures.
- A combined single-chart program view overlaying every measurement type.
- Bulk editing of targets beyond the phase cascade.
- Any server-side persistence, authentication, or transmission of data.
- The .NET backend acquiring a write API or contract tests against the frontend.

## Further Notes

- **Honesty framing.** The module must never imply an external action. Materials uploaded here are stored in the browser and the interface says so. Session data captured into a lesson note is stored in the browser and the interface says so. The existing "view-only analytics" access level and the existing reset-to-demo-data control are the vocabulary this module reuses.
- **A blank is not a zero.** A newly created target appears in the analytics as a target with no measurements, never as a target measuring zero. The existing `missingDataMode` vocabulary governs this and must be honoured by anything that renders a new target.
- **The clinical boundary.** The analytics remain decision support over fictional data. Program Management does not make the program effective; it records what was planned, so that the analytics can be read against the plan.
- **Sequence of work.** The documentation generator and the store's new collections land first, because everything else depends on them. The tabs, then the authoring flows, then the lesson layer, then the analytics integration.
