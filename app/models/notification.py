import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationStatus(str, enum.Enum):
    sent = "sent"
    failed = "failed"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    sent_to = Column(String(255), nullable=False)
    status = Column(String(10), nullable=False)
    error_message = Column(String(500), nullable=True)

    sent_at = Column(DateTime, server_default=func.now(), nullable=False)

    meeting = relationship("Meeting", back_populates="notifications")

    def __repr__(self):
        return f"<Notification id={self.id} to={self.sent_to} status={self.status}>"
