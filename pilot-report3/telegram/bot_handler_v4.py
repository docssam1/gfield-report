from __future__ import annotations

import json
import sys
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


AUTO_RECOG_DIR = Path(__file__).resolve().parent.parent / "auto_recognition"
if str(AUTO_RECOG_DIR) not in sys.path:
    sys.path.insert(0, str(AUTO_RECOG_DIR))

from drive_uploader import upload_photo
from photo_grouping import TelegramPhoto, group_photos, group_photos_no_session
from session_detector import detect_session


STATE_FILE = Path(__file__).resolve().parent / "state" / "v4_session_state.json"
QUEUE_DIR = Path(__file__).resolve().parent / "preview_queue"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _set_session(chat_id: str, message_id: str, text: str, timestamp: str) -> dict:
    session = detect_session(text)
    state = _load_state()
    state[chat_id] = {
        "session": session.to_dict(),
        "session_message_id": message_id,
        "session_timestamp": timestamp,
        "needs_review": session.needs_review,
    }
    _save_state(state)
    return session.to_dict()


def _get_session(chat_id: str) -> Optional[dict]:
    return _load_state().get(chat_id)


def _build_queue_item(chat_id: str, message_id: str, group, upload_result, session_state: Optional[dict]) -> dict:
    source_ids = [message_id]
    if session_state and session_state.get("session_message_id"):
        source_ids.insert(0, session_state["session_message_id"])

    needs_review = bool(group.needs_review or not upload_result.success)
    review_reason = group.review_reason
    if not upload_result.success and upload_result.error:
        review_reason = upload_result.error if not review_reason else f"{review_reason}; {upload_result.error}"

    return {
        "queue_id": f"{group.student_name or 'unknown'}_{group.session_date or 'unknown'}_{group.entry_type}_{uuid.uuid4().hex[:8]}",
        "date": group.session_date,
        "student_name": group.student_name,
        "entry_type": group.entry_type,
        "drive_folder_path": upload_result.drive_path,
        "drive_file_id": upload_result.drive_file_id,
        "photo_count": group.photo_count(),
        "status": "review_needed" if needs_review else "waiting",
        "needs_review": needs_review,
        "review_reason": review_reason,
        "created_at": _now_iso(),
        "source": {
            "telegram_chat_id": chat_id,
            "telegram_message_ids": source_ids,
        },
        "upload_preview": {
            "success": upload_result.success,
            "dry_run": upload_result.dry_run,
            "error": upload_result.error,
        },
        "_preview_only": True,
    }


def _save_queue_item(queue_item: dict) -> Path:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    path = QUEUE_DIR / f"{queue_item['queue_id']}.json"
    path.write_text(json.dumps(queue_item, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def handle_text(chat_id: str, message_id: str, text: str, timestamp: str) -> dict:
    session = _set_session(chat_id, message_id, text, timestamp)
    action = "session_saved_needs_review" if session.get("needs_review") else "session_saved"
    lines = [
        f"[PREVIEW] session captured: {session.get('student_name') or 'unknown'}",
        f"date={session.get('date') or 'unknown'}",
        f"entry_type={session.get('entry_type')}",
    ]
    if session.get("needs_review"):
        lines.append("needs_review=true")
    return {
        "action": action,
        "reply": "\n".join(lines),
        "output": session,
    }


def handle_photo(
    chat_id: str,
    message_id: str,
    file_id: str,
    file_name: str,
    timestamp: str,
    photo_bytes: bytes | None = None,
    dry_run: bool = True,
) -> dict:
    session_state = _get_session(chat_id)
    photo = TelegramPhoto(
        telegram_message_id=message_id,
        timestamp=timestamp,
        file_id=file_id,
        file_name=file_name,
    )

    if session_state:
        session = session_state["session"]
        group = group_photos(
            photos=[photo],
            session_message_id=session_state["session_message_id"],
            session_detected_at=session_state["session_timestamp"],
            session_date=session["date"],
            student_name=session["student_name"],
            entry_type=session["entry_type"],
        )
        if session_state.get("needs_review"):
            group.needs_review = True
            group.review_reason = "session_needs_review"
    else:
        group = group_photos_no_session([photo])

    payload = photo_bytes if photo_bytes is not None else b"preview-photo"
    upload_result = upload_photo(
        photo_bytes=payload,
        file_name=file_name,
        date=group.session_date,
        student_name=group.student_name,
        entry_type=group.entry_type,
        dry_run=dry_run,
    )

    queue_item = _build_queue_item(chat_id, message_id, group, upload_result, session_state)
    queue_path = _save_queue_item(queue_item)

    lines = [
        f"[PREVIEW] photo queued: {queue_item['queue_id']}",
        f"drive_path={queue_item['drive_folder_path']}",
        f"status={queue_item['status']}",
        "parent_message_sent=false",
        "calendar_updated=false",
    ]
    if queue_item["needs_review"]:
        lines.append("needs_review=true")

    return {
        "action": "photo_queue_preview",
        "reply": "\n".join(lines),
        "output": {
            "queue_item": queue_item,
            "queue_path": str(queue_path),
        },
    }


def get_telegram_handlers():
    try:
        from telegram import Update
        from telegram.ext import ContextTypes, MessageHandler, filters

        async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
            msg = update.message
            result = handle_text(
                chat_id=str(update.effective_chat.id),
                message_id=str(msg.message_id),
                text=msg.text or "",
                timestamp=msg.date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            print(result["reply"])

        async def on_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
            msg = update.message
            photo = msg.photo[-1]
            tg_file = await photo.get_file()
            downloaded = await tg_file.download_as_bytearray()
            result = handle_photo(
                chat_id=str(update.effective_chat.id),
                message_id=str(msg.message_id),
                file_id=photo.file_id,
                file_name=f"photo_{msg.message_id}.jpg",
                timestamp=msg.date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                photo_bytes=bytes(downloaded),
                dry_run=True,
            )
            print(result["reply"])

        return [
            MessageHandler(filters.TEXT & ~filters.COMMAND, on_text),
            MessageHandler(filters.PHOTO, on_photo),
        ]
    except ImportError:
        return []


if __name__ == "__main__":
    chat_id = "owner_test_v4"
    ts1 = "2026-06-12T10:00:00Z"
    ts2 = "2026-06-12T10:03:00Z"

    print("=== TEXT ===")
    text_result = handle_text(chat_id, "m100", "6/2 김주한 수업 내용", ts1)
    print(text_result["reply"])
    print(json.dumps(text_result["output"], ensure_ascii=False, indent=2))

    print("=== PHOTO ===")
    photo_result = handle_photo(
        chat_id=chat_id,
        message_id="m101",
        file_id="tg_file_001",
        file_name="photo_001.jpg",
        timestamp=ts2,
        photo_bytes=b"preview-photo",
        dry_run=True,
    )
    print(photo_result["reply"])
    print(json.dumps(photo_result["output"], ensure_ascii=False, indent=2))
