from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_SECRET_KEY = "change-this-secret-key-before-production"
DEVELOPMENT_CORS_ORIGIN_REGEX = (
    r"^https?://("
    r"localhost|"
    r"127\.0\.0\.1|"
    r"10(?:\.\d{1,3}){3}|"
    r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|"
    r"192\.168(?:\.\d{1,3}){2}"
    r")(?::\d+)?$"
)


class Settings(BaseSettings):
    app_name: str = "CampusConnect API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/university_portal"
    )
    environment: str = "development"
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: str = ""

    @model_validator(mode="after")
    def normalize_database_url(self) -> "Settings":
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1,
            )
        return self

    @model_validator(mode="after")
    def reject_default_secret_key_in_production(self) -> "Settings":
        if (
            self.environment.lower() in {"prod", "production"}
            and self.secret_key == DEFAULT_SECRET_KEY
        ):
            raise ValueError(
                "UNIVERSITY_PORTAL_SECRET_KEY must be set in production"
            )
        return self

    def parsed_cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    def is_production(self) -> bool:
        return self.environment.lower() in {"prod", "production"}

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="UNIVERSITY_PORTAL_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
