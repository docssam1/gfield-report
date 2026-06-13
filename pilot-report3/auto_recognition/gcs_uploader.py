from __future__ import annotations

import os
from dataclasses import dataclass

from drive_path_builder import build_drive_path

GCS_BUCKET_NAME = os.environ.get("REPORT3_GCS_BUCKET", "").strip()


@dataclass
class UploadResult:
    success: bool
    drive_path: str
    drive_file_id: str = ""
    error: str = ""
    dry_run: bool = False


def _get_storage_client():
    from google.cloud import storage

    return storage.Client()


def upload_photo(
    photo_bytes: bytes,
    file_name: str,
    date: str,
    student_name: str,
    entry_type: str,
    dry_run: bool = True,
) -> UploadResult:
    object_path = build_drive_path(date, student_name, entry_type)
    if not object_path.valid:
        return UploadResult(success=False, drive_path="", error=object_path.reason)

    full_object_name = f"{object_path.full_path}{file_name}"

    if dry_run:
        return UploadResult(
            success=True,
            drive_path=full_object_name,
            dry_run=True,
        )

    if not GCS_BUCKET_NAME:
        return UploadResult(
            success=False,
            drive_path=full_object_name,
            error="REPORT3_GCS_BUCKET environment variable is missing",
        )

    try:
        client = _get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(full_object_name)
        blob.upload_from_string(photo_bytes, content_type="image/jpeg")
        return UploadResult(
            success=True,
            drive_path=full_object_name,
            drive_file_id=f"gs://{GCS_BUCKET_NAME}/{full_object_name}",
        )
    except Exception as exc:
        return UploadResult(
            success=False,
            drive_path=full_object_name,
            error=str(exc),
        )
