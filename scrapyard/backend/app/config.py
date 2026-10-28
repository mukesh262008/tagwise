from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "change-me-in-production"
DEFAULT_ADMIN_PASSWORD = "admin12345"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./scrapyard.db"
    secret_key: str = DEFAULT_SECRET
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:5173"

    # First-run admin account (only created if no admin exists yet)
    admin_username: str = "admin"
    admin_password: str = DEFAULT_ADMIN_PASSWORD

    # Loads a few clearly-labelled DEMO- records into an empty database
    seed_demo_data: bool = False


settings = Settings()
