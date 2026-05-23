import os
import datetime
import pytz
from app.engine.tables import *

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
    # 2000-01-01 was 甲子 (Jiazi) index 0 according to brief
    anchor = datetime.date(2000, 1, 1)
    delta = (target_date - anchor).days
    jiazi_index = delta % 60
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


def calculate_day_master_strength(pillars: dict, day_master: str) -> str:
    """
    Estimates Day Master strength by tallying which elements support vs. restrain it.
    Month branch carries 3× weight as the primary seasonal indicator.
    """
    dm_element = HEAVENLY_STEMS_ELEMENT[day_master]

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
        score += _score(HEAVENLY_STEMS_ELEMENT[pillars[key]["stem"]])

    if score >= 5:
        return "Strong"
    if score >= 2:
        return "Moderate-Strong"
    if score >= -1:
        return "Moderate"
    if score >= -4:
        return "Moderate-Weak"
    return "Weak"

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
