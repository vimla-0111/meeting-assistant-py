from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.notification import NotificationStatus

class NotificationResponse(BaseModel):
    id: int
    meeting_id: int
    sent_to: str
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    status: NotificationStatus
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True

class SendEmailRequest(BaseModel):
    subject: str
    body: str
    recipient_emails: List[str]
