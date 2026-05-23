from app.engine.tables import SIX_CLASHES, SIX_COMBINATIONS, SIX_HARMS

# Expanded penalty pairs — derived from THREE_PENALTIES for pair-based cross-chart detection.
# Full three-branch sets are detected when at least two branches from the same penalty group meet.
_PENALTY_PAIRS = [
    (frozenset({"寅", "巳"}), "Ungrateful Penalty"),
    (frozenset({"巳", "申"}), "Ungrateful Penalty"),
    (frozenset({"寅", "申"}), "Ungrateful Penalty"),
    (frozenset({"丑", "戌"}), "Bullying Penalty"),
    (frozenset({"戌", "未"}), "Bullying Penalty"),
    (frozenset({"丑", "未"}), "Bullying Penalty"),
    (frozenset({"子", "卯"}), "Uncivilized Penalty"),
]
# Branches that self-penalise when the same branch appears in both user and calendar charts
_SELF_PENALTY_BRANCHES = frozenset({"辰", "午", "酉", "亥"})


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

            # Six Clashes
            for clash_pair in SIX_CLASHES:
                if cal_b in clash_pair and u_b in clash_pair and cal_b != u_b:
                    interactions.append({
                        "type": "clash",
                        "user_branch": u_b,
                        "calendar_branch": cal_b,
                        "description": f"{u_b}-{cal_b} Clash",
                    })

            # Six Combinations
            for combo_pair, element in SIX_COMBINATIONS:
                if cal_b in combo_pair and u_b in combo_pair and cal_b != u_b:
                    interactions.append({
                        "type": "six_combination",
                        "user_branch": u_b,
                        "calendar_branch": cal_b,
                        "element": element,
                        "description": f"{u_b}-{cal_b} Six Combination ({element})",
                    })

            # Six Harms
            for harm_pair in SIX_HARMS:
                if cal_b in harm_pair and u_b in harm_pair and cal_b != u_b:
                    interactions.append({
                        "type": "harm",
                        "user_branch": u_b,
                        "calendar_branch": cal_b,
                        "description": f"{u_b}-{cal_b} Harm",
                    })

            # Penalties
            if cal_b != u_b:
                pair = frozenset({cal_b, u_b})
                for penalty_pair, penalty_name in _PENALTY_PAIRS:
                    if pair == penalty_pair:
                        interactions.append({
                            "type": "penalty",
                            "user_branch": u_b,
                            "calendar_branch": cal_b,
                            "description": f"{u_b}-{cal_b} {penalty_name}",
                        })
            elif cal_b in _SELF_PENALTY_BRANCHES:
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
