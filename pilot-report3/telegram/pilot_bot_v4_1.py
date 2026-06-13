from __future__ import annotations

import os
from datetime import timezone

from run_v4_drive_telegram_tests import write_result_json
from upload_command_parser import parse_upload_command
from upload_session_store import append_uploaded_item, get_session, set_session


BOT_TOKEN = (
    os.environ.get("REPORT3_TELEGRAM_BOT_TOKEN", "").strip()
    or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
)
OWNER_CHAT_ID = os.environ.get("REPORT3_OWNER_CHAT_ID", "").strip()


def _authorized(chat_id: str) -> bool:
    return not OWNER_CHAT_ID or chat_id == OWNER_CHAT_ID


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


def _build_metadata(command: dict, chat_id: str, message_id: str, download_result: dict, upload_result: dict, session_state: dict | None) -> dict:
    return {
        "generated_at": download_result.get("generated_at") or "",
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
        },
        "storage": {
            "backend": "gcs" if os.environ.get("REPORT3_GCS_BUCKET") else "drive",
            "path": upload_result.get("path", ""),
            "uri": upload_result.get("uri", ""),
        },
        "session": {
            "expected_count": command["expected_count"],
            "uploaded_count": (session_state or {}).get("uploaded_count", 0),
            "needs_review": upload_result.get("needs_review", False),
        },
        "safety": {
            "db_updated": False,
            "parent_message_sent": False,
            "final_report_generated": False,
            "calendar_updated": False,
        },
    }


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

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        await update.message.reply_text(
            "Report3 structured upload bot\n"
            f"chat_id={chat_id}\n"
            "Example: 6/2 김주한 과제 사진"
        )

    async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
        backend = "gcs" if os.environ.get("REPORT3_GCS_BUCKET") else "drive"
        await update.message.reply_text(
            "V4-1 ready\n"
            f"storage_backend={backend}\n"
            f"drive_root={'set' if os.environ.get('REPORT3_DRIVE_ROOT_ID') else 'missing'}\n"
            f"gcs_bucket={'set' if os.environ.get('REPORT3_GCS_BUCKET') else 'missing'}\n"
            f"credentials={'set' if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') else 'missing'}"
        )

    async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        command = parse_upload_command(msg.text or "").to_dict()
        set_session(chat_id, command, str(msg.message_id))
        preview = _build_preview(command, chat_id, str(msg.message_id))
        write_result_json("upload_preview.json", preview)

        lines = [
            "[PREVIEW] upload command captured",
            f"student={command['student_name'] or 'unknown'}",
            f"date={command['date'] or 'unknown'}",
            f"entry_type={command['entry_type']}",
            f"media_kind={command['media_kind']}",
            f"expected_count={command['expected_count']}",
        ]
        if command["needs_review"]:
            lines.append("needs_review=true")
            if command["review_reason"]:
                lines.append(f"reason={command['review_reason']}")

        await update.message.reply_text("\n".join(lines))

    async def _handle_media(update: Update, media_type: str):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        session_state = get_session(chat_id)
        if not session_state:
            await update.message.reply_text(
                "먼저 텍스트로 업로드 지시를 보내주세요.\n예: 6/2 김주한 과제 사진"
            )
            return

        command = session_state["command"]
        expected_media = "videos" if command["media_kind"] == "videos" else "photos"
        if media_type != expected_media:
            await update.message.reply_text(
                f"현재 세션은 {command['media_kind']} 대기 중입니다."
            )
            return

        if media_type == "photos":
            tg_media = msg.photo[-1]
            tg_file = await tg_media.get_file()
            file_name = f"{command['entry_type']}_{msg.message_id}.jpg"
            mime_type = "image/jpeg"
            file_id = tg_media.file_id
            payload = bytes(await tg_file.download_as_bytearray())
        else:
            tg_media = msg.video
            tg_file = await tg_media.get_file()
            suffix = ".mp4"
            if tg_media.file_name and "." in tg_media.file_name:
                suffix = "." + tg_media.file_name.split(".")[-1]
            file_name = f"{command['entry_type']}_{msg.message_id}{suffix}"
            mime_type = tg_media.mime_type or "video/mp4"
            file_id = tg_media.file_id
            payload = bytes(await tg_file.download_as_bytearray())

        download_result = _download_result_base(file_id, mime_type)

        try:
            download_result["success"] = True
            download_result["needs_review"] = False
            download_result["downloaded_bytes"] = len(payload)
            download_result["file_path"] = tg_file.file_path or ""
        except Exception as exc:
            download_result["stopped"] = True
            download_result["error"] = f"{type(exc).__name__}: {exc}"
            write_result_json("telegram_photo_download_test_result.json", download_result)
            await update.message.reply_text(
                "Telegram media download failed. Test stopped."
            )
            return

        write_result_json("telegram_photo_download_test_result.json", download_result)

        if os.environ.get("REPORT3_GCS_BUCKET"):
            from gcs_uploader import upload_media
        else:
            await update.message.reply_text("GCS bucket is required for this mode.")
            return

        upload = upload_media(
            media_bytes=payload,
            file_name=file_name,
            date=command["date"],
            student_name=command["student_name"],
            entry_type=command["entry_type"],
            sub_dir=command["media_kind"],
            content_type=mime_type,
            dry_run=False,
        )
        upload_result = {
            "success": upload.success,
            "needs_review": not upload.success or command["needs_review"],
            "path": upload.drive_path,
            "uri": upload.drive_file_id,
            "error": upload.error,
            "entry_type": command["entry_type"],
            "media_kind": command["media_kind"],
            "student_name": command["student_name"],
            "date": command["date"],
        }
        write_result_json("upload_result.json", upload_result)

        updated_session = append_uploaded_item(
            chat_id,
            {
                "message_id": str(msg.message_id),
                "path": upload.drive_path,
                "uri": upload.drive_file_id,
                "media_kind": command["media_kind"],
            },
        )
        metadata = _build_metadata(
            command,
            chat_id,
            str(msg.message_id),
            download_result,
            upload_result,
            updated_session,
        )
        write_result_json("metadata.json", metadata)

        if not upload_result.get("success"):
            await update.message.reply_text(
                "Photo downloaded, but storage write failed. Test stopped.\n"
                f"reason={upload_result.get('error', 'unknown')}"
            )
            return

        uploaded_count = (updated_session or {}).get("uploaded_count", 1)
        await update.message.reply_text(
            "Upload stored.\n"
            f"student={command['student_name']}\n"
            f"date={command['date']}\n"
            f"entry_type={command['entry_type']}\n"
            f"media_kind={command['media_kind']}\n"
            f"downloaded_bytes={download_result['downloaded_bytes']}\n"
            f"stored_as={upload_result['uri']}\n"
            f"uploaded_count={uploaded_count}/{command['expected_count']}\n"
            "No DB, Calendar, Gemini, report, or parent-message action was run."
        )

    async def photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await _handle_media(update, "photos")

    async def video_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await _handle_media(update, "videos")

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(MessageHandler(filters.PHOTO, photo_message))
    app.add_handler(MessageHandler(filters.VIDEO, video_message))
    return app


if __name__ == "__main__":
    build_application().run_polling()
