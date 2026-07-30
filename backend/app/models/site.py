from pydantic import BaseModel
from typing import Optional, Any
from uuid import UUID


class ServiceOfferIn(BaseModel):
    name: str
    description: Optional[str] = None
    duration_min: Optional[int] = None
    price_eur: Optional[float] = None
    image_url: Optional[str] = None
    photos: Optional[list[str]] = None
    service_type: Optional[str] = "service"  # service | product | menu_item
    category: Optional[str] = None


class ServiceAreaIn(BaseModel):
    city: Optional[str] = None
    postal_code: Optional[str] = None
    region: Optional[str] = None
    country: str = "BE"


class TestimonialIn(BaseModel):
    author_name: str
    author_role: Optional[str] = None
    content: str
    rating: int = 5


class SiteCreateIn(BaseModel):
    template_id: Optional[UUID] = None
    title: str
    audience_mode: str = "hybrid"
    default_language: str = "fr"
    service_offers: list[ServiceOfferIn] = []
    service_areas: list[ServiceAreaIn] = []


class SiteUpdateIn(BaseModel):
    title: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email_contact: Optional[str] = None
    address: Optional[str] = None
    audience_mode: Optional[str] = None
    default_language: Optional[str] = None
    absence_mode: Optional[bool] = None
    absence_message: Optional[str] = None
    coverage_zones: Optional[list[str]] = None
    values_list: Optional[list[Any]] = None
    social_links: Optional[dict] = None
    site_style: Optional[dict] = None


class SiteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    title: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email_contact: Optional[str] = None
    address: Optional[str] = None
    status: str
    audience_mode: str
    default_language: str
    absence_mode: bool
    absence_message: Optional[str] = None
    coverage_zones: Optional[list] = None
    values_list: Optional[list] = None
    social_links: Optional[dict] = None
    site_style: Optional[dict] = None
