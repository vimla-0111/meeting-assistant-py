from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.meeting import MeetingStatus


# ─── Request schemas ───────────────────────────────────────────────────────────

class MeetingCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    participant_emails: Optional[List[str]] = []


class MeetingUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    participant_emails: Optional[List[str]] = None
    summary_draft: Optional[str] = None  # owner can edit draft before approval


# ─── Response schemas ──────────────────────────────────────────────────────────

class MeetingResponse(BaseModel):
    id: int
    owner_id: int
    title: str
    description: Optional[str]
    status: MeetingStatus
    failure_reason: Optional[str]
    recording_path: Optional[str]
    audio_path: Optional[str]
    transcript_raw: Optional[str]
    summary_draft: Optional[str]
    summary_approved: Optional[str]
    duration_seconds: Optional[int]
    participant_emails: Optional[List[str]]
    processed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeetingListResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: MeetingStatus
    duration_seconds: Optional[int]
    participant_emails: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True
