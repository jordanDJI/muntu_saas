from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class AvailabilitySlotIn(BaseModel):
    day_of_week: int          # 0=Lun … 6=Dim
    start_time: str           # "HH:MM"
    end_time: str             # "HH:MM"
    slot_duration_min: int = 30
    is_active: bool = True


class AvailabilitySlotOut(BaseModel):
    id: UUID
    calendar_id: UUID
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_min: int
    is_active: bool


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
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    message: Optional[str] = None
    service_offer_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None   # None si request_type == "contact"
    slot_duration_min: int = 30
    request_type: str = "appointment"          # "contact" ou "appointment"
    contact_type: str = "individual"           # individual | company
