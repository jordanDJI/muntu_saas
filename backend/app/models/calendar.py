import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime


class AvailabilitySlotIn(BaseModel):
    day_of_week: int          # 0=Lun … 6=Dim
    start_time: str           # "HH:MM"
    end_time: str             # "HH:MM"
    slot_duration_min: int = 30
    is_active: bool = True
    capacity: int = Field(default=1, ge=1, le=500)        # nb de réservations simultanées
    max_party_size: int = Field(default=1, ge=1, le=500)  # max personnes par résa (1=solo, >1=groupe)


class AvailabilitySlotOut(BaseModel):
    id: UUID
    calendar_id: UUID
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_min: int
    is_active: bool
    capacity: int = 1
    max_party_size: int = 1


class BlockedPeriodIn(BaseModel):
    start_at: datetime
    end_at: datetime
    reason: Optional[str] = None
    color: Optional[str] = None


class BlockedPeriodOut(BaseModel):
    id: UUID
    calendar_id: UUID
    start_at: datetime
    end_at: datetime
    reason: Optional[str]
    color: Optional[str]
    created_by: str


class CalendarApptIn(BaseModel):
    """Création de RDV depuis le dashboard (contact existant ou nouveau)."""
    contact_id: Optional[UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    service_offer_id: Optional[UUID] = None
    scheduled_at: datetime
    end_at: datetime


class PublicBookIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=200)
    phone: Optional[str] = Field(default=None, max_length=50)
    message: Optional[str] = Field(default=None, max_length=2000)
    service_offer_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    slot_duration_min: int = Field(default=30, ge=5, le=480)  # 5 min → 8h max
    request_type: Literal["contact", "appointment"] = "appointment"
    contact_type: Literal["individual", "company"] = "individual"
    party_size: int = Field(default=1, ge=1, le=500)  # nb de personnes (restaurant: table de 4)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Adresse email invalide")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()
