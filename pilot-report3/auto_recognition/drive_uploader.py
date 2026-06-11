"""
Report3 Auto Recognition V2-B — Drive Uploader

세션 그룹의 사진을 Google Drive에 업로드합니다.
Preview only: dry_run=True 시 실제 업로드 없음.

연동 시 필요:
  - Google Drive API (google-api-python-client, google-auth)
  - 서비스 계정 JSON 키
  - 환경변수: GOOGLE_APPLICATION_CREDENTIALS
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass
from typing import Optional

from drive_path_builder import build_drive_path, DrivePath

DRIVE_ROOT_FOLDER_ID = os.environ.get("REPORT3_DRIVE_ROOT_ID", "")  # report3_input 폴더 ID


@dataclass
class UploadResult:
    success: bool
    drive_path: str
    drive_file_id: str = ""
    error: str = ""
    dry_run: bool = False


def _get_drive_service():
    """Google Drive API 서비스 반환."""
    from googleapiclient.discovery import build
    from google.oauth2 import service_account

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    creds = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=["https://www.googleapis.com/auth/drive"],
    )
    return build("drive", "v3", credentials=creds)


def _ensure_folder(service, name: str, parent_id: str) -> str:
    """폴더가 없으면 생성, 있으면 ID 반환."""
    query = (
        f"name='{name}' and mimeType='application/vnd.google-apps.folder'"
        f" and '{parent_id}' in parents and trashed=false"
    )
    res = service.files().list(q=query, fields="files(id,name)").execute()
    files = res.get("files", [])
    if files:
        return files[0]["id"]

    meta = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = service.files().create(body=meta, fields="id").execute()
    return folder["id"]


def _build_folder_chain(service, path_parts: list[str], root_id: str) -> str:
    """경로 세분화하여 폴더 체인 생성."""
    current_id = root_id
    for part in path_parts:
        current_id = _ensure_folder(service, part, current_id)
    return current_id


def upload_photo(
    photo_bytes: bytes,
    file_name: str,
    date: str,
    student_name: str,
    entry_type: str,
    dry_run: bool = True,
) -> UploadResult:
    """
    사진 1장을 Drive에 업로드합니다.

    Args:
        photo_bytes: 사진 원본 바이트
        file_name: 파일명
        date: YYYY-MM-DD
        student_name: 학생 이름
        entry_type: class_notes | homework_check | ...
        dry_run: True 시 실제 업로드 없음 (Preview 모드)

    Returns:
        UploadResult
    """
    drive_path = build_drive_path(date, student_name, entry_type)

    if not drive_path.valid:
        return UploadResult(success=False, drive_path="", error=drive_path.reason)

    if dry_run:
        print(f"[DRY RUN] 업로드 미실행: {drive_path.full_path}{file_name}")
        return UploadResult(
            success=True,
            drive_path=drive_path.full_path + file_name,
            dry_run=True,
        )

    if not DRIVE_ROOT_FOLDER_ID:
        return UploadResult(
            success=False,
            drive_path=drive_path.full_path,
            error="REPORT3_DRIVE_ROOT_ID 환경변수 미설정",
        )

    try:
        service = _get_drive_service()

        # 경로: YYYY-MM-DD / 학생명 / entry_type / photos
        path_parts = [date, student_name, entry_type, "photos"]
        folder_id = _build_folder_chain(service, path_parts, DRIVE_ROOT_FOLDER_ID)

        # 파일 업로드
        media = io.BytesIO(photo_bytes)
        from googleapiclient.http import MediaIoBaseUpload
        media_upload = MediaIoBaseUpload(media, mimetype="image/jpeg")
        meta = {"name": file_name, "parents": [folder_id]}
        uploaded = service.files().create(
            body=meta, media_body=media_upload, fields="id"
        ).execute()

        return UploadResult(
            success=True,
            drive_path=drive_path.full_path + file_name,
            drive_file_id=uploaded["id"],
        )

    except Exception as e:
        return UploadResult(success=False, drive_path=drive_path.full_path, error=str(e))


# ---------------------------------------------------------------------------
# dry_run 테스트
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cases = [
        ("2026-05-06", "김주한", "class_notes",    b"fake_photo_bytes", "photo_001.jpg"),
        ("2026-05-06", "김주한", "homework_check", b"fake_photo_bytes", "photo_002.jpg"),
        ("",           "김주한", "class_notes",    b"fake_photo_bytes", "photo_003.jpg"),  # 오류
    ]
    print("=" * 60)
    print("Drive Uploader — dry_run 테스트")
    print("=" * 60)
    for date, name, etype, data, fname in cases:
        r = upload_photo(data, fname, date, name, etype, dry_run=True)
        print(f"\n{fname}: success={r.success}, path={r.drive_path}, error={r.error}")
