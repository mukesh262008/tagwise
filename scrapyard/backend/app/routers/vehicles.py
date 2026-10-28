from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Vehicle

router = APIRouter(prefix="/vehicles", tags=["vehicles"], dependencies=[Depends(get_current_user)])


@router.get("/makes", response_model=list[str])
def makes(db: Session = Depends(get_db)):
    return list(db.scalars(select(Vehicle.make).distinct().order_by(Vehicle.make)))


@router.get("/models", response_model=list[str])
def models(make: str, db: Session = Depends(get_db)):
    stmt = (
        select(Vehicle.model)
        .where(func.lower(Vehicle.make) == make.strip().lower())
        .distinct()
        .order_by(Vehicle.model)
    )
    return list(db.scalars(stmt))


@router.get("/variants", response_model=list[str])
def variants(make: str, model: str, db: Session = Depends(get_db)):
    stmt = (
        select(Vehicle.variant)
        .where(
            func.lower(Vehicle.make) == make.strip().lower(),
            func.lower(Vehicle.model) == model.strip().lower(),
            Vehicle.variant != "",
        )
        .distinct()
        .order_by(Vehicle.variant)
    )
    return list(db.scalars(stmt))
