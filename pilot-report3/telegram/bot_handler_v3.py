from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import sys

HOMEWORK_DIR = Path(__file__).resolve().parent.parent / "homework"
if str(HOMEWORK_DIR) not in sys.path:
    sys.path.insert(0, str(HOMEWORK_DIR))

from check_builder import build_homework_check
from homework_store import AssignedHomework, HomeworkItem, get_assigned_homework
from query_parser import parse_query
from status_parser import parse_status_input


STATE_FILE = Path(__file__).resolve().parent / "state" / "v3_state.json"


def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_pending(chat_id: str) -> Optional[dict]:
    return _load_state().get(chat_id)


def _set_pending(chat_id: str, assigned: AssignedHomework) -> None:
    state = _load_state()
    state[chat_id] = {
        "flow": "waiting_status",
        "student_name": assigned.student_name,
        "source_date": assigned.source_date,
        "items": [item.to_dict() for item in assigned.items],
        "set_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _save_state(state)


def _clear_pending(chat_id: str) -> None:
    state = _load_state()
    state.pop(chat_id, None)
    _save_state(state)


def handle_message(chat_id: str, message_id: str, text: str) -> dict:
    pending = _get_pending(chat_id)
    if pending and pending.get("flow") == "waiting_status":
        return _handle_status(chat_id, text, pending)
    return _handle_query(chat_id, text)


def _handle_query(chat_id: str, text: str) -> dict:
    query = parse_query(text)
    if query.needs_review or query.intent == "unknown":
        return {
            "action": "needs_review",
            "reply": f"[PREVIEW] 인식 불가: needs_review=true\n원문: {text}",
            "output": query.to_dict(),
        }

    if query.intent != "recall_homework":
        return {
            "action": "needs_review",
            "reply": f"[PREVIEW] 아직 지원하지 않는 intent: {query.intent}\nneeds_review=true",
            "output": query.to_dict(),
        }

    assigned = get_assigned_homework(query.student_name, query.date)
    if not assigned:
        return {
            "action": "not_found",
            "reply": f"[PREVIEW] {query.student_name} {query.date} 과제를 찾지 못했습니다.\nneeds_review=true",
            "output": {
                **query.to_dict(),
                "needs_review": True,
            },
        }

    _set_pending(chat_id, assigned)
    return {
        "action": "homework_listed",
        "reply": assigned.format_for_bot(),
        "output": assigned.to_dict(),
    }


def _handle_status(chat_id: str, text: str, pending: dict) -> dict:
    status_items = parse_status_input(text)
    assigned = AssignedHomework(
        student_name=pending["student_name"],
        source_date=pending["source_date"],
        items=[HomeworkItem(**item) for item in pending["items"]],
    )
    preview = build_homework_check(assigned, status_items)
    _clear_pending(chat_id)

    lines = [
        f"[PREVIEW] homework_check JSON ready: {preview.student_name} {preview.assigned_homework_source_date}",
        "parent_message_sent=false",
        "db_updated=false",
    ]
    if preview.needs_review:
        lines.append("needs_review=true")

    return {
        "action": "homework_check_preview",
        "reply": "\n".join(lines),
        "output": preview.to_dict(),
    }


if __name__ == "__main__":
    chat_id = "owner_test_001"

    print("=== STEP 1 ===")
    result1 = handle_message(chat_id, "m1", "김주한 6/4 과제 불러와줘")
    print(result1["reply"])
    print(json.dumps(result1["output"], ensure_ascii=False, indent=2))

    print("=== STEP 2 ===")
    result2 = handle_message(chat_id, "m2", "1 완료\n2 부분\n3 미수행")
    print(result2["reply"])
    print(json.dumps(result2["output"], ensure_ascii=False, indent=2))
