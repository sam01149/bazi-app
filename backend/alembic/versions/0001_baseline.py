"""Baseline — semua tabel dengan skema lengkap saat ini.

Idempotent: menggunakan CREATE TABLE IF NOT EXISTS sehingga aman dijalankan
pada database yang sudah ada (production) maupun database kosong (fresh deploy).

Revision ID: 0001
Revises:
Create Date: 2026-06-06
"""
from alembic import op
from sqlalchemy import text

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            id           VARCHAR(36) PRIMARY KEY,
            timezone     VARCHAR(50) NOT NULL,
            created_at   TIMESTAMP
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS bazi_charts (
            id                  VARCHAR(36) PRIMARY KEY,
            user_id             VARCHAR(36) REFERENCES users(id),
            birth_datetime      TIMESTAMP   NOT NULL,
            birth_timezone      VARCHAR(50) NOT NULL,
            year_stem           VARCHAR(5)  NOT NULL,
            year_branch         VARCHAR(5)  NOT NULL,
            month_stem          VARCHAR(5)  NOT NULL,
            month_branch        VARCHAR(5)  NOT NULL,
            day_stem            VARCHAR(5)  NOT NULL,
            day_branch          VARCHAR(5)  NOT NULL,
            hour_stem           VARCHAR(5),
            hour_branch         VARCHAR(5),
            day_master_strength VARCHAR(20),
            gender              VARCHAR(10),
            ge_ju               VARCHAR(30),
            yong_shen           VARCHAR(30),
            hour_unknown        BOOLEAN DEFAULT FALSE,
            created_at          TIMESTAMP
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS ten_gods (
            id             VARCHAR(36) PRIMARY KEY,
            chart_id       VARCHAR(36) REFERENCES bazi_charts(id),
            position       VARCHAR(20),
            stem_or_branch VARCHAR(5),
            ten_god        VARCHAR(10),
            element        VARCHAR(10),
            polarity       VARCHAR(5),
            source_branch  VARCHAR(5)
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS luck_pillars (
            id          VARCHAR(36) PRIMARY KEY,
            chart_id    VARCHAR(36) NOT NULL REFERENCES bazi_charts(id),
            order_index INTEGER     NOT NULL,
            stem        VARCHAR(5)  NOT NULL,
            branch      VARCHAR(5)  NOT NULL,
            age_start   FLOAT       NOT NULL
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS wishes (
            id          VARCHAR(36) PRIMARY KEY,
            chart_id    VARCHAR(36) NOT NULL REFERENCES bazi_charts(id),
            content     VARCHAR(2000) NOT NULL,
            analysis    TEXT,
            analyzed_at TIMESTAMP,
            created_at  TIMESTAMP
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS cached_narasi (
            id           VARCHAR(36) PRIMARY KEY,
            chart_id     VARCHAR(36) NOT NULL REFERENCES bazi_charts(id),
            section      VARCHAR(50) NOT NULL,
            narasi_text  TEXT        NOT NULL,
            generated_at TIMESTAMP
        )
    """))


def downgrade() -> None:
    for table in ["cached_narasi", "wishes", "luck_pillars", "ten_gods", "bazi_charts", "users"]:
        op.execute(text(f"DROP TABLE IF EXISTS {table}"))
