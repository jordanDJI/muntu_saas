from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.services.scheduler import start_scheduler, stop_scheduler
from app.api.v1 import sites, leads, appointments, subscriptions, onboarding, auth, chatbot, agents, calendar, booking, webhook, assistant, members, uploads, analytics

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    sentry_sdk.init(dsn=settings.sentry_dsn, integrations=[FastApiIntegration()])


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="SaaS Présence Digitale",
    version="0.1.0",
    docs_url=None if settings.app_env == "production" else "/docs",
    redoc_url=None if settings.app_env == "production" else "/redoc",
    lifespan=lifespan,
)

_cors_origins = [o for o in [settings.frontend_url, settings.frontend_url_prod] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(sites.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(subscriptions.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(chatbot.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(booking.router, prefix="/api/v1")
app.include_router(webhook.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
