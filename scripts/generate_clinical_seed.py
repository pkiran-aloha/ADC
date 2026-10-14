"""Build the shared, deterministic ABA demo fixture (no real client information).

Run: python3 scripts/generate_clinical_seed.py
The checked-in JSON is imported by Vite and embedded by the .NET API. Keep the
series here rather than hand-editing two independent sets of example records.
All dates are relative to the demo's as-of date, not to the machine clock.
"""

import hashlib
import json
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AS_OF = date(2026, 10, 14)

CLIENTS = [
    {"id": "cli-liam", "name": "Liam Miller", "code": "CL-1042", "dateOfBirth": "2018-04-12",
     "primaryDiagnosis": "Autism Spectrum Disorder (Level 2)", "supervisingBcba": "Sarah Jenkins, BCBA",
     "location": "Metro ABA Center - East"},
    {"id": "cli-emma", "name": "Emma Watson", "code": "CL-1088", "dateOfBirth": "2019-09-21",
     "primaryDiagnosis": "ASD with Speech Apraxia", "supervisingBcba": "David Vance, BCBA",
     "location": "Metro ABA Center - North"},
    {"id": "cli-noah", "name": "Noah Davis", "code": "CL-1095", "dateOfBirth": "2017-11-05",
     "primaryDiagnosis": "ASD with Sensory Processing Disorder", "supervisingBcba": "Sarah Jenkins, BCBA",
     "location": "In-Home Therapy"},
]

PROMPT_HIERARCHY_TEMPLATES = [
    {"id": "least-to-most", "name": "Least to Most", "levels":
     ["Independent", "Gestural", "Model", "Partial physical", "Full physical"]},
    {"id": "most-to-least", "name": "Most to Least", "levels":
     ["Full physical", "Partial physical", "Model", "Gestural", "Independent"]},
    {"id": "verbal-fading", "name": "Verbal Prompt Fading", "levels":
     ["Full verbal model", "Partial verbal model", "Initial sound", "Independent"]},
]

CUSTOM_FIELD_DEFINITIONS = [
    {"key": "reinforcer", "label": "Preferred reinforcer", "inputType": "text"},
    {"key": "generalizationSetting", "label": "Generalization setting", "inputType": "text"},
    {"key": "caregiverPractice", "label": "Caregiver practice", "inputType": "text"},
]

MATERIALS = {
    "food": {"fileName": "food-labeling-prompts.txt", "contentType": "text/plain",
             "path": "learning-materials/food-labeling-prompts.txt"},
    "schedule": {"fileName": "first-then-visual-guide.txt", "contentType": "text/plain",
                 "path": "learning-materials/first-then-visual-guide.txt"},
    "interval": {"fileName": "interval-observation-guide.txt", "contentType": "text/plain",
                 "path": "learning-materials/interval-observation-guide.txt"},
}

PROGRAMS = []
TARGETS = {}


def target(id, name, kind, phase, stimuli, description, mastery, *,
           phase_date="2026-09-20", settings="Automatic", instructions=None,
           color="#3B82F6", prompt=None, interval=None, fluency=None):
    """Only serialize fields applicable to the selected measurement tool."""
    item = {"id": id, "name": name, "description": description, "type": kind,
            "phase": phase, "phaseEnteredDate": phase_date,
            "discriminativeStimuli": stimuli, "masterySettings": settings,
            "masteryCriteria": mastery, "color": color}
    if instructions:
        item["targetInstructions"] = instructions
    if kind == "TrialByTrial":
        item["promptHierarchyId"] = prompt or "least-to-most"
    elif kind == "IntervalData":
        assert interval is not None, f"Missing interval configuration for {id}"
        item["intervalSettings"] = interval
    elif kind == "FluencyRate":
        assert fluency is not None, f"Missing fluency configuration for {id}"
        item["fluencySettings"] = {"startType": fluency}
    else:
        assert prompt is None and interval is None and fluency is None, id
    return item


def interval(start, length, capture, count=None):
    result = {"startType": start, "intervalLength": length, "captureType": capture}
    if count is not None:
        result["numberOfIntervals"] = count
    return result


def add_program(id, client, name, category, status, area, objective, teaching, targets,
                *, tags=None, materials=None, baseline=None, custom=None, include_treatment_area=True):
    item = {"id": id, "clientId": client, "name": name, "category": category,
            "status": status, "domain": area,
            "programObjective": objective, "teachingInstructions": teaching,
            "description": objective, "targets": targets}
    if include_treatment_area:
        item["treatmentArea"] = area
    if tags:
        item["tags"] = tags
    if materials:
        item["learningMaterials"] = [MATERIALS[key] for key in materials]
    if baseline:
        item["baseline"] = baseline
    if custom:
        item["customFields"] = custom
    for item_target in targets:
        assert item_target["id"] not in TARGETS, item_target["id"]
        item_target["programId"] = id
        TARGETS[item_target["id"]] = (client, category, item_target)
    PROGRAMS.append(item)


# Skill Acquisition: each program can contain several targets using different tools.
add_program(
    "prog-expressive", "cli-liam", "Expressive Labeling", "SkillAcquisition", "Generalizing",
    "Communication", "Independently label familiar foods and actions across people and settings.",
    "Present one picture at a time, wait five seconds, follow the assigned prompt hierarchy, and reinforce independent labels.",
    [target("tgt-expr-food", "Expressive Food Items", "TrialByTrial", "Generalization",
            "Show a food card and ask 'What is this?'", "Names foods shown on picture cards.",
            "At least 8/10 independent labels for 3 sessions", phase_date="2026-09-28",
            prompt="verbal-fading", color="#3B82F6"),
     target("tgt-expr-actions", "Label Everyday Actions", "TrialByTrial", "Maintenance",
            "Show an action picture and ask 'What is happening?'", "Names actions without an echoic prompt.",
            "At least 8/10 for 3 sessions", phase_date="2026-09-22", color="#6366F1"),
     target("tgt-expr-preference", "Food Preference Observations", "Anecdotal", "Acquisition",
            "Offer two snack options and wait for a choice.", "Record the client's own words and context.",
            "Clinical review of spontaneous requests", settings="Manual", color="#8B5CF6")],
    tags=["Tacting", "Communication"], materials=["food"],
    baseline="4 of 10 food cards named without prompts on 2026-09-15.",
    custom={"reinforcer": "Choice of sticker or music", "generalizationSetting": "Clinic and kitchen"})

add_program(
    "prog-playing", "cli-liam", "Playing with Toys", "SkillAcquisition", "Maintaining",
    "Play & Leisure", "Build sustained independent play and reciprocal peer play.",
    "Offer a choice of materials; start timing on independent engagement and record each scheduled observation interval.",
    [target("tgt-play-independent", "Independent Block Play", "Duration", "Acquisition",
            "Place the building blocks on the mat and say 'You can build.'", "Seconds of uninterrupted independent play.",
            "At least 300 seconds for 3 sessions", instructions="Stop timer for prompts or disengagement.", color="#2563EB"),
     target("tgt-play-turn-taking", "Turn Taking in Board Games", "IntervalData", "Maintenance",
            "Say 'Your turn' or 'Wait for your friend.'", "Observe unprompted turn taking across whole intervals.",
            "At least 85% of intervals for 3 sessions", phase_date="2026-09-25",
            interval=interval("LessonStart", "00:30", "Whole", 20), color="#10B981"),
     target("tgt-play-share", "Share Materials with a Peer", "TrialByTrial", "Completed",
            "Peer asks to borrow one shared block.", "Hands over a block when requested.",
            "At least 9/10 across 3 peers", phase_date="2026-10-02", settings="Manual", color="#14B8A6")],
    tags=["Play", "Social"], materials=["interval"],
    baseline="Independent play averaged 75 seconds; turn taking occurred in 6 of 20 intervals.",
    custom={"reinforcer": "Choice of next game"})

add_program(
    "prog-manding", "cli-liam", "Spontaneous Requests", "SkillAcquisition", "Teaching",
    "Functional Communication", "Increase unprompted requests for items and help.",
    "Arrange motivating opportunities, pause to allow initiation, and count only independently initiated requests.",
    [target("tgt-mands-spontaneous", "Spontaneous Two-Word Requests", "Frequency", "Acquisition",
            "Preferred item visible but out of reach.", "Count independent two-word requests.",
            "At least 15 per hour for 3 sessions", color="#F59E0B"),
     target("tgt-mands-help", "Request Help", "Frequency", "Baseline",
            "Present a closed container containing a desired item.", "Count requests for assistance without prompting.",
            "At least 6 per hour for 3 sessions", phase_date="2026-09-19", color="#D97706")],
    tags=["Mand", "Communication"], custom={"caregiverPractice": "Practice during snack at home"})

add_program(
    "prog-fluency", "cli-liam", "Fluent Naming", "SkillAcquisition", "Teaching",
    "Academic / Fluency", "Increase correct responses during timed naming opportunities.",
    "Run a timed probe, count accurate responses, and record the actual probe length in minutes.",
    [target("tgt-sight-words", "Rapid Sight Word Naming", "FluencyRate", "Acquisition",
            "Present primer sight word cards and say 'Read.'", "Correct words during a seven-minute probe.",
            "At least 30 correct in 7 minutes", fluency="ManualStartCountDown", color="#EC4899"),
     target("tgt-action-fluency", "Action Naming Fluency", "FluencyRate", "Maintenance",
            "Show action cards and say 'Name as many as you can.'", "Correct action labels in three minutes.",
            "At least 20 correct in 3 minutes", phase_date="2026-09-29",
            fluency="LessonStartCountUp", color="#DB2777"),
     target("tgt-object-fluency", "Classroom Object Fluency", "FluencyRate", "Baseline",
            "Lay out classroom object cards; say 'Name these.'", "Correct object names in five minutes.",
            "At least 25 correct in 5 minutes", fluency="ManualStartCountUp", color="#BE185D")],
    tags=["Fluency", "Timed probe"], baseline="14 correct words in seven minutes.")

add_program(
    "prog-receptive", "cli-liam", "Following Classroom Directions", "SkillAcquisition", "Baselining",
    "Receptive Language", "Establish a baseline for receptive directions before teaching.",
    "Give one clear direction without a second cue; record independent responses and observation intervals.",
    [target("tgt-receptive-shapes", "Identify Shapes", "TrialByTrial", "Baseline",
            "Place three shapes and say 'Touch the circle.'", "Independently touches the named shape.",
            "At least 8/10 for 3 sessions", phase_date="2026-10-01", color="#0EA5E9"),
     target("tgt-receptive-attend", "Attend to Group Directions", "IntervalData", "Baseline",
            "Teacher announces a group activity.", "Record any attending within a partial interval.",
            "At least 75% of intervals", phase_date="2026-10-01",
            interval=interval("Manual", "00:45", "Partial"), color="#0284C7")],
    tags=["Baseline", "Classroom"], materials=["schedule"])

add_program(
    "prog-liam-greetings", "cli-liam", "Greeting Familiar Adults", "SkillAcquisition", "Completed",
    "Social Skills", "Respond to greetings from familiar adults without prompts.",
    "Provide a natural greeting, wait five seconds, and score the independent response.",
    [target("tgt-liam-greeting", "Respond to Hello", "TrialByTrial", "Completed",
            "A familiar adult says 'Hello, Liam.'", "Says hello or waves independently.",
            "At least 9/10 across 3 adults", phase_date="2026-10-05", color="#16A34A")],
    tags=["Social", "Mastered"])

add_program(
    "prog-emma-requests", "cli-emma", "Picture-Assisted Requests", "SkillAcquisition", "Teaching",
    "Communication", "Use picture exchange and speech to make functional requests.",
    "Place communication icons within reach, allow initiation, and use the assigned prompt hierarchy for exchange trials.",
    [target("tgt-emma-exchange", "Exchange a Picture for Snack", "TrialByTrial", "Acquisition",
            "Hold a preferred snack and display the matching picture.", "Hands over the matching icon to request.",
            "At least 8/10 independent exchanges", prompt="most-to-least", color="#4F46E5"),
     target("tgt-emma-requests", "Vocal Requests", "Frequency", "Acquisition",
            "Offer a choice of two activities.", "Count independently initiated spoken requests.",
            "At least 8 per session", color="#EAB308"),
     target("tgt-emma-choices", "Choice-Making Notes", "Anecdotal", "Acquisition",
            "Present a preferred and neutral activity.", "Write the exact words or gesture used for the choice.",
            "Review weekly with supervisor", settings="Manual", color="#A855F7")],
    tags=["AAC", "Mands"], materials=["food"],
    baseline="3 of 10 independent picture exchanges at the start of September.",
    custom={"reinforcer": "Preferred snack", "caregiverPractice": "Offer icon board at breakfast"})

add_program(
    "prog-emma-social", "cli-emma", "Peer Engagement", "SkillAcquisition", "Generalizing",
    "Social Skills", "Greet peers and sustain short shared activities in different rooms.",
    "Use a peer model, fade adult prompts, and measure duration and momentary attending in group play.",
    [target("tgt-emma-greeting", "Greet a Peer", "TrialByTrial", "Generalization",
            "Peer approaches and says 'Hi.'", "Returns a greeting without a prompt.",
            "At least 8/10 across 2 settings", phase_date="2026-09-30", color="#0D9488"),
     target("tgt-emma-peer-play", "Shared Play", "Duration", "Maintenance",
            "Peer invites client to build together.", "Seconds participating in joint play.",
            "At least 240 seconds for 3 sessions", phase_date="2026-09-26", color="#059669"),
     target("tgt-emma-attending", "Group Circle Attending", "IntervalData", "Generalization",
            "Teacher begins circle time.", "Eyes/body oriented to group at the observation instant.",
            "At least 80% of checks", phase_date="2026-10-03",
            interval=interval("LessonStart", "01:00", "MomentaryTimeSampling", 15), color="#14B8A6")],
    tags=["Peer play", "Generalization"], materials=["interval"],
    custom={"generalizationSetting": "Playroom and community group"})

add_program(
    "prog-emma-pending", "cli-emma", "Community Safety Preview", "SkillAcquisition", "Pending",
    "Community Skills", "Introduce safety routines after caregiver consent and baseline planning.",
    "Do not collect trials until the supervisor activates this program.",
    [target("tgt-emma-crosswalk", "Stop at Crosswalk", "TrialByTrial", "Pending",
            "An adult approaches a marked crossing.", "Stops at the boundary with an adult.",
            "At least 9/10 across 3 outings", phase_date="2026-10-14", settings="Manual")],
    tags=["Pending"], include_treatment_area=False)

add_program(
    "prog-emma-onhold", "cli-emma", "Fine Motor Beading", "SkillAcquisition", "OnHold",
    "Motor Skills", "Sustain fine motor bead placement during short activities.",
    "Pause instruction pending updated occupational therapy guidance; historical data is retained.",
    [target("tgt-emma-beads", "String Beads Independently", "Duration", "OnHold",
            "Present beads and a cord.", "Seconds of independent fine motor engagement.",
            "At least 180 seconds", phase_date="2026-09-01", settings="Manual", color="#7C3AED")])

add_program(
    "prog-noah-routines", "cli-noah", "Daily Living Routines", "SkillAcquisition", "Maintaining",
    "Adaptive Living", "Complete self-care steps and wait calmly during routine transitions.",
    "Use a visual schedule, record each independent response, and time continuous routine engagement.",
    [target("tgt-noah-dressing", "Follow Dressing Sequence", "TrialByTrial", "Maintenance",
            "Present visual dressing sequence and clothes.", "Completes the requested step independently.",
            "At least 8/10 steps for 3 sessions", phase_date="2026-09-28", color="#2563EB"),
     target("tgt-noah-washing", "Hand-Washing Engagement", "Duration", "Acquisition",
            "Show handwashing card at sink.", "Seconds engaged in washing sequence.",
            "At least 120 continuous seconds", color="#0EA5E9"),
     target("tgt-noah-waiting", "Wait with Visual Schedule", "IntervalData", "Acquisition",
            "Show 'wait' icon before a transition.", "Waits during any part of a partial interval.",
            "At least 80% of intervals", interval=interval("Manual", "00:30", "Partial", 10), color="#10B981")],
    tags=["Adaptive", "Transitions"], materials=["schedule"],
    baseline="Needed prompts for seven of ten dressing steps.",
    custom={"caregiverPractice": "Practice at morning routine", "reinforcer": "Choose breakfast music"})

add_program(
    "prog-noah-community", "cli-noah", "Community Communication", "SkillAcquisition", "Teaching",
    "Community Skills", "Ask for help and label useful community items.",
    "Arrange community role-play, tally spontaneous requests, and time naming probes using a count-up timer.",
    [target("tgt-noah-help", "Ask for Help in Community", "Frequency", "Acquisition",
            "A familiar item is placed out of reach in role-play.", "Counts independent requests for help.",
            "At least 6 per session", color="#D97706"),
     target("tgt-noah-signs", "Name Community Signs", "FluencyRate", "Baseline",
            "Show familiar street sign cards and say 'Name these.'", "Correct sign labels in two minutes.",
            "At least 12 correct in 2 minutes", fluency="LessonStartCountUp", color="#DB2777"),
     target("tgt-noah-observations", "Community Role-Play Notes", "Anecdotal", "Baseline",
            "Begin a simulated store visit.", "Record exact words and context for requests.",
            "Review each session", settings="Manual", color="#9333EA")],
    tags=["Community", "Communication"],
    custom={"generalizationSetting": "Clinic role-play, then neighborhood"})

add_program(
    "prog-noah-discontinued", "cli-noah", "Legacy Puzzle Sorting", "SkillAcquisition", "Discontinued",
    "Academic", "Retain historical sorting data for review after goals changed.",
    "Do not run new trials; the archived goal has been replaced by functional living skills.",
    [target("tgt-noah-puzzle", "Sort Puzzle Pieces", "TrialByTrial", "Discontinued",
            "Show two puzzle-piece groups and say 'Sort.'", "Places a piece in the matching group.",
            "Historical goal; no new mastery evaluation", phase_date="2026-08-20", settings="Manual")],
    tags=["Archived"])

# Behavior Reduction is unitary: exactly one behavior/measurement tool per program.
def add_behavior(id, client, name, kind, status, phase, stimuli, objective, teaching,
                 mastery, *, interval_settings=None, baseline=None, color="#DC2626", area="Behavior Reduction"):
    add_program(id, client, name, "BehaviorReduction", status, area, objective, teaching,
                [target(id.removeprefix("prog-"), name, kind, phase, stimuli, objective,
                        mastery, phase_date="2026-09-22", settings="Manual",
                        interval=interval_settings, color=color)],
                tags=["Behavior reduction", kind], baseline=baseline)


add_behavior("prog-br-vocal", "cli-liam", "Vocal Disruption / Screaming", "Frequency", "Teaching", "Acquisition",
             "A demand is presented or access to an item is delayed.",
             "Count vocalizations above conversational volume that interrupt instruction.",
             "Offer a functional break request before demand; count each episode separated by 10 seconds of quiet.",
             "Fewer than 2 per session for 4 sessions", baseline="12 episodes per hour", color="#EF4444")
add_behavior("prog-br-elopement", "cli-liam", "Elopement / Leaving Area", "Duration", "Maintaining", "Maintenance",
             "Transition away from a preferred activity.",
             "Time movement beyond five feet from the assigned area without permission.",
             "Maintain line of sight; start timer on departure, stop on return, and teach asking for a break.",
             "Under 30 seconds per session", baseline="240 seconds per session", color="#B91C1C")
add_behavior("prog-br-property", "cli-liam", "Property Disruption", "IntervalData", "Teaching", "Acquisition",
             "A work demand is introduced.",
             "Record intervals in which materials are thrown or swept off the table.",
             "Use partial-interval recording and offer a short choice before the demand.",
             "At most 1 of 12 intervals for 4 sessions",
             interval_settings=interval("Manual", "00:30", "Partial", 12),
             baseline="7 of 12 intervals", color="#F97316")

add_behavior("prog-br-refusal", "cli-emma", "Task Refusal", "Frequency", "Teaching", "Acquisition",
             "A non-preferred task is presented.",
             "Count verbal refusal or pushing work away, separated by 10 seconds of participation.",
             "Offer a choice of task order, prompt a break request, and return to instruction after the break.",
             "At most 1 per session", baseline="8 episodes per session", color="#EA580C")
add_behavior("prog-br-drop", "cli-emma", "Drop to Floor", "Duration", "Teaching", "Acquisition",
             "Transition into group instruction.",
             "Time lying on the floor instead of walking with the group.",
             "Present a first/then card; stop timing after client stands and resumes walking.",
             "Under 20 seconds per session", color="#DC2626")
add_behavior("prog-br-disruptive", "cli-emma", "Disruptive Vocalizations", "IntervalData", "Teaching", "Acquisition",
             "Group circle starts or a peer is speaking.",
             "Count whole intervals containing disruptive vocalizations.",
             "Reinforce quiet participation at each 20-second interval boundary.",
             "At most 1 of 15 intervals",
             interval_settings=interval("LessonStart", "00:20", "Whole", 15), color="#BE123C")

add_behavior("prog-br-bolting", "cli-noah", "Bolting from Group", "Frequency", "Generalizing", "Generalization",
             "A community group changes activities.",
             "Count each departure beyond the visual boundary without permission.",
             "Use a visual boundary, rehearse staying near the adult, and count new departures after return.",
             "0 for 5 sessions", color="#EF4444")
add_behavior("prog-br-hand-biting", "cli-noah", "Hand Biting", "Duration", "Teaching", "Acquisition",
             "A loud noise is heard during activities.",
             "Time contact of teeth with hand; stop timing when contact ceases.",
             "Offer a sensory alternative and document total seconds per session.",
             "Under 15 seconds per session", color="#B91C1C")
add_behavior("prog-br-repetitive", "cli-noah", "Repetitive Vocalizations", "IntervalData", "Maintaining", "Maintenance",
             "An adult delivers a lengthy direction.",
             "Mark whether repeated vocalizations occur at each observation instant.",
             "Use momentary time sampling; reinforce participation after quiet checks.",
             "At most 2 of 10 checks", interval_settings=interval("Manual", "01:00", "MomentaryTimeSampling", 10),
             color="#F97316")

THERAPISTS = {
    "cli-liam": ["Sarah Jenkins, BCBA", "Joe Ronald, RBT", "Maya Patel, RBT"],
    "cli-emma": ["David Vance, BCBA", "Nina Torres, RBT", "Alex Chen, RBT"],
    "cli-noah": ["Sarah Jenkins, BCBA", "David Kim, RBT", "Ava Brooks, RBT"],
}
SESSION_DATA = []


def add_series(target_id, samples, *, total=None, minutes=45, last=-1, step=2, hour=10,
               second_session=False):
    """For trial/interval samples are numerators; for duration they're seconds.

    None marks an observed BR session where data was *not* tracked (not a zero).
    An explicit zero BR sample means tracking occurred and the behavior did not.
    """
    client_id, category, item_target = TARGETS[target_id]
    kind = item_target["type"]
    if kind in ("TrialByTrial", "IntervalData"):
        assert total and total > 0, target_id
    if kind == "IntervalData" and item_target["intervalSettings"].get("numberOfIntervals"):
        assert total == item_target["intervalSettings"]["numberOfIntervals"], target_id
    if kind == "FluencyRate":
        assert minutes > 0
    for index, sample in enumerate(samples):
        offset = last - (len(samples) - index - 1) * step
        stamp = datetime.combine(AS_OF + timedelta(days=offset), time(hour, 15)).isoformat(timespec="seconds")
        row = {"id": f"seed-{target_id}-{index + 1:02d}", "clientId": client_id,
               "targetId": target_id, "timestamp": stamp, "sessionNumber": index + 1,
               "therapistName": THERAPISTS[client_id][index % 3]}
        if sample is None:
            assert category == "BehaviorReduction", target_id
            row.update(value=None, missingDataMode="DataNotTracked")
        elif kind in ("TrialByTrial", "IntervalData"):
            assert 0 <= sample <= total, target_id
            row["value"] = round(100 * sample / total)
            if kind == "TrialByTrial":
                row.update(correctCount=sample, totalTrials=total)
            else:
                row.update(occurredIntervals=sample, totalIntervals=total)
            row["lessonDurationMinutes"] = minutes
        elif kind == "Duration":
            assert sample >= 0, target_id
            row.update(value=sample, durationSeconds=sample,
                       occurrenceCount=(1 if sample > 0 else 0), lessonDurationMinutes=minutes)
        elif kind in ("Frequency", "FluencyRate"):
            assert sample >= 0, target_id
            row.update(value=sample, occurrenceCount=sample, lessonDurationMinutes=minutes)
        if category == "BehaviorReduction" and sample == 0:
            row["missingDataMode"] = "ZeroOut"
        SESSION_DATA.append(row)

    if second_session:
        # Same-day, different therapist: exercises per-session versus daily aggregation.
        original = SESSION_DATA[-1]
        duplicate = {**original, "id": f"seed-{target_id}-extra",
                     "timestamp": original["timestamp"][:11] + "15:45:00",
                     "sessionNumber": original["sessionNumber"] + 1,
                     "therapistName": THERAPISTS[client_id][1]}
        SESSION_DATA.append(duplicate)


def add_anecdotes(target_id, observations, *, last=-1, step=3):
    client_id, _, item_target = TARGETS[target_id]
    assert item_target["type"] == "Anecdotal"
    for index, text in enumerate(observations):
        offset = last - (len(observations) - index - 1) * step
        SESSION_DATA.append({"id": f"seed-{target_id}-{index + 1:02d}",
                             "clientId": client_id, "targetId": target_id,
                             "timestamp": datetime.combine(AS_OF + timedelta(days=offset), time(13, 25)).isoformat(timespec="seconds"),
                             "sessionNumber": index + 1,
                             "therapistName": THERAPISTS[client_id][index % 3],
                             "qualitativeEntry": text})


# Meaningful progressions, zeroes, untracked dates, historical goals, and two sessions
# on one date. All active measurement tools have records within the default month.
add_series("tgt-expr-food", [5, 6, 6, 7, 8, 8, 9, 9, 10, 9, 10, 10], total=10, second_session=True)
add_series("tgt-expr-actions", [4, 5, 7, 7, 8, 8, 9, 9], total=10, last=-2)
add_anecdotes("tgt-expr-preference", [
    "Chose yogurt when offered yogurt or crackers without prompting.",
    "Asked for apple slices using a full sentence at the snack table.",
    "Said 'No broccoli, please' and chose another vegetable.",
    "Requested banana while the picture cards were being put away.",
    "Asked for water before staff offered a drink."])
add_series("tgt-play-independent", [95, 120, 158, 185, 210, 228, 255, 280, 310, 345, 360], minutes=50, hour=14)
add_series("tgt-play-turn-taking", [9, 11, 13, 15, 16, 17, 18, 19], total=20, minutes=10, hour=11)
add_series("tgt-play-share", [6, 7, 8, 9, 9, 10], total=10, hour=11)
add_series("tgt-mands-spontaneous", [6, 8, 7, 10, 12, 11, 15, 14, 18, 20], minutes=60, hour=9)
add_series("tgt-mands-help", [1, 1, 2, 2, 3, 3, 4], minutes=60)
add_series("tgt-sight-words", [14, 18, 17, 21, 24, 26, 28, 30, 32], minutes=7, hour=15)
add_series("tgt-action-fluency", [10, 12, 14, 16, 18, 19, 21], minutes=3, hour=15)
add_series("tgt-object-fluency", [5, 7, 8, 9, 10, 11], minutes=5, hour=15)
add_series("tgt-receptive-shapes", [3, 4, 4, 5, 6, 6], total=10)
add_series("tgt-receptive-attend", [4, 5, 5, 6, 7, 8], total=12, minutes=9)
add_series("tgt-liam-greeting", [7, 8, 9, 9, 10, 10], total=10)

add_series("tgt-emma-exchange", [3, 4, 5, 6, 6, 7, 8, 8, 9, 9], total=10)
add_series("tgt-emma-requests", [1, 2, 3, 4, 5, 5, 7, 8], minutes=45)
add_anecdotes("tgt-emma-choices", [
    "Selected the swing icon and pointed to the door.",
    "Exchanged a snack picture with the visiting therapist.",
    "Used 'more bubbles' after the first round of play.",
    "Chose a book using an icon without adult prompting."])
add_series("tgt-emma-greeting", [4, 5, 6, 7, 7, 8, 9, 9], total=10)
add_series("tgt-emma-peer-play", [65, 90, 120, 160, 180, 210, 235, 255], minutes=40, hour=14)
add_series("tgt-emma-attending", [5, 7, 8, 9, 10, 11, 12, 13], total=15, minutes=15)
# Pending has no recordings by design; OnHold retains historical data only.
add_series("tgt-emma-beads", [65, 75, 100, 110], last=-55, hour=14)

add_series("tgt-noah-dressing", [5, 6, 7, 7, 8, 8, 9, 9], total=10)
add_series("tgt-noah-washing", [40, 55, 65, 75, 85, 100, 112, 120], minutes=30)
add_series("tgt-noah-waiting", [3, 4, 5, 6, 6, 7, 8, 8], total=10, minutes=5)
add_series("tgt-noah-help", [1, 2, 2, 3, 3, 4, 5, 6], minutes=45)
add_series("tgt-noah-signs", [3, 4, 5, 6, 8, 9, 10], minutes=2)
add_anecdotes("tgt-noah-observations", [
    "Asked the therapist to open the pretend store door.",
    "Looked at a stop sign and asked what it meant.",
    "Requested a cart during role-play without prompting.",
    "Asked for a break before entering the simulated market."])
add_series("tgt-noah-puzzle", [3, 4, 4, 5], total=10, last=-65)

add_series("br-vocal", [12, 10, 11, 8, 7, None, 5, 4, 3, 2, 0, 0], minutes=60, hour=11)
add_series("br-elopement", [240, 190, 145, None, 110, 75, 50, 30, 0, 0], minutes=60, hour=14)
add_series("br-property", [7, 6, 5, 5, None, 4, 3, 2, 1, 0], total=12, minutes=6, hour=14)
add_series("br-refusal", [8, 7, 7, 5, None, 4, 3, 2, 1, 0], minutes=45)
add_series("br-drop", [150, 130, 105, 90, 70, None, 45, 30, 15, 0], minutes=50, hour=14)
add_series("br-disruptive", [10, 9, 8, None, 7, 5, 4, 3, 2, 0], total=15, minutes=5)
add_series("br-bolting", [6, 5, 5, 4, None, 3, 2, 1, 0, 0], minutes=60)
add_series("br-hand-biting", [100, 90, 75, 65, 50, 40, None, 25, 12, 0], minutes=45)
add_series("br-repetitive", [7, 6, 6, 5, 4, None, 3, 2, 1, 0], total=10, minutes=10)

ABC_CONFIGURATIONS = [
    {"clientId": "cli-liam", "treatmentArea": "Behavioral Regulation",
     "teachingInstructions": "Record what occurred just before and after each event. Select all applicable entries; record the actual location, not a presumed function.",
     "antecedents": ["Tabletop demand", "Transition from preferred play", "Peer took a toy",
                     "Denied access to tablet", "Loud cafeteria noise", "Wait for attention"],
     "behaviors": ["Vocal Disruption / Screaming", "Elopement / Leaving Area", "Property Disruption"],
     "consequences": ["Prompted break request", "First/then visual presented", "Access to quiet corner",
                      "Blocked unsafe movement", "Returned to task with choice", "Peer turn supported"],
     "locations": ["Therapy Table", "Play Area", "Hallway", "Cafeteria"]},
    {"clientId": "cli-emma", "treatmentArea": "Communication & Transitions",
     "teachingInstructions": "Document the exact trigger and response during transitions; use communication icons before re-presenting the demand.",
     "antecedents": ["Non-preferred task presented", "Transition to circle time", "Preferred toy removed",
                     "Peer begins speaking", "Snack delayed", "Group moves to playroom"],
     "behaviors": ["Task Refusal", "Drop to Floor", "Disruptive Vocalizations"],
     "consequences": ["Offered task-order choice", "First/then card shown", "Prompted picture exchange",
                      "Break card offered", "Rejoined group", "Quiet participation reinforced"],
     "locations": ["Classroom", "Circle Area", "Playroom", "Therapy Table"]},
    {"clientId": "cli-noah", "treatmentArea": "Safety & Sensory Regulation",
     "teachingInstructions": "Document safety events immediately; offer a sensory alternative and reinforce remaining with the group.",
     "antecedents": ["Group changed activity", "Loud hallway sound", "Extended instruction",
                     "Preferred item put away", "Community role-play begins", "Asked to wait"],
     "behaviors": ["Bolting from Group", "Hand Biting", "Repetitive Vocalizations"],
     "consequences": ["Visual boundary reviewed", "Sensory alternative offered", "Rejoined group with prompt",
                      "Break request modeled", "Quiet interval reinforced", "Caregiver notified"],
     "locations": ["Home Therapy Room", "Hallway", "Community Practice Area", "Sensory Corner"]},
]

ABC_ENTRIES = []


def add_abc(client_id, events):
    """Events reference a client's configured *text lists* by index, not free text."""
    config = next(config for config in ABC_CONFIGURATIONS if config["clientId"] == client_id)
    for i, (offset, ants, behs, cons, location, notes, intensity, duration) in enumerate(events):
        ABC_ENTRIES.append({
            "id": f"abc-{client_id}-{i + 1:02d}", "clientId": client_id,
            "timestamp": datetime.combine(AS_OF + timedelta(days=offset),
                                          time(9 + i % 6, (i * 11) % 60)).isoformat(timespec="seconds"),
            "therapist": THERAPISTS[client_id][i % 3],
            "antecedents": [config["antecedents"][n] for n in ants],
            "behaviors": [config["behaviors"][n] for n in behs],
            "consequences": [config["consequences"][n] for n in cons],
            "location": config["locations"][location], "notes": notes,
            "intensity": intensity, "durationMinutes": duration,
        })


add_abc("cli-liam", [
    (-1, [0, 5], [0], [0, 4], 0, "Requested a break; returned to table after two minutes.", 3, 4),
    (-1, [1], [1], [1, 3], 2, "Checked the first/then board and walked back with staff.", 2, 2),
    (-3, [2], [2, 0], [5, 0], 1, "Peer turn was restored using a visual timer.", 3, 3),
    (-4, [3], [0], [0], 0, "Used a break request rather than escalating further.", 2, 2),
    (-6, [4], [1], [2, 3], 3, "Quiet corner reduced agitation during lunch.", 2, 3),
    (-8, [0], [2], [4], 0, "Chose an easier starter task and resumed instruction.", 3, 5),
    (-8, [2, 5], [0], [5], 1, "Waited for a peer turn with one gestural cue.", 1, 1),
    (-10, [1], [1], [3, 1], 2, "Returned independently after viewing the schedule.", 2, 2),
    (-12, [3], [0, 2], [0, 4], 0, "Completed work after a prompted functional request.", 3, 4),
    (-15, [0], [0], [4], 0, "Demand was resumed after brief choice making.", 2, 3),
    (-19, [4], [1], [2], 3, "Accepted headphones in quieter corner.", 2, 2),
    (-24, [2], [2], [5], 1, "Shared toy with adult coaching.", 2, 3),
    (-42, [1], [1], [1, 3], 2, "Historical transition observation.", 2, 2),
    (-68, [0], [0], [0], 0, "Historical baseline event.", 3, 5),
])

add_abc("cli-emma", [
    (-1, [0], [0], [0, 4], 0, "Selected which task to complete first and rejoined work.", 2, 3),
    (-1, [1], [1], [1, 3], 1, "Stood up after using the break picture.", 3, 2),
    (-3, [3], [2], [5], 1, "Returned to listening after praise for quiet participation.", 2, 2),
    (-4, [4], [0], [2], 3, "Exchanged a snack icon independently after prompting.", 1, 1),
    (-6, [5], [1], [1, 4], 2, "Used a first/then card to enter the playroom.", 3, 4),
    (-8, [0, 4], [0, 2], [0, 2], 3, "Started the task after a visual choice.", 2, 3),
    (-8, [3], [2], [5], 1, "Brief interruption, then followed the group model.", 1, 1),
    (-10, [1], [1], [3, 4], 1, "Practiced the transition with a break card.", 3, 3),
    (-12, [2], [0], [2], 2, "Requested the toy using an icon.", 2, 2),
    (-15, [0], [0], [0], 0, "Chose a shorter first task.", 2, 3),
    (-19, [4], [2], [5], 3, "Returned to quiet voice after reinforcement.", 2, 2),
    (-24, [5], [1], [1], 2, "Needed help standing before moving to group.", 3, 5),
    (-42, [0], [0], [0], 0, "Earlier task transition entry.", 2, 4),
    (-68, [1], [1], [1], 1, "Historical baseline entry.", 4, 6),
])

add_abc("cli-noah", [
    (-1, [0], [0], [0, 2], 2, "Rejoined the group after boundary rehearsal.", 3, 2),
    (-1, [1], [1], [1, 3], 1, "Accepted a sensory alternative and stopped biting.", 3, 3),
    (-3, [2], [2], [4], 0, "Quiet interval reinforced after instruction was shortened.", 2, 2),
    (-4, [5], [2], [3, 4], 0, "Modeled asking for a break before waiting.", 2, 2),
    (-6, [4], [0], [0], 2, "Stayed with adult following a boundary reminder.", 2, 1),
    (-8, [1, 2], [1, 2], [1, 5], 1, "Caregiver informed of sensory trigger.", 4, 4),
    (-8, [3], [2], [3], 3, "Requested a brief pause, then resumed.", 1, 2),
    (-10, [0], [0], [0, 2], 2, "Practiced staying at the marked spot.", 2, 2),
    (-12, [5], [1], [1], 3, "Used a chew alternative after a prompt.", 3, 3),
    (-15, [2], [2], [4], 0, "Completed the next direction after praise.", 2, 2),
    (-19, [4], [0], [0], 2, "Followed visual boundary to return.", 3, 2),
    (-24, [1], [1], [1], 1, "Noise reduced after moving to a quiet spot.", 3, 3),
    (-42, [0], [0], [0], 2, "Earlier group transition entry.", 3, 3),
    (-68, [2], [2], [4], 0, "Historical baseline entry.", 2, 2),
])

PHASE_LINES = [
    {"id": "pcl-1", "targetId": "tgt-expr-food", "date": "2026-09-23",
     "label": "Differential reinforcement introduced", "style": "Solid", "color": "#2563EB",
     "isAutomated": False, "source": "Manual"},
    {"id": "pcl-2", "targetId": "tgt-expr-food", "date": "2026-09-28",
     "label": "Generalization across settings", "style": "Dotted", "color": "#059669",
     "isAutomated": True, "source": "OutcomesPromotions"},
    {"id": "pcl-3", "targetId": "br-vocal", "date": "2026-09-25",
     "label": "Functional communication training", "style": "Solid", "color": "#DC2626",
     "isAutomated": False, "source": "Manual"},
    {"id": "pcl-4", "targetId": "tgt-emma-attending", "date": "2026-10-03",
     "label": "Group setting generalization", "style": "Dotted", "color": "#059669",
     "isAutomated": True, "source": "OutcomesPromotions"},
    {"id": "pcl-5", "targetId": "br-bolting", "date": "2026-09-30",
     "label": "Visual boundary introduced", "style": "Solid", "color": "#DC2626",
     "isAutomated": False, "source": "Manual"},
]
PHASE_RANGES = [
    {"id": "pr-1", "targetId": "tgt-expr-food", "startDate": "2026-09-15",
     "endDate": "2026-09-22", "label": "Baseline assessment", "color": "rgba(147, 197, 253, 0.25)"},
    {"id": "pr-2", "targetId": "tgt-emma-exchange", "startDate": "2026-09-16",
     "endDate": "2026-09-23", "label": "Initial picture exchange", "color": "rgba(147, 197, 253, 0.25)"},
]
GRAPH_NOTES = [
    {"id": "gn-1", "targetId": "tgt-expr-food", "date": "2026-09-24",
     "noteText": "Used familiar picture cards in a different therapy room.",
     "color": "#F59E0B", "staffName": "Sarah Jenkins, BCBA"},
    {"id": "gn-2", "targetId": "tgt-noah-waiting", "date": "2026-10-04",
     "noteText": "Visual schedule was moved next to the waiting area.",
     "color": "#F59E0B", "staffName": "David Kim, RBT"},
]


def main():
    fixture = {"asOfDate": AS_OF.isoformat(), "clients": CLIENTS,
               "promptHierarchyTemplates": PROMPT_HIERARCHY_TEMPLATES,
               "customFieldDefinitions": CUSTOM_FIELD_DEFINITIONS,
               "programs": PROGRAMS, "sessionData": SESSION_DATA,
               "phaseLines": PHASE_LINES, "phaseRanges": PHASE_RANGES,
               "graphNotes": GRAPH_NOTES, "abcConfigurations": ABC_CONFIGURATIONS,
               "abcEntries": ABC_ENTRIES}
    # Content-derived revision ensures existing browser demos reseed when the data
    # changes, even if the number of programs and records stays the same.
    payload = json.dumps(fixture, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    fixture["revision"] = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    output = ROOT / "data/clinicalSeed.json"
    serialized = json.dumps(fixture, indent=2, ensure_ascii=False) + "\n"
    if sys.argv[1:] == ["--check"]:
        if not output.exists() or output.read_text(encoding="utf-8") != serialized:
            raise SystemExit("Demo fixture is out of date; run python3 scripts/generate_clinical_seed.py")
        print("Clinical demo fixture is up to date.")
    elif len(sys.argv) == 1:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
        print(f"Wrote {len(PROGRAMS)} programs, {len(TARGETS)} targets, "
              f"{len(SESSION_DATA)} recordings and {len(ABC_ENTRIES)} ABC entries to {output}")
    else:
        raise SystemExit("Usage: python3 scripts/generate_clinical_seed.py [--check]")


if __name__ == "__main__":
    main()
