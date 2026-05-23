import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./bazi_local.db")

# Supabase/PostgreSQL connection strings kadang pakai prefix "postgres://"
# SQLAlchemy butuh "postgresql+asyncpg://"
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _url.startswith("postgresql://") and "+asyncpg" not in _url:
    _url = _url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Supabase Transaction Pooler (pgbouncer) doesn't support prepared statements
_connect_args = {"statement_cache_size": 0} if "pooler.supabase.com" in _url else {}
engine = create_async_engine(_url, echo=False, connect_args=_connect_args)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
