from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class ServiceOfferIn(BaseModel):
    name: str
    description: Optional[str] = None
    target_audience: str = "all"
    price_from: Optional[float] = None
    bookable: bool = True
    duration_minutes: Optional[int] = None


class ServiceAreaIn(BaseModel):
    city: Optional[str] = None
    postal_code: Optional[str] = None
    region: Optional[str] = None
    country: str = "BE"


class SiteCreateIn(BaseModel):
    template_id: Optional[UUID] = None
    title: str
    audience_mode: str = "hybrid"
    default_language: str = "fr"
    service_offers: list[ServiceOfferIn] = []
    service_areas: list[ServiceAreaIn] = []


class SiteUpdateIn(BaseModel):
    title: Optional[str] = None
    audience_mode: Optional[str] = None
    default_language: Optional[str] = None
    absence_mode: Optional[bool] = None
    absence_message: Optional[str] = None


class SiteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    title: str
    status: str
    audience_mode: str
    default_language: str
    domain: Optional[str] = None
    absence_mode: bool
    absence_message: Optional[str] = None
