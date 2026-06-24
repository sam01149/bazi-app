from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, time, datetime
from uuid import UUID

class ChartCalculateRequest(BaseModel):
    birth_date: date
    birth_time: Optional[time] = None
    birth_timezone: str
    gender: Optional[str] = None  # 'male' or 'female'
    hour_unknown: bool = False

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

class LuckPillarSchema(BaseModel):
    stem: str
    branch: str
    age_start: float
    order_index: int
    life_stage: Optional[str] = None

class ChartResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    birth_datetime: datetime
    birth_timezone: str
    pillars: PillarsSchema
    ten_gods: Dict[str, str]
    day_master_strength: Optional[str] = None
    gender: Optional[str] = None
    ge_ju: Optional[str] = None
    yong_shen: Optional[str] = None
    void_branches: Optional[List[str]] = None
    stem_combinations: Optional[List[Dict[str, Any]]] = None
    hidden_ten_gods: Optional[Dict[str, Any]] = None
    luck_pillars: Optional[List[LuckPillarSchema]] = None
    active_luck_pillar: Optional[LuckPillarSchema] = None
    hour_unknown: bool = False
    special_stars: Optional[Dict[str, Any]] = None
    pillar_life_stages: Optional[Dict[str, str]] = None
    three_combinations: Optional[List[Dict[str, Any]]] = None
    natal_interactions: Optional[List[Dict[str, Any]]] = None
    active_luck_pillar_interactions: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class InteractionSchema(BaseModel):
    type: str
    user_branch: str
    calendar_branch: str
    description: str
    element: Optional[str] = None
    favorability: Optional[str] = None  # 'challenging' | 'favorable' | 'neutral' | None (Yong Shen unresolved)
    penalty_name: Optional[str] = None  # 'Ungrateful Penalty' | 'Bullying Penalty' | 'Uncivilized Penalty' — only set when type == 'penalty'

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
    analyzed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WishAnalyzeRequest(BaseModel):
    chart_id: str

class WishUpdateRequest(BaseModel):
    content: str

class WishTimingRequest(BaseModel):
    chart_id: str

class ChartCompareRequest(BaseModel):
    chart_id_a: str
    chart_id_b: str

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
