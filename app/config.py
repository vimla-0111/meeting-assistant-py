from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    app_name: str = "Meeting Assistant"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Database
    database_url: str

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection_name: str = "meeting_transcripts"

    # OpenRouter (LLM)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_summary_model: str = "meta-llama/llama-3.1-8b-instruct"
    openrouter_task_model: str = "meta-llama/llama-3.1-8b-instruct"
    openrouter_chat_model: str = "meta-llama/llama-3.1-8b-instruct"

    # Groq (Whisper transcription)
    groq_api_key: str = ""
    whisper_model: str = "whisper-large-v3"
    
    # OpenAI (For embeddings)
    openai_api_key: str = ""

    # File Storage
    storage_path: str = "./storage/recordings"

    # Email
    mail_host: str = "sandbox.smtp.mailtrap.io"
    mail_host_user: str = ""
    mail_host_password: str = ""
    mail_port: int = 2525
    mail_from_email: str = "noreply@meetingassistant.com"
    mail_from_name: str = "Meeting Assistant"

    # CORS (stored as JSON string in .env)
    cors_origins: str = '["http://localhost:5173","http://localhost:3000"]'

    def get_cors_origins(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
