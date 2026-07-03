from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.services.scheduler import start_scheduler, stop_scheduler
from app.api.v1 import sites, leads, appointments, subscriptions, onboarding, auth, chatbot, agents, calendar, booking, webhook, assistant, members, uploads, analytics, public, tenants, users, domains, directory, admin, design_requests, logo_requests, contacts, tags, reminders, campaigns, attachments, profile, secretary, invoices

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
    title="Klientys API",
    version="0.1.0",
    docs_url=None if settings.app_env == "production" else "/docs",
    redoc_url=None if settings.app_env == "production" else "/redoc",
    lifespan=lifespan,
)

_ALWAYS_ALLOWED = ["https://klientys.co", "https://www.klientys.co", "https://muntu-saas.vercel.app"]
_cors_origins = list({
    *_ALWAYS_ALLOWED,
    *[o.strip() for o in [settings.frontend_url, settings.frontend_url_prod] if o],
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    return response

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
app.include_router(public.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(domains.router, prefix="/api/v1")
app.include_router(directory.router, prefix="/api/v1")
app.include_router(admin.router,          prefix="/api/v1")
app.include_router(design_requests.router, prefix="/api/v1")
app.include_router(logo_requests.router,   prefix="/api/v1")
app.include_router(contacts.router,        prefix="/api/v1")
app.include_router(tags.router,            prefix="/api/v1")
app.include_router(reminders.router,       prefix="/api/v1")
app.include_router(campaigns.router,       prefix="/api/v1")
app.include_router(attachments.router,     prefix="/api/v1")
app.include_router(profile.router,         prefix="/api/v1")
app.include_router(secretary.router,       prefix="/api/v1")
app.include_router(invoices.router,        prefix="/api/v1")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "vercel_token_set": bool(settings.vercel_api_token),
        "vercel_project_set": bool(settings.vercel_project_id),
        "vercel_token_prefix": settings.vercel_api_token[:8] if settings.vercel_api_token else None,
    }
