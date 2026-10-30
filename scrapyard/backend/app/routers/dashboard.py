from fastapi import APIRouter, Depends
from sqlalchemy import desc, distinct, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Fitment, Part, Vehicle
from ..schemas import CountItem, DashboardStats, PartOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])

LOW_STOCK_MAX = 2


@router.get("", response_model=DashboardStats)
def stats(db: Session = Depends(get_db)):
    def scalar(stmt):
        return db.scalar(stmt) or 0

    by_category = [
        CountItem(name=name or "Uncategorised", count=count, units=units or 0)
        for name, count, units in db.execute(
            select(Part.category, func.count(Part.id), func.sum(Part.quantity))
            .group_by(Part.category)
            .order_by(desc(func.count(Part.id)))
            .limit(12)
        )
    ]
    by_condition = [
        CountItem(name=name, count=count, units=units or 0)
        for name, count, units in db.execute(
            select(Part.condition, func.count(Part.id), func.sum(Part.quantity)).group_by(Part.condition)
        )
    ]
    top_makes = [
        CountItem(name=name, count=count)
        for name, count in db.execute(
            select(Vehicle.make, func.count(distinct(Fitment.part_id)))
            .join(Fitment, Fitment.vehicle_id == Vehicle.id)
            .group_by(Vehicle.make)
            .order_by(desc(func.count(distinct(Fitment.part_id))))
            .limit(8)
        )
    ]
    recent = db.scalars(select(Part).order_by(desc(Part.created_at), desc(Part.id)).limit(8)).all()

    return DashboardStats(
        total_parts=scalar(select(func.count(Part.id))),
        total_units=scalar(select(func.sum(Part.quantity))),
        total_value=float(scalar(select(func.sum(Part.price * Part.quantity)))),
        out_of_stock=scalar(select(func.count(Part.id)).where(Part.quantity == 0)),
        low_stock=scalar(select(func.count(Part.id)).where(Part.quantity > 0, Part.quantity <= LOW_STOCK_MAX)),
        vehicles_covered=scalar(select(func.count(Vehicle.id))),
        fitments=scalar(select(func.count(Fitment.id))),
        parts_without_fitment=scalar(select(func.count(Part.id)).where(~Part.fitments.any())),
        by_category=by_category,
        by_condition=by_condition,
        top_makes=top_makes,
        recent_parts=[PartOut.model_validate(p) for p in recent],
    )
