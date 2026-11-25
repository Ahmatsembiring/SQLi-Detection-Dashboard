from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://shop:shop@localhost:5432/shop"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120
    jwt_issuer: str = "kopiaman-api"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    # Channel on which the detector service publishes new detections (PostgreSQL LISTEN/NOTIFY).
    notify_channel: str = "attack_events"
    # Trust X-Forwarded-For from the frontend reverse proxy (nginx) to get the real client IP.
    trust_proxy_headers: bool = True
    # OWASP A07: sliding-window rate limit for authentication endpoints (per client IP).
    auth_rate_limit_max: int = 30
    auth_rate_limit_window_seconds: int = 60
    # OWASP A05: allow toggling OpenAPI docs via environment variable.
    enable_docs: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
