import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.meeting import Meeting, MeetingStatus
from app.schemas.meeting import (
    MeetingCreateRequest,
    MeetingUpdateRequest,
    MeetingResponse,
    MeetingListResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.get("", response_model=List[MeetingListResponse])
async def list_meetings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all meetings owned by the current user."""
    result = await db.execute(
        select(Meeting)
        .where(Meeting.owner_id == current_user.id)
        .order_by(Meeting.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    payload: MeetingCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new meeting record. Recording upload is handled separately."""
    meeting = Meeting(
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
        participant_emails=payload.participant_emails or [],
        extract_tasks=payload.extract_tasks,
        status=MeetingStatus.uploaded,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full details of a single meeting."""
    meeting = await _get_owned_meeting(meeting_id, current_user.id, db)
    return meeting


@router.put("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: int,
    payload: MeetingUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update meeting metadata or edit the summary draft."""
    meeting = await _get_owned_meeting(meeting_id, current_user.id, db)

    if payload.title is not None:
        meeting.title = payload.title
    if payload.description is not None:
        meeting.description = payload.description
    if payload.participant_emails is not None:
        meeting.participant_emails = payload.participant_emails
    if payload.summary_draft is not None:
        meeting.summary_draft = payload.summary_draft

    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a meeting and all related data."""
    meeting = await _get_owned_meeting(meeting_id, current_user.id, db)
    await db.delete(meeting)
    await db.commit()


@router.post("/{meeting_id}/upload")
async def upload_meeting_recording(
    meeting_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload recording for a meeting (chunked stream to disk)."""
    meeting = await _get_owned_meeting(meeting_id, current_user.id, db)
    
    if meeting.status not in (MeetingStatus.uploaded.value, MeetingStatus.failed.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meeting is in '{meeting.status}' state and cannot accept a new upload."
        )

    user_dir = os.path.join(settings.storage_path, str(current_user.id), str(meeting.id))
    os.makedirs(user_dir, exist_ok=True)

    _, ext = os.path.splitext(file.filename or "")
    filename = f"original{ext}"
    file_path = os.path.join(user_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    meeting.recording_path = file_path
    meeting.status = MeetingStatus.extracting_audio.value
    await db.commit()
    
    from app.tasks import extract_audio_task
    extract_audio_task.delay(meeting.id)

    return {"message": "Upload successful, processing started", "recording_path": file_path}


@router.get("/{meeting_id}/status")
async def get_meeting_status(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lightweight endpoint for polling pipeline progress.
    Frontend polls this every 5 seconds to show status badge.
    """
    meeting = await _get_owned_meeting(meeting_id, current_user.id, db)
    return {
        "id": meeting.id,
        "status": meeting.status,
        "failure_reason": meeting.failure_reason,
    }


# ─── Helper ────────────────────────────────────────────────────────────────────

async def _get_owned_meeting(meeting_id: int, owner_id: int, db: AsyncSession) -> Meeting:
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.owner_id == owner_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or access denied"
        )
    return meeting
