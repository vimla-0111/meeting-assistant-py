import asyncio
import os
import tempfile
import json
import subprocess
import uuid
from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.meeting import Meeting, MeetingStatus
from app.config import settings
from sqlalchemy import select

from openai import AsyncOpenAI
from pydub import AudioSegment
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter

groq_client = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1"
)
summary_chat_model = ChatOpenAI(
    model=settings.openrouter_summary_model,
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url
)
task_chat_model = ChatOpenAI(
    model=settings.openrouter_task_model,
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
    model_kwargs={"response_format": {"type": "json_object"}}
)

@celery_app.task(bind=True, name="app.tasks.extract_audio_task")
def extract_audio_task(self, meeting_id: int):
    """
    Extracts audio from the uploaded video recording using ffmpeg.
    """
    asyncio.run(_extract_audio(meeting_id))

async def _extract_audio(meeting_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting or not meeting.recording_path:
            return

        try:
            base, ext = os.path.splitext(meeting.recording_path)
            
            # If it's already an audio file, skip ffmpeg and use it directly
            if ext.lower() in [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"]:
                meeting.audio_path = meeting.recording_path
                meeting.status = MeetingStatus.transcribing.value
                await db.commit()
                transcribe_task.delay(meeting_id)
                return
                
            audio_path = f"{base}_audio.mp3"
            
            # ffmpeg command to extract audio without re-encoding if possible, or convert to mp3
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-i", meeting.recording_path, "-q:a", "0", "-map", "a", audio_path, "-y",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"ffmpeg failed: {stderr.decode()}")
                
            meeting.audio_path = audio_path
            meeting.status = MeetingStatus.transcribing.value
            await db.commit()
            
            # Next phase: trigger transcription
            transcribe_task.delay(meeting_id)
            
        except Exception as e:
            meeting.status = MeetingStatus.failed.value
            meeting.failure_reason = str(e)
            await db.commit()


@celery_app.task(bind=True, name="app.tasks.transcribe_task")
def transcribe_task(self, meeting_id: int):
    asyncio.run(_transcribe(meeting_id))

async def _transcribe(meeting_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting or meeting.status != MeetingStatus.transcribing.value:
            return

        try:
            audio = AudioSegment.from_file(meeting.audio_path)
            
            # Split audio into 15-minute chunks to stay under Whisper's 25MB limit
            chunk_length_ms = 15 * 60 * 1000
            chunks = [audio[i:i + chunk_length_ms] for i in range(0, len(audio), chunk_length_ms)]
            
            full_transcript = []
            
            for chunk in chunks:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                    chunk.export(temp_file.name, format="mp3")
                    
                with open(temp_file.name, "rb") as audio_file:
                    response = await groq_client.audio.transcriptions.create(
                        model=settings.whisper_model,
                        file=audio_file,
                        response_format="text"
                    )
                full_transcript.append(response)
                os.unlink(temp_file.name)
            
            meeting.transcript_raw = " ".join(full_transcript)
            meeting.duration_seconds = int(len(audio) / 1000)
            meeting.status = MeetingStatus.summarizing.value
            await db.commit()
            
            generate_summary_task.delay(meeting_id)
            
        except Exception as e:
            meeting.status = MeetingStatus.failed.value
            meeting.failure_reason = str(e)
            await db.commit()


@celery_app.task(bind=True, name="app.tasks.generate_summary_task")
def generate_summary_task(self, meeting_id: int):
    asyncio.run(_generate_summary(meeting_id))

async def _generate_summary(meeting_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting or meeting.status != MeetingStatus.summarizing.value:
            return

        try:
            # 1. Summary Generation
            summary_messages = [
                SystemMessage(content="You are a meeting assistant. Summarize the following meeting transcript. Provide Key Decisions, Discussion Points, and Outcomes in Markdown format."),
                HumanMessage(content=meeting.transcript_raw or "")
            ]
            summary_response = await summary_chat_model.ainvoke(summary_messages)
            meeting.summary_draft = summary_response.content
            
            # 2. Task Extraction (if requested)
            if meeting.extract_tasks:
                task_messages = [
                    SystemMessage(content='Extract action items from the transcript. Output strictly in JSON format: {"tasks": [{"title": "Task title", "description": "Task description", "assignee_email": "email or null"}]}'),
                    HumanMessage(content=meeting.transcript_raw or "")
                ]
                tasks_response = await task_chat_model.ainvoke(task_messages)
                
                try:
                    tasks_data = json.loads(tasks_response.content)
                    meeting.tasks_json = tasks_data.get("tasks", [])
                except Exception:
                    meeting.tasks_json = []
            else:
                meeting.tasks_json = []
            meeting.status = MeetingStatus.pending_approval.value
            await db.commit()
            
            index_transcript_task.delay(meeting_id)
            
        except Exception as e:
            meeting.status = MeetingStatus.failed.value
            meeting.failure_reason = str(e)
            await db.commit()


@celery_app.task(bind=True, name="app.tasks.index_transcript_task")
def index_transcript_task(self, meeting_id: int):
    asyncio.run(_index_transcript(meeting_id))

async def _index_transcript(meeting_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting or not meeting.transcript_raw:
            return

        try:
            embeddings = OpenAIEmbeddings(
                api_key=settings.openrouter_api_key, 
                base_url=settings.openrouter_base_url,
                model="openai/text-embedding-3-small"
            )
            
            # Split the transcript with standard RAG overlap
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
            )
            
            docs = [
                Document(
                    page_content=chunk,
                    metadata={"meeting_id": meeting.id}
                )
                for chunk in text_splitter.split_text(meeting.transcript_raw)
            ]
            
            if docs:
                QdrantVectorStore.from_documents(
                    documents=docs,
                    embedding=embeddings,
                    url=settings.qdrant_url,
                    collection_name="meeting_transcripts",
                    force_recreate=False
                )
            
            # The pipeline is complete! The status remains pending_approval
            # for the user to review the summary and tasks.
            
        except Exception as e:
            meeting.status = MeetingStatus.failed.value
            meeting.failure_reason = str(e)
            await db.commit()
