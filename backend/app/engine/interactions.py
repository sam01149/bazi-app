from app.engine.tables import (
    SIX_CLASHES, SIX_COMBINATIONS, SIX_HARMS, STEM_COMBINATIONS, THREE_COMBINATIONS,
    THREE_PENALTIES, HEAVENLY_STEMS_ELEMENT, EARTHLY_BRANCHES_ELEMENT,
)
from app.engine.calculator import get_element_relation

# Interaction types that disturb a natal branch (vs. six_combination, which bonds one)
_DISRUPTIVE_TYPES = frozenset({"clash", "harm", "penalty", "self_penalty"})

# THREE_PENALTIES holds the 3 named multi-branch groups (Ungrateful/Bullying/
# Uncivilized) plus 4 singleton self-penalty branches. Pair-level lookups and
# the self-penalty set are both derived from it below, instead of being
# hand-duplicated, so there's a single source of truth for what counts as a
# penalty.
_PENALTY_GROUP_NAMES = {
    frozenset({"寅", "巳", "申"}): "Ungrateful Penalty",
    frozenset({"丑", "戌", "未"}): "Bullying Penalty",
    frozenset({"子", "卯"}): "Uncivilized Penalty",
}

def _derive_penalty_pairs() -> list[tuple[frozenset, str]]:
    pairs = []
    for group in THREE_PENALTIES:
        if len(group) < 2:
            continue
        name = _PENALTY_GROUP_NAMES.get(frozenset(group))
        if not name:
            continue
        members = list(group)
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                pairs.append((frozenset({members[i], members[j]}), name))
    return pairs

_PENALTY_PAIRS = _derive_penalty_pairs()
_SELF_PENALTY_BRANCHES = frozenset().union(*(g for g in THREE_PENALTIES if len(g) == 1))


def _classify_branch_pair(b1: str, b2: str) -> list[dict]:
    """Classify ALL interactions between two DISTINCT branches — shared by
    calendar, Luck Pillar, and natal-internal interaction detection so the
    Clash/Combination/Harm/Penalty rules live in exactly one place.

    Returns a LIST, not a single match: some classical branch pairs belong to
    more than one category at once (e.g. 寅-巳 is both a Six Harm AND part of
    the Ungrateful Penalty group) — both must be reported, not just whichever
    rule happened to be checked first.
    """
    if b1 == b2:
        return []
    pair = frozenset({b1, b2})
    found = []
    for clash_pair in SIX_CLASHES:
        if pair == clash_pair:
            found.append({"type": "clash", "description": f"{b1}-{b2} Clash"})
    for combo_pair, element in SIX_COMBINATIONS:
        if pair == combo_pair:
            found.append({"type": "six_combination", "element": element, "description": f"{b1}-{b2} Six Combination ({element})"})
    for harm_pair in SIX_HARMS:
        if pair == harm_pair:
            found.append({"type": "harm", "description": f"{b1}-{b2} Harm"})
    for penalty_pair, penalty_name in _PENALTY_PAIRS:
        if pair == penalty_pair:
            found.append({"type": "penalty", "penalty_name": penalty_name, "description": f"{b1}-{b2} {penalty_name}"})
    return found


def detect_stem_combinations(pillars: dict) -> list:
    """Detect Heavenly Stem Combinations (天干合) within the four pillars."""
    stems = [
        (pos, pillars[pos]["stem"])
        for pos in ("year", "month", "day", "hour")
        if pillars.get(pos, {}).get("stem")
    ]
    result = []
    for i in range(len(stems)):
        for j in range(i + 1, len(stems)):
            pos1, s1 = stems[i]
            pos2, s2 = stems[j]
            for combo_set, element in STEM_COMBINATIONS:
                if {s1, s2} == combo_set:
                    result.append({
                        "stems": [s1, s2],
                        "positions": [pos1, pos2],
                        "result_element": element,
                    })
    return result


def detect_three_combinations(pillars: dict) -> list:
    """
    Detect Three Harmony Combinations (三合局) among the four natal branches —
    e.g. 申子辰 → Water. A 'full' combination (all 3 branches present) forms a
    strong elemental bureau; a 'partial' one (2 of 3 present) is weaker but
    still notable. This table existed in tables.py but was never wired up to
    anything — natal charts with a real 三合局 were getting zero credit for it.
    """
    positions = [
        (pos, pillars[pos]["branch"])
        for pos in ("year", "month", "day", "hour")
        if pillars.get(pos, {}).get("branch")
    ]
    result = []
    for combo_set, element in THREE_COMBINATIONS:
        present = [(pos, b) for pos, b in positions if b in combo_set]
        present_branches = {b for _, b in present}
        if len(present_branches) < 2:
            continue
        result.append({
            "branches": [b for _, b in present],
            "positions": [pos for pos, _ in present],
            "result_element": element,
            "strength": "full" if present_branches == combo_set else "partial",
        })
    return result


def detect_natal_internal_interactions(pillars: dict) -> list:
    """
    Detect Clash/Combination/Harm/Penalty among the natal chart's OWN four
    branches (e.g. Year branch clashing Hour branch) — read as an inherent
    structural trait of the chart (always present), not a time-based event
    like calendar/Luck Pillar interactions.
    """
    positions = [
        (pos, pillars[pos]["branch"])
        for pos in ("year", "month", "day", "hour")
        if pillars.get(pos, {}).get("branch")
    ]
    interactions = []
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            pos1, b1 = positions[i]
            pos2, b2 = positions[j]
            classified = _classify_branch_pair(b1, b2)
            if classified:
                for c in classified:
                    interactions.append({**c, "position_a": pos1, "branch_a": b1, "position_b": pos2, "branch_b": b2})
            elif b1 == b2 and b1 in _SELF_PENALTY_BRANCHES:
                interactions.append({
                    "type": "self_penalty",
                    "position_a": pos1, "branch_a": b1, "position_b": pos2, "branch_b": b2,
                    "description": f"{pos1}-{pos2} ({b1}) Self-Penalty",
                })
    return interactions


def detect_luck_pillar_interactions(natal_pillars: dict, luck_branch: str) -> list:
    """
    Compare the currently active Luck Pillar's (大運) branch against each
    natal branch — a medium-term (~decade) interaction, distinct from
    day-level calendar interactions. Previously the engine only ever compared
    natal branches against the calendar; the active decade itself never
    participated in interaction detection at all.
    """
    if not luck_branch:
        return []
    natal_branches = [
        (pos, natal_pillars[pos]["branch"])
        for pos in ("year", "month", "day", "hour")
        if natal_pillars.get(pos, {}).get("branch")
    ]
    interactions = []
    for pos, nb in natal_branches:
        classified = _classify_branch_pair(nb, luck_branch)
        if classified:
            for c in classified:
                interactions.append({**c, "user_branch": nb, "luck_branch": luck_branch, "natal_position": pos})
        elif nb == luck_branch and nb in _SELF_PENALTY_BRANCHES:
            interactions.append({
                "type": "self_penalty", "user_branch": nb, "luck_branch": luck_branch, "natal_position": pos,
                "description": f"{nb} Self-Penalty",
            })
    return interactions


def detect_calendar_interactions(user_chart: dict, calendar_pillars: dict) -> list:
    """
    Detects clashes, six combinations, six harms, and penalties between
    the user's natal chart branches and the current calendar branches.
    """
    user_branches = [
        user_chart["pillars"]["year"]["branch"],
        user_chart["pillars"]["month"]["branch"],
        user_chart["pillars"]["day"]["branch"],
        user_chart["pillars"]["hour"]["branch"],
    ]
    calendar_branches = [
        calendar_pillars["pillars"]["year"]["branch"],
        calendar_pillars["pillars"]["month"]["branch"],
        calendar_pillars["pillars"]["day"]["branch"],
        calendar_pillars["pillars"]["hour"]["branch"],
    ]

    interactions = []
    for cal_b in calendar_branches:
        for u_b in user_branches:
            classified = _classify_branch_pair(u_b, cal_b)
            if classified:
                for c in classified:
                    interactions.append({**c, "user_branch": u_b, "calendar_branch": cal_b})
            elif u_b == cal_b and u_b in _SELF_PENALTY_BRANCHES:
                interactions.append({
                    "type": "self_penalty",
                    "user_branch": u_b,
                    "calendar_branch": cal_b,
                    "description": f"{u_b} Self-Penalty",
                })

    # Deduplicate (same type + same branch pair → one entry)
    seen: set = set()
    unique = []
    for item in interactions:
        key = (item["type"], item["user_branch"], item["calendar_branch"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def annotate_favorability(interactions: list, day_master: str, yong_shen: str | None) -> list:
    """
    Tags each interaction with how it affects the user's Yong Shen (用神) — the
    element the chart actually needs — instead of treating interaction TYPE
    alone as good/bad (a Clash on a branch the chart doesn't need is a relief,
    not a threat).

    - 'challenging': the disturbed natal branch carries the Yong Shen element.
    - 'favorable': a disruptive interaction hits a branch that ISN'T the Yong
      Shen (removes unneeded energy), or a Six Combination resolves into the
      Yong Shen element.
    - 'neutral': interaction doesn't meaningfully move the Yong Shen needle.
    - None: Yong Shen wasn't resolved for this chart — caller should fall back
      to type-based heuristics.
    """
    if not yong_shen or yong_shen == "需要判断" or not day_master:
        for item in interactions:
            item["favorability"] = None
        return interactions

    dm_element = HEAVENLY_STEMS_ELEMENT.get(day_master, "")
    for item in interactions:
        if item["type"] in _DISRUPTIVE_TYPES:
            user_element = EARTHLY_BRANCHES_ELEMENT.get(item["user_branch"], "")
            relation = get_element_relation(dm_element, user_element)
            item["favorability"] = "challenging" if relation == yong_shen else "favorable"
        elif item["type"] == "six_combination":
            combo_relation = get_element_relation(dm_element, item.get("element", ""))
            item["favorability"] = "favorable" if combo_relation == yong_shen else "neutral"
        else:
            item["favorability"] = "neutral"
    return interactions
