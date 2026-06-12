from __future__ import annotations

import json
import os
from datetime import timezone

from run_v4_drive_telegram_tests import (
    build_metadata_sample,
    run_drive_write_test,
    write_result_json,
)


BOT_TOKEN = (
    os.environ.get("REPORT3_TELEGRAM_BOT_TOKEN", "").strip()
    or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
)
OWNER_CHAT_ID = os.environ.get("REPORT3_OWNER_CHAT_ID", "").strip()


def _authorized(chat_id: str) -> bool:
    return not OWNER_CHAT_ID or chat_id == OWNER_CHAT_ID


def _download_result_base(file_id: str) -> dict:
    return {
        "test_name": "telegram_photo_download_test",
        "success": False,
        "stopped": False,
        "needs_review": True,
        "checks": {
            "TELEGRAM_BOT_TOKEN_present": bool(BOT_TOKEN),
            "photo_received": True,
        },
        "downloaded_bytes": 0,
        "mime_type": "image/jpeg",
        "file_path": "",
        "telegram_file_id": file_id,
        "error": "",
        "mode": "pilot_bot_live_download",
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
            "Report3 V4-1 pilot bot\n"
            f"chat_id={chat_id}\n"
            "Send one non-sensitive test photo."
        )

    async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "V4-1 ready\n"
            f"drive_root={'set' if os.environ.get('REPORT3_DRIVE_ROOT_ID') else 'missing'}\n"
            f"credentials={'set' if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') else 'missing'}"
        )

    async def photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        if not _authorized(chat_id):
            await update.message.reply_text("Unauthorized")
            return

        msg = update.message
        tg_photo = msg.photo[-1]
        download_result = _download_result_base(tg_photo.file_id)

        try:
            tg_file = await tg_photo.get_file()
            payload = bytes(await tg_file.download_as_bytearray())
            download_result["success"] = True
            download_result["needs_review"] = False
            download_result["downloaded_bytes"] = len(payload)
            download_result["file_path"] = tg_file.file_path or ""
        except Exception as exc:
            download_result["stopped"] = True
            download_result["error"] = f"{type(exc).__name__}: {exc}"
            write_result_json(
                "telegram_photo_download_test_result.json",
                download_result,
            )
            await update.message.reply_text(
                "Telegram photo download failed. Test stopped."
            )
            return

        write_result_json(
            "telegram_photo_download_test_result.json",
            download_result,
        )

        drive_result = run_drive_write_test(
            photo_bytes=payload,
            file_name=f"pilot_telegram_{msg.message_id}.jpg",
        )
        write_result_json("drive_write_test_result.json", drive_result)

        metadata = build_metadata_sample(download_result, drive_result)
        metadata["telegram"]["chat_id"] = chat_id
        metadata["telegram"]["message_id"] = str(msg.message_id)
        write_result_json("metadata.json", metadata)

        if not drive_result.get("success"):
            await update.message.reply_text(
                "Photo downloaded, but Drive write failed. Test stopped.\n"
                f"reason={drive_result.get('error', 'unknown')}"
            )
            return

        await update.message.reply_text(
            "V4-1 test passed.\n"
            f"downloaded_bytes={download_result['downloaded_bytes']}\n"
            f"drive_file_id={drive_result['drive_file_id']}\n"
            "No DB, Calendar, Gemini, report, or parent-message action was run."
        )

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(MessageHandler(filters.PHOTO, photo))
    return app


if __name__ == "__main__":
    build_application().run_polling()
