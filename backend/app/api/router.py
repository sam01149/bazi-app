from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, date
import pytz

from app.database import get_db
from app.models.schemas import (
    ChartCalculateRequest, ChartResponse, CalendarResponse,
    NarasiGenerateRequest, PillarsSchema, PillarSchema,
    WishCreateRequest, WishResponse, WishAnalyzeRequest, WishUpdateRequest,
    ProfileResponse, CalendarNarasiRequest, LuckPillarSchema,
)
from app.models.domain import BaZiChart, TenGod, Wish, CachedNarasi, LuckPillar
from app.engine.calculator import (
    get_bazi_chart, get_solar_term_date,
    get_ge_ju, get_yong_shen,
    get_hidden_stem_ten_gods, get_kong_wang,
    get_luck_pillars, get_active_luck_pillar,
)
from app.engine.interactions import detect_calendar_interactions, detect_stem_combinations
from app.engine.tables import HEAVENLY_STEMS_ELEMENT, HEAVENLY_STEMS_POLARITY
from app.services.cerebras import generate_narasi, generate_wish_analysis, generate_calendar_narasi, generate_annual_narasi, is_error_narasi

router = APIRouter()


def _pillars_schema(db_chart: BaZiChart) -> PillarsSchema:
    return PillarsSchema(
        year=PillarSchema(stem=db_chart.year_stem, branch=db_chart.year_branch),
        month=PillarSchema(stem=db_chart.month_stem, branch=db_chart.month_branch),
        day=PillarSchema(stem=db_chart.day_stem, branch=db_chart.day_branch),
        hour=PillarSchema(stem=db_chart.hour_stem or '', branch=db_chart.hour_branch or ''),
    )


def _pillars_dict(db_chart: BaZiChart) -> dict:
    return {
        "year":  {"stem": db_chart.year_stem,  "branch": db_chart.year_branch},
        "month": {"stem": db_chart.month_stem, "branch": db_chart.month_branch},
        "day":   {"stem": db_chart.day_stem,   "branch": db_chart.day_branch},
        "hour":  {"stem": db_chart.hour_stem or "", "branch": db_chart.hour_branch or ""},
    }


def _build_chart_response(
    db_chart: BaZiChart,
    ten_gods_map: dict,
    luck_pillars_list: list = None,
) -> ChartResponse:
    pillars = _pillars_dict(db_chart)
    void_branches = get_kong_wang(db_chart.day_stem, db_chart.day_branch)
    stem_combinations = detect_stem_combinations(pillars)
    hidden_ten_gods = get_hidden_stem_ten_gods(pillars, db_chart.day_stem)

    lp_schemas: list[LuckPillarSchema] = []
    if luck_pillars_list:
        lp_schemas = [
            LuckPillarSchema(
                stem=lp.stem,
                branch=lp.branch,
                age_start=float(lp.age_start),
                order_index=int(lp.order_index),
            )
            for lp in sorted(luck_pillars_list, key=lambda x: x.order_index)
        ]

    active_lp: Optional[LuckPillarSchema] = None
    if lp_schemas:
        tz = pytz.timezone(db_chart.birth_timezone)
        birth_aware = tz.localize(db_chart.birth_datetime)
        active_dict = get_active_luck_pillar(
            [{"age_start": lp.age_start, "stem": lp.stem, "branch": lp.branch, "order_index": lp.order_index}
             for lp in lp_schemas],
            birth_aware,
        )
        if active_dict:
            active_lp = LuckPillarSchema(**active_dict)

    return ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=_pillars_schema(db_chart),
        ten_gods=ten_gods_map,
        day_master_strength=db_chart.day_master_strength,
        gender=db_chart.gender,
        ge_ju=db_chart.ge_ju,
        yong_shen=db_chart.yong_shen,
        void_branches=void_branches or None,
        stem_combinations=stem_combinations or None,
        hidden_ten_gods=hidden_ten_gods or None,
        luck_pillars=lp_schemas or None,
        active_luck_pillar=active_lp,
        hour_unknown=db_chart.hour_unknown or False,
    )


def _build_chart_dict(db_chart: BaZiChart, ten_gods_map: dict = None, luck_pillars_list: list = None) -> dict:
    """Build chart dict for AI payload."""
    pillars = _pillars_dict(db_chart)
    day_stem = db_chart.day_stem
    d = {
        "day_master": f"{day_stem} {HEAVENLY_STEMS_ELEMENT.get(day_stem, '')} {HEAVENLY_STEMS_POLARITY.get(day_stem, '')}".strip(),
        "strength": db_chart.day_master_strength,
        "ge_ju": db_chart.ge_ju,
        "yong_shen": db_chart.yong_shen,
        "pillars": pillars,
        "void_branches": get_kong_wang(day_stem, db_chart.day_branch),
        "stem_combinations": detect_stem_combinations(pillars),
        "hidden_ten_gods": get_hidden_stem_ten_gods(pillars, day_stem),
    }
    if ten_gods_map:
        d["ten_gods"] = ten_gods_map
    if luck_pillars_list is not None:
        tz = pytz.timezone(db_chart.birth_timezone)
        birth_aware = tz.localize(db_chart.birth_datetime)
        lp_raw = [{"age_start": lp.age_start, "stem": lp.stem, "branch": lp.branch, "order_index": lp.order_index}
                  for lp in sorted(luck_pillars_list, key=lambda x: x.order_index)]
        d["active_luck_pillar"] = get_active_luck_pillar(lp_raw, birth_aware)
    return d


# ─── Charts ───────────────────────────────────────────────────────────────────

@router.post("/charts/calculate", response_model=ChartResponse)
async def calculate_chart(req: ChartCalculateRequest, db: AsyncSession = Depends(get_db)):
    try:
        tz = pytz.timezone(req.birth_timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    if req.gender and req.gender.lower() not in ("male", "female"):
        raise HTTPException(status_code=400, detail="gender must be 'male' or 'female'")

    hour = req.birth_time.hour if req.birth_time else 12
    minute = req.birth_time.minute if req.birth_time else 0

    dt_local = datetime(req.birth_date.year, req.birth_date.month, req.birth_date.day, hour, minute)
    dt_aware = tz.localize(dt_local)

    chart_data = get_bazi_chart(dt_aware)
    pillars = chart_data["pillars"]
    day_stem = chart_data["day_master"]
    strength = chart_data["day_master_strength"]

    ge_ju = get_ge_ju(pillars["month"]["branch"], day_stem)
    yong_shen = get_yong_shen(ge_ju, strength)

    db_chart = BaZiChart(
        birth_datetime=dt_aware.replace(tzinfo=None),
        birth_timezone=req.birth_timezone,
        year_stem=pillars["year"]["stem"],
        year_branch=pillars["year"]["branch"],
        month_stem=pillars["month"]["stem"],
        month_branch=pillars["month"]["branch"],
        day_stem=pillars["day"]["stem"],
        day_branch=pillars["day"]["branch"],
        hour_stem=pillars["hour"]["stem"],
        hour_branch=pillars["hour"]["branch"],
        day_master_strength=strength,
        gender=req.gender,
        ge_ju=ge_ju,
        yong_shen=yong_shen,
        hour_unknown=req.birth_time is None or req.hour_unknown,
    )
    db.add(db_chart)
    await db.flush()

    # Surface ten gods (stem-level)
    position_stem_map = {
        "year_stem":  pillars["year"]["stem"],
        "month_stem": pillars["month"]["stem"],
        "hour_stem":  pillars["hour"]["stem"],
    }
    for pos, god in chart_data["ten_gods"].items():
        actual_stem = position_stem_map.get(pos, "")
        db.add(TenGod(
            chart_id=db_chart.id,
            position=pos,
            stem_or_branch="stem",
            ten_god=god,
            element=HEAVENLY_STEMS_ELEMENT.get(actual_stem, "Unknown"),
            polarity=HEAVENLY_STEMS_POLARITY.get(actual_stem, "Unknown"),
        ))

    # Hidden ten gods (branch-level)
    hidden_tgs = get_hidden_stem_ten_gods(pillars, day_stem)
    for position, hs_list in hidden_tgs.items():
        branch = pillars[position]["branch"]
        for hs_data in hs_list:
            db.add(TenGod(
                chart_id=db_chart.id,
                position=f"hidden_{position}",
                stem_or_branch="hidden",
                ten_god=hs_data["ten_god"],
                element=hs_data["element"],
                polarity=hs_data["polarity"],
                source_branch=branch,
            ))

    # Luck pillars (only if gender provided)
    saved_lp: list[LuckPillar] = []
    if req.gender:
        lp_list = get_luck_pillars(
            dt_aware,
            pillars["year"]["stem"],
            pillars["month"]["stem"],
            pillars["month"]["branch"],
            req.gender,
        )
        for lp in lp_list:
            obj = LuckPillar(
                chart_id=db_chart.id,
                order_index=lp["order_index"],
                stem=lp["stem"],
                branch=lp["branch"],
                age_start=lp["age_start"],
            )
            db.add(obj)
            saved_lp.append(obj)

    await db.commit()
    await db.refresh(db_chart)

    return _build_chart_response(db_chart, chart_data["ten_gods"], saved_lp)


@router.get("/charts/{chart_id}", response_model=ChartResponse)
async def get_chart(chart_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(BaZiChart)
        .where(BaZiChart.id == chart_id)
        .options(
            selectinload(BaZiChart.ten_gods),
            selectinload(BaZiChart.luck_pillars),
        )
    )
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    ten_gods = {tg.position: tg.ten_god for tg in db_chart.ten_gods if tg.stem_or_branch == "stem"}
    return _build_chart_response(db_chart, ten_gods, db_chart.luck_pillars)


# ─── Calendar ─────────────────────────────────────────────────────────────────

@router.get("/calendar/current", response_model=CalendarResponse)
async def get_current_calendar(timezone: str = "UTC", chart_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    try:
        tz = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    now = datetime.now(tz)
    return await _build_calendar_response(now, chart_id, db)


@router.get("/calendar/date/{date_str}", response_model=CalendarResponse)
async def get_calendar_for_date(
    date_str: str,
    timezone: str = "UTC",
    chart_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        tz = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="date_str must be YYYY-MM-DD")

    dt_aware = tz.localize(datetime(d.year, d.month, d.day, 12, 0))
    return await _build_calendar_response(dt_aware, chart_id, db)


async def _build_calendar_response(
    dt_aware: datetime,
    chart_id: Optional[str],
    db: AsyncSession,
) -> CalendarResponse:
    cal = get_bazi_chart(dt_aware)

    pillars = PillarsSchema(
        year=PillarSchema(stem=cal["pillars"]["year"]["stem"], branch=cal["pillars"]["year"]["branch"]),
        month=PillarSchema(stem=cal["pillars"]["month"]["stem"], branch=cal["pillars"]["month"]["branch"]),
        day=PillarSchema(stem=cal["pillars"]["day"]["stem"], branch=cal["pillars"]["day"]["branch"]),
        hour=PillarSchema(stem=cal["pillars"]["hour"]["stem"], branch=cal["pillars"]["hour"]["branch"]),
    )

    interactions = []

    if chart_id:
        stmt = select(BaZiChart).where(BaZiChart.id == chart_id)
        result = await db.execute(stmt)
        user_db_chart = result.scalars().first()

        if user_db_chart:
            user_dict = {
                "pillars": {
                    "year":  {"branch": user_db_chart.year_branch},
                    "month": {"branch": user_db_chart.month_branch},
                    "day":   {"branch": user_db_chart.day_branch},
                    "hour":  {"branch": user_db_chart.hour_branch},
                }
            }
            interactions = detect_calendar_interactions(user_dict, cal)

    date_str = dt_aware.strftime("%Y-%m-%d")
    return CalendarResponse(
        current_pillars=pillars,
        interactions=interactions,
        date_str=date_str,
    )

def _interaction_to_dict(interaction) -> dict:
    if isinstance(interaction, dict):
        return {
            "type": interaction.get("type"),
            "user_branch": interaction.get("user_branch"),
            "calendar_branch": interaction.get("calendar_branch"),
            "description": interaction.get("description"),
            "element": interaction.get("element"),
        }
    return {
        "type": getattr(interaction, "type", None),
        "user_branch": getattr(interaction, "user_branch", None),
        "calendar_branch": getattr(interaction, "calendar_branch", None),
        "description": getattr(interaction, "description", None),
        "element": getattr(interaction, "element", None),
    }


@router.post("/calendar/narasi")
async def get_calendar_narasi(req: CalendarNarasiRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == req.chart_id)
    result = await db.execute(stmt)
    db_chart = result.scalars().first()
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    try:
        tz = pytz.timezone(req.timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    try:
        d = date.fromisoformat(req.date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="date_str must be YYYY-MM-DD")

    dt_aware = tz.localize(datetime(d.year, d.month, d.day, 12, 0))
    cal = get_bazi_chart(dt_aware)

    user_dict = {
        "pillars": {
            "year":  {"branch": db_chart.year_branch},
            "month": {"branch": db_chart.month_branch},
            "day":   {"branch": db_chart.day_branch},
            "hour":  {"branch": db_chart.hour_branch},
        }
    }
    interactions_raw = detect_calendar_interactions(user_dict, cal)
    interactions_list = [_interaction_to_dict(i) for i in interactions_raw]

    calendar_pillars = {
        "year":  {"stem": cal["pillars"]["year"]["stem"],  "branch": cal["pillars"]["year"]["branch"]},
        "month": {"stem": cal["pillars"]["month"]["stem"], "branch": cal["pillars"]["month"]["branch"]},
        "day":   {"stem": cal["pillars"]["day"]["stem"],   "branch": cal["pillars"]["day"]["branch"]},
    }

    day_stem = db_chart.day_stem
    user_chart_for_ai = {
        "day_master": f"{day_stem} {HEAVENLY_STEMS_ELEMENT.get(day_stem, '')} {HEAVENLY_STEMS_POLARITY.get(day_stem, '')}".strip(),
        "strength": db_chart.day_master_strength,
        "ge_ju": db_chart.ge_ju,
        "yong_shen": db_chart.yong_shen,
        "pillars": _pillars_dict(db_chart),
    }

    narasi = await generate_calendar_narasi(
        user_chart_for_ai, calendar_pillars, interactions_list, req.date_str
    )

    if is_error_narasi(narasi):
        msg = narasi.replace("ERROR: ", "", 1)
        raise HTTPException(status_code=503, detail=msg)

    return {"narasi": narasi}


# ─── Narasi (profile sections) ────────────────────────────────────────────────

@router.post("/narasi/generate")
async def generate_narasi_endpoint(req: NarasiGenerateRequest, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(BaZiChart)
        .where(BaZiChart.id == req.chart_id)
        .options(
            selectinload(BaZiChart.ten_gods),
            selectinload(BaZiChart.luck_pillars),
        )
    )
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Return cached version if available
    cached_stmt = select(CachedNarasi).where(
        CachedNarasi.chart_id == req.chart_id,
        CachedNarasi.section == req.section,
    )
    cached_result = await db.execute(cached_stmt)
    cached = cached_result.scalars().first()
    if cached and not is_error_narasi(cached.narasi_text):
        return {"narasi": cached.narasi_text, "cached": True}

    ten_gods_map = {tg.position: tg.ten_god for tg in db_chart.ten_gods if tg.stem_or_branch == "stem"}
    structured_data = _build_chart_dict(db_chart, ten_gods_map, db_chart.luck_pillars)

    narration = await generate_narasi(structured_data, req.section)

    if is_error_narasi(narration):
        if cached:
            await db.delete(cached)
            await db.commit()
        msg = narration.replace("ERROR: ", "", 1)
        raise HTTPException(status_code=503, detail=msg)

    if cached:
        cached.narasi_text = narration
    else:
        db.add(CachedNarasi(
            chart_id=req.chart_id,
            section=req.section,
            narasi_text=narration,
        ))
    await db.commit()

    return {"narasi": narration, "cached": False}


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/profile/{chart_id}")
async def get_profile(chart_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(BaZiChart)
        .where(BaZiChart.id == chart_id)
        .options(
            selectinload(BaZiChart.ten_gods),
            selectinload(BaZiChart.cached_narasi),
            selectinload(BaZiChart.luck_pillars),
        )
    )
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    ten_gods = {tg.position: tg.ten_god for tg in db_chart.ten_gods if tg.stem_or_branch == "stem"}
    cached_sections = {cn.section: cn.narasi_text for cn in db_chart.cached_narasi}

    chart_resp = _build_chart_response(db_chart, ten_gods, db_chart.luck_pillars)
    return {"chart": chart_resp, "cached_sections": cached_sections}


# ─── Wishes ───────────────────────────────────────────────────────────────────

@router.post("/wishes", response_model=WishResponse)
async def create_wish(req: WishCreateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == req.chart_id)
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Chart not found")

    wish = Wish(chart_id=req.chart_id, content=req.content)
    db.add(wish)
    await db.commit()
    await db.refresh(wish)
    return wish


@router.get("/wishes", response_model=List[WishResponse])
async def list_wishes(chart_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Wish).where(Wish.chart_id == chart_id).order_by(Wish.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/wishes/{wish_id}")
async def delete_wish(wish_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Wish).where(Wish.id == wish_id)
    result = await db.execute(stmt)
    wish = result.scalars().first()
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    await db.delete(wish)
    await db.commit()
    return {"ok": True}


@router.patch("/wishes/{wish_id}", response_model=WishResponse)
async def update_wish(wish_id: str, req: WishUpdateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Wish).where(Wish.id == wish_id)
    result = await db.execute(stmt)
    wish = result.scalars().first()
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    wish.content = req.content.strip()
    await db.commit()
    await db.refresh(wish)
    return wish


@router.post("/wishes/{wish_id}/analyze", response_model=WishResponse)
async def analyze_wish(wish_id: str, req: WishAnalyzeRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Wish).where(Wish.id == wish_id)
    result = await db.execute(stmt)
    wish = result.scalars().first()
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")

    chart_stmt = (
        select(BaZiChart)
        .where(BaZiChart.id == req.chart_id)
        .options(selectinload(BaZiChart.ten_gods))
    )
    chart_result = await db.execute(chart_stmt)
    db_chart = chart_result.scalars().first()
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    ten_gods_map = {tg.position: tg.ten_god for tg in db_chart.ten_gods if tg.stem_or_branch == "stem"}
    chart_dict = _build_chart_dict(db_chart, ten_gods_map)

    analysis = await generate_wish_analysis(chart_dict, wish.content)
    wish.analysis = analysis
    wish.analyzed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(wish)
    return wish


# ─── Solar Terms ──────────────────────────────────────────────────────────────

_SOLAR_TERM_NAMES = [
    "小寒", "大寒", "立春", "雨水", "驚蟄", "春分",
    "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
    "小暑", "大暑", "立秋", "處暑", "白露", "秋分",
    "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
]


@router.get("/calendar/annual")
async def get_annual_analysis(year: int, chart_id: str, timezone: str = "Asia/Jakarta", db: AsyncSession = Depends(get_db)):
    try:
        tz = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    stmt = (
        select(BaZiChart)
        .where(BaZiChart.id == chart_id)
        .options(selectinload(BaZiChart.ten_gods), selectinload(BaZiChart.luck_pillars))
    )
    result = await db.execute(stmt)
    db_chart = result.scalars().first()
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Get year pillar
    dt_year = tz.localize(datetime(year, 2, 5, 12, 0))  # ~Li Chun
    cal_year = get_bazi_chart(dt_year)
    year_pillar = {
        "stem": cal_year["pillars"]["year"]["stem"],
        "branch": cal_year["pillars"]["year"]["branch"],
    }

    user_dict = {
        "pillars": {
            "year":  {"branch": db_chart.year_branch},
            "month": {"branch": db_chart.month_branch},
            "day":   {"branch": db_chart.day_branch},
            "hour":  {"branch": db_chart.hour_branch},
        }
    }
    interactions_raw = detect_calendar_interactions(user_dict, cal_year)
    interactions_list = [_interaction_to_dict(i) for i in interactions_raw]

    ten_gods_map = {tg.position: tg.ten_god for tg in db_chart.ten_gods if tg.stem_or_branch == "stem"}
    chart_dict = _build_chart_dict(db_chart, ten_gods_map, db_chart.luck_pillars)

    narasi = await generate_annual_narasi(chart_dict, year_pillar, interactions_list, year)

    return {
        "year": year,
        "year_pillar": year_pillar,
        "interactions": interactions_list,
        "narasi": narasi,
    }


@router.get("/solar-terms/year/{year}")
async def get_solar_terms(year: int):
    if year < 1900 or year > 2100:
        raise HTTPException(status_code=400, detail="Year must be between 1900 and 2100")
    result = []
    for i, name in enumerate(_SOLAR_TERM_NAMES):
        dt = get_solar_term_date(year, i)
        result.append({"index": i, "name": name, "datetime_utc": dt.isoformat()})
    return result
