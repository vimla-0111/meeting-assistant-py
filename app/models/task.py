import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class TaskStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    done = "done"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee_email = Column(String(255), nullable=True)
    status = Column(String(20), default=TaskStatus.open.value, nullable=False)

    # Phase 6: external task platform sync
    external_id = Column(String(255), nullable=True)
    external_platform = Column(String(50), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    meeting = relationship("Meeting", back_populates="tasks")

    def __repr__(self):
        return f"<Task id={self.id} title='{self.title}' status={self.status}>"
