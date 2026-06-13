from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


STATE_FILE = Path(__file__).resolve().parent / "state" / "upload_session_state.json"
SESSION_TTL_MINUTES = 30


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def get_session(chat_id: str) -> dict | None:
    state = load_state()
    session = state.get(chat_id)
    if not session:
        return None

    updated_at = _parse_iso(session["updated_at"])
    if datetime.now(timezone.utc) - updated_at > timedelta(minutes=SESSION_TTL_MINUTES):
        state.pop(chat_id, None)
        save_state(state)
        return None
    return session


def set_session(chat_id: str, command: dict, message_id: str) -> dict:
    state = load_state()
    payload = {
        "command": command,
        "session_message_id": message_id,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "uploaded_count": 0,
        "stored_items": [],
    }
    state[chat_id] = payload
    save_state(state)
    return payload


def append_uploaded_item(chat_id: str, item: dict) -> dict | None:
    state = load_state()
    session = state.get(chat_id)
    if not session:
        return None
    session["uploaded_count"] = int(session.get("uploaded_count", 0)) + 1
    session.setdefault("stored_items", []).append(item)
    session["updated_at"] = _now_iso()
    state[chat_id] = session
    save_state(state)
    return session


def clear_session(chat_id: str) -> None:
    state = load_state()
    if chat_id in state:
        state.pop(chat_id, None)
        save_state(state)
