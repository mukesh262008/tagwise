import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Fitment, Part, PartInterchange, User, Vehicle, normalize_pn
from ..schemas import (
    CsvError,
    CsvImportResult,
    FitmentCreate,
    FitmentOut,
    InterchangeCreate,
    PartCreate,
    PartDetail,
    PartList,
    PartOut,
    PartUpdate,
)
from ..services import get_or_create_vehicle, interchange_ids

router = APIRouter(prefix="/parts", tags=["parts"], dependencies=[Depends(get_current_user)])

MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_CSV_ROWS = 20_000


def _get_part(db: Session, part_id: int) -> Part:
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Part not found")
    return part


def _detail(db: Session, part: Part) -> PartDetail:
    ids = interchange_ids(db, part.id)
    linked = (
        db.scalars(select(Part).where(Part.id.in_(ids)).order_by(Part.part_number)).all() if ids else []
    )
    fitments = sorted(
        part.fitments, key=lambda f: (f.vehicle.make.lower(), f.vehicle.model.lower(), f.vehicle.year_from)
    )
    return PartDetail(
        **PartOut.model_validate(part).model_dump(),
        fitments=[FitmentOut.model_validate(f) for f in fitments],
        interchanges=[PartOut.model_validate(p) for p in linked],
    )


# ------------------------------------------------------------------ list / CRUD


@router.get("/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    return list(db.scalars(select(Part.category).where(Part.category != "").distinct().order_by(Part.category)))


@router.get("", response_model=PartList)
def list_parts(
    q: str = "",
    category: str = "",
    condition: str = "",
    in_stock: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(Part)
    if q.strip():
        like = f"%{q.strip()}%"
        conds = [Part.name.ilike(like), Part.part_number.ilike(like), Part.category.ilike(like)]
        norm = normalize_pn(q)
        if norm:
            conds.append(Part.pn_norm.like(f"%{norm}%"))
        stmt = stmt.where(or_(*conds))
    if category:
        stmt = stmt.where(func.lower(Part.category) == category.lower())
    if condition:
        stmt = stmt.where(Part.condition == condition)
    if in_stock:
        stmt = stmt.where(Part.quantity > 0)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(Part.part_number).offset(skip).limit(limit)).all()
    return PartList(items=[PartOut.model_validate(p) for p in items], total=total)


@router.post("", response_model=PartDetail, status_code=status.HTTP_201_CREATED)
def create_part(body: PartCreate, db: Session = Depends(get_db)):
    norm = normalize_pn(body.part_number)
    if db.scalar(select(Part.id).where(Part.pn_norm == norm)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A part with this part number already exists")
    part = Part(**body.model_dump(), pn_norm=norm)
    db.add(part)
    db.commit()
    return _detail(db, part)


@router.get("/{part_id}", response_model=PartDetail)
def get_part(part_id: int, db: Session = Depends(get_db)):
    return _detail(db, _get_part(db, part_id))


@router.patch("/{part_id}", response_model=PartDetail)
def update_part(part_id: int, body: PartUpdate, db: Session = Depends(get_db)):
    part = _get_part(db, part_id)
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "price"}

    if "part_number" in data:
        norm = normalize_pn(data["part_number"])
        clash = db.scalar(select(Part.id).where(Part.pn_norm == norm, Part.id != part.id))
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "A part with this part number already exists")
        part.pn_norm = norm
    for key, value in data.items():
        setattr(part, key, value)
    db.commit()
    return _detail(db, part)


@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(part_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    part = _get_part(db, part_id)
    db.execute(
        delete(PartInterchange).where(
            or_(PartInterchange.part_a_id == part_id, PartInterchange.part_b_id == part_id)
        )
    )
    db.delete(part)
    db.commit()


# ------------------------------------------------------------------ fitments


@router.post("/{part_id}/fitments", response_model=PartDetail, status_code=status.HTTP_201_CREATED)
def add_fitment(part_id: int, body: FitmentCreate, db: Session = Depends(get_db)):
    part = _get_part(db, part_id)
    if body.vehicle_id is not None:
        vehicle = db.get(Vehicle, body.vehicle_id)
        if vehicle is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
    else:
        vehicle = get_or_create_vehicle(
            db, body.make, body.model, body.year_from, body.year_to, body.variant
        )
    exists = db.scalar(select(Fitment.id).where(Fitment.part_id == part.id, Fitment.vehicle_id == vehicle.id))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "This part is already linked to that vehicle")
    db.add(Fitment(part_id=part.id, vehicle_id=vehicle.id, notes=body.notes))
    db.commit()
    db.refresh(part)
    return _detail(db, part)


@router.delete("/{part_id}/fitments/{fitment_id}", response_model=PartDetail)
def remove_fitment(part_id: int, fitment_id: int, db: Session = Depends(get_db)):
    part = _get_part(db, part_id)
    fitment = db.scalar(select(Fitment).where(Fitment.id == fitment_id, Fitment.part_id == part.id))
    if fitment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fitment not found")
    db.delete(fitment)
    db.commit()
    db.refresh(part)
    return _detail(db, part)


# ------------------------------------------------------------------ interchanges


@router.post("/{part_id}/interchanges", response_model=PartDetail, status_code=status.HTTP_201_CREATED)
def add_interchange(part_id: int, body: InterchangeCreate, db: Session = Depends(get_db)):
    part = _get_part(db, part_id)
    other = db.scalar(select(Part).where(Part.pn_norm == normalize_pn(body.part_number)))
    if other is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That part number is not in the catalog yet - add it first (quantity can be 0)"
        )
    if other.id == part.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A part cannot be interchangeable with itself")
    a, b = sorted((part.id, other.id))
    if not db.scalar(
        select(PartInterchange.id).where(PartInterchange.part_a_id == a, PartInterchange.part_b_id == b)
    ):
        db.add(PartInterchange(part_a_id=a, part_b_id=b))
        db.commit()
    return _detail(db, part)


@router.delete("/{part_id}/interchanges/{other_id}", response_model=PartDetail)
def remove_interchange(part_id: int, other_id: int, db: Session = Depends(get_db)):
    part = _get_part(db, part_id)
    a, b = sorted((part_id, other_id))
    db.execute(delete(PartInterchange).where(PartInterchange.part_a_id == a, PartInterchange.part_b_id == b))
    db.commit()
    return _detail(db, part)


# ------------------------------------------------------------------ CSV import (admin)


def _opt_int(value, field: str, minimum: int = 0):
    text = (value or "").strip()
    if not text:
        return None
    try:
        number = int(text)
    except ValueError:
        raise ValueError(f"{field} must be a whole number")
    if number < minimum:
        raise ValueError(f"{field} must be >= {minimum}")
    return number


def _opt_price(value):
    text = (value or "").strip().replace(",", "")
    if not text:
        return None
    try:
        price = float(text)
    except ValueError:
        raise ValueError("price must be a number")
    if price < 0:
        raise ValueError("price must be >= 0")
    return price


def _import_row(db: Session, row: dict, result: CsvImportResult, touched: set[int]) -> None:
    # 1) parse and validate everything before touching the database
    part_number = (row.get("part_number") or "").strip().upper()
    norm = normalize_pn(part_number)
    if not norm:
        raise ValueError("part_number is empty")
    name = (row.get("name") or "").strip()
    condition = (row.get("condition") or "").strip().lower() or None
    if condition and condition not in ("good", "fair", "poor"):
        raise ValueError("condition must be good, fair or poor")
    quantity = _opt_int(row.get("quantity"), "quantity")
    price = _opt_price(row.get("price"))
    category = (row.get("category") or "").strip()
    notes = (row.get("notes") or "").strip()

    make = (row.get("make") or "").strip()
    model = (row.get("model") or "").strip()
    year_from = _opt_int(row.get("year_from"), "year_from", 1900)
    year_to = _opt_int(row.get("year_to"), "year_to", 1900)
    variant = (row.get("variant") or "").strip()
    if any((make, model, year_from, year_to)):
        if not (make and model and year_from and year_to):
            raise ValueError("make, model, year_from and year_to are all required for a fitment")
        if year_from > year_to:
            raise ValueError("year_from must be <= year_to")

    # 2) write
    part = db.scalar(select(Part).where(Part.pn_norm == norm))
    if part is None:
        if not name:
            raise ValueError("name is required for a new part")
        part = Part(
            part_number=part_number,
            pn_norm=norm,
            name=name,
            category=category,
            condition=condition or "good",
            quantity=quantity or 0,
            price=price,
            notes=notes,
        )
        db.add(part)
        db.flush()
        result.parts_created += 1
        touched.add(part.id)
    else:
        changed = False
        for attr, value in (
            ("name", name),
            ("category", category),
            ("condition", condition),
            ("quantity", quantity),
            ("price", price),
            ("notes", notes),
        ):
            if value not in (None, "") and getattr(part, attr) != value:
                setattr(part, attr, value)
                changed = True
        if changed and part.id not in touched:
            result.parts_updated += 1
        touched.add(part.id)

    if make:
        vehicle = get_or_create_vehicle(db, make, model, year_from, year_to, variant)
        if not db.scalar(select(Fitment.id).where(Fitment.part_id == part.id, Fitment.vehicle_id == vehicle.id)):
            db.add(Fitment(part_id=part.id, vehicle_id=vehicle.id))
            db.flush()
            result.fitments_added += 1


@router.post("/import", response_model=CsvImportResult)
async def import_csv(
    file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    """One row per fitment. Columns: part_number, name (required for new parts), category, condition,
    quantity, price, notes, make, model, year_from, year_to, variant. Existing parts are updated with
    the non-empty values (quantity is replaced, not added)."""
    raw = await file.read()
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 5 MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be a UTF-8 encoded CSV")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The CSV is empty")
    reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]
    if "part_number" not in reader.fieldnames:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing required column: part_number")

    result = CsvImportResult()
    touched: set[int] = set()
    for line, row in enumerate(reader, start=2):
        if line - 1 > MAX_CSV_ROWS:
            result.errors.append(CsvError(row=line, error=f"Stopped: more than {MAX_CSV_ROWS} rows"))
            break
        try:
            _import_row(db, row, result, touched)
        except ValueError as exc:
            result.errors.append(CsvError(row=line, error=str(exc)))
    db.commit()
    return result
