"""Report3 V4-2 pilot bot.

Changes vs V4-1:
- Multi-photo grouping: reply summary when uploaded_count reaches expected_count.
- video_file media_kind: real video file upload to GCS videos/ sub-dir.
- Safety: no DB, no report, no parent message.
"""
from __future__ import annotations

import os

from run_v4_drive_telegram_tests import write_result_json
from upload_command_parser import parse_upload_command
from upload_session_store import (
    append_uploaded_item,
    clear_session,
    get_session,
    set_session,
)

BOT_TOKEN = (
    os.environ.get("REPORT3_TELEGRAM_BOT_TOKEN", "").strip()
    or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
)
OWNER_CHAT_ID = os.environ.get("REPORT3_OWNER_CHAT_ID", "").strip()


def _authorized(chat_id: str) -> bool:
    return not OWNER_CHAT_ID or chat_id == OWNER_CHAT_ID


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------

def _download_result_base(file_id: str, media_type: str) -> dict:
    return {
        "test_name": "telegram_media_download",
        "success": False,
        "stopped": False,
        "needs_review": True,
        "checks": {
            "TELEGRAM_BOT_TOKEN_present": bool(BOT_TOKEN),
            "media_received": True,
        },
        "downloaded_bytes": 0,
        "mime_type": media_type,
        "file_path": "",
        "telegram_file_id": file_id,
        "error": "",
        "mode": "structured_upload_live_download",
    }


def _build_preview(command: dict, chat_id: str, message_id: str) -> dict:
    return {
        "preview_only": True,
        "action": "upload_command_preview",
        "student_name": command["student_name"],
        "date": command["date"],
        "entry_type": command["entry_type"],
        "media_kind": command["media_kind"],
        "link_url": command.get("link_url", ""),
        "expected_count": command["expected_count"],
        "needs_review": command["needs_review"],
        "review_reason": command["review_reason"],
        "source": {
            "platform": "telegram",
            "chat_id": chat_id,
            "message_id": message_id,
            "raw_text": command["raw_text"],
        },
    }


def _build_metadata(
    command: dict,
    chat_id: str,
    message_id: str,
    download_result: dict,
    upload_result: dict,
    session_state: dict | None,
) -> dict:
    backend = "gcs" if os.environ.get("REPORT3_GCS_BUCKET") else "drive"
    return {
        "preview_only": True,
        "student_name": command["student_name"],
        "source_date": command["date"],
        "entry_type": command["entry_type"],
        "media_kind": command["media_kind"],
        "telegram": {
            "chat_id": chat_id,
            "message_id": message_id,
            "file_id": download_result.get("telegram_file_id", ""),
            "downloaded_bytes": download_result.get("downloaded_bytes", 0),
            "video_url": command.get("link_url", ""),
        },
        "storage": {
            "backend": "link" if command["media_kind"] == "video_link" else backend,
            "path": upload_result.get("path", ""),
            "uri": upload_result.get("uri", ""),
        },
        "session": {
            "expected_count": command["expected_count"],
            "uploaded_count": (session_state or {}).get("uploaded_count", 0),
            "all_message_ids": [
                i.get("message_id", "")
                for i in (session_state or {}).get("stored_items", [])
            ],
            "needs_review": upload_result.get("needs_review", False),
        },
        "safety": {
            "db_updated": False,
            "parent_message_sent": False,
            "final_report_generated": False,
            "calendar_updated": False,
        },
    }


def _upload_to_gcs(
    payload: bytes,
    file_name: str,
    command: dict,
    sub_dir: str,
    content_type: str,
) -> dict:
    """GCS 업로드 공통 함수. sub_dir로 photos/ 또는 videos/ 구분."""
    from gcs_uploader import upload_media
    upload = upload_media(
        media_bytes=payload,
        file_name=file_name,
        date=command["date"],
        student_name=command["student_name"],
        entry_type=command["entry_type"],
        sub_dir=sub_dir,
        content_type=content_type,
        dry_run=False,
    )
    return {
        "success": upload.success,
        "needs_review": not upload.success or command["needs_review"],
        "path": upload.drive_path,
        "uri": upload.drive_file_id,
        "error": upload.error,
        "entry_type": command["entry_type"],
        "media_kind": command["media_kind"],
        "student_name": command["student_name"],
        "date": command["date"],
        "sub_dir": sub_dir,
    }


def _session_summary(session_state: dict, command: dict) -> str:
    """멀티미디어 완료 시 summary 텍스트."""
    items = session_state.get("stored_items", [])
    uploaded = session_state.get("uploaded_count", 0)
    expected = command["expected_count"]
    all_ids = [i.get("message_id", "") for i in items]
    uris = [i.get("uri", "") for i in items]

    lines = [
        f"\u2705 {command['student_name']} {command['date']} {command['entry_type']} 업로드 완료",
        f"uploaded_count={uploaded}/{expected}",
        f"message_ids={all_ids}",
    ]
    for i, uri in enumerate(uris, 1):
        lines.append(f"  [{i}] {uri}")
    lines += [
        "No DB, Calendar, Gemini, report, or parent-message action was run.",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

def build_application():
    if not BOT_TOKEN:
        raise RuntimeError(
            "REPORT3_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN is missing"
        )

    from telegram import Update
    from telegram.ext import (
        ApplicationBuilder,
        CommandHandler,
        ContextTypes,
        MessageHandler,
        filters,
    )

    # ── /start ──────────────────────────────────────────────────────────────
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        await update.message.reply_text(
            "Report3 V4-2 pilot bot\n"
            f"chat_id={chat_id}\n"
            "Examples:\n"
            "6/2 김주한 과제 사진 3장\n"
            "6/2 김주한 수업 영상 https://youtu.be/...\n"
            "6/2 김주한 수업 동영상  ← 파일 직접 업로드"
        )

    # ── /status ─────────────────────────────────────────────────────────────
    async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
        backend = "gcs" if os.environ.get("REPORT3_GCS_BUCKET") else "drive"
        await update.message.reply_text(
            "V4-2 ready\n"
            f"storage_backend={backend}\n"
            f"gcs_bucket={'set' if os.environ.get('REPORT3_GCS_BUCKET') else 'missing'}\n"
            f"credentials={'set' if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') else 'missing'}"
        )

    # ── 텍스트 메시지 ────────────────────────────────────────────────────────
    async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        command = parse_upload_command(msg.text or "").to_dict()
        set_session(chat_id, command, str(msg.message_id))
        write_result_json("upload_preview.json", _build_preview(command, chat_id, str(msg.message_id)))

        lines = [
            "[PREVIEW] upload command captured",
            f"student={command['student_name'] or 'unknown'}",
            f"date={command['date'] or 'unknown'}",
            f"entry_type={command['entry_type']}",
            f"media_kind={command['media_kind']}",
            f"expected_count={command['expected_count']}",
        ]

        if command["media_kind"] == "video_link" and command["link_url"]:
            # 링크만 저장, GCS 업로드 없음
            upload_result = {
                "success": True,
                "needs_review": command["needs_review"],
                "path": "",
                "uri": command["link_url"],
                "error": "",
                **{k: command[k] for k in ("entry_type", "media_kind", "student_name", "date")},
                "link_url": command["link_url"],
            }
            write_result_json("upload_result.json", upload_result)
            metadata = _build_metadata(
                command, chat_id, str(msg.message_id),
                {"telegram_file_id": "", "downloaded_bytes": 0},
                upload_result,
                {"uploaded_count": 1, "stored_items": [{"message_id": str(msg.message_id), "uri": command["link_url"]}]},
            )
            write_result_json("metadata.json", metadata)
            clear_session(chat_id)
            lines.append(f"video_url={command['link_url']}")
            lines.append("stored_as=link_only")
        elif command["media_kind"] == "video_file":
            lines.append("동영상 파일을 이어서 보내주세요.")
            lines.append(f"저장 경로: {command['date']}/{command['student_name']}/{command['entry_type']}/videos/")
        elif command["needs_review"]:
            lines.append("needs_review=true")
            if command["review_reason"]:
                lines.append(f"reason={command['review_reason']}")
        else:
            lines.append(f"사진 {command['expected_count']}장을 이어서 보내주세요.")

        await update.message.reply_text("\n".join(lines))

    # ── 사진 메시지 ──────────────────────────────────────────────────────────
    async def photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        session_state = get_session(chat_id)
        if not session_state:
            await update.message.reply_text(
                "먼저 텍스트로 업로드 지시를 보내주세요.\n예: 6/2 김주한 과제 사진 3장"
            )
            return

        command = session_state["command"]
        if command["media_kind"] not in ("photos",):
            await update.message.reply_text(
                "현재 세션은 사진 업로드 대기 상태가 아닙니다.\n"
                f"media_kind={command['media_kind']}"
            )
            return

        if not os.environ.get("REPORT3_GCS_BUCKET"):
            await update.message.reply_text("GCS bucket is required for this mode.")
            return

        tg_photo = msg.photo[-1]
        tg_file  = await tg_photo.get_file()
        payload  = bytes(await tg_file.download_as_bytearray())
        file_name = f"{command['entry_type']}_{msg.message_id}.jpg"

        download_result = _download_result_base(tg_photo.file_id, "image/jpeg")
        download_result.update({
            "success": True,
            "needs_review": False,
            "downloaded_bytes": len(payload),
            "file_path": tg_file.file_path or "",
        })
        write_result_json("telegram_photo_download_test_result.json", download_result)

        upload_result = _upload_to_gcs(payload, file_name, command, "photos", "image/jpeg")
        write_result_json("upload_result.json", upload_result)

        updated_session = append_uploaded_item(
            chat_id,
            {
                "message_id": str(msg.message_id),
                "path": upload_result["path"],
                "uri": upload_result["uri"],
                "media_kind": "photos",
            },
        )
        metadata = _build_metadata(
            command, chat_id, str(msg.message_id),
            download_result, upload_result, updated_session,
        )
        write_result_json("metadata.json", metadata)

        if not upload_result["success"]:
            await update.message.reply_text(
                "Photo downloaded, but GCS write failed. Test stopped.\n"
                f"reason={upload_result.get('error', 'unknown')}"
            )
            return

        uploaded_count = (updated_session or {}).get("uploaded_count", 1)
        expected_count = command["expected_count"]

        # ── 그룹 완료 감지 ──────────────────────────────────────────────────
        if uploaded_count >= expected_count:
            clear_session(chat_id)
            await update.message.reply_text(
                _session_summary(updated_session, command)
            )
        else:
            await update.message.reply_text(
                f"Photo stored. [{uploaded_count}/{expected_count}]\n"
                f"uri={upload_result['uri']}\n"
                "No DB/report/parent-message action was run."
            )

    # ── 동영상 파일 메시지 (V4-2) ────────────────────────────────────────────
    async def video_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        session_state = get_session(chat_id)
        if not session_state:
            await update.message.reply_text(
                "먼저 텍스트로 업로드 지시를 보내주세요.\n예: 6/2 김주한 수업 동영상"
            )
            return

        command = session_state["command"]
        if command["media_kind"] != "video_file":
            await update.message.reply_text(
                "현재 세션은 동영상 직접 업로드 대기 상태가 아닙니다.\n"
                f"media_kind={command['media_kind']}"
            )
            return

        if not os.environ.get("REPORT3_GCS_BUCKET"):
            await update.message.reply_text("GCS bucket is required for this mode.")
            return

        tg_video  = msg.video
        tg_file   = await tg_video.get_file()
        payload   = bytes(await tg_file.download_as_bytearray())
        mime_type = tg_video.mime_type or "video/mp4"
        ext       = mime_type.split("/")[-1] if "/" in mime_type else "mp4"
        file_name = f"{command['entry_type']}_{msg.message_id}.{ext}"

        download_result = _download_result_base(tg_video.file_id, mime_type)
        download_result.update({
            "success": True,
            "needs_review": False,
            "downloaded_bytes": len(payload),
            "file_path": tg_file.file_path or "",
        })
        write_result_json("telegram_video_download_result.json", download_result)

        # videos/ sub_dir 으로 GCS 저장
        upload_result = _upload_to_gcs(payload, file_name, command, "videos", mime_type)
        write_result_json("upload_result.json", upload_result)

        updated_session = append_uploaded_item(
            chat_id,
            {
                "message_id": str(msg.message_id),
                "path": upload_result["path"],
                "uri": upload_result["uri"],
                "media_kind": "video_file",
            },
        )
        metadata = _build_metadata(
            command, chat_id, str(msg.message_id),
            download_result, upload_result, updated_session,
        )
        write_result_json("metadata.json", metadata)

        if not upload_result["success"]:
            await update.message.reply_text(
                "Video downloaded, but GCS write failed. Test stopped.\n"
                f"reason={upload_result.get('error', 'unknown')}"
            )
            return

        clear_session(chat_id)
        await update.message.reply_text(
            f"\u2705 Video stored.\n"
            f"student={command['student_name']}\n"
            f"date={command['date']}\n"
            f"entry_type={command['entry_type']}\n"
            f"sub_dir=videos/\n"
            f"downloaded_bytes={download_result['downloaded_bytes']}\n"
            f"uri={upload_result['uri']}\n"
            "No DB, Calendar, Gemini, report, or parent-message action was run."
        )

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(MessageHandler(filters.PHOTO, photo_message))
    app.add_handler(MessageHandler(filters.VIDEO, video_message))
    return app


if __name__ == "__main__":
    build_application().run_polling()
