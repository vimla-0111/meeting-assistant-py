import asyncio
import os
import tempfile
import json
import subprocess
import uuid
from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.meeting import Meeting, MeetingStatus
from app.models.notification import Notification, NotificationStatus
from app.config import settings
from sqlalchemy import select
import httpx
import base64
from app.logger import logger
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import markdown

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
            logger.warning(f"[Meeting {meeting_id}] Audio extraction skipped — meeting not found or no recording path.")
            return

        logger.info(f"[Meeting {meeting_id}] ── STAGE 1: Audio Extraction started. Recording: '{meeting.recording_path}'")
        try:
            base, ext = os.path.splitext(meeting.recording_path)

            # If it's already an audio file, skip ffmpeg and use it directly
            if ext.lower() in [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"]:
                logger.info(f"[Meeting {meeting_id}] Recording is already an audio file ({ext}). Skipping ffmpeg conversion.")
                meeting.audio_path = meeting.recording_path
                meeting.status = MeetingStatus.transcribing.value
                await db.commit()
                logger.info(f"[Meeting {meeting_id}] ── STAGE 1 complete. Triggering transcription.")
                transcribe_task.delay(meeting_id)
                return

            audio_path = f"{base}_audio.mp3"
            logger.info(f"[Meeting {meeting_id}] Running ffmpeg to extract audio → '{audio_path}'")

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

            logger.info(f"[Meeting {meeting_id}] ── STAGE 1 complete. Audio saved to '{audio_path}'. Triggering transcription.")
            # Next phase: trigger transcription
            transcribe_task.delay(meeting_id)

        except Exception as e:
            logger.error(f"[Meeting {meeting_id}] STAGE 1 FAILED — Audio extraction error: {e}")
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
            logger.warning(f"[Meeting {meeting_id}] Transcription skipped — meeting not found or unexpected status '{getattr(meeting, 'status', 'N/A')}'.")
            return

        logger.info(f"[Meeting {meeting_id}] ── STAGE 2: Transcription started. Audio: '{meeting.audio_path}'")
        try:
            audio = AudioSegment.from_file(meeting.audio_path)
            duration_min = round(len(audio) / 60000, 1)
            logger.info(f"[Meeting {meeting_id}] Audio loaded. Duration: {duration_min} min. Splitting into 15-min chunks for Whisper.")

            # Split audio into 15-minute chunks to stay under Whisper's 25MB limit
            chunk_length_ms = 15 * 60 * 1000
            chunks = [audio[i:i + chunk_length_ms] for i in range(0, len(audio), chunk_length_ms)]
            logger.info(f"[Meeting {meeting_id}] Total chunks to transcribe: {len(chunks)}")

            full_transcript = []

            for idx, chunk in enumerate(chunks, start=1):
                logger.info(f"[Meeting {meeting_id}] Sending chunk {idx}/{len(chunks)} to Whisper ({settings.whisper_model})...")
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
                logger.info(f"[Meeting {meeting_id}] Chunk {idx}/{len(chunks)} transcribed successfully.")

            meeting.transcript_raw = " ".join(full_transcript)
            meeting.duration_seconds = int(len(audio) / 1000)
            meeting.status = MeetingStatus.summarizing.value
            await db.commit()

            logger.info(f"[Meeting {meeting_id}] ── STAGE 2 complete. Transcript length: {len(meeting.transcript_raw)} chars. Triggering summary generation.")
            generate_summary_task.delay(meeting_id)

        except Exception as e:
            logger.error(f"[Meeting {meeting_id}] STAGE 2 FAILED — Transcription error: {e}")
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
            logger.warning(f"[Meeting {meeting_id}] Summary generation skipped — meeting not found or unexpected status '{getattr(meeting, 'status', 'N/A')}'.")
            return

        logger.info(f"[Meeting {meeting_id}] ── STAGE 3: Summary generation started using model '{settings.openrouter_summary_model}'.")
        try:
            # 1. Summary Generation
            summary_messages = [
                SystemMessage(content="You are a meeting assistant. Summarize the following meeting transcript. Provide Key Decisions, Discussion Points, and Outcomes in Markdown format."),
                HumanMessage(content=meeting.transcript_raw or "")
            ]
            summary_response = await summary_chat_model.ainvoke(summary_messages)
            meeting.summary_draft = summary_response.content
            logger.info(f"[Meeting {meeting_id}] Summary generated. Length: {len(meeting.summary_draft)} chars.")

            # 2. Task Extraction (if requested)
            if meeting.extract_tasks:
                logger.info(f"[Meeting {meeting_id}] Task extraction enabled. Extracting action items using model '{settings.openrouter_task_model}'...")
                task_messages = [
                    SystemMessage(content='Extract action items from the transcript. Output strictly in JSON format: {"tasks": [{"title": "Task title", "description": "Task description", "assignee_email": "email or null"}]}'),
                    HumanMessage(content=meeting.transcript_raw or "")
                ]
                tasks_response = await task_chat_model.ainvoke(task_messages)

                try:
                    tasks_data = json.loads(tasks_response.content)
                    meeting.tasks_json = tasks_data.get("tasks", [])
                    logger.info(f"[Meeting {meeting_id}] Extracted {len(meeting.tasks_json)} action item(s).")
                except Exception:
                    logger.warning(f"[Meeting {meeting_id}] Failed to parse task extraction JSON — defaulting to empty task list.")
                    meeting.tasks_json = []
            else:
                logger.info(f"[Meeting {meeting_id}] Task extraction not requested. Skipping.")
                meeting.tasks_json = []

            meeting.status = MeetingStatus.pending_approval.value
            await db.commit()

            logger.info(f"[Meeting {meeting_id}] ── STAGE 3 complete. Status set to 'pending_approval'. Triggering vector indexing.")
            index_transcript_task.delay(meeting_id)

        except Exception as e:
            logger.error(f"[Meeting {meeting_id}] STAGE 3 FAILED — Summary/task extraction error: {e}")
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
            logger.warning(f"[Meeting {meeting_id}] Vector indexing skipped — meeting not found or transcript is empty.")
            return

        logger.info(f"[Meeting {meeting_id}] ── STAGE 4: Vector indexing started. Embedding model: 'text-embedding-3-small'.")
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
                logger.info(f"[Meeting {meeting_id}] Upserting {len(docs)} document chunk(s) into Qdrant collection 'meeting_transcripts'.")
                QdrantVectorStore.from_documents(
                    documents=docs,
                    embedding=embeddings,
                    url=settings.qdrant_url,
                    collection_name="meeting_transcripts",
                    force_recreate=False
                )
                logger.info(f"[Meeting {meeting_id}] ── STAGE 4 complete. {len(docs)} chunk(s) indexed. Pipeline finished — meeting is ready for review.")
            else:
                logger.warning(f"[Meeting {meeting_id}] No document chunks produced from transcript. Skipping Qdrant upsert.")

        except Exception as e:
            logger.error(f"[Meeting {meeting_id}] STAGE 4 FAILED — Vector indexing error: {e}")
            meeting.status = MeetingStatus.failed.value
            meeting.failure_reason = str(e)
            await db.commit()

@celery_app.task(bind=True, name="app.tasks.send_summary_notification_task")
def send_summary_notification_task(self, meeting_id: int, email_subject: str, email_body: str):
    asyncio.run(_send_summary_notification(meeting_id, email_subject, email_body))

async def _send_summary_notification(meeting_id: int, email_subject: str, email_body: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting:
            logger.warning(f"[Meeting {meeting_id}] Notification skipped — meeting not found.")
            return

        emails = meeting.participant_emails or []
        if not emails:
            logger.warning(f"[Meeting {meeting_id}] Notification skipped — no participant emails on record.")
            return

        logger.info(f"[Meeting {meeting_id}] ── Sending summary notification to {len(emails)} participant(s). Subject: '{email_subject}'")

        host = settings.mail_host
        user = settings.mail_host_user
        password = settings.mail_host_password
        port = settings.mail_port
        sender = settings.mail_from_email
        sender_name = settings.mail_from_name

        use_smtp = bool(host and user and password)
        if not use_smtp:
            logger.warning(f"[Meeting {meeting_id}] SMTP credentials not configured — running in mock email mode.")

        for email_addr in emails:
            status_val = NotificationStatus.failed.value
            error_msg = None

            if use_smtp:
                try:
                    # Convert the markdown summary to an HTML body
                    html_body = markdown.markdown(email_body)

                    msg = MIMEMultipart('alternative')
                    msg['From'] = f"{sender_name} <{sender}>"
                    msg['To'] = email_addr
                    msg['Subject'] = email_subject

                    # Attach both plain text and HTML versions
                    msg.attach(MIMEText(email_body, 'plain'))
                    msg.attach(MIMEText(html_body, 'html'))

                    # Run smtplib in a separate thread so it doesn't block the async event loop
                    def send_email_sync():
                        with smtplib.SMTP(host, port) as server:
                            server.login(user, password)
                            server.send_message(msg)

                    await asyncio.to_thread(send_email_sync)
                    status_val = NotificationStatus.sent.value
                    logger.info(f"[Meeting {meeting_id}] Email delivered to '{email_addr}' via SMTP (host={host}:{port}).")
                except Exception as e:
                    error_msg = f"SMTP error: {str(e)}"
                    logger.error(f"[Meeting {meeting_id}] Failed to deliver email to '{email_addr}': {error_msg}")
            else:
                # Mock sending if no SMTP config
                logger.info(f"[Meeting {meeting_id}] [MOCK] Email would be sent to '{email_addr}' — subject: '{email_subject}'")
                status_val = NotificationStatus.sent.value

            notification = Notification(
                meeting_id=meeting_id,
                sent_to=email_addr,
                email_subject=email_subject,
                email_body=email_body,
                status=status_val,
                error_message=error_msg
            )
            db.add(notification)

        await db.commit()
        logger.info(f"[Meeting {meeting_id}] Notification records saved to database. Done.")
