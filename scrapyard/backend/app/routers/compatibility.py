from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Part, PartInterchange, normalize_pn
from ..schemas import CompatCheckResult, CompatMatch, PartOut
from ..services import interchange_ids, parts_with_own_fitment, vehicle_conditions

router = APIRouter(prefix="/compat", tags=["compatibility"], dependencies=[Depends(get_current_user)])


@router.get("/check", response_model=CompatCheckResult)
def check(
    part_number: str = Query(..., min_length=1),
    make: str = Query(..., min_length=1),
    model: str = Query(..., min_length=1),
    year: int = Query(..., ge=1900, le=2100),
    variant: str = "",
    db: Session = Depends(get_db),
):
    """Does this part fit this vehicle? Also lists in-stock parts that would fit instead."""
    norm = normalize_pn(part_number)
    part = db.scalar(select(Part).where(Part.pn_norm == norm)) if norm else None
    if part is None:
        return CompatCheckResult(part_found=False)

    group_ids = {part.id} | interchange_ids(db, part.id)
    fitting = parts_with_own_fitment(db, group_ids, vehicle_conditions(make, model, year, variant))

    if not fitting:
        return CompatCheckResult(part_found=True, part=PartOut.model_validate(part), compatible=False)

    # Interchangeable parts share fitment: if any member of the group fits, they all do.
    members = db.scalars(select(Part).where(Part.id.in_(group_ids), Part.quantity > 0).order_by(Part.part_number))
    options = [
        CompatMatch(part=PartOut.model_validate(p), via="direct" if p.id in fitting else "interchange")
        for p in members
    ]
    return CompatCheckResult(
        part_found=True,
        part=PartOut.model_validate(part),
        compatible=True,
        matched_via="direct" if part.id in fitting else "interchange",
        in_stock_options=options,
    )


@router.get("/search", response_model=list[CompatMatch])
def search(
    make: str = Query(..., min_length=1),
    model: str = Query(..., min_length=1),
    year: int | None = Query(None, ge=1900, le=2100),
    variant: str = "",
    category: str = "",
    in_stock_only: bool = True,
    db: Session = Depends(get_db),
):
    """Which parts fit this vehicle?"""
    direct_ids = parts_with_own_fitment(db, None, vehicle_conditions(make, model, year, variant))
    if not direct_ids:
        return []

    linked: set[int] = set()
    rows = db.scalars(
        select(PartInterchange).where(
            PartInterchange.part_a_id.in_(direct_ids) | PartInterchange.part_b_id.in_(direct_ids)
        )
    )
    for r in rows:
        linked.update((r.part_a_id, r.part_b_id))
    all_ids = direct_ids | linked

    stmt = select(Part).where(Part.id.in_(all_ids))
    if category:
        stmt = stmt.where(func.lower(Part.category) == category.lower())
    if in_stock_only:
        stmt = stmt.where(Part.quantity > 0)

    matches = [
        CompatMatch(part=PartOut.model_validate(p), via="direct" if p.id in direct_ids else "interchange")
        for p in db.scalars(stmt.order_by(Part.category, Part.name)).all()
    ]
    matches.sort(key=lambda m: m.via != "direct")  # stable: direct matches first
    return matches[:300]
