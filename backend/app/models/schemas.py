from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, time, datetime
from uuid import UUID

class ChartCalculateRequest(BaseModel):
    birth_date: date
    birth_time: Optional[time] = None
    birth_timezone: str

class NarasiGenerateRequest(BaseModel):
    chart_id: UUID
    section: str

class PillarSchema(BaseModel):
    stem: str
    branch: str

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
    id: UUID
    user_id: Optional[UUID] = None
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
