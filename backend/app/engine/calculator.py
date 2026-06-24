import os
import datetime
import pytz
from app.engine.tables import (
    HEAVENLY_STEMS, EARTHLY_BRANCHES,
    HEAVENLY_STEMS_ELEMENT, HEAVENLY_STEMS_POLARITY,
    EARTHLY_BRANCHES_ELEMENT, HIDDEN_STEMS,
    SIX_CLASHES, SIX_COMBINATIONS, SIX_HARMS, THREE_COMBINATIONS,
    THREE_PENALTIES, HOUR_BRANCHES, PRODUCES, CONTROLS,
    STEM_COMBINATIONS, KONG_WANG,
    GUI_REN, TAO_HUA, YI_MA, WEN_CHANG, GU_CHEN_GUA_SU,
    LIFE_STAGES, LIFE_STAGE_START,
)

# Try to import swisseph. It might fail locally without C++ tools,
# but it will run fine inside the Docker container.
try:
    import swisseph as swe
except ImportError:
    swe = None

def get_julian_day(year: int, month: int, day: int, hour: float = 0.0) -> float:
    if swe:
        return swe.julday(year, month, day, hour, swe.GREG_CAL)
    # Basic estimative fallback for testing without swisseph
    date_val = datetime.datetime(year, month, day) + datetime.timedelta(hours=hour)
    delta = date_val - datetime.datetime(2000, 1, 1, 12, 0, 0)
    return 2451545.0 + delta.total_seconds() / 86400.0

def _normalize_longitude(lon: float) -> float:
    return lon % 360.0

def get_solar_term_date(year: int, term_index: int) -> datetime.datetime:
    """
    term_index 0-23, mulai dari 小寒 (Slight Cold).
    Li Chun (Start of Spring) is term_index = 2.
    """
    target_longitude = (285 + term_index * 15) % 360
    
    # Estimate jd_start (approximate date)
    # Slight Cold is around Jan 5
    estimated_day_of_year = 5 + term_index * 15.22
    
    if swe:
        jd_start = swe.julday(year, 1, 1, 0.0) + estimated_day_of_year - 5
        
        # Binary search for exact time
        # Search range: +/- 5 days from estimate
        left = jd_start - 5.0
        right = jd_start + 5.0
        
        for _ in range(50): # 50 iterations give very high precision
            mid = (left + right) / 2.0
            pos = swe.calc_ut(mid, swe.SUN, swe.FLG_MOSEPH)[0][0]
            
            # Handle the wrap-around at 360 degrees
            diff = _normalize_longitude(pos - target_longitude)
            if diff > 180:
                diff -= 360
                
            if diff > 0:
                right = mid
            else:
                left = mid
                
        # Convert julian day back to datetime
        jd_final = (left + right) / 2.0
        # swe.revjul returns (year, month, day, hour)
        y, m, d, h = swe.revjul(jd_final, swe.GREG_CAL)
        hours = int(h)
        minutes = int((h - hours) * 60)
        seconds = int((((h - hours) * 60) - minutes) * 60)
        
        # Avoid 60 seconds edge case
        if seconds == 60:
            seconds = 59
            
        dt = datetime.datetime(y, m, d, hours, minutes, seconds, tzinfo=pytz.UTC)
        return dt
    
    # Fallback if no swisseph
    base_date = datetime.datetime(year, 1, 1, 0, 0, tzinfo=pytz.UTC)
    return base_date + datetime.timedelta(days=estimated_day_of_year - 1)

def get_year_pillar(target_date: datetime.datetime) -> tuple[str, str]:
    """
    Tahun BaZi berganti pada Li Chun (Solar Term ke-2).
    """
    year = target_date.year
    li_chun = get_solar_term_date(year, 2)
    
    if target_date < li_chun:
        year -= 1
        
    # Jia Zi year (index 0) was 1984
    offset = (year - 1984) % 60
    stem = HEAVENLY_STEMS[offset % 10]
    branch = EARTHLY_BRANCHES[offset % 12]
    return stem, branch

def get_month_pillar(year_stem: str, target_date: datetime.datetime) -> tuple[str, str]:
    """
    Bulan BaZi berganti pada major solar terms (ganjil: 3, 5, 7, dll).
    Note: January (Slight Cold) is considered the 12th month of the PREVIOUS BaZi year, 
    but term 0 and 1 belong to it.
    """
    bazi_year = target_date.year
    li_chun = get_solar_term_date(bazi_year, 2)
    if target_date < li_chun:
        bazi_year -= 1

    # Find which solar month we are in (1 to 12)
    # Month 1 starts at term_index 2 (Li Chun)
    month_index = 1
    for m in range(2, 14): # 2 to 13
        # Major solar term for month m
        # m=2->term 2, m=3->term 4, m=4->term 6 ...
        # If m exceeds 12, we wrap around to next year's term 0 and 2
        term_idx = (m * 2 - 2)
        y = bazi_year
        if term_idx >= 24:
            term_idx -= 24
            y += 1
            
        term_date = get_solar_term_date(y, term_idx)
        if target_date >= term_date:
            month_index = m - 1
        else:
            break
            
    # Calculate month branch (Month 1 is always Yin)
    branch_idx = (month_index + 1) % 12
    branch = EARTHLY_BRANCHES[branch_idx]
    
    # Calculate month stem (Five Tigers method - 五虎遁年起月法)
    # Jia/Ji -> Bing (2)
    # Yi/Geng -> Wu (4)
    # Bing/Xin -> Geng (6)
    # Ding/Ren -> Ren (8)
    # Wu/Gui -> Jia (0)
    year_stem_idx = HEAVENLY_STEMS.index(year_stem)
    start_stem_idx = (((year_stem_idx % 5) + 1) * 2) % 10
    
    stem_idx = (start_stem_idx + (month_index - 1)) % 10
    stem = HEAVENLY_STEMS[stem_idx]
    
    return stem, branch

def get_day_pillar(target_date: datetime.date) -> tuple[str, str]:
    # Jan 1, 2000 = jiazi index 54 (戊午)
    # Derived from: Jan 1, 1900 = 甲戌 (index 10); 36524 days to Jan 1 2000; (10+44)%60=54
    anchor = datetime.date(2000, 1, 1)
    ANCHOR_JIAZI = 54
    delta = (target_date - anchor).days
    jiazi_index = (delta + ANCHOR_JIAZI) % 60
    stem = HEAVENLY_STEMS[jiazi_index % 10]
    branch = EARTHLY_BRANCHES[jiazi_index % 12]
    return stem, branch

def get_hour_pillar(day_stem: str, hour: int) -> tuple[str, str]:
    branch = None
    for (start, end), b in HOUR_BRANCHES.items():
        if start > end: # 23-1
            if hour >= start or hour < end:
                branch = b
                break
        else:
            if start <= hour < end:
                branch = b
                break
    if not branch:
        branch = "子"
        
    day_stem_idx = HEAVENLY_STEMS.index(day_stem)
    start_stem_idx = ((day_stem_idx % 5) * 2) % 10
    branch_idx = EARTHLY_BRANCHES.index(branch)
    hour_stem_idx = (start_stem_idx + branch_idx) % 10
    stem = HEAVENLY_STEMS[hour_stem_idx]
    
    return stem, branch

def calculate_ten_god(day_master: str, target_stem: str) -> str:
    dm_element = HEAVENLY_STEMS_ELEMENT[day_master]
    dm_polarity = HEAVENLY_STEMS_POLARITY[day_master]
    t_element = HEAVENLY_STEMS_ELEMENT[target_stem]
    t_polarity = HEAVENLY_STEMS_POLARITY[target_stem]

    same_polarity = (dm_polarity == t_polarity)

    if dm_element == t_element:
        return "比肩" if same_polarity else "劫財"
    if PRODUCES[dm_element] == t_element:
        return "食神" if same_polarity else "傷官"
    if CONTROLS[dm_element] == t_element:
        return "偏財" if same_polarity else "正財"
    if CONTROLS[t_element] == dm_element:
        return "偏官" if same_polarity else "正官"
    if PRODUCES[t_element] == dm_element:
        return "偏印" if same_polarity else "正印"
    return "Unknown"


def get_element_relation(day_master_element: str, other_element: str) -> str:
    """
    Groups an element's relationship to the Day Master's element into the five
    generic forces (比劫/食神/財星/官殺/印綬), ignoring stem polarity. Used to compare
    a branch's element against Yong Shen (用神), which is stored as one of these
    five group names.
    """
    if not other_element:
        return "Unknown"
    if other_element == day_master_element:
        return "比劫"
    if PRODUCES.get(day_master_element) == other_element:
        return "食神"
    if CONTROLS.get(day_master_element) == other_element:
        return "財星"
    if CONTROLS.get(other_element) == day_master_element:
        return "官殺"
    if PRODUCES.get(other_element) == day_master_element:
        return "印綬"
    return "Unknown"


def calculate_day_master_strength(pillars: dict, day_master: str) -> str:
    """
    Estimates Day Master strength by tallying which elements support vs. restrain it.
    Month branch carries 3× weight as the primary seasonal indicator.

    Heavenly Stem Combinations (天干合) among year/month/hour stems shift the
    combining stems' contribution to the combination's result element instead
    of their original element, but only when the month branch's element
    supports or produces that result element (the classical 合化 condition that
    the season must back the transformation). The Day stem is excluded from
    transformation — Day Master transformation (化氣格) needs criteria beyond
    this engine's scope.
    """
    dm_element = HEAVENLY_STEMS_ELEMENT[day_master]
    month_branch_element = EARTHLY_BRANCHES_ELEMENT[pillars["month"]["branch"]]

    stem_overrides: dict[str, str] = {}
    stem_positions = [
        (pos, pillars[pos]["stem"])
        for pos in ("year", "month", "hour")
        if pillars.get(pos, {}).get("stem")
    ]
    for i in range(len(stem_positions)):
        for j in range(i + 1, len(stem_positions)):
            pos1, s1 = stem_positions[i]
            pos2, s2 = stem_positions[j]
            for combo_set, result_element in STEM_COMBINATIONS:
                if {s1, s2} != combo_set:
                    continue
                transforms = (
                    month_branch_element == result_element
                    or PRODUCES.get(month_branch_element) == result_element
                )
                if transforms:
                    stem_overrides[pos1] = result_element
                    stem_overrides[pos2] = result_element

    def _stem_element(pos: str) -> str:
        return stem_overrides.get(pos, HEAVENLY_STEMS_ELEMENT[pillars[pos]["stem"]])

    def _score(element: str) -> int:
        if element == dm_element:
            return 1   # 比劫 — same element, supports DM
        if PRODUCES.get(element) == dm_element:
            return 1   # 印 — produces DM
        if CONTROLS.get(element) == dm_element:
            return -1  # 官殺 — controls DM
        if PRODUCES.get(dm_element) == element:
            return -1  # 食傷 — DM drains into this
        if CONTROLS.get(dm_element) == element:
            return -1  # 財 — DM controls this (disperses energy)
        return 0

    score = 0

    # Month branch: primary seasonal indicator (weight ×3)
    score += _score(EARTHLY_BRANCHES_ELEMENT[pillars["month"]["branch"]]) * 3

    # Remaining branches (year, day, hour) — weight ×1 each
    for key in ("year", "day", "hour"):
        score += _score(EARTHLY_BRANCHES_ELEMENT[pillars[key]["branch"]])

    # Other stems (year, month, hour) — exclude day stem (that IS the day master)
    for key in ("year", "month", "hour"):
        score += _score(_stem_element(key))

    if score >= 5:
        return "Strong"
    if score >= 2:
        return "Moderate-Strong"
    if score >= -1:
        return "Moderate"
    if score >= -4:
        return "Moderate-Weak"
    return "Weak"

_GE_JU_FROM_TEN_GOD = {
    "比肩": "建禄格",
    "劫財": "月刃格",
    "食神": "食神格",
    "傷官": "傷官格",
    "偏財": "偏財格",
    "正財": "正財格",
    "偏官": "七殺格",
    "正官": "正官格",
    "偏印": "偏印格",
    "正印": "正印格",
}

_YONG_SHEN_RULES = {
    ("建禄格", True):  "官殺",
    ("建禄格", False): "印綬",
    ("月刃格", True):  "官殺",
    ("月刃格", False): "印綬",
    ("食神格", True):  "財星",
    ("食神格", False): "印綬",
    ("傷官格", True):  "財星",
    ("傷官格", False): "印綬",
    ("偏財格", True):  "官殺",
    ("偏財格", False): "比劫",
    ("正財格", True):  "官殺",
    ("正財格", False): "比劫",
    ("七殺格", True):  "食神",
    ("七殺格", False): "印綬",
    ("正官格", True):  "印綬",
    ("正官格", False): "印綬",
    ("偏印格", True):  "財星",
    ("偏印格", False): "官殺",
    ("正印格", True):  "財星",
    ("正印格", False): "官殺",
}


def get_ge_ju(month_branch: str, day_master: str) -> str:
    """Determine the structural pattern (格局) from the dominant hidden stem of the Month Branch."""
    dominant_stem = HIDDEN_STEMS.get(month_branch, [""])[0]
    if not dominant_stem:
        return "未知格"
    ten_god = calculate_ten_god(day_master, dominant_stem)
    return _GE_JU_FROM_TEN_GOD.get(ten_god, f"{ten_god}格")


def get_yong_shen(ge_ju: str, strength: str) -> str:
    """Determine the Useful God (用神) based on structure and DM strength."""
    is_strong = strength in ("Strong", "Moderate-Strong")
    return _YONG_SHEN_RULES.get((ge_ju, is_strong), "需要判断")


def get_hidden_stem_ten_gods(pillars: dict, day_master: str) -> dict:
    """Return Ten Gods for all hidden stems in each pillar's branch."""
    result = {}
    for position in ("year", "month", "day", "hour"):
        branch = pillars[position].get("branch", "")
        if not branch:
            continue
        result[position] = [
            {
                "stem": hs,
                "ten_god": calculate_ten_god(day_master, hs),
                "element": HEAVENLY_STEMS_ELEMENT[hs],
                "polarity": HEAVENLY_STEMS_POLARITY[hs],
            }
            for hs in HIDDEN_STEMS.get(branch, [])
        ]
    return result


def get_kong_wang(day_stem: str, day_branch: str) -> list:
    """Return the two void branches (空亡) for the Day Pillar's 旬 cycle."""
    ds_idx = HEAVENLY_STEMS.index(day_stem)
    db_idx = EARTHLY_BRANCHES.index(day_branch)
    jiazi = next((i for i in range(60) if i % 10 == ds_idx and i % 12 == db_idx), None)
    if jiazi is None:
        return []
    return KONG_WANG.get((jiazi // 10) * 10, [])


def get_luck_pillars(
    birth_dt: datetime.datetime,
    year_stem: str,
    month_stem: str,
    month_branch: str,
    gender: str,
) -> list:
    """
    Calculate 10 Luck Pillars (大運).
    Direction: Male+Yang or Female+Yin = forward; Male+Yin or Female+Yang = backward.
    Age start = days to nearest major solar term ÷ 3.
    """
    year_polarity = HEAVENLY_STEMS_POLARITY[year_stem]
    direction = 1 if (
        (gender.lower() == "male" and year_polarity == "Yang") or
        (gender.lower() == "female" and year_polarity == "Yin")
    ) else -1

    birth_utc = birth_dt.astimezone(pytz.UTC)
    birth_year = birth_utc.year

    # Collect even-indexed (major) solar terms from 2 years around birth
    candidate_terms = []
    for y in range(birth_year - 1, birth_year + 2):
        for term_idx in range(0, 24, 2):
            candidate_terms.append(get_solar_term_date(y, term_idx))
    candidate_terms.sort()

    if direction == 1:
        nearest = next((t for t in candidate_terms if t > birth_utc), None)
    else:
        nearest = next((t for t in reversed(candidate_terms) if t < birth_utc), None)

    if nearest is None:
        return []

    delta_days = abs((nearest - birth_utc).total_seconds() / 86400.0)
    age_start = delta_days / 3.0

    # Find jiazi index of month pillar for 60-cycle navigation
    ms_idx = HEAVENLY_STEMS.index(month_stem)
    mb_idx = EARTHLY_BRANCHES.index(month_branch)
    month_jiazi = next(i for i in range(60) if i % 10 == ms_idx and i % 12 == mb_idx)

    pillars = []
    for i in range(10):
        lp_jiazi = (month_jiazi + direction * (i + 1)) % 60
        pillars.append({
            "stem": HEAVENLY_STEMS[lp_jiazi % 10],
            "branch": EARTHLY_BRANCHES[lp_jiazi % 12],
            "age_start": round(age_start + i * 10, 1),
            "order_index": i,
        })
    return pillars


def get_active_luck_pillar(luck_pillars: list, birth_dt: datetime.datetime) -> dict | None:
    """Return the currently active Luck Pillar based on age today."""
    if not luck_pillars:
        return None
    if birth_dt.tzinfo is None:
        birth_utc = pytz.UTC.localize(birth_dt)
    else:
        birth_utc = birth_dt.astimezone(pytz.UTC)
    today_utc = datetime.datetime.now(pytz.UTC)
    age_years = (today_utc - birth_utc).total_seconds() / (365.25 * 24 * 3600)
    active = None
    for p in luck_pillars:
        if p["age_start"] <= age_years:
            active = p
        else:
            break
    return active


def get_life_stage(day_stem: str, branch: str) -> str:
    """Return the 12 Life Stage (十二运星) for a given branch under the day stem."""
    start_branch = LIFE_STAGE_START.get(day_stem)
    if not start_branch or branch not in EARTHLY_BRANCHES:
        return ""
    polarity = HEAVENLY_STEMS_POLARITY.get(day_stem, "Yang")
    start_idx  = EARTHLY_BRANCHES.index(start_branch)
    branch_idx = EARTHLY_BRANCHES.index(branch)
    if polarity == "Yang":
        offset = (branch_idx - start_idx) % 12
    else:
        offset = (start_idx - branch_idx) % 12
    return LIFE_STAGES[offset]


def get_special_stars(day_stem: str, year_branch: str, natal_branches: list) -> dict:
    """
    Identify which special stars (神煞) appear in the natal chart branches.
    natal_branches: all four natal branch values [year_b, month_b, day_b, hour_b]
    Returns a dict of star_name → {branches/branch, in_chart: bool}.
    """
    natal_set = set(natal_branches)
    result = {}

    # Gui Ren (贵人) — two noble people branches for day stem
    gui_branches = GUI_REN.get(day_stem, [])
    result["gui_ren"] = {
        "branches": gui_branches,
        "in_chart": any(b in natal_set for b in gui_branches),
    }

    # Tao Hua (桃花) — one branch based on year branch
    tao_branch = TAO_HUA.get(year_branch)
    if tao_branch:
        result["tao_hua"] = {
            "branch": tao_branch,
            "in_chart": tao_branch in natal_set,
        }

    # Yi Ma (驿马) — one branch based on year branch
    yi_branch = YI_MA.get(year_branch)
    if yi_branch:
        result["yi_ma"] = {
            "branch": yi_branch,
            "in_chart": yi_branch in natal_set,
        }

    # Wen Chang (文昌) — one branch based on day stem
    wen_branch = WEN_CHANG.get(day_stem)
    if wen_branch:
        result["wen_chang"] = {
            "branch": wen_branch,
            "in_chart": wen_branch in natal_set,
        }

    # Gu Chen (孤辰) & Gua Su (寡宿) — based on year branch
    gu_gua = GU_CHEN_GUA_SU.get(year_branch)
    if gu_gua:
        gu_branch, gua_branch = gu_gua
        result["gu_chen"] = {
            "branch": gu_branch,
            "in_chart": gu_branch in natal_set,
        }
        result["gua_su"] = {
            "branch": gua_branch,
            "in_chart": gua_branch in natal_set,
        }

    return result


def get_bazi_chart(dt: datetime.datetime) -> dict:
    """
    Expects dt to be tz-aware (localized to birth timezone).
    Year/month use UTC for astronomical solar term comparisons;
    day/hour use local time since BaZi day/hour boundaries follow local midnight.
    """
    dt_utc = dt.astimezone(pytz.UTC)

    year_stem, year_branch = get_year_pillar(dt_utc)
    month_stem, month_branch = get_month_pillar(year_stem, dt_utc)
    day_stem, day_branch = get_day_pillar(dt.date())
    hour_stem, hour_branch = get_hour_pillar(day_stem, dt.hour)

    pillars = {
        "year":  {"stem": year_stem,  "branch": year_branch},
        "month": {"stem": month_stem, "branch": month_branch},
        "day":   {"stem": day_stem,   "branch": day_branch},
        "hour":  {"stem": hour_stem,  "branch": hour_branch},
    }

    ten_gods = {
        "year_stem":  calculate_ten_god(day_stem, year_stem),
        "month_stem": calculate_ten_god(day_stem, month_stem),
        "hour_stem":  calculate_ten_god(day_stem, hour_stem),
    }

    return {
        "pillars": pillars,
        "ten_gods": ten_gods,
        "day_master": day_stem,
        "day_master_strength": calculate_day_master_strength(pillars, day_stem),
    }
