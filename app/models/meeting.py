import enum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    ForeignKey, JSON, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class MeetingStatus(str, enum.Enum):
    uploaded = "uploaded"
    extracting_audio = "extracting_audio"
    transcribing = "transcribing"
    summarizing = "summarizing"
    pending_approval = "pending_approval"
    approved = "approved"
    failed = "failed"


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Pipeline status stored as plain string (enum values)
    status = Column(String(30), default=MeetingStatus.uploaded.value, nullable=False)
    failure_reason = Column(Text, nullable=True)

    recording_path = Column(String(500), nullable=True)
    audio_path = Column(String(500), nullable=True)
    transcript_raw = Column(Text(length=4294967295), nullable=True)  # LONGTEXT for MySQL

    summary_draft = Column(Text, nullable=True)
    summary_approved = Column(Text, nullable=True)

    # Temp storage for AI-extracted tasks before owner approves
    tasks_json = Column(JSON, nullable=True)

    duration_seconds = Column(Integer, nullable=True)
    participant_emails = Column(JSON, nullable=True)

    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="meetings")
    tasks = relationship("Task", back_populates="meeting", lazy="select", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="meeting", lazy="select", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Meeting id={self.id} title='{self.title}' status={self.status}>"
