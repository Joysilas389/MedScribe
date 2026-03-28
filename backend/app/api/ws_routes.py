"""
WebSocket Routes — Real-time audio streaming and transcription.

Handles the WebSocket connection for live ambient scribing.
Requires JWT authentication via query parameter.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import jwt as pyjwt
import json
import logging

from app.core.security import security_manager
from app.core.database import async_session_factory
from app.services import audio_handler, transcription_service
from app.models import Encounter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/audio/{encounter_id}")
async def audio_stream(
    websocket: WebSocket,
    encounter_id: str,
    token: str = Query(...)
):
    """
    WebSocket endpoint for real-time audio streaming.

    Authentication: JWT token passed as query parameter.
    Protocol:
    - Client sends binary audio chunks (WebM/Ogg/WAV)
    - Client sends JSON control messages (pause/resume/stop)
    - Server sends JSON transcript segments and status updates
    """
    # Authenticate
    try:
        payload = security_manager.validate_token(token, expected_type="access")
        user_id = payload["sub"]
    except pyjwt.InvalidTokenError:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return

    # Verify encounter exists and belongs to user
    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(Encounter).where(
                Encounter.id == encounter_id,
                Encounter.physician_id == user_id
            )
        )
        encounter = result.scalar_one_or_none()
        if not encounter:
            await websocket.close(code=4004, reason="Encounter not found")
            return

    # Define transcript callback
    async def on_transcript_segment(session_id, audio_data, audio_format, chunk_number):
        """Called when audio buffer is flushed — sends to transcription."""
        try:
            result = await transcription_service.transcribe_audio(
                audio_data=audio_data,
                audio_format=audio_format,
                language_hint=encounter.spoken_language
            )

            if result["text"].strip():
                # Store in database
                async with async_session_factory() as db:
                    segment = await transcription_service.store_transcript_segment(
                        db=db,
                        encounter_id=encounter_id,
                        text=result["text"],
                        speaker_label=result.get("segments", [{}])[0].get("speaker", "unknown") if result.get("segments") else "unknown",
                        language_detected=result.get("language", "en"),
                        confidence=result.get("confidence", 0.0),
                    )
                    await db.commit()

                # Send transcript to client
                await websocket.send_json({
                    "type": "transcript",
                    "text": result["text"],
                    "speaker": "unknown",
                    "language": result.get("language", "en"),
                    "confidence": result.get("confidence", 0.0),
                    "chunk_number": chunk_number,
                })

        except Exception as e:
            logger.error(f"Transcript processing error: {type(e).__name__}")
            await websocket.send_json({
                "type": "error",
                "message": "Transcription processing failed for this segment."
            })

    # Handle the audio stream
    await audio_handler.handle_connection(
        websocket=websocket,
        session_id=encounter_id,
        user_id=user_id,
        on_transcript_segment=on_transcript_segment,
    )

    # Update encounter duration after session ends
    session_info = audio_handler.get_active_session(encounter_id)
    if session_info:
        elapsed = int((datetime.now(timezone.utc) - session_info["start_time"]).total_seconds())
    else:
        elapsed = 0

    try:
        async with async_session_factory() as db:
            from sqlalchemy import select as sel
            res = await db.execute(
                sel(Encounter).where(Encounter.id == encounter_id)
            )
            enc = res.scalar_one_or_none()
            if enc:
                enc.duration_seconds = max(enc.duration_seconds, elapsed)
                await db.commit()
    except Exception:
        pass  # Non-critical — duration is informational
