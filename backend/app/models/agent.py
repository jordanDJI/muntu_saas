from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── agent_config ──────────────────────────────────────────────────────────────

class AgentConfigUpdate(BaseModel):
    status: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    synthesis_schedule_minutes: Optional[int] = Field(None, ge=30, le=1440)
    whatsapp_number: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_notify_chat_id: Optional[int] = None
    # Agent 2 enrichi
    persona_name: Optional[str] = None
    persona_tone: Optional[str] = None
    knowledge_base: Optional[str] = None
    faq_pairs: Optional[list] = None
    quote_enabled: Optional[bool] = None
    quote_variables: Optional[list] = None
    escalation_triggers: Optional[list[str]] = None
    urgent_keywords: Optional[list[str]] = None
    memory_enabled: Optional[bool] = None
    photo_diagnosis_enabled:    Optional[bool] = None
    followup_enabled:           Optional[bool] = None
    followup_delay_hours:       Optional[int] = None
    followup_message:           Optional[str] = None
    diagnostic_mode_enabled:    Optional[bool] = None


class AgentConfigOut(BaseModel):
    id: str
    tenant_id: str
    agent_type: str
    status: str
    model: str
    system_prompt: Optional[str] = None
    synthesis_schedule_minutes: int = 180
    whatsapp_number: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_notify_chat_id: Optional[int] = None
    # Agent 2 enrichi
    persona_name: Optional[str] = None
    persona_tone: Optional[str] = "friendly"
    knowledge_base: Optional[str] = None
    faq_pairs: Optional[list] = None
    quote_enabled: bool = False
    quote_variables: Optional[list] = None
    escalation_triggers: Optional[list[str]] = None
    urgent_keywords: Optional[list[str]] = None
    memory_enabled: bool = True
    photo_diagnosis_enabled:    bool = False
    followup_enabled:           bool = False
    followup_delay_hours:       int = 24
    followup_message:           Optional[str] = None
    diagnostic_mode_enabled:    bool = False
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


# ── Assistant tenant (Agent 3) ────────────────────────────────────────────────

class AssistantChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class AssistantChatResponse(BaseModel):
    reply: str
    conversation_id: str
