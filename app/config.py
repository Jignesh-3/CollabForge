from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CollabForge"
    FIREBASE_CREDENTIALS_PATH: str = "firebase_credentials.json"

    class Config:
        env_file = ".env"

settings = Settings()