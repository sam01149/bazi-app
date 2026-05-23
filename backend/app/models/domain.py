import uuid
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

def _now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timezone = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=_now_utc)

    charts = relationship("BaZiChart", back_populates="user", cascade="all, delete-orphan")


class BaZiChart(Base):
    __tablename__ = "bazi_charts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    birth_datetime = Column(DateTime, nullable=False)
    birth_timezone = Column(String(50), nullable=False)

    year_stem = Column(String(5), nullable=False)
    year_branch = Column(String(5), nullable=False)
    month_stem = Column(String(5), nullable=False)
    month_branch = Column(String(5), nullable=False)
    day_stem = Column(String(5), nullable=False)
    day_branch = Column(String(5), nullable=False)
    hour_stem = Column(String(5))
    hour_branch = Column(String(5))

    day_master_strength = Column(String(20))
    created_at = Column(DateTime, default=_now_utc)

    user = relationship("User", back_populates="charts")
    ten_gods = relationship("TenGod", back_populates="chart", cascade="all, delete-orphan")
    wishes = relationship("Wish", back_populates="chart", cascade="all, delete-orphan")
    cached_narasi = relationship("CachedNarasi", back_populates="chart", cascade="all, delete-orphan")


class TenGod(Base):
    __tablename__ = "ten_gods"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chart_id = Column(String(36), ForeignKey("bazi_charts.id"))
    position = Column(String(20))
    stem_or_branch = Column(String(5))
    ten_god = Column(String(10))
    element = Column(String(10))
    polarity = Column(String(5))

    chart = relationship("BaZiChart", back_populates="ten_gods")


class Wish(Base):
    __tablename__ = "wishes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chart_id = Column(String(36), ForeignKey("bazi_charts.id"), nullable=False)
    content = Column(String(2000), nullable=False)
    analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now_utc)

    chart = relationship("BaZiChart", back_populates="wishes")


class CachedNarasi(Base):
    __tablename__ = "cached_narasi"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chart_id = Column(String(36), ForeignKey("bazi_charts.id"), nullable=False)
    section = Column(String(50), nullable=False)
    narasi_text = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=_now_utc)

    chart = relationship("BaZiChart", back_populates="cached_narasi")
