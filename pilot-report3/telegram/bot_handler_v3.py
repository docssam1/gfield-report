"""
Report3 V3 — Bot Handler (End-to-End)

과제 조회 및 확인 플로우 전체를 연결합니다.
Preview only: 메시지 전송 없음, production DB 수정 없음.

== 지원 플로우 ==

[RECALL 플로우]
  오너: "김주한 6/4 과제 불러와줘"
  봇:   번호 매긴 과제 목록 반환 (preview 로그)
  오너: "1 완료\n2 부분완료 틀린문제 많음\n3 미수행"
  봇:   homework_check JSON 저장 (preview)

[FLOW STATE 관리]
  chat_id별로 pending_check state 유지.
  상태: idle | waiting_status
"""

from __future__ import annotations

import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# 경로 설정 — homework 모듈 import
SYS_PATH = Path(__file__).parent.parent / "homework"
if str(SYS_PATH) not in sys.path:
    sys.path.insert(0, str(SYS_PATH))

from query_parser import parse_query
from homework_store import get_assigned_homework, AssignedHomework
from status_parser import parse_status_input
from check_builder import build_homework_check, save_homework_check

OWNER_CHAT_ID = os.environ.get("OWNER_CHAT_ID", "")
STATE_FILE = Path(__file__).parent / "state" / "v3_state.json"


# ---------------------------------------------------------------------------
# State 관리
# ---------------------------------------------------------------------------

def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _clear_pending(chat_id: str) -> None:
    state = _load_state()
    state.pop(chat_id, None)
    _save_state(state)


def _set_pending(chat_id: str, assigned: AssignedHomework) -> None:
    state = _load_state()
    state[chat_id] = {
        "flow": "waiting_status",
        "student_name": assigned.student_name,
        "source_date": assigned.source_date,
        "items": [i.__dict__ for i in assigned.items],
        "set_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _save_state(state)


def _get_pending(chat_id: str) -> Optional[dict]:
    return _load_state().get(chat_id)


# ---------------------------------------------------------------------------
# 메인 핸들러
# ---------------------------------------------------------------------------

def handle_message(chat_id: str, message_id: str, text: str) -> dict:
    """
    오너 메시지 수신 → 플로우 분기 처리.

    Returns:
        {
          "action": str,
          "reply": str,          # 봇이 보낼 텍스트 (preview: 전송 안 함)
          "output": dict | None  # 저장된 결과
        }
    """
    if OWNER_CHAT_ID and chat_id != OWNER_CHAT_ID:
        return {"action": "ignored", "reply": "", "output": None}

    pending = _get_pending(chat_id)

    # ── 상태: 과제 상태 입력 대기 중 ──────────────────────────────────────
    if pending and pending.get("flow") == "waiting_status":
        return _handle_status_input(chat_id, message_id, text, pending)

    # ── 일반 텍스트: 쿼리 파싱 ────────────────────────────────────────────
    return _handle_query(chat_id, message_id, text)


def _handle_query(chat_id: str, message_id: str, text: str) -> dict:
    """쿼리 파싱 → recall_homework 분기."""
    query = parse_query(text)

    if query.needs_review or query.intent == "unknown":
        return {
            "action": "needs_review",
            "reply": f"[PREVIEW] 인식 불가: needs_review=true\n원문: {text!r}",
            "output": query.to_dict(),
        }

    if query.intent == "recall_homework":
        return _recall_homework(chat_id, query)

    if query.intent == "recall_homework_check":
        return _recall_homework_check(chat_id, query)

    if query.intent == "recall_class_notes":
        return {
            "action": "recall_class_notes",
            "reply": f"[PREVIEW] 수업내용 조회: {query.student_name} {query.date}\n(V4에서 구현 예정)",
            "output": query.to_dict(),
        }

    return {
        "action": "unhandled",
        "reply": f"[PREVIEW] 미지원 intent: {query.intent}",
        "output": query.to_dict(),
    }


def _recall_homework(chat_id: str, query) -> dict:
    """과제 목록 조회 → 번호 목록 반환 + waiting_status 상태 설정."""
    assigned = get_assigned_homework(query.student_name, query.date)

    if not assigned:
        return {
            "action": "not_found",
            "reply": f"[PREVIEW] {query.student_name} {query.date} 과제 데이터 없음.\n먼저 수업 사진을 분석해 과제를 등록해주세요.",
            "output": None,
        }

    # 봇 응답 포맷
    reply = assigned.format_for_bot()

    # 상태 저장 — 다음 메시지에서 상태 입력 받기 위해
    _set_pending(chat_id, assigned)

    return {
        "action": "homework_listed",
        "reply": reply,
        "output": assigned.to_dict(),
    }


def _recall_homework_check(chat_id: str, query) -> dict:
    """기존 homework_check 결과 조회."""
    from check_builder import load_homework_check
    result = load_homework_check(query.student_name, query.date)
    if not result:
        return {
            "action": "not_found",
            "reply": f"[PREVIEW] {query.student_name} {query.date} 과제확인 기록 없음.",
            "output": None,
        }
    return {
        "action": "homework_check_recalled",
        "reply": f"[PREVIEW] {query.student_name} {query.date} 과제확인 결과:\n" + _format_check(result),
        "output": result,
    }


def _handle_status_input(chat_id: str, message_id: str, text: str, pending: dict) -> dict:
    """과제 상태 입력 처리 → homework_check JSON 저장."""
    from homework_store import HomeworkItem

    status_items = parse_status_input(text)

    if not status_items:
        return {
            "action": "status_parse_failed",
            "reply": "[PREVIEW] 상태 입력 인식 실패.\n예: 1 완료\n2 부분\n3 미수행",
            "output": None,
        }

    # pending에서 AssignedHomework 복원
    items = [HomeworkItem(**i) for i in pending["items"]]
    assigned = AssignedHomework(
        student_name=pending["student_name"],
        source_date=pending["source_date"],
        items=items,
    )

    result = build_homework_check(assigned, status_items)
    path = save_homework_check(result)

    # 상태 초기화
    _clear_pending(chat_id)

    reply_lines = [f"[PREVIEW] 과제확인 저장 완료: {result.student_name} ({result.assigned_homework_source_date})"]
    for item in result.items:
        icon = {"done": "✅", "partial": "⚠️", "not_done": "❌", "unknown": "❓"}.get(item.status, "❓")
        note = f" ({item.note})" if item.note else ""
        reply_lines.append(f"{icon} {item.title}{note}")
    if result.needs_review:
        reply_lines.append("\n⚠️ needs_review=true — 오너 확인 필요")
    reply_lines.append(f"\n저장: {path}")
    reply_lines.append("📵 public_allowed=false — 학부모 전송 안 함")

    return {
        "action": "homework_check_saved",
        "reply": "\n".join(reply_lines),
        "output": result.to_dict(),
    }


def _format_check(data: dict) -> str:
    lines = []
    for item in data.get("items", []):
        icon = {"done": "✅", "partial": "⚠️", "not_done": "❌"}.get(item.get("status"), "❓")
        note = f" ({item['note']})" if item.get("note") else ""
        lines.append(f"{icon} {item['title']}{note}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 실제 텔레봇 연동 스켈레톤
# ---------------------------------------------------------------------------
def get_telegram_handlers():
    """
    python-telegram-bot v20+에 등록할 핸들러 반환.

    사용:
        app = Application.builder().token(TOKEN).build()
        for h in get_telegram_handlers(): app.add_handler(h)
        app.run_polling()
    """
    try:
        from telegram import Update
        from telegram.ext import MessageHandler, filters, ContextTypes

        async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
            chat_id = str(update.effective_chat.id)
            msg = update.message
            result = handle_message(chat_id, str(msg.message_id), msg.text or "")
            # Preview: 로그만 출력, 실제 전송 없음
            print(f"[BOT_V3] action={result['action']}")
            print(f"[REPLY PREVIEW]\n{result['reply']}")

        return [MessageHandler(filters.TEXT & ~filters.COMMAND, on_text)]
    except ImportError:
        print("pip install python-telegram-bot 필요")
        return []


# ---------------------------------------------------------------------------
# 로컬 E2E 시뮬레이션 테스트
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    CHAT = "owner_test_001"

    print("=" * 60)
    print("Bot Handler V3 — E2E 시뮬레이션")
    print("=" * 60)

    # Step 1: 과제 조회
    print("\n[Step 1] 오너: '김주한 6/4 과제 불러와줘'")
    r1 = handle_message(CHAT, "msg_001", "김주한 6/4 과제 불러와줘")
    print(f"action: {r1['action']}")
    print(f"reply:\n{r1['reply']}")

    # Step 2: 상태 입력
    print("\n[Step 2] 오너: '1 완료 / 2 부분완료 틀린문제 많음 / 3 미수행'")
    status_text = "1 완료\n2 부분완료 틀린문제 많음\n3 미수행"
    r2 = handle_message(CHAT, "msg_002", status_text)
    print(f"action: {r2['action']}")
    print(f"reply:\n{r2['reply']}")
    if r2.get("output"):
        print("\noutput JSON:")
        print(json.dumps(r2["output"], ensure_ascii=False, indent=2))

    # Step 3: needs_review 케이스
    print("\n[Step 3] 인식 불가 입력")
    r3 = handle_message(CHAT, "msg_003", "불러와줘")
    print(f"action: {r3['action']}")
    print(f"reply: {r3['reply']}")
