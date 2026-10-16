"""Application configuration managed through Pydantic Settings."""

import json
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings populated from environment variables."""

    # Project metadata
    PROJECT_NAME: str = "FinNexus"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    NODE_ENV: str | None = None

    # Routing
    API_V1_PREFIX: str = "/api/v1"

    # Individual Database Configuration Variables
    DB_HOST: str | None = None
    DB_PORT: int | str = 5432
    DB_NAME: str | None = None
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None
    DB_SCHEMA: str | None = None

    # Database URLs (can be provided directly or auto-derived from DB_* above)
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/financeflow_dev"
    )
    SYNC_DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/financeflow_dev"
    )

    # Individual Redis Configuration Variables
    REDIS_HOST: str | None = None
    REDIS_PORT: int | str = 6379
    REDIS_PASSWORD: str | None = None
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security & Tokens
    SECRET_KEY: str = "insecure_dev_key_must_be_overridden_in_production"
    JWT_ACCESS_SECRET: str | None = None
    JWT_REFRESH_SECRET: str | None = None
    JWT_ACCESS_EXPIRES_IN: str | None = None
    JWT_REFRESH_EXPIRES_IN: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Initial Super Admin Authority
    SUPER_ADMIN_EMAIL: str = "admin@finnexus.com"
    SUPER_ADMIN_PASSWORD: str = "Admin@12345"
    SUPER_ADMIN_FIRST_NAME: str = "Aditya"
    SUPER_ADMIN_LAST_NAME: str = "Thakre"

    # CORS Configuration
    CORS_ORIGIN: str | None = None
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
        "https://dashboard.finnexus.com",
        "https://crm.finnexus.com",
        "https://toolkit.finnexus.com",
        "https://insurance.finnexus.com",
        "https://api.finnexus.com",
        "https://dashboard.financeflow.com",
        "https://crm.financeflow.com",
        "https://toolkit.financeflow.com",
        "https://insurance.financeflow.com",
        "https://api.financeflow.com",
    ]

    # Rate Limiting
    RATE_LIMIT_WINDOW_MS: int | None = None
    RATE_LIMIT_MAX_REQUESTS: int | None = None

    # Super Admin Initial Seeder
    SUPER_ADMIN_EMAIL: str | None = None
    SUPER_ADMIN_PASSWORD: str | None = None
    SUPER_ADMIN_FIRST_NAME: str | None = None
    SUPER_ADMIN_LAST_NAME: str | None = None

    # Health Check Probe Timeouts
    DB_HEALTH_TIMEOUT: float = 3.0
    REDIS_HEALTH_TIMEOUT: float = 3.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def model_post_init(self, __context: object) -> None:
        """Derive composite database, redis, and security settings after parsing env."""
        super().model_post_init(__context)

        # Map NODE_ENV to ENVIRONMENT if provided
        if self.NODE_ENV and self.ENVIRONMENT == "development":
            self.ENVIRONMENT = self.NODE_ENV

        # Assemble PostgreSQL URLs if DB_HOST, DB_USER, and DB_NAME are specified
        if self.DB_HOST and self.DB_USER and self.DB_NAME:
            pwd_part = (
                f":{quote_plus(str(self.DB_PASSWORD))}" if self.DB_PASSWORD else ""
            )
            auth = f"{self.DB_USER}{pwd_part}"
            host_port = f"{self.DB_HOST}:{self.DB_PORT}"
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{auth}@{host_port}/{self.DB_NAME}"
            )
            self.SYNC_DATABASE_URL = (
                f"postgresql+psycopg://{auth}@{host_port}/{self.DB_NAME}"
            )

        # Assemble Redis URL if REDIS_HOST is specified
        if self.REDIS_HOST:
            if self.REDIS_PASSWORD:
                encoded_pwd = quote_plus(str(self.REDIS_PASSWORD))
                self.REDIS_URL = (
                    f"redis://:{encoded_pwd}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
                )
            else:
                self.REDIS_URL = f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

        # Map JWT_ACCESS_SECRET to SECRET_KEY if provided
        if self.JWT_ACCESS_SECRET and (
            self.SECRET_KEY == "insecure_dev_key_must_be_overridden_in_production"
            or not self.SECRET_KEY
        ):
            self.SECRET_KEY = self.JWT_ACCESS_SECRET

        # Parse JWT expiration if passed as '15m' or '7d'
        if self.JWT_ACCESS_EXPIRES_IN and self.JWT_ACCESS_EXPIRES_IN.endswith("m"):
            try:
                self.ACCESS_TOKEN_EXPIRE_MINUTES = int(self.JWT_ACCESS_EXPIRES_IN[:-1])
            except ValueError:
                pass
        if self.JWT_REFRESH_EXPIRES_IN and self.JWT_REFRESH_EXPIRES_IN.endswith("d"):
            try:
                self.REFRESH_TOKEN_EXPIRE_DAYS = int(self.JWT_REFRESH_EXPIRES_IN[:-1])
            except ValueError:
                pass

        # Map single CORS_ORIGIN into CORS_ORIGINS list
        if self.CORS_ORIGIN:
            if isinstance(self.CORS_ORIGINS, list):
                if self.CORS_ORIGIN not in self.CORS_ORIGINS:
                    self.CORS_ORIGINS.append(self.CORS_ORIGIN)
            else:
                self.CORS_ORIGINS = [self.CORS_ORIGIN]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Parse CORS origins if provided as a comma-separated string or JSON string."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []


# Global settings singleton
settings = Settings()
