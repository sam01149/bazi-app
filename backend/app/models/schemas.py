from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, time, datetime
from uuid import UUID

class ChartCalculateRequest(BaseModel):
    birth_date: date
    birth_time: Optional[time] = None
    birth_timezone: str

class NarasiGenerateRequest(BaseModel):
    chart_id: str
    section: str

class PillarSchema(BaseModel):
    stem: str = ''
    branch: str = ''

class PillarsSchema(BaseModel):
    year: PillarSchema
    month: PillarSchema
    day: PillarSchema
    hour: Optional[PillarSchema] = None

class TenGodSchema(BaseModel):
    position: str
    stem_or_branch: str
    ten_god: str
    element: str
    polarity: str

class ChartResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    birth_datetime: datetime
    birth_timezone: str
    pillars: PillarsSchema
    ten_gods: Dict[str, str]
    day_master_strength: Optional[str] = None

    class Config:
        from_attributes = True

class InteractionSchema(BaseModel):
    type: str
    user_branch: str
    calendar_branch: str
    description: str
    element: Optional[str] = None

class CalendarResponse(BaseModel):
    current_pillars: PillarsSchema
    interactions: List[InteractionSchema]
    date_str: Optional[str] = None

# Wish schemas
class WishCreateRequest(BaseModel):
    chart_id: str
    content: str

class WishResponse(BaseModel):
    id: str
    chart_id: str
    content: str
    analysis: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WishAnalyzeRequest(BaseModel):
    chart_id: str

# CachedNarasi schemas
class CachedNarasiResponse(BaseModel):
    section: str
    narasi_text: str
    generated_at: datetime

    class Config:
        from_attributes = True

class ProfileResponse(BaseModel):
    chart: ChartResponse
    cached_sections: Dict[str, str]

class CalendarNarasiRequest(BaseModel):
    chart_id: str
    date_str: str
    timezone: str = "Asia/Jakarta"
