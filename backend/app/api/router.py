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
    WishCreateRequest, WishResponse, WishAnalyzeRequest,
    ProfileResponse, CalendarNarasiRequest,
)
from app.models.domain import BaZiChart, TenGod, Wish, CachedNarasi
from app.engine.calculator import get_bazi_chart, get_solar_term_date
from app.engine.interactions import detect_calendar_interactions
from app.engine.tables import HEAVENLY_STEMS_ELEMENT, HEAVENLY_STEMS_POLARITY
from app.services.cerebras import generate_narasi, generate_wish_analysis, generate_calendar_narasi, is_error_narasi

router = APIRouter()


def _build_chart_dict(db_chart: BaZiChart) -> dict:
    return {
        "day_master": db_chart.day_stem,
        "strength": db_chart.day_master_strength,
        "pillars": {
            "year":  {"stem": db_chart.year_stem,  "branch": db_chart.year_branch},
            "month": {"stem": db_chart.month_stem, "branch": db_chart.month_branch},
            "day":   {"stem": db_chart.day_stem,   "branch": db_chart.day_branch},
            "hour":  {"stem": db_chart.hour_stem,  "branch": db_chart.hour_branch},
        },
        "birth_timezone": db_chart.birth_timezone,
    }


def _pillars_schema(db_chart: BaZiChart) -> PillarsSchema:
    return PillarsSchema(
        year=PillarSchema(stem=db_chart.year_stem, branch=db_chart.year_branch),
        month=PillarSchema(stem=db_chart.month_stem, branch=db_chart.month_branch),
        day=PillarSchema(stem=db_chart.day_stem, branch=db_chart.day_branch),
        hour=PillarSchema(stem=db_chart.hour_stem or '', branch=db_chart.hour_branch or ''),
    )


# ─── Charts ───────────────────────────────────────────────────────────────────

@router.post("/charts/calculate", response_model=ChartResponse)
async def calculate_chart(req: ChartCalculateRequest, db: AsyncSession = Depends(get_db)):
    try:
        tz = pytz.timezone(req.birth_timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    hour = req.birth_time.hour if req.birth_time else 12
    minute = req.birth_time.minute if req.birth_time else 0

    dt_local = datetime(req.birth_date.year, req.birth_date.month, req.birth_date.day, hour, minute)
    dt_aware = tz.localize(dt_local)

    chart_data = get_bazi_chart(dt_aware)

    db_chart = BaZiChart(
        birth_datetime=dt_aware.replace(tzinfo=None),
        birth_timezone=req.birth_timezone,
        year_stem=chart_data["pillars"]["year"]["stem"],
        year_branch=chart_data["pillars"]["year"]["branch"],
        month_stem=chart_data["pillars"]["month"]["stem"],
        month_branch=chart_data["pillars"]["month"]["branch"],
        day_stem=chart_data["pillars"]["day"]["stem"],
        day_branch=chart_data["pillars"]["day"]["branch"],
        hour_stem=chart_data["pillars"]["hour"]["stem"],
        hour_branch=chart_data["pillars"]["hour"]["branch"],
        day_master_strength=chart_data["day_master_strength"],
    )
    db.add(db_chart)
    await db.flush()

    position_stem_map = {
        "year_stem":  chart_data["pillars"]["year"]["stem"],
        "month_stem": chart_data["pillars"]["month"]["stem"],
        "hour_stem":  chart_data["pillars"]["hour"]["stem"],
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

    await db.commit()
    await db.refresh(db_chart)

    return ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=_pillars_schema(db_chart),
        ten_gods=chart_data["ten_gods"],
        day_master_strength=db_chart.day_master_strength,
    )


@router.get("/charts/{chart_id}", response_model=ChartResponse)
async def get_chart(chart_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == chart_id).options(selectinload(BaZiChart.ten_gods))
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    ten_gods = {tg.position: tg.ten_god for tg in db_chart.ten_gods}

    return ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=_pillars_schema(db_chart),
        ten_gods=ten_gods,
        day_master_strength=db_chart.day_master_strength,
    )


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
    interactions_list = [
        {"type": i.type, "user_branch": i.user_branch, "calendar_branch": i.calendar_branch, "description": i.description}
        for i in interactions_raw
    ]

    calendar_pillars = {
        "year":  {"stem": cal["pillars"]["year"]["stem"],  "branch": cal["pillars"]["year"]["branch"]},
        "month": {"stem": cal["pillars"]["month"]["stem"], "branch": cal["pillars"]["month"]["branch"]},
        "day":   {"stem": cal["pillars"]["day"]["stem"],   "branch": cal["pillars"]["day"]["branch"]},
    }

    narasi = await generate_calendar_narasi(
        _build_chart_dict(db_chart), calendar_pillars, interactions_list, req.date_str
    )

    if is_error_narasi(narasi):
        msg = narasi.replace("ERROR: ", "", 1)
        raise HTTPException(status_code=503, detail=msg)

    return {"narasi": narasi}


# ─── Narasi (profile sections) ────────────────────────────────────────────────

@router.post("/narasi/generate")
async def generate_narasi_endpoint(req: NarasiGenerateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == req.chart_id).options(selectinload(BaZiChart.ten_gods))
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Return cached version if available (skip if previously cached an error)
    cached_stmt = select(CachedNarasi).where(
        CachedNarasi.chart_id == req.chart_id,
        CachedNarasi.section == req.section,
    )
    cached_result = await db.execute(cached_stmt)
    cached = cached_result.scalars().first()
    if cached and not is_error_narasi(cached.narasi_text):
        return {"narasi": cached.narasi_text, "cached": True}

    ten_gods_map = {tg.position: tg.ten_god for tg in db_chart.ten_gods}
    structured_data = _build_chart_dict(db_chart)
    structured_data["ten_gods"] = ten_gods_map

    narration = await generate_narasi(structured_data, req.section)

    if is_error_narasi(narration):
        # Delete bad cache entry if it exists so next retry can try again
        if cached:
            await db.delete(cached)
            await db.commit()
        # Return user-friendly error (strip internal prefix)
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
        )
    )
    result = await db.execute(stmt)
    db_chart = result.scalars().first()

    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    ten_gods = {tg.position: tg.ten_god for tg in db_chart.ten_gods}
    cached_sections = {cn.section: cn.narasi_text for cn in db_chart.cached_narasi}

    chart_resp = ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=_pillars_schema(db_chart),
        ten_gods=ten_gods,
        day_master_strength=db_chart.day_master_strength,
    )

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

    ten_gods_map = {tg.position: tg.ten_god for tg in db_chart.ten_gods}
    chart_dict = _build_chart_dict(db_chart)
    chart_dict["ten_gods"] = ten_gods_map

    analysis = await generate_wish_analysis(chart_dict, wish.content)
    wish.analysis = analysis
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


@router.get("/solar-terms/year/{year}")
async def get_solar_terms(year: int):
    if year < 1900 or year > 2100:
        raise HTTPException(status_code=400, detail="Year must be between 1900 and 2100")
    result = []
    for i, name in enumerate(_SOLAR_TERM_NAMES):
        dt = get_solar_term_date(year, i)
        result.append({"index": i, "name": name, "datetime_utc": dt.isoformat()})
    return result
