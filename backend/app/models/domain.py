import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timezone = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="charts")
    ten_gods = relationship("TenGod", back_populates="chart", cascade="all, delete-orphan")


class TenGod(Base):
    __tablename__ = "ten_gods"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chart_id = Column(String(36), ForeignKey("bazi_charts.id"))
    position = Column(String(20))  # year_stem, month_branch, etc.
    stem_or_branch = Column(String(5))
    ten_god = Column(String(10))
    element = Column(String(10))
    polarity = Column(String(5))

    chart = relationship("BaZiChart", back_populates="ten_gods")
