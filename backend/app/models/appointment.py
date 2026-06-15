from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class AppointmentCreateIn(BaseModel):
    contact_id: UUID
    service_offer_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    type: str = "b2c_appointment"
    audience_type: str = "b2c"
    scheduled_at: datetime
    end_at: datetime
    cal_booking_id: Optional[str] = None


class AppointmentUpdateIn(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    service_offer_id: Optional[UUID] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: UUID
    status: str
    type: str
    audience_type: str
    scheduled_at: datetime
    end_at: datetime
    contact_id: Optional[UUID] = None
    service_offer_id: Optional[UUID] = None
    notes: Optional[str] = None
    party_size: int = 1
    contact: Optional[dict] = None
    service_offer: Optional[dict] = None
