from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import auth, compatibility, dashboard, parts, users, vehicles
from .seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Scrap Yard Inventory API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, users.router, parts.router, vehicles.router, compatibility.router, dashboard.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
