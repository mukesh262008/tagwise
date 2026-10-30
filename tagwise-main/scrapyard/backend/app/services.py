from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .models import Fitment, PartInterchange, Vehicle


def get_or_create_vehicle(
    db: Session, make: str, model: str, year_from: int, year_to: int, variant: str = ""
) -> Vehicle:
    make, model, variant = make.strip(), model.strip(), variant.strip()

    # Reuse the casing already in the database so "Maruti" / "MARUTI" don't split into two makes
    make = db.scalar(select(Vehicle.make).where(func.lower(Vehicle.make) == make.lower()).limit(1)) or make
    model = (
        db.scalar(
            select(Vehicle.model)
            .where(func.lower(Vehicle.make) == make.lower(), func.lower(Vehicle.model) == model.lower())
            .limit(1)
        )
        or model
    )

    vehicle = db.scalar(
        select(Vehicle).where(
            func.lower(Vehicle.make) == make.lower(),
            func.lower(Vehicle.model) == model.lower(),
            Vehicle.year_from == year_from,
            Vehicle.year_to == year_to,
            func.lower(Vehicle.variant) == variant.lower(),
        )
    )
    if vehicle is None:
        vehicle = Vehicle(make=make, model=model, year_from=year_from, year_to=year_to, variant=variant)
        db.add(vehicle)
        db.flush()
    return vehicle


def vehicle_conditions(make: str | None, model: str | None, year: int | None, variant: str | None) -> list:
    """SQL conditions matching vehicle rows against what the user typed.
    A vehicle row with an empty variant applies to every variant."""
    conds = []
    if make:
        conds.append(func.lower(Vehicle.make) == make.strip().lower())
    if model:
        conds.append(func.lower(Vehicle.model) == model.strip().lower())
    if year is not None:
        conds += [Vehicle.year_from <= year, Vehicle.year_to >= year]
    if variant and variant.strip():
        conds.append(or_(Vehicle.variant == "", func.lower(Vehicle.variant) == variant.strip().lower()))
    return conds


def interchange_ids(db: Session, part_id: int) -> set[int]:
    rows = db.scalars(
        select(PartInterchange).where(
            or_(PartInterchange.part_a_id == part_id, PartInterchange.part_b_id == part_id)
        )
    )
    ids: set[int] = set()
    for r in rows:
        ids.update((r.part_a_id, r.part_b_id))
    ids.discard(part_id)
    return ids


def parts_with_own_fitment(db: Session, part_ids: set[int] | None, conds: list) -> set[int]:
    """Ids of parts (optionally limited to part_ids) that have a fitment on a matching vehicle."""
    stmt = select(Fitment.part_id).join(Vehicle, Vehicle.id == Fitment.vehicle_id).where(*conds)
    if part_ids is not None:
        if not part_ids:
            return set()
        stmt = stmt.where(Fitment.part_id.in_(part_ids))
    return set(db.scalars(stmt))
