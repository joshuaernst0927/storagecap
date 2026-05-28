import os
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    anthropic_api_key: Optional[str] = None
    attom_api_key: Optional[str] = None
    costar_api_key: Optional[str] = None
    costar_api_secret: Optional[str] = None
    crexi_api_key: Optional[str] = None

    email_smtp_host: str = "smtp.gmail.com"
    email_smtp_port: int = 587
    email_username: Optional[str] = None
    email_password: Optional[str] = None
    email_to: str = "joshuaernst@gmail.com"

    nextjs_base_url: str = "http://localhost:3000"
    nextjs_api_secret: Optional[str] = None

    target_states: list = field(default_factory=lambda: ["FL", "TX", "NC", "GA", "TN"])
    hot_deal_threshold: int = 65
    deals_json_path: str = "deals.json"
    request_delay: float = 2.0
    use_playwright: bool = True

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            attom_api_key=os.getenv("ATTOM_API_KEY"),
            costar_api_key=os.getenv("COSTAR_API_KEY"),
            costar_api_secret=os.getenv("COSTAR_API_SECRET"),
            crexi_api_key=os.getenv("CREXI_API_KEY"),
            email_smtp_host=os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com"),
            email_smtp_port=int(os.getenv("EMAIL_SMTP_PORT", "587")),
            email_username=os.getenv("EMAIL_USERNAME"),
            email_password=os.getenv("EMAIL_PASSWORD"),
            email_to=os.getenv("EMAIL_TO", "joshuaernst@gmail.com"),
            nextjs_base_url=os.getenv("NEXTJS_BASE_URL", "http://localhost:3000"),
            nextjs_api_secret=os.getenv("NEXTJS_API_SECRET"),
            target_states=os.getenv("TARGET_STATES", "FL,TX,NC,GA,TN").split(","),
            hot_deal_threshold=int(os.getenv("HOT_DEAL_THRESHOLD", "65")),
            deals_json_path=os.getenv("DEALS_JSON_PATH", "deals.json"),
            request_delay=float(os.getenv("REQUEST_DELAY_SECONDS", "2.0")),
            use_playwright=os.getenv("USE_PLAYWRIGHT", "1") == "1",
        )
