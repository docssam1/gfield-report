"""
Report3 Auto Recognition V2-A — Telegram Bot Handler

실제 텔레봇에 통합할 핸들러 모듈.
Preview only: 실제 전송 없음, 원본 사진 수정 없음.

흐름:
  텍스트 수신 → detect_session() → state 저장
  사진 수신 → state 조회 → group_photos() → queue 등록

서비스 연동 시:
  pip install python-telegram-bot
  환경변수: TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from session_detector import detect_session, SessionResult
from photo_grouping import TelegramPhoto, group_photos, group_photos_no_session
from drive_path_builder import build_drive_path

# ---------------------------------------------------------------------------
# State 저장소 (로컬 JSON, V2에서 Redis로 대체 가능)
# ---------------------------------------------------------------------------
STATE_FILE = Path(__file__).parent / "state" / "session_state.json"
QUEUE_DIR  = Path(__file__).parent / "sample_queue"

OWNER_CHAT_ID = os.environ.get("OWNER_CHAT_ID", "")


def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# 핸들러 함수
# ---------------------------------------------------------------------------

def handle_text(chat_id: str, message_id: str, text: str, timestamp: str) -> dict:
    """
    텍스트 메시지 수신 트리거.
    오너 단독 채널에서만 동작.

    Returns:
        {"action": "session_saved" | "ignored", "session": dict | None}
    """
    # 오너 체크 (실제 연동 시 OWNER_CHAT_ID로 필터링)
    if OWNER_CHAT_ID and chat_id != OWNER_CHAT_ID:
        return {"action": "ignored", "reason": "not_owner"}

    result = detect_session(text)

    if result.needs_review or not result.date or not result.student_name:
        # 세션 미인식 → state에는 저장하되 needs_review 플래그
        state = _load_state()
        state[chat_id] = {
            "session": result.to_dict(),
            "session_message_id": message_id,
            "session_timestamp": timestamp,
            "needs_review": True,
        }
        _save_state(state)
        return {"action": "session_saved_needs_review", "session": result.to_dict()}

    # 세션 인식 성공 → state 저장
    state = _load_state()
    state[chat_id] = {
        "session": result.to_dict(),
        "session_message_id": message_id,
        "session_timestamp": timestamp,
        "needs_review": False,
    }
    _save_state(state)
    return {"action": "session_saved", "session": result.to_dict()}


def handle_photo(chat_id: str, message_id: str, file_id: str,
                 file_name: str, timestamp: str) -> dict:
    """
    사진 메시지 수신 트리거.
    직전 세션이 있으면 귀속, 없으면 needs_review.

    Returns:
        {"action": "grouped" | "review_needed", "queue_item": dict}
    """
    if OWNER_CHAT_ID and chat_id != OWNER_CHAT_ID:
        return {"action": "ignored", "reason": "not_owner"}

    state = _load_state()
    session_state = state.get(chat_id)

    photo = TelegramPhoto(
        telegram_message_id=message_id,
        timestamp=timestamp,
        file_id=file_id,
        file_name=file_name,
    )

    if not session_state:
        # 세션 없음
        group = group_photos_no_session([photo])
    else:
        s = session_state["session"]
        group = group_photos(
            photos=[photo],
            session_message_id=session_state["session_message_id"],
            session_detected_at=session_state["session_timestamp"],
            session_date=s["date"],
            student_name=s["student_name"],
            entry_type=s["entry_type"],
        )
        if session_state.get("needs_review"):
            group.needs_review = True
            group.review_reason = "세션 자체 needs_review 상태"

    # Drive 경로 계산
    drive = build_drive_path(
        date=group.session_date,
        student_name=group.student_name,
        entry_type=group.entry_type,
    )

    # Queue 아이템 생성
    queue_item = {
        "queue_id": f"{group.student_name}_{group.session_date}_{group.entry_type}_{uuid.uuid4().hex[:6]}",
        "date": group.session_date,
        "student_name": group.student_name,
        "entry_type": group.entry_type,
        "drive_folder_path": drive.full_path if drive.valid else "",
        "photo_count": group.photo_count(),
        "status": "review_needed" if group.needs_review else "waiting",
        "needs_review": group.needs_review,
        "review_reason": group.review_reason,
        "created_at": _now_iso(),
        "source": {
            "telegram_chat_id": chat_id,
            "telegram_message_ids": [
                session_state["session_message_id"] if session_state else "",
                message_id,
            ],
        },
    }

    # Queue 파일 저장 (Preview: 실제 DB 없음)
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    queue_path = QUEUE_DIR / f"{queue_item['queue_id']}.json"
    queue_path.write_text(json.dumps(queue_item, ensure_ascii=False, indent=2), encoding="utf-8")

    action = "review_needed" if group.needs_review else "grouped"
    return {"action": action, "queue_item": queue_item}


# ---------------------------------------------------------------------------
# 실제 텔레봇 연동 스탈레톤 (python-telegram-bot v20+)
# ---------------------------------------------------------------------------
def get_telegram_handlers():
    """
    python-telegram-bot Application에 등록할 핸들러 목록 반환.

    사용예:
        from telegram.ext import Application
        from bot_handler import get_telegram_handlers

        app = Application.builder().token(TOKEN).build()
        for handler in get_telegram_handlers():
            app.add_handler(handler)
        app.run_polling()
    """
    try:
        from telegram import Update
        from telegram.ext import MessageHandler, filters, ContextTypes

        async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
            chat_id = str(update.effective_chat.id)
            msg = update.message
            result = handle_text(
                chat_id=chat_id,
                message_id=str(msg.message_id),
                text=msg.text or "",
                timestamp=msg.date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            # Preview: 로그만 출력, 매시지 미전송
            print(f"[TEXT] {result}")

        async def on_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
            chat_id = str(update.effective_chat.id)
            msg = update.message
            photo = msg.photo[-1]  # 가장 큰 해상도
            result = handle_photo(
                chat_id=chat_id,
                message_id=str(msg.message_id),
                file_id=photo.file_id,
                file_name=f"photo_{msg.message_id}.jpg",
                timestamp=msg.date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            print(f"[PHOTO] {result}")

        return [
            MessageHandler(filters.TEXT & ~filters.COMMAND, on_text),
            MessageHandler(filters.PHOTO, on_photo),
        ]

    except ImportError:
        print("python-telegram-bot 미설치. pip install python-telegram-bot")
        return []


# ---------------------------------------------------------------------------
# 로컴 테스트
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    CHAT = "test_chat_001"
    NOW  = _now_iso()

    print("=" * 60)
    print("Bot Handler — 로컴 실행 테스트")
    print("=" * 60)

    # 1. 세션 텍스트
    r1 = handle_text(CHAT, "msg_100", "5/6 김주한 수업내용", NOW)
    print("\n[1] 텍스트 수신")
    print(json.dumps(r1, ensure_ascii=False, indent=2))

    # 2. 사진 수신 (+3분)
    from datetime import timedelta
    photo_time = datetime.now(timezone.utc) + timedelta(minutes=3)
    photo_iso  = photo_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    r2 = handle_photo(CHAT, "msg_101", "tg_file_abc", "photo_001.jpg", photo_iso)
    print("\n[2] 사진 수신 (+3분)")
    print(json.dumps(r2, ensure_ascii=False, indent=2))

    # 3. 세션 없이 사진
    r3 = handle_photo("unknown_chat", "msg_200", "tg_file_xyz", "photo_002.jpg", NOW)
    print("\n[3] 세션 없이 사진")
    print(json.dumps(r3, ensure_ascii=False, indent=2))
