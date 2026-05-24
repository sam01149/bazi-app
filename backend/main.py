from dotenv import load_dotenv
load_dotenv()  # Load environment variables dari .env file

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.router import router as api_router
from app.database import engine, Base
from contextlib import asynccontextmanager


async def _run_migrations(conn):
    """Add new columns to existing tables (idempotent — silently skips if already present)."""
    migrations = [
        "ALTER TABLE bazi_charts ADD COLUMN gender VARCHAR(10)",
        "ALTER TABLE bazi_charts ADD COLUMN ge_ju VARCHAR(30)",
        "ALTER TABLE bazi_charts ADD COLUMN yong_shen VARCHAR(30)",
        "ALTER TABLE ten_gods ADD COLUMN source_branch VARCHAR(5)",
    ]
    for stmt in migrations:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass  # Column already exists — safe to ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)
    yield

app = FastAPI(title="BaZi App API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "BaZi API is running"}
