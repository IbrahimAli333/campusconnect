import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api.v1 import api_router
from app.core.config import DEVELOPMENT_CORS_ORIGIN_REGEX, get_settings


logger = logging.getLogger(__name__)


def init_error_reporting() -> bool:
    """Wire up Sentry when a DSN is configured.

    Returns whether reporting was enabled. With no DSN the whole feature is
    inert, so local development, tests, and CI never emit events.
    """
    settings = get_settings()
    if not settings.sentry_dsn:
        return False

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        # Request bodies can carry passwords and profile content, so no PII
        # is attached to events.
        send_default_pii=False,
    )
    logger.info("Sentry error reporting enabled for %s", settings.environment)
    return True


def create_app() -> FastAPI:
    settings = get_settings()
    # Initialise before the app so startup errors are captured too.
    init_error_reporting()
    app = FastAPI(title=settings.app_name)
    cors_origins = settings.parsed_cors_origins()
    cors_origin_regex = None
    if not settings.is_production():
        cors_origin_regex = DEVELOPMENT_CORS_ORIGIN_REGEX

    if cors_origins or cors_origin_regex:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_origin_regex=cors_origin_regex,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
