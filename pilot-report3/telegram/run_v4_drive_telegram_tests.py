from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
AUTO_RECOG_DIR = BASE_DIR.parent / "auto_recognition"
if str(AUTO_RECOG_DIR) not in sys.path:
    sys.path.insert(0, str(AUTO_RECOG_DIR))

OUTPUT_DIR = BASE_DIR / "test_outputs"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_result_json(name: str, data: dict) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _base_drive_result() -> dict:
    return {
        "tested_at": _now_iso(),
        "test_name": "drive_write_test",
        "success": False,
        "stopped": False,
        "needs_review": True,
        "checks": {
            "REPORT3_DRIVE_ROOT_ID_present": False,
            "GOOGLE_APPLICATION_CREDENTIALS_present": False,
            "GOOGLE_APPLICATION_CREDENTIALS_exists": False,
            "root_folder_accessible": False,
            "root_folder_can_add_children": False,
        },
        "root_folder": {
            "id": "",
            "name": "",
            "mime_type": "",
        },
        "drive_path": "",
        "drive_file_id": "",
        "error": "",
        "mode": "pilot_real_write_test",
        "notes": [
            "No DB update",
            "No parent messaging",
            "No final report generation",
        ],
    }


def run_drive_write_test(
    photo_bytes: bytes | None = None,
    file_name: str = "pilot_v4_1_drive_write_test.jpg",
) -> dict:
    result = _base_drive_result()
    root_id = os.environ.get("REPORT3_DRIVE_ROOT_ID", "").strip()
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

    result["checks"]["REPORT3_DRIVE_ROOT_ID_present"] = bool(root_id)
    result["checks"]["GOOGLE_APPLICATION_CREDENTIALS_present"] = bool(creds_path)
    result["checks"]["GOOGLE_APPLICATION_CREDENTIALS_exists"] = bool(
        creds_path and Path(creds_path).is_file()
    )
    result["root_folder"]["id"] = root_id

    if not root_id:
        result["stopped"] = True
        result["error"] = "REPORT3_DRIVE_ROOT_ID missing"
        return result
    if not creds_path:
        result["stopped"] = True
        result["error"] = "GOOGLE_APPLICATION_CREDENTIALS missing"
        return result
    if not Path(creds_path).is_file():
        result["stopped"] = True
        result["error"] = "GOOGLE_APPLICATION_CREDENTIALS file not found"
        return result

    try:
        import drive_uploader

        service = drive_uploader._get_drive_service()
        root = service.files().get(
            fileId=root_id,
            fields="id,name,mimeType,capabilities(canAddChildren)",
        ).execute()

        result["checks"]["root_folder_accessible"] = True
        result["checks"]["root_folder_can_add_children"] = bool(
            root.get("capabilities", {}).get("canAddChildren")
        )
        result["root_folder"].update(
            {
                "name": root.get("name", ""),
                "mime_type": root.get("mimeType", ""),
            }
        )

        if root.get("mimeType") != "application/vnd.google-apps.folder":
            result["stopped"] = True
            result["error"] = "REPORT3_DRIVE_ROOT_ID is not a Google Drive folder"
            return result
        if not result["checks"]["root_folder_can_add_children"]:
            result["stopped"] = True
            result["error"] = "Service account has no write permission on root folder"
            return result

        upload = drive_uploader.upload_photo(
            photo_bytes=photo_bytes or b"report3-v4-1-test-photo",
            file_name=file_name,
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            student_name="_PILOT_V4_1",
            entry_type="telegram_download_test",
            dry_run=False,
        )
        result["drive_path"] = upload.drive_path
        result["drive_file_id"] = upload.drive_file_id
        result["success"] = upload.success
        result["needs_review"] = not upload.success
        result["error"] = upload.error
        result["stopped"] = not upload.success
        return result
    except Exception as exc:
        result["stopped"] = True
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["exception_trace"] = traceback.format_exc(limit=5)
        return result


def _base_telegram_result() -> dict:
    return {
        "tested_at": _now_iso(),
        "test_name": "telegram_photo_download_test",
        "success": False,
        "stopped": False,
        "needs_review": True,
        "checks": {
            "TELEGRAM_BOT_TOKEN_present": False,
            "REPORT3_TEST_TELEGRAM_FILE_ID_present": False,
        },
        "downloaded_bytes": 0,
        "mime_type": "",
        "file_path": "",
        "telegram_file_id": "",
        "error": "",
        "mode": "pilot_real_download_test",
    }


def run_telegram_photo_download_test() -> dict:
    result = _base_telegram_result()
    bot_token = (
        os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        or os.environ.get("BOT_TOKEN", "").strip()
    )
    file_id = os.environ.get("REPORT3_TEST_TELEGRAM_FILE_ID", "").strip()
    result["checks"]["TELEGRAM_BOT_TOKEN_present"] = bool(bot_token)
    result["checks"]["REPORT3_TEST_TELEGRAM_FILE_ID_present"] = bool(file_id)
    result["telegram_file_id"] = file_id

    if not bot_token:
        result["stopped"] = True
        result["error"] = "TELEGRAM_BOT_TOKEN/BOT_TOKEN missing"
        return result
    if not file_id:
        result["stopped"] = True
        result["error"] = "REPORT3_TEST_TELEGRAM_FILE_ID missing"
        return result

    try:
        import asyncio
        from telegram import Bot

        async def _download():
            bot = Bot(token=bot_token)
            tg_file = await bot.get_file(file_id)
            data = await tg_file.download_as_bytearray()
            return tg_file, bytes(data)

        tg_file, payload = asyncio.run(_download())
        result["success"] = True
        result["needs_review"] = False
        result["downloaded_bytes"] = len(payload)
        result["file_path"] = tg_file.file_path or ""
        result["mime_type"] = "image/jpeg"
        return result
    except Exception as exc:
        result["stopped"] = True
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result


def build_metadata_sample(
    telegram_result: dict | None = None,
    drive_result: dict | None = None,
) -> dict:
    telegram_result = telegram_result or {}
    drive_result = drive_result or {}
    return {
        "generated_at": _now_iso(),
        "preview_only": True,
        "student_name": "_PILOT_V4_1",
        "source_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "entry_type": "telegram_download_test",
        "telegram": {
            "chat_id": "",
            "message_id": "",
            "photo_file_id": telegram_result.get("telegram_file_id", ""),
            "downloaded_bytes": telegram_result.get("downloaded_bytes", 0),
        },
        "drive": {
            "root_id": drive_result.get("root_folder", {}).get("id", ""),
            "folder_path": drive_result.get("drive_path", ""),
            "file_id": drive_result.get("drive_file_id", ""),
        },
        "safety": {
            "db_updated": False,
            "parent_message_sent": False,
            "final_report_generated": False,
            "calendar_updated": False,
        },
    }


def _run_and_always_write() -> int:
    drive_result = _base_drive_result()
    telegram_result = _base_telegram_result()

    try:
        drive_result = run_drive_write_test()
    except Exception as exc:
        drive_result["stopped"] = True
        drive_result["error"] = f"Unhandled {type(exc).__name__}: {exc}"
        drive_result["exception_trace"] = traceback.format_exc(limit=5)
    finally:
        write_result_json("drive_write_test_result.json", drive_result)

    if drive_result.get("stopped"):
        telegram_result["stopped"] = True
        telegram_result["error"] = (
            "Skipped because drive test stopped first: "
            + drive_result.get("error", "unknown error")
        )
    else:
        try:
            telegram_result = run_telegram_photo_download_test()
        except Exception as exc:
            telegram_result["stopped"] = True
            telegram_result["error"] = f"Unhandled {type(exc).__name__}: {exc}"

    write_result_json("telegram_photo_download_test_result.json", telegram_result)
    write_result_json(
        "metadata.json",
        build_metadata_sample(telegram_result, drive_result),
    )
    return 0 if drive_result.get("success") and telegram_result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(_run_and_always_write())
