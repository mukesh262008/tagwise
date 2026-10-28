"""First-run setup: admin account, and optional clearly-labelled demo records."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import DEFAULT_ADMIN_PASSWORD, DEFAULT_SECRET, settings
from .models import Fitment, Part, PartInterchange, User, normalize_pn
from .security import hash_password
from .services import get_or_create_vehicle

log = logging.getLogger("scrapyard")

DEMO_NOTE = "DEMO RECORD - not real fitment data"

# part_number, name, category, condition, qty, price, [(make, model, from, to, variant)]
DEMO_PARTS = [
    ("DEMO-ALT-100", "Alternator", "Electrical", "good", 2, 4500, [("Maruti Suzuki", "Swift", 2011, 2017, ""), ("Maruti Suzuki", "Ritz", 2009, 2016, "")]),
    ("DEMO-ALT-101", "Alternator (aftermarket equivalent)", "Electrical", "fair", 1, 3200, []),
    ("DEMO-RAD-200", "Radiator", "Cooling", "good", 1, 3800, [("Hyundai", "i20", 2015, 2020, "1.2")]),
    ("DEMO-HDL-300", "Headlight assembly LH", "Body", "fair", 3, 2200, [("Honda", "City", 2014, 2019, "")]),
    ("DEMO-HDL-301", "Headlight assembly RH", "Body", "good", 0, 2400, [("Honda", "City", 2014, 2019, "")]),
    ("DEMO-STR-400", "Starter motor", "Electrical", "good", 2, 3100, [("Toyota", "Innova", 2005, 2015, "")]),
    ("DEMO-GBX-500", "Gearbox 5-speed manual", "Transmission", "poor", 1, 15000, [("Maruti Suzuki", "Swift", 2011, 2017, "1.3 Diesel")]),
    ("DEMO-DOR-600", "Front door LH", "Body", "good", 1, 5200, [("Hyundai", "i20", 2012, 2014, ""), ("Hyundai", "i20", 2015, 2020, "")]),
]
DEMO_INTERCHANGES = [("DEMO-ALT-100", "DEMO-ALT-101")]


def seed(db: Session) -> None:
    if settings.secret_key == DEFAULT_SECRET:
        log.warning("SECRET_KEY is the default value - set a long random one before going live.")

    if db.scalar(select(User.id).where(User.role == "admin").limit(1)) is None:
        db.add(
            User(
                username=settings.admin_username.strip().lower(),
                full_name="Administrator",
                hashed_password=hash_password(settings.admin_password),
                role="admin",
            )
        )
        db.commit()
        if settings.admin_password == DEFAULT_ADMIN_PASSWORD:
            log.warning("Admin account created with the default password - change it immediately.")

    if settings.seed_demo_data and db.scalar(select(Part.id).limit(1)) is None:
        _seed_demo(db)


def _seed_demo(db: Session) -> None:
    if db.scalar(select(User.id).where(User.username == "worker1")) is None:
        db.add(
            User(username="worker1", full_name="Demo Worker", hashed_password=hash_password("worker12345"), role="worker")
        )

    by_number: dict[str, Part] = {}
    for number, name, category, condition, qty, price, fits in DEMO_PARTS:
        part = Part(
            part_number=number, pn_norm=normalize_pn(number), name=name, category=category,
            condition=condition, quantity=qty, price=price, notes=DEMO_NOTE,
        )
        db.add(part)
        db.flush()
        by_number[number] = part
        for make, model, y_from, y_to, variant in fits:
            vehicle = get_or_create_vehicle(db, make, model, y_from, y_to, variant)
            db.add(Fitment(part_id=part.id, vehicle_id=vehicle.id))

    for a, b in DEMO_INTERCHANGES:
        lo, hi = sorted((by_number[a].id, by_number[b].id))
        db.add(PartInterchange(part_a_id=lo, part_b_id=hi))
    db.commit()
