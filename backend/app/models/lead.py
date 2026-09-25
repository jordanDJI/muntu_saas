from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.services.phone import validate_phone_field


class LeadCreateIn(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    service_offer_id: Optional[UUID] = None
    audience_type: str = "b2c"
    request_type: str = "appointment"
    source: str = "site_form"
    contact_type: str = "individual"  # individual | company
    consent_channels: list[str] = []  # canaux RGPD acceptés à la soumission du formulaire (ex: ["email", "telephone"])

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_field(v)


class LeadUpdateIn(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    pipeline_stage_id: Optional[UUID] = None
    internal_note: Optional[str] = None


class LeadOut(BaseModel):
    id: UUID
    tenant_id: UUID
    status: str
    priority: str
    audience_type: str
    request_type: str
    source: str
    notes: Optional[str] = None
    internal_note: Optional[str] = None
    created_at: datetime
    contact: Optional[dict] = None
