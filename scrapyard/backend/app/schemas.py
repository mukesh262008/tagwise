import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import normalize_pn

Condition = Literal["good", "fair", "poor"]
Role = Literal["admin", "worker"]
Via = Literal["direct", "interchange"]
USERNAME_RE = re.compile(r"^[a-z0-9_.-]{3,64}$")


def _strip(v):
    return v.strip() if isinstance(v, str) else v


def _clean_pn(v):
    if not isinstance(v, str):
        return v
    v = v.strip().upper()
    if not normalize_pn(v):
        raise ValueError("Part number must contain letters or digits")
    return v


# ---------------------------------------------------------------- auth / users


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool


class UserCreate(BaseModel):
    username: str
    full_name: str = Field(default="", max_length=128)
    password: str = Field(min_length=8, max_length=128)
    role: Role = "worker"

    @field_validator("username", mode="before")
    @classmethod
    def _username(cls, v):
        v = _strip(v)
        v = v.lower() if isinstance(v, str) else v
        if not isinstance(v, str) or not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-64 characters: letters, digits, . _ -")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: Role | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------- vehicles


class VehicleBase(BaseModel):
    make: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=64)
    year_from: int = Field(ge=1900, le=2100)
    year_to: int = Field(ge=1900, le=2100)
    variant: str = Field(default="", max_length=64)

    _strip = field_validator("make", "model", "variant", mode="before")(_strip)

    @model_validator(mode="after")
    def _years(self):
        if self.year_from > self.year_to:
            raise ValueError("year_from must be <= year_to")
        return self


class VehicleOut(VehicleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------------------------------------------------------------- parts


class PartBase(BaseModel):
    part_number: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="", max_length=64)
    condition: Condition = "good"
    quantity: int = Field(default=0, ge=0, le=1_000_000)
    price: float | None = Field(default=None, ge=0)
    notes: str = Field(default="", max_length=2000)
    location_note: str = Field(default="", max_length=160)

    _pn = field_validator("part_number", mode="before")(_clean_pn)
    _strip = field_validator("name", "category", "location_note", mode="before")(_strip)


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    part_number: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, max_length=64)
    condition: Condition | None = None
    quantity: int | None = Field(default=None, ge=0, le=1_000_000)
    price: float | None = Field(default=None, ge=0)  # send null to clear
    notes: str | None = Field(default=None, max_length=2000)
    location_note: str | None = Field(default=None, max_length=160)

    _pn = field_validator("part_number", mode="before")(_clean_pn)
    _strip = field_validator("name", "category", "location_note", mode="before")(_strip)


class PartOut(PartBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class PartList(BaseModel):
    items: list[PartOut]
    total: int


class FitmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle: VehicleOut
    notes: str


class FitmentCreate(BaseModel):
    """Give an existing vehicle_id, or describe the vehicle (it is created if new)."""

    vehicle_id: int | None = None
    make: str | None = None
    model: str | None = None
    year_from: int | None = Field(default=None, ge=1900, le=2100)
    year_to: int | None = Field(default=None, ge=1900, le=2100)
    variant: str = Field(default="", max_length=64)
    notes: str = Field(default="", max_length=255)

    _strip = field_validator("make", "model", "variant", mode="before")(_strip)

    @model_validator(mode="after")
    def _check(self):
        if self.vehicle_id is None:
            if not (self.make and self.model and self.year_from and self.year_to):
                raise ValueError("Provide vehicle_id, or make, model, year_from and year_to")
            if self.year_from > self.year_to:
                raise ValueError("year_from must be <= year_to")
        return self


class InterchangeCreate(BaseModel):
    part_number: str = Field(min_length=1, max_length=64)


class PartDetail(PartOut):
    fitments: list[FitmentOut]
    interchanges: list[PartOut]


class CsvError(BaseModel):
    row: int
    error: str


class CsvImportResult(BaseModel):
    parts_created: int = 0
    parts_updated: int = 0
    fitments_added: int = 0
    errors: list[CsvError] = []


# ---------------------------------------------------------------- compatibility


class CompatMatch(BaseModel):
    part: PartOut
    via: Via  # direct = has its own fitment record; interchange = linked to a part that does


class CompatCheckResult(BaseModel):
    part_found: bool
    part: PartOut | None = None
    compatible: bool | None = None  # None when the part number is unknown
    matched_via: Via | None = None
    in_stock_options: list[CompatMatch] = []


# ---------------------------------------------------------------- dashboard


class CountItem(BaseModel):
    name: str
    count: int
    units: int = 0


class DashboardStats(BaseModel):
    total_parts: int
    total_units: int
    total_value: float
    out_of_stock: int
    low_stock: int
    vehicles_covered: int
    fitments: int
    parts_without_fitment: int
    by_category: list[CountItem]
    by_condition: list[CountItem]
    top_makes: list[CountItem]
    recent_parts: list[PartOut]
