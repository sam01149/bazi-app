from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import datetime
import pytz

from app.database import get_db
from app.models.schemas import (
    ChartCalculateRequest, ChartResponse, CalendarResponse,
    NarasiGenerateRequest, PillarsSchema, PillarSchema
)
from app.models.domain import BaZiChart, TenGod
from app.engine.calculator import get_bazi_chart, get_solar_term_date
from app.engine.interactions import detect_calendar_interactions
from app.engine.tables import HEAVENLY_STEMS_ELEMENT, HEAVENLY_STEMS_POLARITY
from app.services.cerebras import generate_narasi

router = APIRouter()

@router.post("/charts/calculate", response_model=ChartResponse)
async def calculate_chart(req: ChartCalculateRequest, db: AsyncSession = Depends(get_db)):
    # Build datetime based on user's timezone
    try:
        tz = pytz.timezone(req.birth_timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    # If hour is unknown, default to 12:00 but we might want an "unknown hour" flag.
    # For now, default to 12:00 if none provided.
    hour = req.birth_time.hour if req.birth_time else 12
    minute = req.birth_time.minute if req.birth_time else 0
    
    dt_local = datetime(req.birth_date.year, req.birth_date.month, req.birth_date.day, hour, minute)
    dt_aware = tz.localize(dt_local)

    # Calculate
    chart_data = get_bazi_chart(dt_aware)
    
    # Create DB records
    db_chart = BaZiChart(
        birth_datetime=dt_aware,
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
        db_ten_god = TenGod(
            chart_id=db_chart.id,
            position=pos,
            stem_or_branch="stem",
            ten_god=god,
            element=HEAVENLY_STEMS_ELEMENT.get(actual_stem, "Unknown"),
            polarity=HEAVENLY_STEMS_POLARITY.get(actual_stem, "Unknown"),
        )
        db.add(db_ten_god)
    
    await db.commit()
    await db.refresh(db_chart)

    # Format response
    pillars = PillarsSchema(
        year=PillarSchema(stem=db_chart.year_stem, branch=db_chart.year_branch),
        month=PillarSchema(stem=db_chart.month_stem, branch=db_chart.month_branch),
        day=PillarSchema(stem=db_chart.day_stem, branch=db_chart.day_branch),
        hour=PillarSchema(stem=db_chart.hour_stem, branch=db_chart.hour_branch)
    )

    return ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=pillars,
        ten_gods=chart_data["ten_gods"],
        day_master_strength=db_chart.day_master_strength
    )

@router.get("/charts/{chart_id}", response_model=ChartResponse)
async def get_chart(chart_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == chart_id).options(selectinload(BaZiChart.ten_gods))
    result = await db.execute(stmt)
    db_chart = result.scalars().first()
    
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    pillars = PillarsSchema(
        year=PillarSchema(stem=db_chart.year_stem, branch=db_chart.year_branch),
        month=PillarSchema(stem=db_chart.month_stem, branch=db_chart.month_branch),
        day=PillarSchema(stem=db_chart.day_stem, branch=db_chart.day_branch),
        hour=PillarSchema(stem=db_chart.hour_stem, branch=db_chart.hour_branch)
    )
    
    ten_gods = {tg.position: tg.ten_god for tg in db_chart.ten_gods}

    return ChartResponse(
        id=db_chart.id,
        user_id=db_chart.user_id,
        birth_datetime=db_chart.birth_datetime,
        birth_timezone=db_chart.birth_timezone,
        pillars=pillars,
        ten_gods=ten_gods,
        day_master_strength=db_chart.day_master_strength
    )

@router.get("/calendar/current", response_model=CalendarResponse)
async def get_current_calendar(timezone: str = "UTC", chart_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    try:
        tz = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    now = datetime.now(tz)
    calendar_chart = get_bazi_chart(now)
    
    pillars = PillarsSchema(
        year=PillarSchema(stem=calendar_chart["pillars"]["year"]["stem"], branch=calendar_chart["pillars"]["year"]["branch"]),
        month=PillarSchema(stem=calendar_chart["pillars"]["month"]["stem"], branch=calendar_chart["pillars"]["month"]["branch"]),
        day=PillarSchema(stem=calendar_chart["pillars"]["day"]["stem"], branch=calendar_chart["pillars"]["day"]["branch"]),
        hour=PillarSchema(stem=calendar_chart["pillars"]["hour"]["stem"], branch=calendar_chart["pillars"]["hour"]["branch"])
    )
    
    interactions = []
    
    if chart_id:
        # Fetch user chart to calculate interactions
        stmt = select(BaZiChart).where(BaZiChart.id == chart_id)
        result = await db.execute(stmt)
        user_db_chart = result.scalars().first()
        
        if user_db_chart:
            user_dict = {
                "pillars": {
                    "year": {"branch": user_db_chart.year_branch},
                    "month": {"branch": user_db_chart.month_branch},
                    "day": {"branch": user_db_chart.day_branch},
                    "hour": {"branch": user_db_chart.hour_branch}
                }
            }
            interactions = detect_calendar_interactions(user_dict, calendar_chart)

    return CalendarResponse(
        current_pillars=pillars,
        interactions=interactions
    )

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


@router.post("/narasi/generate")
async def generate_narasi_endpoint(req: NarasiGenerateRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(BaZiChart).where(BaZiChart.id == req.chart_id).options(selectinload(BaZiChart.ten_gods))
    result = await db.execute(stmt)
    db_chart = result.scalars().first()
    
    if not db_chart:
        raise HTTPException(status_code=404, detail="Chart not found")
        
    ten_gods_list = [tg.ten_god for tg in db_chart.ten_gods]
    
    # Construct structured data for AI
    structured_data = {
        "day_master": db_chart.day_stem,
        "strength": db_chart.day_master_strength,
        "dominant_gods": ten_gods_list,
        # we can pass interactions if we calculate them based on current month/year
        "section": req.section
    }
    
    narration = generate_narasi(structured_data, req.section)
    return {"narasi": narration}
