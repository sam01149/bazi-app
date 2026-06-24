"""
Unit tests for backend/app/engine/calculator.py

Run with: cd backend && python -m pytest tests/test_calculator.py -v
"""
import sys
import os
import datetime
import pytz

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.engine.calculator import (
    get_day_pillar, get_year_pillar, get_month_pillar, get_hour_pillar,
    calculate_ten_god, calculate_day_master_strength,
    get_ge_ju, get_yong_shen, get_kong_wang,
    get_luck_pillars, get_life_stage, get_special_stars,
)


# ── Day Pillar ────────────────────────────────────────────────────────────────

def test_day_pillar_anchor():
    """Jan 1 2000 (anchor) must be 戊午 (jiazi index 54)."""
    stem, branch = get_day_pillar(datetime.date(2000, 1, 1))
    assert stem == "戊" and branch == "午", f"Got {stem}{branch}, expected 戊午"


def test_day_pillar_known_joey_yap():
    """Nov 24 2004 — Joey Yap example, day pillar should be 丁未."""
    stem, branch = get_day_pillar(datetime.date(2004, 11, 24))
    assert stem == "丁" and branch == "未", f"Got {stem}{branch}, expected 丁未"


def test_day_pillar_cycling():
    """Day pillars cycle every 60 days."""
    d0 = datetime.date(2000, 1, 1)
    s0, b0 = get_day_pillar(d0)
    s60, b60 = get_day_pillar(d0 + datetime.timedelta(days=60))
    assert s0 == s60 and b0 == b60, "60-day cycle broken"


def test_day_pillar_historical():
    """Jan 1 1900 should be 甲戌 (jiazi index 10)."""
    stem, branch = get_day_pillar(datetime.date(1900, 1, 1))
    assert stem == "甲" and branch == "戌", f"Got {stem}{branch}, expected 甲戌"


# ── Year Pillar ───────────────────────────────────────────────────────────────

def test_year_pillar_2024_after_lichun():
    """2024 after Li Chun (Feb 4) should be 甲辰."""
    tz = pytz.UTC
    dt = tz.localize(datetime.datetime(2024, 3, 15, 12, 0))
    stem, branch = get_year_pillar(dt)
    assert stem == "甲" and branch == "辰", f"Got {stem}{branch}"


def test_year_pillar_2024_before_lichun():
    """2024 before Li Chun should still be 癸卯 (2023 year)."""
    tz = pytz.UTC
    dt = tz.localize(datetime.datetime(2024, 1, 15, 12, 0))
    stem, branch = get_year_pillar(dt)
    assert stem == "癸" and branch == "卯", f"Got {stem}{branch}"


def test_year_pillar_1984():
    """1984 after Li Chun: 甲子 year (jiazi cycle starts)."""
    tz = pytz.UTC
    dt = tz.localize(datetime.datetime(1984, 6, 1, 12, 0))
    stem, branch = get_year_pillar(dt)
    assert stem == "甲" and branch == "子", f"Got {stem}{branch}"


# ── Hour Pillar ───────────────────────────────────────────────────────────────

def test_hour_pillar_midnight():
    """Hour 23 (Zi hour) with day stem 甲 → 甲子."""
    stem, branch = get_hour_pillar("甲", 23)
    assert branch == "子", f"Got branch {branch}, expected 子"
    assert stem == "甲", f"Got stem {stem}, expected 甲"


def test_hour_pillar_noon():
    """Hour 12 (Wu hour) with day stem 甲 → 庚午 (Five Rats Method: 甲日甲子时起, 午 is the 7th branch → 庚)."""
    stem, branch = get_hour_pillar("甲", 12)
    assert branch == "午", f"Got branch {branch}"
    assert stem == "庚", f"Got stem {stem}, expected 庚"


# ── Ten Gods ──────────────────────────────────────────────────────────────────

TEN_GOD_CASES = [
    ("甲", "甲", "比肩"),   # same element, same polarity
    ("甲", "乙", "劫財"),   # same element, different polarity
    ("甲", "丙", "食神"),   # DM produces target, same polarity
    ("甲", "丁", "傷官"),   # DM produces target, different polarity
    ("甲", "戊", "偏財"),   # DM controls target, same polarity
    ("甲", "己", "正財"),   # DM controls target, different polarity
    ("甲", "庚", "偏官"),   # target controls DM, same polarity
    ("甲", "辛", "正官"),   # target controls DM, different polarity
    ("甲", "壬", "偏印"),   # target produces DM, same polarity
    ("甲", "癸", "正印"),   # target produces DM, different polarity
]

def test_ten_gods_all():
    """Verify all 10 Ten God relationships for 甲 Day Master."""
    for dm, target, expected in TEN_GOD_CASES:
        result = calculate_ten_god(dm, target)
        assert result == expected, f"calculate_ten_god({dm}, {target}): got {result}, expected {expected}"


# ── Kong Wang ─────────────────────────────────────────────────────────────────

def test_kong_wang_jiazi():
    """甲子 day (jiazi 0) → void branches 戌 亥."""
    voids = get_kong_wang("甲", "子")
    assert set(voids) == {"戌", "亥"}, f"Got {voids}"


def test_kong_wang_jiayin():
    """甲寅 day (jiazi 50) → void branches 子 丑."""
    voids = get_kong_wang("甲", "寅")
    assert set(voids) == {"子", "丑"}, f"Got {voids}"


# ── Ge Ju / Yong Shen ────────────────────────────────────────────────────────

def test_ge_ju_from_month_branch():
    """Month branch 子 hidden stem 癸, DM 甲: 癸 is 正印 → 正印格."""
    result = get_ge_ju("子", "甲")
    assert result == "正印格", f"Got {result}"


def test_yong_shen_strong_jianlu():
    """Strong 建禄格 → Yong Shen = 官殺."""
    result = get_yong_shen("建禄格", "Strong")
    assert result == "官殺", f"Got {result}"


def test_yong_shen_weak_jianlu():
    """Weak 建禄格 → Yong Shen = 印綬."""
    result = get_yong_shen("建禄格", "Weak")
    assert result == "印綬", f"Got {result}"


# ── Luck Pillars ──────────────────────────────────────────────────────────────

def test_luck_pillars_count():
    """get_luck_pillars returns exactly 10 pillars."""
    tz = pytz.timezone("Asia/Jakarta")
    birth = tz.localize(datetime.datetime(1993, 8, 1, 10, 30))
    pillars = get_luck_pillars(birth, "癸", "壬", "申", "male")
    assert len(pillars) == 10, f"Expected 10 luck pillars, got {len(pillars)}"


def test_luck_pillars_ascending_ages():
    """age_start should increase monotonically across pillars."""
    tz = pytz.timezone("Asia/Jakarta")
    birth = tz.localize(datetime.datetime(1993, 8, 1, 10, 30))
    pillars = get_luck_pillars(birth, "癸", "壬", "申", "male")
    ages = [p["age_start"] for p in pillars]
    assert ages == sorted(ages), f"Luck pillar ages not ascending: {ages}"


def test_luck_pillars_10year_gap():
    """Each consecutive pillar should start ~10 years after the previous."""
    tz = pytz.timezone("Asia/Jakarta")
    birth = tz.localize(datetime.datetime(1990, 5, 15, 8, 0))
    pillars = get_luck_pillars(birth, "庚", "甲", "午", "female")
    for i in range(1, len(pillars)):
        gap = pillars[i]["age_start"] - pillars[i - 1]["age_start"]
        assert abs(gap - 10.0) < 0.01, f"Gap between pillar {i-1} and {i}: {gap}"


# ── Life Stages ───────────────────────────────────────────────────────────────

def test_life_stage_start_yang():
    """甲 Day Master: 亥 branch is the start → 长生."""
    result = get_life_stage("甲", "亥")
    assert result == "长生", f"Got {result}"


def test_life_stage_peak_yang():
    """甲 Day Master: 卯 branch is offset 4 from 亥 → 帝旺."""
    # 亥(0)→子(1)→丑(2)→寅(3)→卯(4) = 帝旺
    result = get_life_stage("甲", "卯")
    assert result == "帝旺", f"Got {result}"


def test_life_stage_yin_reverse():
    """乙 Day Master: starts at 午, goes backward. 午 → 长生, 巳 → 沐浴."""
    assert get_life_stage("乙", "午") == "长生"
    assert get_life_stage("乙", "巳") == "沐浴"


# ── Special Stars ─────────────────────────────────────────────────────────────

def test_special_stars_gui_ren_in_chart():
    """甲 Day Master with 丑 in natal branches → Gui Ren in chart."""
    stars = get_special_stars("甲", "子", ["子", "丑", "午", "未"])
    assert stars["gui_ren"]["in_chart"] is True


def test_special_stars_tao_hua():
    """Year branch 子 → Tao Hua branch is 酉. Test in/out."""
    stars_in  = get_special_stars("甲", "子", ["子", "酉", "午", "寅"])
    stars_out = get_special_stars("甲", "子", ["子", "丑", "午", "寅"])
    assert stars_in["tao_hua"]["branch"] == "酉"
    assert stars_in["tao_hua"]["in_chart"]  is True
    assert stars_out["tao_hua"]["in_chart"] is False


def test_special_stars_wen_chang():
    """甲 Day Master → Wen Chang branch 巳."""
    stars = get_special_stars("甲", "子", ["子", "丑", "午", "未"])
    assert stars["wen_chang"]["branch"] == "巳"
    assert stars["wen_chang"]["in_chart"] is False

    stars2 = get_special_stars("甲", "子", ["子", "巳", "午", "未"])
    assert stars2["wen_chang"]["in_chart"] is True
