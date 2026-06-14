"""GCS URI → bytes 다운로드.
Preview only: 원본 파일 수정 없음.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class MediaLoadResult:
    success: bool
    data: bytes
    uri: str
    error: str = ""


def load_from_gcs(uri: str) -> MediaLoadResult:
    """
    gs://bucket/path 형식 URI에서 bytes 다운로드.
    원본 파일 수정 없음.
    """
    if not uri.startswith("gs://"):
        return MediaLoadResult(success=False, data=b"", uri=uri,
                               error=f"Invalid GCS URI: {uri}")

    bucket_name = os.environ.get("REPORT3_GCS_BUCKET", "").strip()
    if not bucket_name:
        return MediaLoadResult(success=False, data=b"", uri=uri,
                               error="REPORT3_GCS_BUCKET not set")

    try:
        from google.cloud import storage
        # URI 파싱: gs://bucket/path/to/file
        without_scheme = uri[5:]  # bucket/path/to/file
        slash_idx = without_scheme.index("/")
        blob_name = without_scheme[slash_idx + 1:]

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob   = bucket.blob(blob_name)
        data   = blob.download_as_bytes()
        return MediaLoadResult(success=True, data=data, uri=uri)
    except Exception as e:
        return MediaLoadResult(success=False, data=b"", uri=uri, error=str(e))


def load_media_list(uris: list[str]) -> tuple[list[bytes], list[str]]:
    """
    여러 GCS URI 로드.
    Returns: (성공 bytes 리스트, 실패 URI 리스트)
    """
    payloads: list[bytes] = []
    failed:   list[str]   = []
    for uri in uris:
        r = load_from_gcs(uri)
        if r.success:
            payloads.append(r.data)
        else:
            failed.append(f"{uri}: {r.error}")
    return payloads, failed
