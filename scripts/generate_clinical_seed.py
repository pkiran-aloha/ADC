"""Build the shared, deterministic ABA demo fixture (no real client information).

Run: python3 scripts/generate_clinical_seed.py           # write data/clinicalSeed.json
     python3 scripts/generate_clinical_seed.py --check   # CI: the committed file is current

The checked-in JSON is imported by Vite and embedded by the .NET API. The data are
simulated rather than hand-typed:

* A service calendar (recurring appointments, holidays, absences, cancellations,
  substitutes, BCBA/BCaBA overlap supervision, caregiver guidance) drives everything.
* Skill targets follow explicit phase timelines (Baseline -> Acquisition ->
  Maintenance -> Generalization -> Completed). Trial-by-trial targets record the
  prompt level of every trial; mastery promotions happen only when the structured
  mastery rule is met, so the graphs and the phase history agree.
* Problem behavior is generated as episodes from function-specific models (escape,
  attention, tangible, automatic) with extinction bursts, setting events,
  time-of-day/weekday patterns, resurgence after breaks and precursor chains.
  Session rows summarize those episodes and the ABC log samples them, so ABC
  counts never exceed the measured counts.
* Interobserver agreement, procedural fidelity and supervision are recorded the way
  Cooper, Heron & Heward (2020) and the BACB describe them.

Randomness comes from a portable SplitMix64 generator with no libm transcendental
calls, so the output is byte-identical on every platform and Python version.
All dates are relative to the demo's as-of date, not to the machine clock.
"""

import hashlib
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AS_OF = date(2026, 10, 14)
MASK64 = (1 << 64) - 1


# --------------------------------------------------------------------------- #
# Deterministic helpers
# --------------------------------------------------------------------------- #
class Rng:
    """SplitMix64 seeded from a label, so each entity has an independent stream."""

    def __init__(self, label):
        self.state = int.from_bytes(hashlib.sha256(label.encode("utf-8")).digest()[:8], "big")

    def _next(self):
        self.state = (self.state + 0x9E3779B97F4A7C15) & MASK64
        value = self.state
        value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
        value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & MASK64
        return value ^ (value >> 31)

    def random(self):
        return (self._next() >> 11) / 9007199254740992.0

    def uniform(self, low, high):
        return low + (high - low) * self.random()

    def chance(self, probability):
        return self.random() < probability

    def randint(self, low, high):
        return low + int(self.random() * (high - low + 1))

    def choice(self, items):
        return items[int(self.random() * len(items))]

    def weighted(self, pairs):
        pairs = [(item, weight) for item, weight in pairs if weight > 0]
        total = sum(weight for _, weight in pairs)
        pick = self.random() * total
        for item, weight in pairs:
            pick -= weight
            if pick < 0:
                return item
        return pairs[-1][0]

    def normal(self, mu=0.0, sigma=1.0):
        # Irwin-Hall approximation: only additions, so results are portable.
        return mu + sigma * (sum(self.random() for _ in range(12)) - 6.0)

    def poisson(self, lam):
        # Binomial approximation of a Poisson count; avoids exp() for portability.
        if lam <= 0:
            return 0
        trials = max(24, int(lam * 6) + 12)
        probability = lam / trials
        return sum(1 for _ in range(trials) if self.random() < probability)


def d(text):
    return date.fromisoformat(text)


def to_minutes(text):
    hours, minutes = text.split(":")
    return int(hours) * 60 + int(minutes)


def clock(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def stamp(day, minutes):
    return f"{day.isoformat()}T{clock(minutes)}:00"


def js_round(value):
    """Math.round semantics; the JavaScript tests recompute percentages this way."""
    return int(math.floor(value + 0.5))


def tenths(part, whole):
    """Percentage to one decimal with JavaScript rounding (Math.round(1000 * part / whole) / 10)."""
    return js_round(1000 * part / whole) / 10


def clamp(value, low, high):
    return max(low, min(high, value))


def shaped(progress, shape="s"):
    x = clamp(progress, 0.0, 1.0)
    if shape == "fast":
        return 1 - (1 - x) * (1 - x)
    if shape == "slow":
        return x * x
    if shape == "linear":
        return x
    if shape == "flat":
        return 0.15 * x
    return x * x * (3 - 2 * x)


def root7(value):
    """Daily factor whose 7th power is `value` (Newton's method, portable arithmetic)."""
    x = 1.0 + (value - 1.0) / 7.0
    for _ in range(40):
        x6 = x * x * x * x * x * x
        x = x - (x6 * x - value) / (7 * x6)
    return x


def power(base, exponent):
    result = 1.0
    for _ in range(exponent):
        result *= base
    return result


# --------------------------------------------------------------------------- #
# Organisation, people and standards
# --------------------------------------------------------------------------- #
CLIENTS = [
    {"id": "cli-liam", "name": "Liam Miller", "code": "CL-1042", "dateOfBirth": "2018-04-12",
     "primaryDiagnosis": "Autism Spectrum Disorder (Level 2)", "supervisingBcba": "Sarah Jenkins, BCBA",
     "location": "Metro ABA Center - East", "serviceModel": "Comprehensive", "authorizedHoursPerWeek": 18,
     "serviceStartDate": "2026-04-13", "primarySetting": "Clinic"},
    {"id": "cli-emma", "name": "Emma Watson", "code": "CL-1088", "dateOfBirth": "2019-09-21",
     "primaryDiagnosis": "ASD with Speech Apraxia", "supervisingBcba": "David Vance, BCBA",
     "location": "Metro ABA Center - North", "serviceModel": "Comprehensive", "authorizedHoursPerWeek": 18,
     "serviceStartDate": "2026-05-04", "primarySetting": "Clinic"},
    {"id": "cli-noah", "name": "Noah Davis", "code": "CL-1095", "dateOfBirth": "2017-11-05",
     "primaryDiagnosis": "ASD with Sensory Processing Disorder", "supervisingBcba": "Sarah Jenkins, BCBA",
     "location": "In-Home Therapy", "serviceModel": "Focused", "authorizedHoursPerWeek": 10,
     "serviceStartDate": "2026-04-20", "primarySetting": "Home"},
    {"id": "cli-isla", "name": "Isla Bennett", "code": "CL-1117", "dateOfBirth": "2022-03-08",
     "primaryDiagnosis": "Autism Spectrum Disorder (Level 3)", "supervisingBcba": "Hannah Lee, BCBA",
     "location": "Metro ABA Center - North", "serviceModel": "Comprehensive", "authorizedHoursPerWeek": 25,
     "serviceStartDate": "2026-06-01", "primarySetting": "Clinic"},
    {"id": "cli-mateo", "name": "Mateo Alvarez", "code": "CL-1063", "dateOfBirth": "2014-01-27",
     "primaryDiagnosis": "ASD (Level 1) with ADHD", "supervisingBcba": "David Vance, BCBA",
     "location": "Lincoln Middle School & community", "serviceModel": "Focused", "authorizedHoursPerWeek": 7,
     "serviceStartDate": "2026-04-13", "primarySetting": "School"},
]
CLIENT_BY_ID = {client["id"]: client for client in CLIENTS}
SHORT = {"cli-liam": "liam", "cli-emma": "emma", "cli-noah": "noah", "cli-isla": "isla", "cli-mateo": "mateo"}

STAFF = [
    {"name": "Sarah Jenkins, BCBA", "role": "BCBA"},
    {"name": "David Vance, BCBA", "role": "BCBA"},
    {"name": "Hannah Lee, BCBA", "role": "BCBA"},
    {"name": "Priya Shah, BCaBA", "role": "BCaBA"},
    {"name": "Joe Ronald, RBT", "role": "RBT"},
    {"name": "Maya Patel, RBT", "role": "RBT"},
    {"name": "Nina Torres, RBT", "role": "RBT"},
    {"name": "Alex Chen, RBT", "role": "RBT"},
    {"name": "David Kim, RBT", "role": "RBT"},
    {"name": "Ava Brooks, RBT", "role": "RBT"},
    {"name": "Grace Oyelaran, RBT", "role": "RBT"},
    {"name": "Leo Martins, RBT", "role": "RBT", "startDate": "2026-08-03"},
]
ROLE = {person["name"]: person["role"] for person in STAFF}
LEO = "Leo Martins, RBT"
LEO_START = d("2026-08-03")
LEO_RETRAINED = d("2026-08-28")

CLINICAL_STANDARDS = {
    "ioa": {"minimumCoveragePercent": 20, "preferredCoveragePercent": 33,
            "minimumAgreementPercent": 80, "preferredAgreementPercent": 90,
            "source": "Cooper, Heron & Heward (2020); Kratochwill et al. (2010) WWC single-case standards"},
    "fidelity": {"minimumPercent": 85, "preferredPercent": 95,
                 "source": "Demo benchmark for procedural fidelity checklists; set by the supervising BCBA"},
    "supervision": {"rbtMinimumPercent": 5, "rbtMinimumContactsPerMonth": 2,
                    "source": "BACB RBT supervision requirements: at least 5% of each RBT's monthly service hours"},
    "stability": {"medianBandPercent": 25, "minimumWithinPercent": 80,
                  "source": "Lane & Gast (2014) stability envelope"},
    "nonoverlap": {"napBands": [0.66, 0.93], "pndBands": [50, 70, 90],
                   "source": "Parker & Vannest (2009) NAP; Scruggs & Mastropieri (1998) PND"},
    "cdc": {"shiftSd": 0.25, "alpha": 0.05, "source": "Fisher, Kelley & Lomas (2003) conservative dual-criterion"},
    # Graphing policy: the minimum session size that becomes a data point on a graph, so a
    # two-trial probe cannot suggest more variability than the sample supports.
    "graphing": {"minimumTrialsPerDataPoint": 5, "minimumMinutesPerDataPoint": 1,
                 "source": "Organisation graphing policy for the demo workspace; set by the clinical director"},
    # Behaviour-reduction mastery: baseline level plus a percentage reduction sustained over
    # consecutive measured days, unless an individual target configures its own rule.
    "behaviorReduction": {"reductionPercent": 80, "sustainedDays": 14, "baselineSource": "mean",
                          "source": "Dual-criterion style reduction rule (Fisher, Kelley & Lomas, 2003) scaled to the target's baseline"},
}

PROMPT_HIERARCHY_TEMPLATES = [
    {"id": "least-to-most", "name": "Least to Most",
     "levels": ["Independent", "Gestural", "Model", "Partial physical", "Full physical"],
     "codes": ["I", "G", "M", "P", "F"]},
    {"id": "most-to-least", "name": "Most to Least",
     "levels": ["Full physical", "Partial physical", "Model", "Gestural", "Independent"],
     "codes": ["F", "P", "M", "G", "I"]},
    {"id": "verbal-fading", "name": "Verbal Prompt Fading",
     "levels": ["Full verbal model", "Partial verbal model", "Initial sound", "Independent"],
     "codes": ["V", "P", "S", "I"]},
]
# Prompted trial codes ordered from least to most intrusive.
PROMPT_ORDER = {"least-to-most": ["G", "M", "P", "F"], "most-to-least": ["G", "M", "P", "F"],
                "verbal-fading": ["S", "P", "V"]}

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

# --------------------------------------------------------------------------- #
# Calendar: recurring appointments, closures and absences
# --------------------------------------------------------------------------- #
HOLIDAYS = {d("2026-05-25"), d("2026-06-19"), d("2026-07-03"), d("2026-09-07")}

SCHEDULES = {
    "cli-liam": [
        dict(days=[0, 2], start="09:00", end="12:00", setting="Clinic", staff="Joe Ronald, RBT"),
        dict(days=[1, 3], start="09:00", end="12:00", setting="Clinic", staff="Maya Patel, RBT"),
        dict(days=[4], start="15:30", end="17:30", setting="Home", staff="Maya Patel, RBT"),
        dict(days=[1], start="15:30", end="17:00", setting="Home", staff="Sarah Jenkins, BCBA",
             code="97155", start_date="2026-06-02", biweekly=True),
        dict(days=[3], start="17:30", end="18:30", setting="Telehealth", staff="Sarah Jenkins, BCBA",
             code="97156", start_date="2026-04-23", biweekly=True),
    ],
    "cli-emma": [
        dict(days=[0, 1], start="08:30", end="12:00", setting="Clinic", staff="Nina Torres, RBT"),
        dict(days=[2, 3], start="08:30", end="12:00", setting="Clinic", staff="Alex Chen, RBT"),
        dict(days=[4], start="09:00", end="11:00", setting="Community", staff="Alex Chen, RBT"),
        dict(days=[2], start="16:00", end="17:00", setting="Home", staff="David Vance, BCBA",
             code="97156", start_date="2026-05-06", biweekly=True),
    ],
    "cli-noah": [
        dict(days=[0, 2], start="15:00", end="17:30", setting="Home", staff="David Kim, RBT"),
        dict(days=[4], start="15:00", end="17:30", setting="Home", staff="Ava Brooks, RBT"),
        dict(days=[5], start="10:00", end="12:00", setting="Community", staff="Ava Brooks, RBT",
             start_date="2026-05-02", biweekly=True),
        dict(days=[0], start="17:45", end="18:45", setting="Home", staff="Sarah Jenkins, BCBA",
             code="97156", start_date="2026-04-27", biweekly=True),
    ],
    "cli-isla": [
        dict(days=[0, 1, 2], start="08:30", end="12:30", setting="Clinic", staff="Grace Oyelaran, RBT"),
        dict(days=[3, 4], start="08:30", end="12:30", setting="Clinic", staff="Grace Oyelaran, RBT",
             end_date="2026-07-31"),
        dict(days=[3, 4], start="08:30", end="12:30", setting="Clinic", staff=LEO, start_date="2026-08-03"),
        dict(days=[2], start="13:30", end="15:30", setting="Clinic", staff="Maya Patel, RBT"),
        dict(days=[4], start="13:30", end="14:30", setting="Telehealth", staff="Hannah Lee, BCBA",
             code="97156", start_date="2026-06-05", biweekly=True),
    ],
    "cli-mateo": [
        dict(days=[1, 3], start="12:30", end="14:30", setting="School", staff="Alex Chen, RBT",
             end_date="2026-06-12"),
        dict(days=[0], start="13:00", end="15:00", setting="Community", staff="Alex Chen, RBT",
             start_date="2026-06-15", end_date="2026-08-14"),
        dict(days=[3], start="13:00", end="15:00", setting="Home", staff="Alex Chen, RBT",
             start_date="2026-06-15", end_date="2026-08-14"),
        dict(days=[1, 3], start="12:30", end="14:30", setting="School", staff="Alex Chen, RBT",
             start_date="2026-08-17"),
        dict(days=[2], start="15:30", end="17:00", setting="Community", staff="Ava Brooks, RBT"),
        dict(days=[1], start="17:00", end="18:00", setting="Telehealth", staff="David Vance, BCBA",
             code="97156", start_date="2026-04-14", biweekly=True),
    ],
}

ABSENCES = {
    "cli-liam": [("2026-07-27", "2026-07-31", "Family vacation"), ("2026-08-24", "2026-08-25", "Client illness")],
    "cli-emma": [("2026-06-15", "2026-06-16", "Client illness"), ("2026-08-17", "2026-08-21", "Family vacation")],
    "cli-noah": [("2026-09-21", "2026-09-23", "Client illness")],
    "cli-isla": [("2026-09-08", "2026-09-09", "Client illness")],
    "cli-mateo": [("2026-05-19", "2026-05-21", "School testing week"), ("2026-07-20", "2026-07-24", "Family vacation")],
}
STAFF_ABSENCES = {"Joe Ronald, RBT": [("2026-08-10", "2026-08-14")], "Alex Chen, RBT": [("2026-07-06", "2026-07-07")]}
SETTING_EVENT_WINDOWS = {
    "cli-liam": [("2026-08-26", "2026-08-27", "Illness symptoms")],
    "cli-isla": [("2026-09-10", "2026-09-11", "Illness symptoms")],
    "cli-noah": [("2026-08-10", "2026-08-23", "Medication change")],
    "cli-mateo": [("2026-09-01", "2026-09-11", "Change at home")],
    "cli-emma": [("2026-06-17", "2026-06-17", "Illness symptoms")],
}
SLEEP_RATE = {"cli-liam": 0.12, "cli-emma": 0.07, "cli-noah": 0.10, "cli-isla": 0.12, "cli-mateo": 0.06}
SUPERVISORS = {"cli-liam": ["Sarah Jenkins, BCBA"], "cli-emma": ["David Vance, BCBA"],
               "cli-noah": ["Sarah Jenkins, BCBA"], "cli-isla": ["Hannah Lee, BCBA", "Priya Shah, BCaBA"],
               "cli-mateo": ["David Vance, BCBA", "Priya Shah, BCaBA"]}
FIDELITY = {"Joe Ronald, RBT": 93, "Maya Patel, RBT": 96, "Nina Torres, RBT": 91, "Alex Chen, RBT": 89,
            "David Kim, RBT": 92, "Ava Brooks, RBT": 90, "Grace Oyelaran, RBT": 94}
EVENT_EFFECT = {"Poor sleep reported": 1.55, "Missed breakfast": 1.3, "Illness symptoms": 1.5,
                "Substitute staff": 1.35, "Schedule change": 1.45, "Medication change": 1.6,
                "Change at home": 1.5}


def in_window(day, windows):
    return next((label for start, end, label in windows if d(start) <= day <= d(end)), None)


# --------------------------------------------------------------------------- #
# Programs and targets
# --------------------------------------------------------------------------- #
PROGRAMS = []
TARGETS = {}
MODELS = {}


def rule(measure, comparison, threshold, sessions):
    return {"measure": measure, "comparison": comparison, "threshold": threshold, "consecutiveSessions": sessions}


def target(id, name, kind, history, stimuli, description, mastery, mastery_rule, model, *,
           settings="Automatic", instructions=None, color="#346b52", prompt=None, interval=None, fluency=None):
    """Only serialize fields applicable to the selected measurement tool."""
    timeline = [(phase, d(day)) for phase, day in history]
    assert all(a[1] < b[1] for a, b in zip(timeline, timeline[1:])), id
    item = {"id": id, "name": name, "description": description, "type": kind,
            "phase": timeline[-1][0], "phaseEnteredDate": timeline[-1][1].isoformat(),
            "phaseHistory": [{"phase": phase, "date": day.isoformat()} for phase, day in timeline],
            "discriminativeStimuli": stimuli, "masterySettings": settings,
            "masteryCriteria": mastery, "color": color}
    if mastery_rule:
        item["masteryRule"] = mastery_rule
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
    MODELS[id] = dict(model, kind=kind, history=timeline, settings_mode=settings, rule=mastery_rule,
                      prompt=item.get("promptHierarchyId"), interval=interval)
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


def pct(threshold, sessions=3):
    return rule("percentCorrect", "atLeast", threshold, sessions)


# ---- Liam ----------------------------------------------------------------- #
LIAM_PREFERENCE_NOTES = [
    "Chose yogurt when offered yogurt or crackers without prompting.",
    "Asked for apple slices using a full sentence at the snack table.",
    "Said 'No broccoli, please' and chose another vegetable.",
    "Requested banana while the picture cards were being put away.",
    "Asked for water before staff offered a drink.",
    "Pointed to the cereal box and said 'cereal, please' at home.",
    "Told the therapist 'I like the red apple' while labeling.",
    "Refused raisins by saying 'not that one' instead of pushing the plate.",
    "Requested 'more crackers' twice during a peer snack.",
    "Named a new food (hummus) spontaneously and asked to taste it.",
    "Commented 'that's sour' after tasting a lemon slice.",
    "Asked his mother for 'pasta for dinner' during the home session.",
]
add_program(
    "prog-expressive", "cli-liam", "Expressive Labeling", "SkillAcquisition", "Generalizing",
    "Communication", "Independently label familiar foods, actions, animals and community helpers across people and settings.",
    "Present one picture at a time, wait five seconds, follow the assigned prompt hierarchy, and reinforce independent labels.",
    [target("tgt-expr-food", "Expressive Food Items", "TrialByTrial",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27"), ("Maintenance", "2026-07-21"),
             ("Generalization", "2026-09-28")],
            "Show a food card and ask 'What is this?'", "Names foods shown on picture cards.",
            "At least 8/10 independent labels for 3 sessions", pct(80),
            dict(base=0.3, peak=0.92, shape="s", trials=10, minutes=8, intervention=("2026-06-08", 0.08)),
            prompt="verbal-fading", color="#3B82F6"),
     target("tgt-expr-actions", "Label Everyday Actions", "TrialByTrial",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18"), ("Maintenance", "2026-09-22")],
            "Show an action picture and ask 'What is happening?'", "Names actions without an echoic prompt.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.22, peak=0.9, shape="slow", trials=10, minutes=8), color="#6366F1"),
     target("tgt-expr-animals", "Label Zoo Animals", "TrialByTrial",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27"), ("Maintenance", "2026-06-16"),
             ("Generalization", "2026-07-20"), ("Completed", "2026-08-31")],
            "Show an animal figurine and ask 'Who is this?'", "Names zoo animals from figurines and books.",
            "At least 9/10 for 3 sessions", pct(90),
            dict(base=0.42, peak=0.97, shape="fast", trials=10, minutes=6), settings="Manual", color="#8B5CF6"),
     target("tgt-expr-helpers", "Label Community Helpers", "TrialByTrial",
            [("Baseline", "2026-08-31"), ("Acquisition", "2026-09-08")],
            "Show a community helper photo and ask 'Who is this?'", "Names community helpers from photos.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.18, peak=0.68, shape="linear", trials=10, minutes=8), prompt="verbal-fading", color="#0EA5E9"),
     target("tgt-expr-preference", "Food Preference Observations", "Anecdotal",
            [("Acquisition", "2026-04-27")],
            "Offer two snack options and wait for a choice.", "Record the client's own words and context.",
            "Clinical review of spontaneous requests", None,
            dict(notes=LIAM_PREFERENCE_NOTES), settings="Manual", color="#A855F7")],
    tags=["Tacting", "Communication"], materials=["food"],
    baseline="3 of 10 food cards named without prompts during the April baseline.",
    custom={"reinforcer": "Choice of sticker or music", "generalizationSetting": "Clinic and kitchen"})

add_program(
    "prog-playing", "cli-liam", "Playing with Toys", "SkillAcquisition", "Maintaining",
    "Play & Leisure", "Build sustained independent play and reciprocal peer play.",
    "Offer a choice of materials; start timing on independent engagement and record each scheduled observation interval.",
    [target("tgt-play-independent", "Independent Block Play", "Duration",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27")],
            "Place the building blocks on the mat and say 'You can build.'", "Seconds of uninterrupted independent play.",
            "At least 300 seconds for 3 sessions", rule("durationSeconds", "atLeast", 300, 3),
            dict(base=70, peak=330, shape="s", minutes=15, bouts=3, awaiting=True), settings="Manual",
            instructions="Stop timer for prompts or disengagement.", color="#2563EB"),
     target("tgt-play-turn-taking", "Turn Taking in Board Games", "IntervalData",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04"), ("Maintenance", "2026-09-25")],
            "Say 'Your turn' or 'Wait for your friend.'", "Observe unprompted turn taking across whole intervals.",
            "At least 85% of intervals for 3 sessions", rule("percentIntervals", "atLeast", 85, 3),
            dict(base=0.3, peak=0.9, shape="s"),
            interval=interval("LessonStart", "00:30", "Whole", 20), color="#10B981"),
     target("tgt-play-share", "Share Materials with a Peer", "TrialByTrial",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27"), ("Maintenance", "2026-07-07"),
             ("Completed", "2026-10-02")],
            "Peer asks to borrow one shared block.", "Hands over a block when requested.",
            "At least 9/10 across 3 peers", pct(90),
            dict(base=0.4, peak=0.96, shape="fast", trials=10, minutes=6, settings=["Clinic"]),
            settings="Manual", color="#14B8A6")],
    tags=["Play", "Social"], materials=["interval"],
    baseline="Independent play averaged 75 seconds; turn taking occurred in 6 of 20 intervals.",
    custom={"reinforcer": "Choice of next game"})

add_program(
    "prog-manding", "cli-liam", "Spontaneous Requests", "SkillAcquisition", "Teaching",
    "Functional Communication", "Increase unprompted requests for items and help.",
    "Arrange motivating opportunities, pause to allow initiation, and count only independently initiated requests.",
    [target("tgt-mands-spontaneous", "Spontaneous Two-Word Requests", "Frequency",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27")],
            "Preferred item visible but out of reach.", "Count independent two-word requests.",
            "At least 15 per hour for 3 sessions", rule("ratePerHour", "atLeast", 15, 3),
            dict(base=4.0, peak=13.5, shape="s", minutes=60), color="#F59E0B"),
     target("tgt-mands-help", "Request Help", "Frequency",
            [("Baseline", "2026-09-14")],
            "Present a closed container containing a desired item.", "Count requests for assistance without prompting.",
            "At least 6 per hour for 3 sessions", rule("ratePerHour", "atLeast", 6, 3),
            dict(base=1.5, peak=1.5, minutes=60), color="#D97706")],
    tags=["Mand", "Communication"], custom={"caregiverPractice": "Practice during snack at home"})

add_program(
    "prog-fluency", "cli-liam", "Fluent Naming", "SkillAcquisition", "Teaching",
    "Academic / Fluency", "Increase correct responses per minute during timed practice (precision teaching).",
    "Run a one-minute timing, count corrects and errors, and chart both on the celeration view.",
    [target("tgt-sight-words", "Rapid Sight Word Naming", "FluencyRate",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18")],
            "Present primer sight word cards and say 'Read.'", "Correct words per one-minute timing.",
            "At least 40 correct per minute for 3 timings", rule("correctPerMinute", "atLeast", 40, 3),
            dict(base=14, cap=44, approach=0.93, errors=6.0, error_cap=1.0, minutes=1),
            fluency="ManualStartCountDown", color="#EC4899"),
     target("tgt-action-fluency", "Action Naming Fluency", "FluencyRate",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04"), ("Maintenance", "2026-09-29")],
            "Show action cards and say 'Name as many as you can.'", "Correct action labels per minute.",
            "At least 20 correct per minute for 3 timings", rule("correctPerMinute", "atLeast", 20, 3),
            dict(base=8, cap=25, approach=0.9, errors=4.0, error_cap=0.6, minutes=1),
            fluency="LessonStartCountUp", color="#DB2777"),
     target("tgt-object-fluency", "Classroom Object Fluency", "FluencyRate",
            [("Baseline", "2026-09-21")],
            "Lay out classroom object cards; say 'Name these.'", "Correct object names per minute.",
            "At least 25 correct per minute for 3 timings", rule("correctPerMinute", "atLeast", 25, 3),
            dict(base=9, cap=9, approach=1.0, errors=3.0, error_cap=3.0, minutes=1),
            fluency="ManualStartCountUp", color="#BE185D")],
    tags=["Fluency", "Timed probe"], baseline="14 correct words per minute in May.")

add_program(
    "prog-receptive", "cli-liam", "Following Classroom Directions", "SkillAcquisition", "Baselining",
    "Receptive Language", "Establish a baseline for receptive directions before teaching.",
    "Give one clear direction without a second cue; record independent responses and observation intervals.",
    [target("tgt-receptive-shapes", "Identify Shapes", "TrialByTrial",
            [("Baseline", "2026-10-01")],
            "Place three shapes and say 'Touch the circle.'", "Independently touches the named shape.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.36, peak=0.36, trials=10, minutes=6), color="#0EA5E9"),
     target("tgt-receptive-attend", "Attend to Group Directions", "IntervalData",
            [("Baseline", "2026-10-01")],
            "Teacher announces a group activity.", "Record any attending within a partial interval.",
            "At least 75% of intervals", rule("percentIntervals", "atLeast", 75, 3),
            dict(base=0.45, peak=0.45, total=(10, 14)),
            interval=interval("Manual", "00:45", "Partial"), color="#0284C7")],
    tags=["Baseline", "Classroom"], materials=["schedule"])

add_program(
    "prog-liam-greetings", "cli-liam", "Greeting Familiar Adults", "SkillAcquisition", "Completed",
    "Social Skills", "Respond to greetings from familiar adults without prompts.",
    "Provide a natural greeting, wait five seconds, and score the independent response.",
    [target("tgt-liam-greeting", "Respond to Hello", "TrialByTrial",
            [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-20"), ("Maintenance", "2026-06-02"),
             ("Generalization", "2026-07-13"), ("Completed", "2026-10-05")],
            "A familiar adult says 'Hello, Liam.'", "Says hello or waves independently.",
            "At least 9/10 across 3 adults", pct(90),
            dict(base=0.45, peak=0.96, shape="fast", trials=5, minutes=3), settings="Manual", color="#16A34A")],
    tags=["Social", "Mastered"])

# ---- Emma ----------------------------------------------------------------- #
EMMA_CHOICE_NOTES = [
    "Selected the swing icon and pointed to the door.",
    "Exchanged a snack picture with the visiting therapist.",
    "Used 'more bubbles' after the first round of play.",
    "Chose a book using an icon without adult prompting.",
    "Signed 'all done' and handed over the puzzle.",
    "Picked the playdough icon over the blocks and smiled.",
    "Approximated 'juice' vocally while touching the icon.",
    "Chose a peer to play with by tapping the photo board.",
    "Requested the slide at playgroup using two icons.",
    "Rejected the tablet icon and chose music instead.",
    "Said 'go' to start the car ramp game.",
]
add_program(
    "prog-emma-requests", "cli-emma", "Picture-Assisted Requests", "SkillAcquisition", "Teaching",
    "Communication", "Use picture exchange and speech to make functional requests.",
    "Place communication icons within reach, allow initiation, and use the assigned prompt hierarchy for exchange trials.",
    [target("tgt-emma-exchange", "Exchange a Picture for Snack", "TrialByTrial",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18")],
            "Hold a preferred snack and display the matching picture.", "Hands over the matching icon to request.",
            "At least 8/10 independent exchanges", pct(80),
            dict(base=0.2, peak=0.76, shape="slow", trials=10, minutes=8), prompt="most-to-least", color="#4F46E5"),
     target("tgt-emma-requests", "Vocal Requests", "Frequency",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18")],
            "Offer a choice of two activities.", "Count independently initiated spoken requests.",
            "At least 8 per session", rule("count", "atLeast", 8, 3),
            dict(base=1.0, peak=1.9, shape="s", minutes="session"), color="#EAB308"),
     target("tgt-emma-choices", "Choice-Making Notes", "Anecdotal",
            [("Acquisition", "2026-05-18")],
            "Present a preferred and neutral activity.", "Write the exact words or gesture used for the choice.",
            "Review weekly with supervisor", None, dict(notes=EMMA_CHOICE_NOTES), settings="Manual", color="#A855F7")],
    tags=["AAC", "Mands"], materials=["food"],
    baseline="2 of 10 independent picture exchanges in early May.",
    custom={"reinforcer": "Preferred snack", "caregiverPractice": "Offer icon board at breakfast"})

add_program(
    "prog-emma-social", "cli-emma", "Peer Engagement", "SkillAcquisition", "Generalizing",
    "Social Skills", "Greet peers and sustain short shared activities in different rooms.",
    "Use a peer model, fade adult prompts, and measure duration and momentary attending in group play.",
    [target("tgt-emma-greeting", "Greet a Peer", "TrialByTrial",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18"), ("Maintenance", "2026-08-11"),
             ("Generalization", "2026-09-30")],
            "Peer approaches and says 'Hi.'", "Returns a greeting without a prompt.",
            "At least 8/10 across 2 settings", pct(80),
            dict(base=0.25, peak=0.9, shape="s", trials=6, minutes=5), color="#0D9488"),
     target("tgt-emma-peer-play", "Shared Play", "Duration",
            [("Baseline", "2026-05-11"), ("Acquisition", "2026-05-25"), ("Maintenance", "2026-09-26")],
            "Peer invites client to build together.", "Seconds participating in joint play.",
            "At least 240 seconds for 3 sessions", rule("durationSeconds", "atLeast", 240, 3),
            dict(base=55, peak=265, shape="s", minutes=10, bouts=3), color="#059669"),
     target("tgt-emma-attending", "Group Circle Attending", "IntervalData",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18"), ("Maintenance", "2026-08-25"),
             ("Generalization", "2026-10-03")],
            "Teacher begins circle time.", "Eyes/body oriented to group at the observation instant.",
            "At least 80% of checks", rule("percentIntervals", "atLeast", 80, 3),
            dict(base=0.35, peak=0.87, shape="s"),
            interval=interval("LessonStart", "01:00", "MomentaryTimeSampling", 15), color="#14B8A6")],
    tags=["Peer play", "Generalization"], materials=["interval"],
    custom={"generalizationSetting": "Playroom and community group"})

add_program(
    "prog-emma-pending", "cli-emma", "Community Safety Preview", "SkillAcquisition", "Pending",
    "Community Skills", "Introduce safety routines after caregiver consent and baseline planning.",
    "Do not collect trials until the supervisor activates this program.",
    [target("tgt-emma-crosswalk", "Stop at Crosswalk", "TrialByTrial",
            [("Pending", "2026-10-14")],
            "An adult approaches a marked crossing.", "Stops at the boundary with an adult.",
            "At least 9/10 across 3 outings", pct(90, 3), dict(base=0.3, peak=0.3, trials=10),
            settings="Manual")],
    tags=["Pending"], include_treatment_area=False)

add_program(
    "prog-emma-onhold", "cli-emma", "Fine Motor Beading", "SkillAcquisition", "OnHold",
    "Motor Skills", "Sustain fine motor bead placement during short activities.",
    "Pause instruction pending updated occupational therapy guidance; historical data is retained.",
    [target("tgt-emma-beads", "String Beads Independently", "Duration",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18"), ("OnHold", "2026-08-24")],
            "Present beads and a cord.", "Seconds of independent fine motor engagement.",
            "At least 180 seconds", rule("durationSeconds", "atLeast", 180, 3),
            dict(base=55, peak=125, shape="linear", minutes=6, bouts=2), settings="Manual", color="#7C3AED")])

# ---- Noah ----------------------------------------------------------------- #
NOAH_NOTES = [
    "Asked the therapist to open the pretend store door.",
    "Looked at a stop sign and asked what it meant.",
    "Requested a cart during role-play without prompting.",
    "Said 'excuse me' to get past a shopper in the aisle.",
    "Asked 'where are the apples?' after a model.",
    "Covered ears near the checkout and asked for headphones.",
    "Handed money to the cashier and waited for change.",
    "Pointed to the exit sign and said 'out'.",
]
add_program(
    "prog-noah-routines", "cli-noah", "Daily Living Routines", "SkillAcquisition", "Maintaining",
    "Adaptive Living", "Complete self-care steps and wait calmly during routine transitions.",
    "Use a visual schedule, record each independent response, and time continuous routine engagement.",
    [target("tgt-noah-dressing", "Follow Dressing Sequence", "TrialByTrial",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04"), ("Maintenance", "2026-09-28")],
            "Present visual dressing sequence and clothes.", "Completes the requested step independently.",
            "At least 8/10 steps for 3 sessions", pct(80),
            dict(base=0.28, peak=0.88, shape="slow", trials=8, minutes=10), prompt="most-to-least", color="#2563EB"),
     target("tgt-noah-washing", "Hand-Washing Engagement", "Duration",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04")],
            "Show handwashing card at sink.", "Seconds engaged in washing sequence.",
            "At least 120 continuous seconds", rule("durationSeconds", "atLeast", 120, 3),
            dict(base=35, peak=104, shape="linear", minutes=4, bouts=2), color="#0EA5E9"),
     target("tgt-noah-waiting", "Wait with Visual Schedule", "IntervalData",
            [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-18")],
            "Show 'wait' icon before a transition.", "Waits during any part of a partial interval.",
            "At least 80% of intervals", rule("percentIntervals", "atLeast", 80, 3),
            dict(base=0.28, peak=0.72, shape="s"),
            interval=interval("Manual", "00:30", "Partial", 10), color="#10B981")],
    tags=["Adaptive", "Transitions"], materials=["schedule"],
    baseline="Needed prompts for seven of ten dressing steps.",
    custom={"caregiverPractice": "Practice at morning routine", "reinforcer": "Choose breakfast music"})

add_program(
    "prog-noah-community", "cli-noah", "Community Communication", "SkillAcquisition", "Teaching",
    "Community Skills", "Ask for help and label useful community items.",
    "Arrange community role-play, tally spontaneous requests, and time naming probes using a count-up timer.",
    [target("tgt-noah-help", "Ask for Help in Community", "Frequency",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04")],
            "A familiar item is placed out of reach in role-play.", "Counts independent requests for help.",
            "At least 6 per session", rule("count", "atLeast", 6, 3),
            dict(base=0.4, peak=1.9, shape="s", minutes="session"), color="#D97706"),
     target("tgt-noah-signs", "Name Community Signs", "FluencyRate",
            [("Baseline", "2026-09-07")],
            "Show familiar street sign cards and say 'Name these.'", "Correct sign labels per minute.",
            "At least 12 correct per minute", rule("correctPerMinute", "atLeast", 12, 3),
            dict(base=5, cap=5, approach=1.0, errors=2.5, error_cap=2.5, minutes=1),
            fluency="LessonStartCountUp", color="#DB2777"),
     target("tgt-noah-observations", "Community Role-Play Notes", "Anecdotal",
            [("Baseline", "2026-09-07")],
            "Begin a simulated store visit.", "Record exact words and context for requests.",
            "Review each session", None, dict(notes=NOAH_NOTES), settings="Manual", color="#9333EA")],
    tags=["Community", "Communication"],
    custom={"generalizationSetting": "Clinic role-play, then neighborhood"})

add_program(
    "prog-noah-discontinued", "cli-noah", "Legacy Puzzle Sorting", "SkillAcquisition", "Discontinued",
    "Academic", "Retain historical sorting data for review after goals changed.",
    "Do not run new trials; the archived goal was replaced by functional living skills after a flat trend.",
    [target("tgt-noah-puzzle", "Sort Puzzle Pieces", "TrialByTrial",
            [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-04"), ("Discontinued", "2026-08-20")],
            "Show two puzzle-piece groups and say 'Sort.'", "Places a piece in the matching group.",
            "Historical goal; no new mastery evaluation", pct(80),
            dict(base=0.42, peak=0.5, shape="flat", trials=10, minutes=6), settings="Manual")],
    tags=["Archived"])

# ---- Isla ----------------------------------------------------------------- #
ISLA_NOTES = [
    "Looked from the bubbles to the therapist and back when bubbles stopped.",
    "Followed a point to the window when a bus passed.",
    "Brought a car to show Grace and smiled.",
    "Did not shift gaze when the therapist pointed to the poster.",
    "Turned toward her name on the second call during play.",
    "Held up a block and vocalized 'ba' while looking at the therapist.",
    "Tracked a rolling ball to a peer and laughed.",
    "Reached for the adult's hand to request the spinning top.",
]
add_program(
    "prog-isla-mands", "cli-isla", "Early Manding", "SkillAcquisition", "Teaching",
    "Functional Communication", "Request preferred items with vocal approximations or signs.",
    "Contrive motivation with preferred items in view; use a 3-second prompt delay and fade physical prompts.",
    [target("tgt-isla-mand-items", "Mand for Preferred Items", "TrialByTrial",
            [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-08"), ("Maintenance", "2026-08-25"),
             ("Generalization", "2026-09-21")],
            "Hold up a preferred item and wait.", "Signs or approximates the item name to request it.",
            "At least 8/10 independent mands for 3 sessions", pct(80),
            dict(base=0.12, peak=0.9, shape="s", trials=10, minutes=10), prompt="most-to-least", color="#346b52"),
     target("tgt-isla-mand-rate", "Independent Mands per Hour", "Frequency",
            [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-15")],
            "Preferred items rotated through natural play.", "Count unprompted mands during a one-hour sample.",
            "At least 20 per hour for 3 sessions", rule("ratePerHour", "atLeast", 20, 3),
            dict(base=2.0, peak=15.0, shape="s", minutes=60), color="#9b7a3d")],
    tags=["Mand", "Early learner"], custom={"reinforcer": "Bubbles, spinning top, music"})

add_program(
    "prog-isla-imitation", "cli-isla", "Motor Imitation", "SkillAcquisition", "Maintaining",
    "Imitation", "Imitate gross motor, object and fine motor actions after a model.",
    "Say 'Do this' with a single model; use most-to-least prompting and reinforce independent imitation.",
    [target("tgt-isla-gross-imitation", "Gross Motor Imitation", "TrialByTrial",
            [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-08"), ("Maintenance", "2026-07-28")],
            "Model clapping, arms up, or stomping and say 'Do this.'", "Imitates the gross motor action within 3 seconds.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.24, peak=0.93, shape="fast", trials=10, minutes=6), prompt="most-to-least", color="#697b96"),
     target("tgt-isla-object-imitation", "Imitate Actions with Objects", "TrialByTrial",
            [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-08"), ("Maintenance", "2026-07-14"),
             ("Completed", "2026-09-14")],
            "Model an action with a toy (roll car, shake maraca).", "Imitates the object action within 3 seconds.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.3, peak=0.95, shape="fast", trials=10, minutes=6), prompt="most-to-least", color="#a36959"),
     target("tgt-isla-fine-imitation", "Fine Motor Imitation", "TrialByTrial",
            [("Baseline", "2026-08-03"), ("Acquisition", "2026-08-10")],
            "Model finger movements (point, wiggle, pinch).", "Imitates the fine motor action within 3 seconds.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.08, peak=0.58, shape="s", trials=10, minutes=6), prompt="most-to-least", color="#527d82")],
    tags=["Imitation", "Early learner"])

add_program(
    "prog-isla-matching", "cli-isla", "Visual Matching", "SkillAcquisition", "Teaching",
    "Visual Performance", "Match identical objects and then objects to pictures.",
    "Present a field of three; say 'Match' and use least-to-most prompting after a 5-second delay.",
    [target("tgt-isla-match-identical", "Match Identical Objects", "TrialByTrial",
            [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-08"), ("Maintenance", "2026-07-21"),
             ("Generalization", "2026-08-31")],
            "Hand an object and say 'Match.'", "Places the object with its identical match.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.38, peak=0.95, shape="fast", trials=10, minutes=6), color="#65735a"),
     target("tgt-isla-match-pictures", "Match Object to Picture", "TrialByTrial",
            [("Baseline", "2026-07-27"), ("Acquisition", "2026-08-03")],
            "Hand an object and say 'Match' with three pictures on the table.", "Places the object on its picture.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.2, peak=0.7, shape="linear", trials=10, minutes=6), color="#346b52")],
    tags=["Matching"], materials=["schedule"])

add_program(
    "prog-isla-toileting", "cli-isla", "Toilet Training", "SkillAcquisition", "Teaching",
    "Adaptive Living", "Stay dry between scheduled sits and sit calmly on the toilet.",
    "Run a 30-minute sit schedule; check pants at each momentary check and time calm sitting.",
    [target("tgt-isla-dry-checks", "Dry at Scheduled Checks", "IntervalData",
            [("Baseline", "2026-06-15"), ("Acquisition", "2026-06-29")],
            "Check pants at each scheduled 30-minute mark.", "Pants are dry at the momentary check.",
            "Dry at 90% of checks for 5 days", rule("percentIntervals", "atLeast", 90, 5),
            dict(base=0.42, peak=0.8, shape="s"),
            interval=interval("LessonStart", "30:00", "MomentaryTimeSampling", 8), color="#9b7a3d"),
     target("tgt-isla-sitting", "Sit Calmly on Toilet", "Duration",
            [("Baseline", "2026-06-15"), ("Acquisition", "2026-06-22"), ("Maintenance", "2026-09-01")],
            "Say 'Potty time' and guide to the bathroom.", "Seconds seated calmly during the scheduled sit.",
            "At least 120 seconds for 3 sessions", rule("durationSeconds", "atLeast", 120, 3),
            dict(base=20, peak=165, shape="s", minutes=4, bouts=2), color="#527d82")],
    tags=["Adaptive", "Toileting"], custom={"caregiverPractice": "Matching sit schedule at home"})

add_program(
    "prog-isla-joint-attention", "cli-isla", "Joint Attention", "SkillAcquisition", "Baselining",
    "Social Communication", "Respond to joint attention bids before teaching initiations.",
    "Present a joint attention bid (point plus gaze shift) and score orienting within 5 seconds; no prompts in baseline.",
    [target("tgt-isla-respond-ja", "Respond to Joint Attention Bids", "TrialByTrial",
            [("Baseline", "2026-09-28")],
            "Point to an interesting item and say 'Look!'", "Orients to the item within 5 seconds.",
            "At least 8/10 for 3 sessions", pct(80),
            dict(base=0.22, peak=0.22, trials=10, minutes=5), color="#697b96"),
     target("tgt-isla-ja-notes", "Joint Attention Notes", "Anecdotal",
            [("Baseline", "2026-09-28")],
            "Natural play with novel toys.", "Narrative notes on gaze shifts and showing.",
            "Review weekly with supervisor", None, dict(notes=ISLA_NOTES), settings="Manual", color="#a36959")],
    tags=["Baseline", "Social communication"])

# ---- Mateo ---------------------------------------------------------------- #
MATEO_NOTES = [
    "Asked a peer about the weekend soccer game and listened to the answer.",
    "Shifted from trains to the peer's video game topic after one prompt.",
    "Interrupted twice, then used the 'my turn to talk' card.",
    "Joined a lunch table conversation about a movie without prompting.",
    "Asked the cashier where the batteries were.",
    "Talked about subway maps for four minutes; peer walked away.",
    "Complimented a classmate's drawing and asked how they made it.",
    "Used a calm voice to disagree about game rules.",
    "Asked to sit with peers at lunch for the first time this month.",
    "Answered a peer's question, then asked one back.",
    "Explained the bus route to his sister during a community outing.",
    "Ended a conversation politely by saying he had to go to class.",
]
add_program(
    "prog-mateo-conversation", "cli-mateo", "Conversation Skills", "SkillAcquisition", "Teaching",
    "Social Skills", "Initiate and sustain reciprocal conversations with peers.",
    "Pre-correct before lunch, use a visual conversation map, and fade adult prompts to self-monitoring.",
    [target("tgt-mateo-initiations", "Initiate Peer Conversation", "Frequency",
            [("Baseline", "2026-04-14"), ("Acquisition", "2026-04-28")],
            "Lunch or free time with familiar peers nearby.", "Count unprompted conversation openers with peers.",
            "At least 6 per hour for 3 sessions", rule("ratePerHour", "atLeast", 6, 3),
            dict(base=1.2, peak=5.2, shape="s", minutes=30), color="#346b52"),
     target("tgt-mateo-topic", "Stay on Topic for 3 Exchanges", "TrialByTrial",
            [("Baseline", "2026-04-14"), ("Acquisition", "2026-04-28"), ("Maintenance", "2026-08-26"),
             ("Generalization", "2026-09-15")],
            "A peer starts a topic.", "Contributes three on-topic exchanges.",
            "At least 5/6 opportunities for 3 sessions", pct(80),
            dict(base=0.3, peak=0.88, shape="s", trials=6, minutes=10), color="#9b7a3d"),
     target("tgt-mateo-conv-notes", "Conversation Observation Notes", "Anecdotal",
            [("Acquisition", "2026-04-28")],
            "Peer conversation opportunities.", "Exact words, topic shifts and peer responses.",
            "Review weekly with supervisor", None, dict(notes=MATEO_NOTES), settings="Manual", color="#697b96")],
    tags=["Social", "Conversation"], custom={"generalizationSetting": "Lunch, community outings and home"})

add_program(
    "prog-mateo-money", "cli-mateo", "Money Skills", "SkillAcquisition", "Teaching",
    "Academic / Fluency", "Count coins fluently and calculate change for purchases.",
    "Use one-minute coin-counting timings and worksheet trials; chart corrects and errors daily.",
    [target("tgt-mateo-coins", "Count Coin Combinations", "FluencyRate",
            [("Baseline", "2026-04-14"), ("Acquisition", "2026-04-21")],
            "Present mixed coin cards and say 'Count.'", "Correct coin totals per one-minute timing.",
            "At least 25 correct per minute for 3 timings", rule("correctPerMinute", "atLeast", 25, 3),
            dict(base=6, cap=24.5, approach=0.915, errors=5.0, error_cap=0.8, minutes=1),
            fluency="ManualStartCountDown", color="#a36959"),
     target("tgt-mateo-change", "Calculate Change", "TrialByTrial",
            [("Baseline", "2026-06-16"), ("Acquisition", "2026-06-23")],
            "Pose a purchase with a $5 or $10 bill.", "States the correct change.",
            "At least 7/8 for 3 sessions", pct(85),
            dict(base=0.2, peak=0.68, shape="s", trials=8, minutes=8), color="#527d82")],
    tags=["Money", "Fluency"])

add_program(
    "prog-mateo-selfmgmt", "cli-mateo", "Self-Management", "SkillAcquisition", "Generalizing",
    "Executive Function", "Self-monitor academic engagement and complete homework independently.",
    "Use a vibrating interval timer for self-monitoring; match self-ratings against momentary checks.",
    [target("tgt-mateo-engagement", "Academic Engagement", "IntervalData",
            [("Baseline", "2026-04-14"), ("Acquisition", "2026-04-28"), ("Maintenance", "2026-07-28"),
             ("Generalization", "2026-08-24")],
            "Independent seatwork assigned.", "Engaged with assigned work at each momentary check.",
            "At least 85% of checks for 3 sessions", rule("percentIntervals", "atLeast", 85, 3),
            dict(base=0.45, peak=0.9, shape="fast"),
            interval=interval("LessonStart", "01:00", "MomentaryTimeSampling", 20), color="#65735a"),
     target("tgt-mateo-homework", "Independent Homework Engagement", "Duration",
            [("Baseline", "2026-04-15"), ("Acquisition", "2026-04-29")],
            "Homework folder opened with a visual checklist.", "Seconds of independent work before requesting help.",
            "At least 20 minutes for 3 sessions", rule("durationSeconds", "atLeast", 1200, 3),
            dict(base=240, peak=930, shape="linear", minutes=25, bouts=3), color="#346b52")],
    tags=["Self-management"], materials=["interval"])

add_program(
    "prog-mateo-community", "cli-mateo", "Community Safety", "SkillAcquisition", "Maintaining",
    "Community Skills", "Cross streets safely and share personal information with trusted adults.",
    "Teach the crossing task analysis in vivo; probe personal information with unfamiliar staff.",
    [target("tgt-mateo-crossing", "Safe Street Crossing", "TrialByTrial",
            [("Baseline", "2026-04-15"), ("Acquisition", "2026-04-29"), ("Maintenance", "2026-07-09")],
            "Approach a marked crosswalk with an adult.", "Completes each crossing step independently.",
            "At least 5/6 steps for 3 outings", pct(80),
            dict(base=0.5, peak=0.95, shape="fast", trials=6, minutes=10, settings=["Community"]), color="#9b7a3d"),
     target("tgt-mateo-personal-info", "Share Personal Information", "TrialByTrial",
            [("Baseline", "2026-04-15"), ("Acquisition", "2026-04-22"), ("Maintenance", "2026-06-04"),
             ("Completed", "2026-08-26")],
            "A trusted adult asks for his address or phone number.", "States the requested information accurately.",
            "At least 5/5 for 3 sessions", pct(100),
            dict(base=0.4, peak=0.98, shape="fast", trials=5, minutes=3), settings="Manual", color="#697b96")],
    tags=["Safety", "Community"])


# ---- Behavior reduction (unitary programs) -------------------------------- #
def add_behavior(id, client, name, kind, status, history, stimuli, objective, teaching, mastery, mastery_rule,
                 model, *, function, intervention, interval_settings=None, baseline=None, color="#DC2626",
                 area="Behavior Reduction"):
    item = target(id.removeprefix("prog-"), name, kind, history, stimuli, objective, mastery, mastery_rule,
                  model, settings="Manual", interval=interval_settings, color=color)
    item["functionHypothesis"] = function
    item["intervention"] = intervention
    add_program(id, client, name, "BehaviorReduction", status, area, objective, teaching, [item],
                tags=["Behavior reduction", kind, function], baseline=baseline)


add_behavior("prog-br-vocal", "cli-liam", "Vocal Disruption / Screaming", "Frequency", "Teaching",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-05-04")],
             "A demand is presented or access to an item is delayed.",
             "Count vocalizations above conversational volume that interrupt instruction.",
             "Offer a functional break request before demands; count each episode separated by 10 seconds of quiet.",
             "Fewer than 2 per session for 4 sessions", rule("count", "atMost", 1, 4),
             dict(rate=3.4, floor=0.42, decay=0.958, burst=[1.6, 1.45, 1.25, 1.1], weekday={0: 1.3},
                  hot=[("10:15", "11:30", 2.2)], intensity=(3.1, 2.0), chain=("br-elopement", 0.2, 0.08, 1, 4),
                  thin=("2026-08-03", 1.25)),
             function="Escape", intervention="FCT (break request) + escape extinction",
             baseline="3.4 episodes per hour during the April descriptive assessment", color="#EF4444")
add_behavior("prog-br-elopement", "cli-liam", "Elopement / Leaving Area", "Duration", "Maintaining",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-04-27"), ("Maintenance", "2026-08-18")],
             "Transition away from a preferred activity.",
             "Time movement beyond five feet from the assigned area without permission.",
             "Maintain line of sight; start timer on departure, stop on return, and teach asking for a break.",
             "Under 30 seconds per session", rule("durationSeconds", "below", 30, 3),
             dict(rate=0.85, floor=0.07, decay=0.945, burst=[1.3, 1.15], episode=(70, 22),
                  hot=[("09:00", "09:20", 1.5), ("10:30", "10:50", 2.0), ("11:40", "12:00", 1.5)], intensity=(3.0, 2.2)),
             function="Escape", intervention="Blocking + first/then visual + DRO for staying in area",
             baseline="About 240 seconds per session in April", color="#B91C1C")
add_behavior("prog-br-property", "cli-liam", "Property Disruption", "IntervalData", "Teaching",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-05-04")],
             "A work demand is introduced.",
             "Record intervals in which materials are thrown or swept off the table.",
             "Use partial-interval recording and offer a short choice before the demand.",
             "At most 1 of 12 intervals for 4 sessions", rule("intervalCount", "atMost", 1, 4),
             dict(rate=0.5, floor=0.07, decay=0.962, burst=[1.3, 1.2], hot=[("10:00", "11:30", 1.8)], intensity=(2.8, 2.0)),
             function="Escape", intervention="Choice-making + FCT + response interruption",
             interval_settings=interval("Manual", "00:30", "Partial", 12),
             baseline="7 of 12 intervals", color="#F97316")

add_behavior("prog-br-refusal", "cli-emma", "Task Refusal", "Frequency", "Teaching",
             [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-26")],
             "A non-preferred task is presented.",
             "Count verbal refusal or pushing work away, separated by 10 seconds of participation.",
             "Offer a choice of task order, prompt a break request, and return to instruction after the break.",
             "At most 1 per session", rule("count", "atMost", 1, 3),
             dict(rate=2.5, floor=0.3, decay=0.955, burst=[1.5, 1.3, 1.15], weekday={0: 1.2},
                  hot=[("09:15", "10:15", 1.8), ("10:45", "11:30", 1.6)], intensity=(2.6, 1.8),
                  chain=("br-drop", 0.24, 0.1, 0, 3)),
             function="Escape", intervention="Task-order choice + FCT (break card) + high-probability sequence",
             baseline="8 episodes per session", color="#EA580C")
add_behavior("prog-br-drop", "cli-emma", "Drop to Floor", "Duration", "Teaching",
             [("Baseline", "2026-05-04"), ("Acquisition", "2026-06-01")],
             "Transition into group instruction.",
             "Time lying on the floor instead of walking with the group.",
             "Present a first/then card; stop timing after client stands and resumes walking.",
             "Under 20 seconds per session", rule("durationSeconds", "below", 20, 3),
             dict(rate=0.65, floor=0.1, decay=0.952, burst=[1.4, 1.2], episode=(95, 22), weekday={4: 1.6},
                  hot=[("08:30", "08:45", 1.8), ("10:15", "10:35", 2.5), ("11:45", "12:00", 1.6)], intensity=(2.9, 2.0)),
             function="Escape", intervention="Visual first/then + transition warnings + reinforcement for walking",
             color="#DC2626")
add_behavior("prog-br-disruptive", "cli-emma", "Disruptive Vocalizations", "IntervalData", "Teaching",
             [("Baseline", "2026-05-04"), ("Acquisition", "2026-05-26")],
             "Group circle starts or a peer is speaking.",
             "Count whole intervals containing disruptive vocalizations.",
             "Reinforce quiet participation at each 20-second interval boundary.",
             "At most 1 of 15 intervals", rule("intervalCount", "atMost", 1, 3),
             dict(rate=0.34, floor=0.08, decay=0.965, burst=[1.25], hot=[("09:45", "10:15", 2.0)], intensity=(2.2, 1.6)),
             function="Attention", intervention="DRA for quiet participation + planned ignoring",
             interval_settings=interval("LessonStart", "00:20", "Whole", 15), color="#BE123C")

add_behavior("prog-br-bolting", "cli-noah", "Bolting from Group", "Frequency", "Generalizing",
             [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-11"), ("Generalization", "2026-09-14")],
             "A community group changes activities.",
             "Count each departure beyond the visual boundary without permission.",
             "Use a visual boundary, rehearse staying near the adult, and count new departures after return.",
             "0 for 5 sessions", rule("count", "atMost", 0, 5),
             dict(rate=0.8, floor=0.06, decay=0.95, burst=[1.35, 1.2], setting={"Community": 2.6},
                  hot=[("16:00", "16:30", 1.6), ("10:30", "11:30", 1.8)], intensity=(3.2, 2.4)),
             function="Tangible", intervention="Visual boundary + DRO + teach a 'go' request")
add_behavior("prog-br-hand-biting", "cli-noah", "Hand Biting", "Duration", "Teaching",
             [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-18")],
             "A loud noise is heard during activities.",
             "Time contact of teeth with hand; stop timing when contact ceases.",
             "Offer a sensory alternative and document total seconds per session.",
             "Under 15 seconds per session", rule("durationSeconds", "below", 15, 3),
             dict(rate=1.1, floor=0.3, decay=0.968, burst=[], episode=(18, 7), sensitivity={"Medication change": 1.9},
                  hot=[("16:30", "17:15", 1.5)], intensity=(2.7, 2.0)),
             function="Automatic", intervention="Matched stimulation (chewy) + response blocking + headphones",
             color="#B91C1C")
add_behavior("prog-br-repetitive", "cli-noah", "Repetitive Vocalizations", "IntervalData", "Maintaining",
             [("Baseline", "2026-04-20"), ("Acquisition", "2026-05-11"), ("Maintenance", "2026-09-08")],
             "An adult delivers a lengthy direction.",
             "Mark whether repeated vocalizations occur at each observation instant.",
             "Use momentary time sampling; reinforce participation after quiet checks.",
             "At most 2 of 10 checks", rule("intervalCount", "atMost", 2, 3),
             dict(rate=0.55, floor=0.12, decay=0.962, burst=[], hot=[("15:00", "15:30", 1.4)], intensity=(1.8, 1.4),
                  chain=("br-hand-biting", 0.12, 0.08, 0, 2)),
             function="Automatic", intervention="Response interruption and redirection (RIRD) + DRO",
             interval_settings=interval("Manual", "01:00", "MomentaryTimeSampling", 10), color="#F97316")

add_behavior("prog-br-isla-aggression", "cli-isla", "Aggression (Hitting)", "Frequency", "Teaching",
             [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-22")],
             "A preferred item is removed or access is delayed.",
             "Count each open- or closed-hand strike toward another person.",
             "Teach a mand for the item (FCT), provide noncontingent access between demands, and block attempts.",
             "Zero or one per session for 5 sessions", rule("count", "atMost", 1, 5),
             dict(rate=2.1, floor=0.32, decay=0.955, burst=[1.7, 1.5, 1.3, 1.15], afternoon=1.3,
                  hot=[("10:15", "10:45", 2.2), ("12:00", "12:30", 1.6)], intensity=(3.0, 2.1)),
             function="Tangible", intervention="FCT (mand for item) + NCR + extinction", color="#DC2626")
add_behavior("prog-br-isla-tantrum", "cli-isla", "Tantrum", "Duration", "Maintaining",
             [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-22"), ("Maintenance", "2026-09-29")],
             "Transitions or demands interrupt preferred play.",
             "Time crying with flopping or kicking lasting more than 5 seconds.",
             "Give two-minute transition warnings, prompt a break request and keep the demand in place.",
             "Under 60 seconds per session", rule("durationSeconds", "below", 60, 3),
             dict(rate=0.8, floor=0.12, decay=0.95, burst=[1.4, 1.2], episode=(120, 34), afternoon=1.4,
                  hot=[("09:30", "10:00", 1.6), ("11:30", "12:00", 1.8)], intensity=(3.2, 2.3),
                  chain=("br-isla-aggression", 0.34, 0.14, 0, 2)),
             function="Escape", intervention="Transition warnings + FCT + escape extinction", color="#B91C1C")
add_behavior("prog-br-isla-mouthing", "cli-isla", "Mouthing Objects", "IntervalData", "Teaching",
             [("Baseline", "2026-06-01"), ("Acquisition", "2026-06-29")],
             "Unstructured play or waiting with small objects available.",
             "Score any interval in which a non-food object passes the plane of the lips.",
             "Offer matched stimulation (chewy tube), block, and redirect to play.",
             "Under 20% of intervals for 3 sessions", rule("percentIntervals", "below", 20, 3),
             dict(rate=0.45, floor=0.16, decay=0.972, burst=[], hot=[("11:00", "11:45", 1.5)], intensity=(1.6, 1.3)),
             function="Automatic", intervention="Matched stimulation + response blocking",
             interval_settings=interval("LessonStart", "00:15", "Partial", 20), color="#F97316")

add_behavior("prog-br-mateo-verbal", "cli-mateo", "Verbal Aggression", "Frequency", "Teaching",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-05-04")],
             "Peers tease or adults correct his work.",
             "Count threats, insults or swearing directed at a person, separated by 30 seconds.",
             "Reinforce appropriate attention bids (DRA), coach peers to ignore, and use self-monitoring.",
             "Zero per session for 4 sessions", rule("count", "atMost", 0, 4),
             dict(rate=1.5, floor=0.2, decay=0.955, burst=[1.4, 1.2], weekday={4: 1.2},
                  hot=[("12:30", "13:00", 2.6), ("15:30", "16:00", 1.4)], intensity=(2.8, 2.0),
                  sensitivity={"Change at home": 1.7}),
             function="Attention", intervention="DRA + peer-mediated planned ignoring + self-monitoring",
             baseline="About three incidents per school session in April", color="#DC2626")
add_behavior("prog-br-mateo-refusal", "cli-mateo", "Work Refusal", "Duration", "Maintaining",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-05-04"), ("Maintenance", "2026-09-22")],
             "Written work or multi-step tasks are assigned.",
             "Time head-down, arms-crossed or verbal refusal until work resumes.",
             "Chunk tasks, honor a break card, and deliver tokens for starting work.",
             "Under 2 minutes per session", rule("durationSeconds", "below", 120, 3),
             dict(rate=1.0, floor=0.14, decay=0.952, burst=[1.3, 1.15], episode=(150, 42),
                  hot=[("13:00", "14:00", 1.8)], intensity=(2.5, 1.8), chain=("br-mateo-verbal", 0.26, 0.1, 0, 3)),
             function="Escape", intervention="Task modification (chunking) + break card + token economy",
             color="#B91C1C")
add_behavior("prog-br-mateo-perseveration", "cli-mateo", "Perseverative Talk", "IntervalData", "Teaching",
             [("Baseline", "2026-04-13"), ("Acquisition", "2026-05-11")],
             "Unstructured conversation or waiting.",
             "Score any interval with more than one sentence about trains or subway maps after a topic change.",
             "Schedule topic time (NCR), redirect to a shared topic, and praise flexible talk.",
             "Under 15% of intervals for 3 sessions", rule("percentIntervals", "below", 15, 3),
             dict(rate=0.4, floor=0.14, decay=0.97, burst=[], total=(16, 24), hot=[("12:30", "13:00", 1.6)],
                  intensity=(1.5, 1.3)),
             function="Attention", intervention="Scheduled topic time (NCR) + redirection + DRA",
             interval_settings=interval("Manual", "00:30", "Partial"), color="#F97316")

# --------------------------------------------------------------------------- #
# ABC catalogs: antecedent categories (motivating operations) and the reinforcer
# each consequence would deliver if it maintained behavior.
# --------------------------------------------------------------------------- #
SETTING_EVENTS = ["Poor sleep reported", "Missed breakfast", "Illness symptoms", "Substitute staff",
                  "Schedule change", "Medication change", "Change at home"]
ABC_SPECS = {
    "cli-liam": {
        "treatmentArea": "Behavioral Regulation",
        "teachingInstructions": "Record what occurred just before and after each event. Select all applicable entries; record the actual location, not a presumed function.",
        "antecedents": {"Tabletop demand": "Demand", "Transition from preferred play": "Transition",
                        "Peer took a toy": "Peer interaction", "Denied access to tablet": "Restricted access",
                        "Loud cafeteria noise": "Sensory", "Wait for attention": "Diverted attention",
                        "Asked to clean up": "Demand"},
        "consequences": {"Prompted break request": "Escape", "First/then visual presented": "None",
                         "Access to quiet corner": "Escape", "Blocked unsafe movement": "Attention",
                         "Returned to task with choice": "None", "Peer turn supported": "Tangible",
                         "Demand removed": "Escape", "Verbal reprimand": "Attention", "Tablet returned": "Tangible"},
        "locations": ["Therapy Table", "Play Area", "Hallway", "Cafeteria", "Home - Kitchen", "Home - Living Room"],
        "places": {"Tabletop demand": "Therapy Table", "Transition from preferred play": "Hallway",
                   "Peer took a toy": "Play Area", "Denied access to tablet": "Play Area",
                   "Loud cafeteria noise": "Cafeteria", "Wait for attention": "Therapy Table"},
        "home": {"Asked to clean up": "Home - Living Room", "Tabletop demand": "Home - Kitchen"},
        "homeDefault": "Home - Living Room",
        "onlyClinic": ["Loud cafeteria noise", "Peer took a toy"], "onlyHome": ["Asked to clean up"],
    },
    "cli-emma": {
        "treatmentArea": "Communication & Transitions",
        "teachingInstructions": "Document the exact trigger and response during transitions; use communication icons before re-presenting the demand.",
        "antecedents": {"Non-preferred task presented": "Demand", "Transition to circle time": "Transition",
                        "Preferred toy removed": "Restricted access", "Peer begins speaking": "Diverted attention",
                        "Snack delayed": "Restricted access", "Group moves to playroom": "Transition",
                        "Playgroup arrival": "Transition"},
        "consequences": {"Offered task-order choice": "None", "First/then card shown": "None",
                         "Prompted picture exchange": "Tangible", "Break card offered": "Escape",
                         "Rejoined group": "None", "Quiet participation reinforced": "Attention",
                         "Task removed": "Escape", "Adult comforted": "Attention", "Toy returned": "Tangible"},
        "locations": ["Classroom", "Circle Area", "Playroom", "Therapy Table", "Community Playgroup"],
        "places": {"Non-preferred task presented": "Therapy Table", "Transition to circle time": "Circle Area",
                   "Preferred toy removed": "Playroom", "Peer begins speaking": "Circle Area",
                   "Snack delayed": "Classroom", "Group moves to playroom": "Playroom"},
        "community": "Community Playgroup",
        "onlyCommunity": ["Playgroup arrival"],
    },
    "cli-noah": {
        "treatmentArea": "Safety & Sensory Regulation",
        "teachingInstructions": "Document safety events immediately; offer a sensory alternative and reinforce remaining with the group.",
        "antecedents": {"Group changed activity": "Transition", "Loud hallway sound": "Sensory",
                        "Extended instruction": "Demand", "Preferred item put away": "Restricted access",
                        "Community role-play begins": "Transition", "Asked to wait": "Waiting",
                        "Alone with little to do": "Low stimulation", "Crowded store aisle": "Sensory"},
        "consequences": {"Visual boundary reviewed": "None", "Sensory alternative offered": "Sensory",
                         "Rejoined group with prompt": "Attention", "Break request modeled": "Escape",
                         "Quiet interval reinforced": "Attention", "Caregiver notified": "Attention",
                         "Chased by adult": "Attention", "Activity ended early": "Escape",
                         "No programmed consequence": "Sensory"},
        "locations": ["Home Therapy Room", "Hallway", "Community Practice Area", "Sensory Corner",
                      "Grocery Store", "Backyard"],
        "places": {"Group changed activity": "Home Therapy Room", "Loud hallway sound": "Hallway",
                   "Extended instruction": "Home Therapy Room", "Preferred item put away": "Home Therapy Room",
                   "Community role-play begins": "Community Practice Area", "Asked to wait": "Hallway",
                   "Alone with little to do": "Sensory Corner"},
        "community": "Grocery Store",
        "onlyCommunity": ["Crowded store aisle"],
    },
    "cli-isla": {
        "treatmentArea": "Communication & Safety",
        "teachingInstructions": "Record every aggression; sample other episodes. Note what was removed or requested just before the episode.",
        "antecedents": {"Preferred item removed": "Restricted access", "Told to wait": "Waiting",
                        "Demand presented": "Demand", "Transition between activities": "Transition",
                        "Peer near preferred toy": "Peer interaction", "Adult attention diverted": "Diverted attention",
                        "Unstructured free play": "Low stimulation"},
        "consequences": {"Item returned": "Tangible", "Prompted mand (FCT)": "Tangible",
                         "Item delivered after mand": "Tangible", "Blocked and redirected": "None",
                         "Demand removed": "Escape", "Adult comforted": "Attention",
                         "Chewy offered (matched stimulation)": "Sensory", "Planned ignoring": "None"},
        "locations": ["Therapy Table", "Play Area", "Sensory Room", "Bathroom", "Snack Table"],
        "places": {"Preferred item removed": "Play Area", "Told to wait": "Snack Table",
                   "Demand presented": "Therapy Table", "Transition between activities": "Play Area",
                   "Peer near preferred toy": "Play Area", "Adult attention diverted": "Play Area",
                   "Unstructured free play": "Sensory Room"},
    },
    "cli-mateo": {
        "treatmentArea": "Peer Relationships & Task Engagement",
        "teachingInstructions": "Record peer and adult responses verbatim when possible; note whether a break card was available.",
        "antecedents": {"Writing task assigned": "Demand", "Peer teasing": "Peer interaction",
                        "Teacher attention to others": "Diverted attention", "Corrected by adult": "Demand",
                        "Unstructured lunch time": "Low stimulation", "Preferred topic interrupted": "Restricted access",
                        "Transition to next class": "Transition"},
        "consequences": {"Peer laughter": "Attention", "Teacher reprimand": "Attention", "Task removed": "Escape",
                         "Task broken into steps": "None", "Break card honored": "Escape",
                         "Praise for appropriate request": "Attention", "Planned ignoring": "None",
                         "Redirected to shared topic": "None"},
        "locations": ["Classroom", "Cafeteria", "Hallway", "Resource Room", "Community Store", "Home"],
        "places": {"Writing task assigned": "Classroom", "Peer teasing": "Cafeteria",
                   "Teacher attention to others": "Classroom", "Corrected by adult": "Resource Room",
                   "Unstructured lunch time": "Cafeteria", "Preferred topic interrupted": "Cafeteria",
                   "Transition to next class": "Hallway"},
        "community": "Community Store", "homePlace": "Home",
        "onlySchool": ["Unstructured lunch time", "Transition to next class", "Teacher attention to others"],
    },
}

BEHAVIOR_ABC = {
    "br-vocal": dict(
        antecedents={"Tabletop demand": 46, "Asked to clean up": 12, "Denied access to tablet": 12,
                     "Wait for attention": 10, "Transition from preferred play": 8, "Loud cafeteria noise": 6,
                     "Peer took a toy": 4},
        baseline={"Demand removed": 40, "Verbal reprimand": 24, "Access to quiet corner": 14, "Tablet returned": 8,
                  "Returned to task with choice": 10},
        treatment={"Prompted break request": 40, "Returned to task with choice": 24, "First/then visual presented": 20,
                   "Demand removed": 7, "Verbal reprimand": 5, "Access to quiet corner": 4}),
    "br-elopement": dict(
        antecedents={"Transition from preferred play": 44, "Tabletop demand": 24, "Loud cafeteria noise": 12,
                     "Denied access to tablet": 10, "Peer took a toy": 5, "Wait for attention": 5},
        baseline={"Blocked unsafe movement": 38, "Verbal reprimand": 22, "Demand removed": 22, "Access to quiet corner": 18},
        treatment={"Blocked unsafe movement": 34, "First/then visual presented": 30, "Prompted break request": 26,
                   "Demand removed": 10}),
    "br-property": dict(
        antecedents={"Tabletop demand": 56, "Denied access to tablet": 14, "Peer took a toy": 10,
                     "Wait for attention": 10, "Transition from preferred play": 10},
        baseline={"Demand removed": 44, "Verbal reprimand": 30, "Tablet returned": 10, "Peer turn supported": 16},
        treatment={"Returned to task with choice": 36, "Prompted break request": 30, "Verbal reprimand": 10,
                   "Demand removed": 9, "Peer turn supported": 15}),
    "br-refusal": dict(
        antecedents={"Non-preferred task presented": 58, "Transition to circle time": 10, "Snack delayed": 8,
                     "Group moves to playroom": 8, "Preferred toy removed": 8, "Peer begins speaking": 4,
                     "Playgroup arrival": 4},
        baseline={"Task removed": 46, "Adult comforted": 20, "Toy returned": 10, "Offered task-order choice": 14,
                  "Break card offered": 10},
        treatment={"Offered task-order choice": 34, "Break card offered": 30, "First/then card shown": 18,
                   "Task removed": 10, "Adult comforted": 8}),
    "br-drop": dict(
        antecedents={"Transition to circle time": 34, "Group moves to playroom": 26, "Playgroup arrival": 16,
                     "Non-preferred task presented": 14, "Preferred toy removed": 10},
        baseline={"Task removed": 30, "Adult comforted": 34, "Rejoined group": 16, "Toy returned": 20},
        treatment={"First/then card shown": 38, "Rejoined group": 30, "Break card offered": 16, "Adult comforted": 10,
                   "Task removed": 6}),
    "br-disruptive": dict(
        antecedents={"Peer begins speaking": 44, "Transition to circle time": 18, "Snack delayed": 14,
                     "Non-preferred task presented": 12, "Preferred toy removed": 12},
        baseline={"Adult comforted": 44, "Quiet participation reinforced": 8, "Toy returned": 18, "Task removed": 30},
        treatment={"Quiet participation reinforced": 44, "Rejoined group": 26, "Prompted picture exchange": 18,
                   "Adult comforted": 12}),
    "br-bolting": dict(
        antecedents={"Community role-play begins": 22, "Group changed activity": 22, "Crowded store aisle": 18,
                     "Preferred item put away": 16, "Asked to wait": 14, "Loud hallway sound": 8},
        baseline={"Chased by adult": 46, "Activity ended early": 22, "Caregiver notified": 16, "Rejoined group with prompt": 16},
        treatment={"Visual boundary reviewed": 40, "Rejoined group with prompt": 30, "Break request modeled": 18,
                   "Chased by adult": 12}),
    "br-hand-biting": dict(
        antecedents={"Loud hallway sound": 34, "Alone with little to do": 24, "Asked to wait": 14,
                     "Extended instruction": 12, "Crowded store aisle": 10, "Preferred item put away": 6},
        baseline={"No programmed consequence": 46, "Caregiver notified": 20, "Activity ended early": 14,
                  "Sensory alternative offered": 20},
        treatment={"Sensory alternative offered": 52, "No programmed consequence": 18, "Quiet interval reinforced": 16,
                   "Caregiver notified": 14}),
    "br-repetitive": dict(
        antecedents={"Extended instruction": 36, "Alone with little to do": 30, "Asked to wait": 18,
                     "Group changed activity": 8, "Loud hallway sound": 8},
        baseline={"No programmed consequence": 60, "Caregiver notified": 10, "Rejoined group with prompt": 30},
        treatment={"Quiet interval reinforced": 42, "Rejoined group with prompt": 32, "No programmed consequence": 26}),
    "br-isla-aggression": dict(
        antecedents={"Preferred item removed": 38, "Peer near preferred toy": 20, "Told to wait": 18,
                     "Transition between activities": 12, "Demand presented": 8, "Adult attention diverted": 4},
        baseline={"Item returned": 50, "Adult comforted": 18, "Demand removed": 14, "Blocked and redirected": 18},
        treatment={"Prompted mand (FCT)": 36, "Item delivered after mand": 22, "Blocked and redirected": 26,
                   "Item returned": 10, "Planned ignoring": 6}),
    "br-isla-tantrum": dict(
        antecedents={"Transition between activities": 34, "Demand presented": 26, "Told to wait": 18,
                     "Preferred item removed": 16, "Adult attention diverted": 6},
        baseline={"Demand removed": 40, "Item returned": 26, "Adult comforted": 34},
        treatment={"Blocked and redirected": 30, "Prompted mand (FCT)": 30, "Planned ignoring": 24, "Demand removed": 8,
                   "Adult comforted": 8}),
    "br-isla-mouthing": dict(
        antecedents={"Unstructured free play": 46, "Told to wait": 22, "Adult attention diverted": 18,
                     "Demand presented": 14},
        baseline={"Planned ignoring": 40, "Blocked and redirected": 34, "Adult comforted": 26},
        treatment={"Chewy offered (matched stimulation)": 52, "Blocked and redirected": 36, "Planned ignoring": 12}),
    "br-mateo-verbal": dict(
        antecedents={"Peer teasing": 36, "Corrected by adult": 22, "Teacher attention to others": 16,
                     "Unstructured lunch time": 14, "Writing task assigned": 8, "Preferred topic interrupted": 4},
        baseline={"Peer laughter": 42, "Teacher reprimand": 40, "Task removed": 18},
        treatment={"Planned ignoring": 34, "Praise for appropriate request": 26, "Teacher reprimand": 16,
                   "Peer laughter": 14, "Redirected to shared topic": 10}),
    "br-mateo-refusal": dict(
        antecedents={"Writing task assigned": 54, "Corrected by adult": 20, "Transition to next class": 12,
                     "Teacher attention to others": 8, "Preferred topic interrupted": 6},
        baseline={"Task removed": 48, "Teacher reprimand": 30, "Break card honored": 6, "Task broken into steps": 16},
        treatment={"Task broken into steps": 40, "Break card honored": 32, "Praise for appropriate request": 16,
                   "Task removed": 8, "Teacher reprimand": 4}),
    "br-mateo-perseveration": dict(
        antecedents={"Preferred topic interrupted": 34, "Unstructured lunch time": 30, "Teacher attention to others": 20,
                     "Transition to next class": 16},
        baseline={"Peer laughter": 22, "Teacher reprimand": 30, "Redirected to shared topic": 48},
        treatment={"Redirected to shared topic": 50, "Planned ignoring": 26, "Praise for appropriate request": 24}),
}
OUTCOMES = ["Back on task in {m} min.", "Calm within {m} min; resumed the activity.", "Needed {m} min to regroup.",
            "Rejoined the group after {m} min.", "Ended without further escalation.",
            "Brief escalation, then settled after {m} min."]


# --------------------------------------------------------------------------- #
# Simulation
# --------------------------------------------------------------------------- #
def phase_on(history, day):
    current = None
    for phase, start in history:
        if start <= day:
            current = phase
        else:
            break
    return current


def phase_start(history, phase):
    return next((start for name, start in history if name == phase), None)


def next_phase_date(history, phase):
    for index, (name, _) in enumerate(history):
        if name == phase and index + 1 < len(history):
            return history[index + 1][1]
    return None


def build_calendar(client):
    rng = Rng(f"calendar/{client['id']}")
    sessions = []
    start = d(client["serviceStartDate"])
    day = start
    while day <= AS_OF:
        if day in HOLIDAYS:
            day += timedelta(days=1)
            continue
        for slot in SCHEDULES[client["id"]]:
            if day.weekday() not in slot["days"]:
                continue
            first = d(slot.get("start_date", client["serviceStartDate"]))
            if day < first or (slot.get("end_date") and day > d(slot["end_date"])):
                continue
            if slot.get("biweekly") and ((day - first).days // 7) % 2:
                continue
            begin, end = to_minutes(slot["start"]), to_minutes(slot["end"])
            if day == AS_OF and begin > 12 * 60:
                continue  # the snapshot is taken at midday
            code = slot.get("code", "97153")
            therapist = slot["staff"]
            session = {"clientId": client["id"], "date": day.isoformat(), "start": slot["start"],
                       "end": slot["end"], "minutes": end - begin, "therapistName": therapist,
                       "role": ROLE[therapist], "serviceCode": code, "setting": slot["setting"],
                       "status": "Completed", "_day": day, "_begin": begin, "_regular": therapist}
            absence = in_window(day, [(a, b, label) for a, b, label in ABSENCES.get(client["id"], [])])
            if absence:
                session.update(status="Cancelled", cancelReason=absence)
            elif code == "97153" and rng.chance(0.03):
                session.update(status="Cancelled", cancelReason="Family cancellation")
            elif code == "97153":
                out = in_window(day, [(a, b, "out") for a, b in STAFF_ABSENCES.get(therapist, [])])
                if out or rng.chance(0.03):
                    leo_free = not (day.weekday() in (3, 4) and begin < 13 * 60)
                    if day >= LEO_START and therapist != LEO and leo_free:
                        session.update(therapistName=LEO, role="RBT")
                    elif rng.chance(0.5):
                        bcba = SUPERVISORS[client["id"]][0]
                        session.update(therapistName=bcba, role=ROLE[bcba], serviceCode="97155")
                    else:
                        session.update(status="Cancelled", cancelReason="Staff unavailable")
            sessions.append(session)
        day += timedelta(days=1)
    sessions.sort(key=lambda s: (s["_day"], s["_begin"]))

    previous_day = None
    for session in sessions:
        if session["status"] != "Completed" or session["serviceCode"] == "97156":
            continue
        events = []
        day = session["_day"]
        window = in_window(day, SETTING_EVENT_WINDOWS.get(client["id"], []))
        if window:
            events.append(window)
        if rng.chance(SLEEP_RATE[client["id"]]):
            events.append("Poor sleep reported")
        if session["_begin"] < 11 * 60 and rng.chance(0.04):
            events.append("Missed breakfast")
        if session["therapistName"] != session["_regular"]:
            events.append("Substitute staff")
        if previous_day and (day - previous_day).days >= 7:
            events.append("Schedule change")
        if day.isoformat() in ("2026-06-15", "2026-08-17") and client["id"] == "cli-mateo":
            events.append("Schedule change")
        previous_day = day
        if events:
            session["settingEvents"] = sorted(set(events), key=SETTING_EVENTS.index)

    # Weekly overlap supervision with a procedural-fidelity checklist; newer staff get more.
    by_week = {}
    for session in sessions:
        if session["status"] == "Completed" and session["role"] == "RBT":
            by_week.setdefault(session["_day"].isocalendar()[:2], []).append(session)
    supervised_minutes = {}
    for index, (_, week) in enumerate(sorted(by_week.items())):
        supervisors = SUPERVISORS[client["id"]]
        month = week[0]["_day"].strftime("%Y-%m")
        chosen = [min(week, key=lambda s: (supervised_minutes.get((month, s["therapistName"]), 0), s["_day"], s["_begin"]))]
        if any(s["therapistName"] == LEO for s in week) and rng.chance(0.7):
            chosen.append(next(s for s in week if s["therapistName"] == LEO))
        elif len(week) > 3 and rng.chance(0.3):
            chosen.append(week[-1])
        for pick, session in enumerate(chosen):
            if "supervision" in session:
                continue
            supervisor = supervisors[(index + pick) % len(supervisors)]
            minutes = min(session["minutes"], rng.choice([45, 60, 60, 90]))
            session["supervision"] = {"supervisor": supervisor, "minutes": minutes}
            key = (session["_day"].strftime("%Y-%m"), session["therapistName"])
            supervised_minutes[key] = supervised_minutes.get(key, 0) + minutes
            total = rng.choice([20, 22, 24, 25])
            therapist = session["therapistName"]
            if therapist == LEO:
                mean = 77 if session["_day"] < LEO_RETRAINED else 92
            else:
                mean = FIDELITY.get(therapist, 92) + (-6 if therapist == "Alex Chen, RBT" and
                                                     d("2026-07-01") <= session["_day"] <= d("2026-07-24") else 0)
            percent = clamp(rng.normal(mean, 3.2), 60, 100)
            correct = clamp(js_round(total * percent / 100), 0, total)
            session["fidelity"] = {"observer": supervisor, "correct": correct, "total": total,
                                   "percent": tenths(correct, total)}
    return sessions


def team_for(client_id, sessions):
    names = []
    for session in sessions:
        if session["role"] == "RBT" and session["therapistName"] not in names:
            names.append(session["therapistName"])
    return names


def sample_minute(rng, session, hot):
    blocks = max(1, session["minutes"] // 15)
    weights = []
    for block in range(blocks):
        start = session["_begin"] + block * 15
        weight = 1.0
        for begin, end, bonus in hot:
            if to_minutes(begin) <= start < to_minutes(end):
                weight += bonus
        weights.append((block, weight))
    block = rng.weighted(weights)
    return clamp(block * 15 + rng.randint(0, 14), 1, session["minutes"] - 1)


def interval_scores(rng, count, probability, stickiness=0.35):
    probability = clamp(probability, 0.0, 1.0)
    if probability < 0.002:
        return "0" * count
    if probability > 0.998:
        return "1" * count
    stay = min(0.95, probability + stickiness * (1 - probability))
    enter = min(0.95, probability * (1 - stay) / (1 - probability))
    state = rng.chance(probability)
    scores = []
    for _ in range(count):
        scores.append("1" if state else "0")
        state = rng.chance(stay if state else enter)
    return "".join(scores)


def interval_seconds(settings):
    minutes, seconds = settings["intervalLength"].split(":")
    return int(minutes) * 60 + int(seconds)


def trial_sequence(rng, hierarchy, count, probability, progress):
    order = PROMPT_ORDER[hierarchy]
    codes = []
    for _ in range(count):
        if rng.chance(probability):
            codes.append("I")
            continue
        if hierarchy == "least-to-most":
            weights = [0.3 + 0.55 * probability, 0.35, max(0.04, 0.22 - 0.18 * probability),
                       max(0.02, 0.13 - 0.12 * probability)]
        else:
            levels = len(order)
            planned = clamp(int((1 - progress) * levels), 0, levels - 1)
            weights = [0.1] * levels
            weights[planned] = 0.7
            if planned > 0:
                weights[planned - 1] += 0.15
        codes.append(rng.weighted(list(zip(order, weights))))
    return "".join(codes)


def session_effect(session, sensitivity=None):
    effect = 1.0
    for event in session.get("settingEvents", []):
        effect *= (sensitivity or {}).get(event, EVENT_EFFECT.get(event, 1.0))
    return effect


def sa_penalty(session):
    penalty = 0.05 * len(session.get("settingEvents", []))
    if session.get("fidelity", {}).get("percent", 100) < 85:
        penalty += 0.05
    return min(0.16, penalty)


def acquisition_progress(model, day):
    start = phase_start(model["history"], "Acquisition")
    end = next_phase_date(model["history"], "Acquisition") or (AS_OF + timedelta(days=1))
    span = max(1, (end - start).days)
    return clamp((day - start).days / span, 0.0, 1.0)


def sa_level(model, phase, day, state):
    """Expected level for the session (probability, rate, seconds) before noise."""
    base, peak = model["base"], model["peak"]
    if phase == "Baseline":
        return base, 0.0
    if phase == "Acquisition":
        progress = acquisition_progress(model, day)
        level = base + (peak - base) * shaped(progress, model.get("shape", "s"))
        boost = model.get("intervention")
        if boost and day >= d(boost[0]):
            level += boost[1] * min(1.0, (day - d(boost[0])).days / 21)
        return level, progress
    maintained = peak if model["kind"] != "TrialByTrial" else min(0.97, peak + 0.02)
    if phase == "Generalization":
        probes = state["generalization"]
        return maintained - (0.16 if model["kind"] in ("TrialByTrial", "IntervalData") else 0.18 * maintained) * \
            max(0.0, 1 - probes / 4), 1.0
    return maintained, 1.0


def fluency_level(model, phase, day):
    base, cap = model["base"], model["cap"]
    errors, error_cap = model["errors"], model["error_cap"]
    if phase == "Baseline":
        return base, errors
    start = phase_start(model["history"], "Acquisition")
    days = (day - start).days
    factor = power(root7(model["approach"]), days)
    error_factor = power(root7(0.82), days)
    rate = cap - (cap - base) * factor
    err = error_cap + (errors - error_cap) * error_factor
    if phase in ("Maintenance", "Generalization"):
        rate = max(rate, cap * 0.98)
    return rate, err


def should_run(rng, model, phase, session, state, primary):
    day = session["_day"]
    if phase in (None, "Pending", "Completed", "OnHold", "Discontinued"):
        return False
    allowed = model.get("settings")
    if allowed and session["setting"] not in allowed:
        return False
    if session["setting"] == "Telehealth":
        return False
    if model["kind"] == "Anecdotal":
        if state["last"] and (day - state["last"]).days < 5:
            return False
        return rng.chance(0.55)
    if phase == "Baseline":
        has_next = len(model["history"]) > 1
        if has_next and state["baseline"] >= 7:
            return False
        if state["baseline"] == 0 and (day - model["history"][0][1]).days >= 3:
            return True  # every baseline gets probed at least once
        return rng.chance(0.75 if has_next else 0.45)
    if phase == "Acquisition":
        return rng.chance(model.get("acq_p", 0.72))
    if phase == "Maintenance":
        if state["last"] and (day - state["last"]).days < 6:
            return False
        return rng.chance(0.6)
    if phase == "Generalization":
        if state["last"] and (day - state["last"]).days < 3:
            return False
        novel = session["setting"] != primary or session["therapistName"] != session["_regular"]
        return rng.chance(0.8 if novel else 0.35)
    return False


def build_sa_row(rng, model, phase, session, state, minute):
    kind = model["kind"]
    day = session["_day"]
    row = {"lessonDurationMinutes": None}
    if kind == "Anecdotal":
        notes = model["notes"]
        text = notes[state["notes"] % len(notes)]
        if state["notes"] >= len(notes):
            text = f"{text} ({session['setting'].lower()} session, follow-up)"
        state["notes"] += 1
        return {"qualitativeEntry": text}
    penalty = sa_penalty(session)
    if kind == "TrialByTrial":
        level, progress = sa_level(model, phase, day, state)
        probability = clamp(level - penalty + rng.normal(0, 0.075 if phase == "Acquisition" else 0.055), 0.02, 0.99)
        count = model.get("trials", 10)
        if rng.chance(0.08) and count >= 8:
            count -= rng.randint(2, 3)
        sequence = trial_sequence(rng, model["prompt"], count, probability, progress)
        correct = sequence.count("I")
        return {"value": js_round(100 * correct / count), "correctCount": correct, "totalTrials": count,
                "trialSequence": sequence, "lessonDurationMinutes": model.get("minutes", 8)}
    if kind == "IntervalData":
        level, _ = sa_level(model, phase, day, state)
        probability = clamp(level - penalty + rng.normal(0, 0.06), 0.02, 0.99)
        settings = model["interval"]
        count = settings.get("numberOfIntervals") or rng.randint(*model.get("total", (12, 16)))
        scores = interval_scores(rng, count, probability, 0.25)
        occurred = scores.count("1")
        minutes = round(count * interval_seconds(settings) / 60, 1)
        return {"value": js_round(100 * occurred / count), "occurredIntervals": occurred, "totalIntervals": count,
                "intervalScores": scores, "lessonDurationMinutes": minutes if minutes % 1 else int(minutes)}
    if kind == "Duration":
        level, _ = sa_level(model, phase, day, state)
        seconds = max(0, js_round(level * (1 - penalty) + rng.normal(0, 0.11 * level)))
        seconds = min(seconds, model.get("minutes", 15) * 60)
        episodes = split_bouts(rng, seconds, model.get("bouts", 2))
        row = {"value": seconds, "durationSeconds": seconds, "occurrenceCount": len(episodes),
               "lessonDurationMinutes": model.get("minutes", 15)}
        if episodes:
            row["episodeDurations"] = episodes
        return row
    if kind == "Frequency":
        level, _ = sa_level(model, phase, day, state)
        minutes = session["minutes"] if model.get("minutes") == "session" else model.get("minutes", 60)
        count = rng.poisson(level * minutes / 60 * (1 - penalty))
        return {"value": count, "occurrenceCount": count, "lessonDurationMinutes": minutes}
    if kind == "FluencyRate":
        rate, errors = fluency_level(model, phase, day)
        minutes = model.get("minutes", 1)
        correct = rng.poisson(max(0.2, rate * (1 - penalty * 0.6)) * minutes)
        wrong = rng.poisson(max(0.05, errors * (1 + penalty)) * minutes)
        return {"value": correct, "occurrenceCount": correct, "errorCount": wrong, "lessonDurationMinutes": minutes}
    raise AssertionError(kind)


def split_bouts(rng, seconds, max_bouts):
    if seconds <= 0:
        return []
    bouts = clamp(1 + rng.poisson(0.7), 1, max_bouts)
    if seconds < 20 * bouts:
        bouts = 1
    weights = [0.5 + rng.random() for _ in range(bouts)]
    total = sum(weights)
    parts = [max(5, js_round(seconds * weight / total)) for weight in weights]
    parts[-1] = seconds - sum(parts[:-1])
    if parts[-1] < 1:
        return [seconds]
    return parts


# ---- mastery-rule enforcement: graphs and promotions must agree ------------ #
def measure_value(row, measure):
    if measure in ("percentCorrect", "percentIntervals"):
        return row["value"]
    if measure == "intervalCount":
        return row["occurredIntervals"]
    if measure == "count":
        return row["occurrenceCount"]
    if measure == "ratePerHour":
        return 60 * row["occurrenceCount"] / row["lessonDurationMinutes"]
    if measure == "correctPerMinute":
        return row["occurrenceCount"] / row["lessonDurationMinutes"]
    if measure == "durationSeconds":
        return row["durationSeconds"]
    raise AssertionError(measure)


def compare(value, mastery_rule):
    threshold = mastery_rule["threshold"]
    return {"atLeast": value >= threshold, "atMost": value <= threshold,
            "below": value < threshold, "above": value > threshold}[mastery_rule["comparison"]]


def meets(row, mastery_rule):
    return compare(measure_value(row, mastery_rule["measure"]), mastery_rule)


def set_quantity(row, model, quantity):
    kind = model["kind"]
    if kind == "TrialByTrial":
        sequence = list(row["trialSequence"])
        lowest = PROMPT_ORDER[model["prompt"]][0]
        while sequence.count("I") < quantity:
            sequence[max(i for i, code in enumerate(sequence) if code != "I")] = "I"
        while sequence.count("I") > quantity:
            sequence[min(i for i, code in enumerate(sequence) if code == "I")] = lowest
        row.update(trialSequence="".join(sequence), correctCount=quantity,
                   value=js_round(100 * quantity / row["totalTrials"]))
    elif kind == "IntervalData":
        scores = list(row["intervalScores"])
        while scores.count("1") < quantity:
            scores[scores.index("0")] = "1"
        while scores.count("1") > quantity:
            scores[len(scores) - 1 - scores[::-1].index("1")] = "0"
        row.update(intervalScores="".join(scores), occurredIntervals=quantity,
                   value=js_round(100 * quantity / row["totalIntervals"]))
    elif kind == "Duration":
        episodes = row.get("episodeDurations") or ([quantity] if quantity else [])
        if quantity and episodes:
            scale = quantity / max(1, sum(episodes))
            parts = [max(1, js_round(value * scale)) for value in episodes]
            parts[-1] = quantity - sum(parts[:-1])
            if parts[-1] < 1:
                parts = [quantity]
        else:
            parts = []
        row.update(value=quantity, durationSeconds=quantity, occurrenceCount=len(parts))
        if parts:
            row["episodeDurations"] = parts
        else:
            row.pop("episodeDurations", None)
    else:
        row.update(value=quantity, occurrenceCount=quantity)
    record = row.get("ioa")
    if record and record["method"] in ("TotalCount", "TotalDuration"):
        primary = row["durationSeconds"] if record["method"] == "TotalDuration" else row["occurrenceCount"]
        old = record["primary"]
        if record["method"] == "TotalDuration":
            secondary = js_round(primary * record["secondary"] / old) if old else primary
        else:
            secondary = max(0, primary + record["secondary"] - old)
        record.update(primary=primary, secondary=secondary, percent=agreement(primary, secondary))
    if TARGETS[row["targetId"]][1] == "BehaviorReduction":
        if row["value"] == 0:
            row["missingDataMode"] = "ZeroOut"
        else:
            row.pop("missingDataMode", None)


def adjust_row(row, model, qualify):
    """Move one observation minimally across the mastery threshold (either direction)."""
    mastery_rule, kind = model["rule"], model["kind"]
    measure = mastery_rule["measure"]
    if kind == "TrialByTrial":
        current, high = row["correctCount"], row["totalTrials"]
    elif kind == "IntervalData":
        current, high = row["occurredIntervals"], row["totalIntervals"]
    elif kind == "Duration":
        current, high = row["durationSeconds"], max(3600, row["durationSeconds"] * 3)
    else:
        current, high = row["occurrenceCount"], row["occurrenceCount"] + 400

    def value_for(quantity):
        if measure in ("percentCorrect", "percentIntervals"):
            total = row["totalTrials"] if kind == "TrialByTrial" else row["totalIntervals"]
            return js_round(100 * quantity / total)
        if measure == "ratePerHour":
            return 60 * quantity / row["lessonDurationMinutes"]
        if measure == "correctPerMinute":
            return quantity / row["lessonDurationMinutes"]
        return quantity

    def acceptable(quantity):
        return 0 <= quantity <= high and compare(value_for(quantity), mastery_rule) == qualify

    chosen = next(candidate for delta in range(high + 2) for candidate in (current - delta, current + delta)
                  if acceptable(candidate))
    if kind == "Duration" and chosen != current:
        step = 1 if chosen > current else -1
        for _ in range(3 + current % 9):
            if acceptable(chosen + step):
                chosen += step
    set_quantity(row, model, chosen)
    assert meets(row, mastery_rule) == qualify, (row, mastery_rule)


def enforce_mastery(target_id, rows):
    """Promotions happen the day after the rule is first met; earlier streaks are broken."""
    model = MODELS[target_id]
    mastery_rule = model["rule"]
    history = model["history"]
    if not mastery_rule or model["kind"] == "Anecdotal" or not phase_start(history, "Acquisition"):
        return
    start = phase_start(history, "Acquisition")
    promotion = next_phase_date(history, "Acquisition")
    promoted = promotion and next(p for p, day in history if day == promotion) in ("Maintenance", "Generalization", "Completed")
    teaching = [row for row in rows if start <= row["_day"] and (not promotion or row["_day"] < promotion)]
    needed = mastery_rule["consecutiveSessions"]
    if model["kind"] in ("Frequency", "Duration", "IntervalData") and TARGETS[target_id][1] == "BehaviorReduction":
        if promoted:  # BR maintenance decisions are manual: criterion met just before promotion
            measured = [row for row in teaching if row.get("missingDataMode") != "DataNotTracked"]
            for row in measured[-needed:]:
                if not meets(row, mastery_rule):
                    adjust_row(row, model, True)
        return
    final = needed + (1 if promoted and model["settings_mode"] == "Manual" else 0) if promoted else 0
    if not promoted and model.get("awaiting"):
        final = needed  # manual mastery: the rule is met and awaits the supervisor's review
    head, tail = (teaching[:-final], teaching[-final:]) if final else (teaching, [])
    streak = 0
    for index, row in enumerate(head):
        qualifies = meets(row, mastery_rule)
        must_break = (index == len(head) - 1 and tail) or streak + 1 >= needed
        if qualifies and must_break:
            adjust_row(row, model, False)
            qualifies = False
        streak = streak + 1 if qualifies else 0
    for row in tail:
        if not meets(row, mastery_rule):
            adjust_row(row, model, True)
    if promoted and model["settings_mode"] == "Automatic":
        assert tail, target_id
        last_day = tail[-1]["_day"]
        assert last_day < promotion, target_id
        snapped = last_day + timedelta(days=1)
        model["history"] = [(phase, snapped if day == promotion else day) for phase, day in history]


# ---- behavior episodes ------------------------------------------------------ #
def br_state():
    return {"treatment": 0, "level": None}


def br_level(model, phase, session, state):
    day = session["_day"]
    history = model["history"]
    rate, floor = model["rate"], model["floor"]
    if phase == "Baseline":
        # Problem behavior often worsens slightly while baseline data are collected.
        state["baseline"] = state.get("baseline", 0) + 1
        level = rate * power(model.get("worsening", 1.012), state["baseline"])
    else:
        if state["level"] is None:
            state["level"] = rate
        state["level"] = floor + (state["level"] - floor) * model["decay"]
        level = state["level"]
        burst = model.get("burst", [])
        if state["treatment"] < len(burst):
            level *= burst[state["treatment"]]
        state["treatment"] += 1
        thin = model.get("thin")
        if thin and d(thin[0]) <= day <= d(thin[0]) + timedelta(days=10):
            level *= thin[1]
        if phase == "Generalization":
            general = phase_start(history, "Generalization")
            level *= 1 + 0.6 * max(0.0, 1 - (day - general).days / 21)
    level *= model.get("weekday", {}).get(day.weekday(), 1.0)
    level *= model.get("setting", {}).get(session["setting"], 1.0)
    if model.get("afternoon") and session["_begin"] >= 12 * 60:
        level *= model["afternoon"]
    level *= session_effect(session, model.get("sensitivity"))
    return level


def intensity_for(rng, model, phase, session, chained):
    baseline, treated = model["intensity"]
    mean = baseline if phase == "Baseline" else treated
    mean += 0.5 * bool(session.get("settingEvents")) + (0.5 if chained else 0)
    return int(clamp(js_round(rng.normal(mean, 0.75)), 1, 5))


def pick_antecedents(rng, client_id, behavior_id, session):
    spec = ABC_SPECS[client_id]
    weights = dict(BEHAVIOR_ABC[behavior_id]["antecedents"])
    setting = session["setting"]
    for name in list(weights):
        if setting != "Home" and name in spec.get("onlyHome", []):
            weights[name] = 0
        if setting != "Clinic" and name in spec.get("onlyClinic", []):
            weights[name] = 0
        if setting != "Community" and name in spec.get("onlyCommunity", []):
            weights[name] = 0
        if setting != "School" and name in spec.get("onlySchool", []):
            weights[name] = 0
    if not any(weight > 0 for weight in weights.values()):
        weights = dict(BEHAVIOR_ABC[behavior_id]["antecedents"])
    first = rng.weighted(list(weights.items()))
    chosen = [first]
    if rng.chance(0.24):
        weights[first] = 0
        if any(weight > 0 for weight in weights.values()):
            chosen.append(rng.weighted(list(weights.items())))
    return chosen


def pick_location(rng, client_id, antecedent, session):
    spec = ABC_SPECS[client_id]
    setting = session["setting"]
    if setting == "Home" and "home" in spec:
        return spec["home"].get(antecedent, spec["homeDefault"])
    if setting == "Home" and spec.get("homePlace"):
        return spec["homePlace"]
    if setting == "Community" and spec.get("community"):
        return spec["community"]
    place = spec["places"].get(antecedent) or spec["locations"][0]
    if rng.chance(0.12):
        return rng.choice([loc for loc in spec["locations"] if loc not in (spec.get("community"), spec.get("homePlace"))
                           and not loc.startswith("Home -")])
    return place


def pick_consequences(rng, behavior_id, phase, session):
    spec = BEHAVIOR_ABC[behavior_id]
    pool = dict(spec["baseline"] if phase == "Baseline" else spec["treatment"])
    if phase != "Baseline" and session.get("fidelity", {}).get("percent", 100) < 85:
        for name, weight in spec["baseline"].items():  # integrity failures reinforce problem behavior
            pool[name] = pool.get(name, 0) + weight * 0.6
    first = rng.weighted(list(pool.items()))
    chosen = [first]
    if rng.chance(0.28):
        pool[first] = 0
        if any(weight > 0 for weight in pool.values()):
            chosen.append(rng.weighted(list(pool.items())))
    return chosen


def abc_note(rng, client_id, behaviors, antecedent, consequences, minutes, session):
    behavior = " + ".join(name.split(" / ")[0].lower() for name in behaviors)
    outcome = rng.choice(OUTCOMES).format(m=max(1, minutes))
    note = f"{antecedent} \u2192 {behavior}. {consequences[0]}. {outcome}"
    events = [event for event in session.get("settingEvents", []) if event != "Substitute staff"]
    if events and rng.chance(0.6):
        note += f" Context: {events[0].lower()}."
    return note


# --------------------------------------------------------------------------- #
# Main simulation loop
# --------------------------------------------------------------------------- #
SESSION_DATA = []
SERVICE_SESSIONS = []
ABC_ENTRIES = []


def simulate_client(client):
    client_id = client["id"]
    rng = Rng(f"data/{client_id}")
    sessions = build_calendar(client)
    team = team_for(client_id, sessions)
    programs = [program for program in PROGRAMS if program["clientId"] == client_id]
    skill_targets = [t for p in programs if p["category"] == "SkillAcquisition" for t in p["targets"]]
    behavior_targets = [t for p in programs if p["category"] == "BehaviorReduction" for t in p["targets"]]
    sa_state = {t["id"]: {"last": None, "baseline": 0, "generalization": 0, "notes": 0} for t in skill_targets}
    behavior_state = {t["id"]: br_state() for t in behavior_targets}
    rows_by_target = {t["id"]: [] for t in skill_targets + behavior_targets}
    abc_rows = []
    short = SHORT[client_id]
    service_index = 0

    for session in sessions:
        service_index += 1
        session["id"] = f"ss-{short}-{service_index:04d}"
        if session["status"] != "Completed" or session["serviceCode"] == "97156":
            continue
        day = session["_day"]
        in_baseline = (day - d(client["serviceStartDate"])).days < 21
        ioa_session = rng.chance(0.6 if "supervision" in session else (0.35 if in_baseline else 0.16))
        observer = None
        if ioa_session:
            observer = session.get("supervision", {}).get("supervisor")
            if not observer:
                others = [name for name in team if name != session["therapistName"] and
                          (name != LEO or day >= LEO_START)]
                observer = rng.choice(others) if others else SUPERVISORS[client_id][0]
            session["ioaObserver"] = observer
        session_rows = []

        # Skill acquisition: run the targets due in this session, in program order.
        offset = 6
        for item in skill_targets:
            model = MODELS[item["id"]]
            phase = phase_on(model["history"], day)
            state = sa_state[item["id"]]
            if not should_run(rng, model, phase, session, state, client["primarySetting"]):
                continue
            minute = clamp(offset, 2, session["minutes"] - 4)
            fields = build_sa_row(rng, model, phase, session, state, minute)
            offset += math.ceil(fields.get("lessonDurationMinutes") or 4) + 2
            if offset > session["minutes"] - 6:
                offset = 8 + rng.randint(0, 10)
            row = {"clientId": client_id, "targetId": item["id"],
                   "timestamp": stamp(day, session["_begin"] + minute),
                   "therapistName": session["therapistName"], "serviceSessionId": session["id"]}
            row.update({key: value for key, value in fields.items() if value is not None})
            row["_day"], row["_phase"] = day, phase
            state["last"] = day
            if phase == "Baseline":
                state["baseline"] += 1
            if phase == "Generalization":
                state["generalization"] += 1
            rows_by_target[item["id"]].append(row)
            session_rows.append(row)

        # Behavior reduction: every target is measured every session (continuous recording).
        episodes = {}
        tracked = {}
        for item in behavior_targets:
            model = MODELS[item["id"]]
            phase = phase_on(model["history"], day)
            level = br_level(model, phase, session, behavior_state[item["id"]])
            tracked[item["id"]] = not rng.chance(0.035)
            hours = session["minutes"] / 60
            if model["kind"] == "Frequency":
                count = rng.poisson(level * hours)
                episodes[item["id"]] = [{"minute": sample_minute(rng, session, model["hot"]), "chain": False}
                                        for _ in range(count)]
            elif model["kind"] == "Duration":
                count = rng.poisson(level * hours)
                base, floor = model["episode"]
                treated = behavior_state[item["id"]]["treatment"]
                mean = base if phase == "Baseline" else floor + (base - floor) * power(0.93, treated)
                episodes[item["id"]] = [{"minute": sample_minute(rng, session, model["hot"]), "chain": False,
                                         "seconds": max(3, js_round(mean * (0.35 + 1.3 * (rng.random() + rng.random()) / 2)))}
                                        for _ in range(count)]
            else:
                settings = item["intervalSettings"]
                total = settings.get("numberOfIntervals") or rng.randint(*model.get("total", (16, 24)))
                window = max(1, js_round(total * interval_seconds(settings) / 60))
                begin = rng.randint(3, max(3, session["minutes"] - window - 3))
                scores = interval_scores(rng, total, min(0.95, level), 0.45)
                runs, index = [], 0
                while index < total:
                    if scores[index] == "1":
                        start = index
                        while index < total and scores[index] == "1":
                            index += 1
                        runs.append({"minute": clamp(begin + js_round(start * interval_seconds(settings) / 60), 1,
                                                     session["minutes"] - 1),
                                     "seconds": (index - start) * interval_seconds(settings), "chain": False})
                    index += 1
                episodes[item["id"]] = runs
                behavior_state[item["id"]]["scores"] = (scores, total, window, begin)

        # Precursor chains add episodes of the next behavior shortly afterwards.
        for item in behavior_targets:
            model = MODELS[item["id"]]
            if "chain" not in model:
                continue
            follow, before, after, low, high = model["chain"]
            phase = phase_on(model["history"], day)
            probability = before if phase == "Baseline" else after
            for episode in list(episodes[item["id"]]):
                if rng.chance(probability):
                    minute = episode["minute"] + rng.randint(low, high)
                    if minute >= session["minutes"]:
                        continue
                    added = {"minute": minute, "chain": True, "from": item["id"], "source": episode}
                    follow_model = MODELS[follow]
                    if follow_model["kind"] == "Duration":
                        base, floor = follow_model["episode"]
                        treated = behavior_state[follow]["treatment"]
                        mean = base if phase_on(follow_model["history"], day) == "Baseline" else \
                            floor + (base - floor) * power(0.93, treated)
                        added["seconds"] = max(3, js_round(mean * (0.5 + rng.random())))
                    episodes[follow].append(added)

        for item in behavior_targets:
            model = MODELS[item["id"]]
            phase = phase_on(model["history"], day)
            row = {"clientId": client_id, "targetId": item["id"], "timestamp": stamp(day, session["_begin"]),
                   "therapistName": session["therapistName"], "serviceSessionId": session["id"],
                   "_day": day, "_phase": phase}
            items = sorted(episodes[item["id"]], key=lambda e: e["minute"])
            for before, after in zip(items, items[1:]):
                earliest = before["minute"] + max(1, math.ceil(before.get("seconds", 30) / 60))
                after["minute"] = min(max(after["minute"], earliest), session["minutes"] - 1)
            episodes[item["id"]] = items
            if not tracked[item["id"]]:
                row.update(value=None, missingDataMode="DataNotTracked")
            elif model["kind"] == "Frequency":
                row.update(value=len(items), occurrenceCount=len(items), lessonDurationMinutes=session["minutes"])
            elif model["kind"] == "Duration":
                seconds = sum(e["seconds"] for e in items)
                row.update(value=seconds, durationSeconds=seconds, occurrenceCount=len(items),
                           lessonDurationMinutes=session["minutes"])
                if items:
                    row["episodeDurations"] = [e["seconds"] for e in items]
            else:
                scores, total, window, begin = behavior_state[item["id"]]["scores"]
                occurred = scores.count("1")
                row.update(timestamp=stamp(day, session["_begin"] + begin), value=js_round(100 * occurred / total),
                           occurredIntervals=occurred, totalIntervals=total, intervalScores=scores,
                           lessonDurationMinutes=round(total * interval_seconds(item["intervalSettings"]) / 60, 1))
                if row["lessonDurationMinutes"] % 1 == 0:
                    row["lessonDurationMinutes"] = int(row["lessonDurationMinutes"])
            if row["value"] == 0:
                row["missingDataMode"] = "ZeroOut"
            rows_by_target[item["id"]].append(row)
            session_rows.append(row)

        # IOA: BCBA/BCaBA or a second RBT records the same targets independently.
        if observer:
            measured = [row for row in session_rows if row.get("value") is not None and "qualitativeEntry" not in row]
            behavior_rows = [row for row in measured if TARGETS[row["targetId"]][1] == "BehaviorReduction"]
            skill_rows = [row for row in measured if TARGETS[row["targetId"]][1] == "SkillAcquisition"]
            chosen = behavior_rows + [skill_rows[i] for i in sorted({rng.randint(0, len(skill_rows) - 1)
                                                                     for _ in range(2)})] if skill_rows else behavior_rows
            leo_learning = session["therapistName"] == LEO and day < LEO_RETRAINED
            for row in chosen:
                row["ioa"] = ioa_record(rng, row, observer, leo_learning)

        # ABC sampling: the descriptive assessment records most episodes; later, a sample
        # plus every high-intensity episode.
        recorded = []
        for item in behavior_targets:
            if not tracked[item["id"]]:
                continue
            model = MODELS[item["id"]]
            phase = phase_on(model["history"], day)
            # Rare episodes are always worth a narrative; frequent ones are sampled.
            count = len(episodes[item["id"]])
            probability, cap = (0.4, 2) if phase == "Baseline" else ({1: 0.55, 2: 0.35}.get(count, 0.12), 2)
            kept = 0
            for episode in episodes[item["id"]]:
                episode["intensity"] = intensity_for(rng, model, phase, session, episode["chain"])
                if kept >= cap:
                    break
                source_kept = episode.get("source", {}).get("recorded")
                if episode["intensity"] >= 4 or rng.chance(0.75 if source_kept else probability):
                    episode["recorded"] = True
                    recorded.append((item, episode, phase))
                    kept += 1
        recorded.sort(key=lambda entry: entry[1]["minute"])
        merged = set()
        for index, (item, episode, phase) in enumerate(recorded):
            if index in merged:
                continue
            behaviors = [item]
            for other in range(index + 1, len(recorded)):
                partner = recorded[other]
                if partner[1].get("source") is episode and partner[1]["minute"] - episode["minute"] <= 2:
                    behaviors.append(partner[0])
                    merged.add(other)
                    break
            abc_rows.append(make_abc(rng, client_id, session, behaviors, episode, phase))

    # Promotions must agree with the data (structured mastery rules).
    for item in skill_targets + behavior_targets:
        enforce_mastery(item["id"], rows_by_target[item["id"]])
        model = MODELS[item["id"]]
        item["phaseHistory"] = [{"phase": phase, "date": day.isoformat()} for phase, day in model["history"]]
        item["phase"], item["phaseEnteredDate"] = model["history"][-1][0], model["history"][-1][1].isoformat()

    for item in skill_targets + behavior_targets:
        for number, row in enumerate(rows_by_target[item["id"]], start=1):
            row["sessionNumber"] = number
    abc_rows = reconcile_abc(abc_rows, behavior_targets, rows_by_target)

    client_rows = sorted((row for rows in rows_by_target.values() for row in rows),
                         key=lambda row: (row["timestamp"], row["targetId"]))
    for row in client_rows:
        SESSION_DATA.append(row)
    for session in sessions:
        SERVICE_SESSIONS.append(session)
    abc_rows.sort(key=lambda entry: entry["timestamp"])
    for number, entry in enumerate(abc_rows, start=1):
        entry["id"] = f"abc-{short}-{number:04d}"
        ABC_ENTRIES.append(entry)


def reconcile_abc(entries, behavior_targets, rows_by_target):
    """Mastery adjustments can lower a session's count; drop ABC records beyond it."""
    available = {}
    for item in behavior_targets:
        for row in rows_by_target[item["id"]]:
            if row.get("value") is None:
                continue
            if MODELS[item["id"]]["kind"] == "IntervalData":
                episodes = len([run for run in row["intervalScores"].split("0") if run])
            else:
                episodes = row["occurrenceCount"]
            available[(row["serviceSessionId"], item["name"])] = episodes
    kept = []
    for entry in sorted(entries, key=lambda item: item["timestamp"]):
        behaviors = []
        for name in entry["behaviors"]:
            key = (entry["serviceSessionId"], name)
            if available.get(key, 0) > 0:
                available[key] -= 1
                behaviors.append(name)
        if behaviors:
            if behaviors != entry["behaviors"]:
                antecedent, rest = entry["notes"].split(" \u2192 ", 1)
                described = " + ".join(name.split(" / ")[0].lower() for name in behaviors)
                entry["notes"] = f"{antecedent} \u2192 {described}. {rest.split('. ', 1)[1]}"
            entry["behaviors"] = behaviors
            kept.append(entry)
    return kept


def ioa_record(rng, row, observer, learning):
    """Second-observer record using the IOA method that fits the measurement tool."""
    kind = MODELS[row["targetId"]]["kind"]
    factor = 3.0 if learning else 1.0
    if kind in ("TrialByTrial", "IntervalData"):
        total = row.get("totalTrials") or row.get("totalIntervals")
        rate = (0.025 if kind == "TrialByTrial" else 0.035) * factor
        disagreements = sum(1 for _ in range(total) if rng.chance(rate))
        method = "TrialByTrial" if kind == "TrialByTrial" else "IntervalByInterval"
        return {"observer": observer, "method": method, "agreements": total - disagreements, "total": total,
                "percent": tenths(total - disagreements, total)}
    if kind == "Duration":
        primary = row["durationSeconds"]
        secondary = max(0, js_round(primary * (1 + rng.normal(0, 0.045 * factor))))
        if primary and rng.chance(0.05 * factor):
            secondary = max(0, primary - rng.randint(4, 20))
        return {"observer": observer, "method": "TotalDuration", "primary": primary, "secondary": secondary,
                "percent": agreement(primary, secondary)}
    primary = row["occurrenceCount"]
    # Discrete, salient events are easy to agree on; disagreements grow with the count.
    miss = min(0.5, (0.02 + 0.03 * primary) * factor)
    delta = 0 if not rng.chance(miss) else (1 if primary < 6 or rng.chance(0.7) else 2)
    secondary = max(0, primary + (delta if rng.chance(0.5) or primary == 0 else -delta))
    return {"observer": observer, "method": "TotalCount", "primary": primary, "secondary": secondary,
            "percent": agreement(primary, secondary)}


def agreement(primary, secondary):
    if primary == secondary:
        return 100.0
    return tenths(min(primary, secondary), max(primary, secondary))


def document_retraining():
    """gn-4: Leo's first August IOA checks with Isla fell below 80% before BST retraining."""
    rows = [row for row in SESSION_DATA if row["clientId"] == "cli-isla" and row["therapistName"] == LEO
            and "ioa" in row and row["_day"] < LEO_RETRAINED and TARGETS[row["targetId"]][1] == "BehaviorReduction"]
    dates = sorted({row["_day"] for row in rows})[:2]
    assert len(dates) == 2, "Expected two IOA sessions for the retraining story"
    for row in rows:
        if row["_day"] not in dates:
            continue
        record = row["ioa"]
        if record["method"] in ("TrialByTrial", "IntervalByInterval"):
            record["agreements"] = max(0, record["total"] - max(4, js_round(record["total"] * 0.25)))
            record["percent"] = tenths(record["agreements"], record["total"])
        elif record["primary"] > 0:
            record["secondary"] = max(0, js_round(record["primary"] * 0.7) if record["method"] == "TotalDuration"
                                      else record["primary"] - max(1, record["primary"] // 3))
            if record["secondary"] == record["primary"]:
                record["secondary"] = record["primary"] + 1
            record["percent"] = agreement(record["primary"], record["secondary"])
        elif record["method"] == "TotalCount":
            record["secondary"] = 1
            record["percent"] = 0.0


def make_abc(rng, client_id, session, behaviors, episode, phase):
    first = behaviors[0]
    antecedents = pick_antecedents(rng, client_id, first["id"], session)
    consequences = pick_consequences(rng, behaviors[-1]["id"], phase, session)
    minutes = max(1, math.ceil(episode.get("seconds", rng.randint(30, 150)) / 60))
    if len(behaviors) > 1:
        minutes += 1
    entry = {"clientId": client_id,
             "timestamp": stamp(session["_day"], session["_begin"] + episode["minute"]),
             "therapist": session["therapistName"],
             "antecedents": antecedents, "behaviors": [item["name"] for item in behaviors],
             "consequences": consequences, "location": pick_location(rng, client_id, antecedents[0], session),
             "notes": abc_note(rng, client_id, [item["name"] for item in behaviors], antecedents[0], consequences,
                               minutes, session),
             "intensity": max(episode["intensity"], 3 if len(behaviors) > 1 else 1),
             "durationMinutes": minutes, "serviceSessionId": session["id"]}
    if session.get("settingEvents"):
        entry["settingEvents"] = session["settingEvents"]
    return entry


# --------------------------------------------------------------------------- #
# Annotations derived from the clinical story
# --------------------------------------------------------------------------- #
PHASE_LABELS = {"Acquisition": ("Teaching begins", "Solid", "ProgramUpdate", False),
                "Maintenance": ("Mastery criterion met", "Dotted", "OutcomesPromotions", True),
                "Generalization": ("Generalization probes", "Dotted", "OutcomesPromotions", True),
                "Completed": ("Target completed", "Solid", "Manual", False),
                "OnHold": ("Placed on hold", "Solid", "Manual", False),
                "Discontinued": ("Discontinued", "Solid", "Manual", False)}
CUSTOM_LINE_LABELS = {
    ("tgt-expr-food", "Generalization"): "Generalization across settings",
    ("tgt-emma-attending", "Generalization"): "Group setting generalization",
    ("br-vocal", "Acquisition"): "Functional communication training",
    ("br-bolting", "Acquisition"): "Visual boundary introduced",
    ("br-bolting", "Generalization"): "Community generalization",
    ("tgt-noah-puzzle", "Discontinued"): "Discontinued: flat trend",
}
EXTRA_LINES = [
    ("tgt-expr-food", "2026-06-08", "Differential reinforcement introduced", "Solid", "#2563EB", False, "Manual"),
    ("br-vocal", "2026-08-03", "Break schedule thinned", "Dotted", "#9b7a3d", False, "ProgramUpdate"),
    ("tgt-mateo-engagement", "2026-08-17", "School year resumes", "Dotted", "#697b96", True, "Bulk"),
    ("br-mateo-verbal", "2026-08-17", "School year resumes", "Dotted", "#697b96", True, "Bulk"),
    ("br-mateo-verbal", "2026-06-15", "Summer program", "Dotted", "#697b96", True, "Bulk"),
    ("br-isla-aggression", "2026-07-20", "NCR schedule thinned", "Dotted", "#9b7a3d", False, "ProgramUpdate"),
]
PHASE_RANGES = [
    {"id": "pr-1", "targetId": "tgt-expr-food", "startDate": "2026-04-13", "endDate": "2026-04-24",
     "label": "Baseline assessment", "color": "rgba(147, 197, 253, 0.25)"},
    {"id": "pr-2", "targetId": "tgt-emma-exchange", "startDate": "2026-05-18", "endDate": "2026-06-05",
     "label": "Initial picture exchange", "color": "rgba(147, 197, 253, 0.25)"},
    {"id": "pr-3", "targetId": "br-vocal", "startDate": "2026-04-13", "endDate": "2026-05-01",
     "label": "Descriptive assessment (ABC)", "color": "#71957f33"},
    {"id": "pr-4", "targetId": "br-vocal", "startDate": "2026-07-27", "endDate": "2026-07-31",
     "label": "Family vacation", "color": "#9b7a3d33"},
    {"id": "pr-5", "targetId": "br-hand-biting", "startDate": "2026-08-10", "endDate": "2026-08-23",
     "label": "Medication adjustment", "color": "#a3695933"},
    {"id": "pr-6", "targetId": "tgt-isla-dry-checks", "startDate": "2026-06-29", "endDate": "2026-07-10",
     "label": "Intensive toilet training", "color": "#71957f33"},
    {"id": "pr-7", "targetId": "br-mateo-verbal", "startDate": "2026-09-01", "endDate": "2026-09-11",
     "label": "Change at home", "color": "#a3695933"},
]
GRAPH_NOTES = [
    {"id": "gn-1", "targetId": "tgt-expr-food", "date": "2026-09-30",
     "noteText": "Used familiar picture cards in a different therapy room.", "color": "#F59E0B",
     "staffName": "Sarah Jenkins, BCBA"},
    {"id": "gn-2", "targetId": "tgt-noah-waiting", "date": "2026-10-05",
     "noteText": "Visual schedule was moved next to the waiting area.", "color": "#F59E0B",
     "staffName": "David Kim, RBT"},
    {"id": "gn-3", "targetId": "tgt-expr-food", "date": "2026-06-22",
     "noteText": "Echoic prompts faded to the initial sound.", "color": "#527d82", "staffName": "Maya Patel, RBT"},
    {"id": "gn-4", "targetId": "br-isla-aggression", "date": "2026-08-28",
     "noteText": "IOA below 80% on two sessions; Leo retrained on the definition with BST.", "color": "#a36959",
     "staffName": "Hannah Lee, BCBA"},
    {"id": "gn-5", "targetId": "br-hand-biting", "date": "2026-08-10",
     "noteText": "Caregiver reported a medication change; monitoring closely.", "color": "#a36959",
     "staffName": "Sarah Jenkins, BCBA"},
    {"id": "gn-6", "targetId": "tgt-mateo-coins", "date": "2026-05-12",
     "noteText": "Added a daily one-minute practice sheet for home.", "color": "#527d82",
     "staffName": "David Vance, BCBA"},
    {"id": "gn-7", "targetId": "br-refusal", "date": "2026-07-13",
     "noteText": "Fidelity dipped; reviewed the break-card steps with staff.", "color": "#a36959",
     "staffName": "David Vance, BCBA"},
    {"id": "gn-8", "targetId": "tgt-noah-puzzle", "date": "2026-08-17",
     "noteText": "Twelve weeks without a meaningful trend; team agreed to replace the goal.", "color": "#a36959",
     "staffName": "Sarah Jenkins, BCBA"},
]


def build_phase_lines():
    lines = []
    for target_id, (_, _, item) in TARGETS.items():
        history = MODELS[target_id]["history"]
        for phase, day in history[1:]:
            label, style, source, automated = PHASE_LABELS[phase]
            label = CUSTOM_LINE_LABELS.get((target_id, phase), label)
            if TARGETS[target_id][1] == "BehaviorReduction" and phase == "Acquisition" and \
                    (target_id, phase) not in CUSTOM_LINE_LABELS:
                label = f"Intervention: {item['intervention'].split(' + ')[0]}"
            if item["masterySettings"] == "Manual" and phase == "Maintenance":
                automated, source = False, "Manual"
            color = {"Solid": "#294f3d", "Dotted": "#527d82"}[style]
            lines.append({"targetId": target_id, "date": day.isoformat(), "label": label, "style": style,
                          "color": color, "isAutomated": automated, "source": source})
    for target_id, day, label, style, color, automated, source in EXTRA_LINES:
        lines.append({"targetId": target_id, "date": day, "label": label, "style": style, "color": color,
                      "isAutomated": automated, "source": source})
    lines.sort(key=lambda line: (line["date"], line["targetId"], line["label"]))
    for number, line in enumerate(lines, start=1):
        line["id"] = f"pcl-{number}"
    return [{"id": line["id"], **{k: v for k, v in line.items() if k != "id"}} for line in lines]


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
COMPACT_KEYS = {"sessionData", "serviceSessions", "abcEntries", "phaseLines", "phaseRanges", "graphNotes", "staff"}
ROW_ORDER = ["id", "clientId", "targetId", "timestamp", "sessionNumber", "therapistName", "serviceSessionId",
             "value", "missingDataMode", "correctCount", "totalTrials", "trialSequence", "occurredIntervals",
             "totalIntervals", "intervalScores", "durationSeconds", "occurrenceCount", "episodeDurations",
             "errorCount", "lessonDurationMinutes", "qualitativeEntry", "ioa"]
SESSION_ORDER = ["id", "clientId", "date", "start", "end", "minutes", "therapistName", "role", "serviceCode",
                 "setting", "status", "cancelReason", "settingEvents", "supervision", "fidelity", "ioaObserver"]


def ordered(record, order):
    return {key: record[key] for key in order if key in record}


def serialize(fixture):
    lines = ["{"]
    keys = list(fixture)
    for index, key in enumerate(keys):
        comma = "," if index < len(keys) - 1 else ""
        value = fixture[key]
        if key in COMPACT_KEYS and isinstance(value, list) and value:
            lines.append(f"  {json.dumps(key)}: [")
            for position, item in enumerate(value):
                tail = "," if position < len(value) - 1 else ""
                lines.append("    " + json.dumps(item, ensure_ascii=False, separators=(",", ":")) + tail)
            lines.append(f"  ]{comma}")
        else:
            body = json.dumps(value, indent=2, ensure_ascii=False).replace("\n", "\n  ")
            lines.append(f"  {json.dumps(key)}: {body}{comma}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def build_fixture():
    for client in CLIENTS:
        simulate_client(client)
    document_retraining()
    for number, row in enumerate(SESSION_DATA, start=1):
        row["id"] = f"obs-{number:05d}"
    rows = [ordered(row, ROW_ORDER) for row in SESSION_DATA]
    services = [ordered(session, SESSION_ORDER) for session in SERVICE_SESSIONS]
    abc_configurations = []
    for client in CLIENTS:
        spec = ABC_SPECS[client["id"]]
        behaviors = [p["targets"][0]["name"] for p in PROGRAMS
                     if p["clientId"] == client["id"] and p["category"] == "BehaviorReduction"]
        abc_configurations.append({
            "clientId": client["id"], "treatmentArea": spec["treatmentArea"],
            "teachingInstructions": spec["teachingInstructions"],
            "antecedents": list(spec["antecedents"]), "behaviors": behaviors,
            "consequences": list(spec["consequences"]), "locations": spec["locations"],
            "settingEvents": SETTING_EVENTS,
            "antecedentCategories": spec["antecedents"], "consequenceFunctions": spec["consequences"]})
    return {"asOfDate": AS_OF.isoformat(), "clients": CLIENTS, "staff": STAFF,
            "clinicalStandards": CLINICAL_STANDARDS,
            "promptHierarchyTemplates": PROMPT_HIERARCHY_TEMPLATES,
            "customFieldDefinitions": CUSTOM_FIELD_DEFINITIONS,
            "programs": PROGRAMS, "serviceSessions": services, "sessionData": rows,
            "phaseLines": build_phase_lines(), "phaseRanges": PHASE_RANGES,
            "graphNotes": GRAPH_NOTES, "abcConfigurations": abc_configurations,
            "abcEntries": [{"id": entry["id"], **{k: v for k, v in entry.items() if k != "id"}}
                           for entry in ABC_ENTRIES]}


def main():
    fixture = build_fixture()
    # Content-derived revision ensures existing browser demos reseed when the data
    # changes, even if the number of programs and records stays the same.
    payload = json.dumps(fixture, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    fixture["revision"] = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    output = ROOT / "data/clinicalSeed.json"
    serialized = serialize(fixture)
    if sys.argv[1:] == ["--check"]:
        if not output.exists() or output.read_text(encoding="utf-8") != serialized:
            raise SystemExit("Demo fixture is out of date; run python3 scripts/generate_clinical_seed.py")
        print("Clinical demo fixture is up to date.")
    elif len(sys.argv) == 1:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
        print(f"Wrote {len(PROGRAMS)} programs, {len(TARGETS)} targets, {len(fixture['serviceSessions'])} "
              f"service sessions, {len(fixture['sessionData'])} recordings and {len(fixture['abcEntries'])} "
              f"ABC entries to {output}")
    else:
        raise SystemExit("Usage: python3 scripts/generate_clinical_seed.py [--check]")


if __name__ == "__main__":
    main()
