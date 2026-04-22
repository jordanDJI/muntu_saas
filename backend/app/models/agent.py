from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── agent_config ──────────────────────────────────────────────────────────────

class AgentConfigUpdate(BaseModel):
    status: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    synthesis_schedule_minutes: Optional[int] = Field(None, ge=30, le=1440)


class AgentConfigOut(BaseModel):
    id: str
    tenant_id: str
    agent_type: str
    status: str
    model: str
    system_prompt: Optional[str]
    synthesis_schedule_minutes: int
    created_at: datetime
    updated_at: datetime


# ── agent_link ────────────────────────────────────────────────────────────────

class AgentLinkCreate(BaseModel):
    contact_id: str
    channel: str = "whatsapp"
    expiry_days: Optional[int] = Field(None, ge=1, le=365)


class AgentLinkOut(BaseModel):
    id: str
    contact_id: str
    channel: str
    token: str
    expires_at: datetime
    used_at: Optional[datetime]
    created_at: datetime


# ── ocr_summary ───────────────────────────────────────────────────────────────

class OCRSummaryOut(BaseModel):
    id: str
    contact_id: str
    appointment_id: Optional[str]
    document_type: Optional[str]
    processed_at: datetime


# ── agent_synthesis ───────────────────────────────────────────────────────────

class AgentSynthesisOut(BaseModel):
    id: str
    tenant_id: str
    content: str
    period_start: datetime
    period_end: datetime
    delivered_at: Optional[datetime]
    created_at: datetime


# ── chatbot (Agent 1) ─────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
