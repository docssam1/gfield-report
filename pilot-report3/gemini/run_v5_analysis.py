"""V5 분석 단독 실행 스크립트.

사용법:
  # dry_run (기본)
  python run_v5_analysis.py

  # metadata.json 지정
  python run_v5_analysis.py --metadata path/to/metadata.json

  # 실제 Gemini API 호출
  python run_v5_analysis.py --no-dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SYS_PATH = Path(__file__).resolve().parent
if str(SYS_PATH) not in sys.path:
    sys.path.insert(0, str(SYS_PATH))

from gemini_analyzer_v5 import analyze_session
from analysis_preview_writer import write_preview

DEFAULT_METADATA = Path(__file__).parent.parent / "telegram" / "test_outputs" / "metadata.json"

# fallback 샘플 metadata (metadata.json 없을 때)
SAMPLE_METADATA = {
    "preview_only": True,
    "student_name": "김주한",
    "source_date": "2026-06-02",
    "entry_type": "homework_photo",
    "media_kind": "photos",
    "storage": {
        "backend": "gcs",
        "path": "report3_input/2026-06-02/김주한/homework_photo/photos/",
        "uri": "gs://gfield-report3-pilot-0995737435/report3_input/2026-06-02/김주한/homework_photo/photos/homework_photo_35.jpg"
    },
    "session": {
        "expected_count": 1,
        "uploaded_count": 1,
        "all_message_ids": ["35"],
        "stored_items": [
            {"message_id": "35",
             "uri": "gs://gfield-report3-pilot-0995737435/report3_input/2026-06-02/김주한/homework_photo/photos/homework_photo_35.jpg"}
        ],
        "needs_review": False,
    },
    "safety": {
        "db_updated": False,
        "parent_message_sent": False,
        "final_report_generated": False,
    }
}


def main():
    parser = argparse.ArgumentParser(description="V5 Gemini Analysis")
    parser.add_argument("--metadata", default="", help="metadata.json 경로")
    parser.add_argument("--no-dry-run", action="store_true", help="실제 Gemini API 호출")
    args = parser.parse_args()

    # metadata 로드
    meta_path = Path(args.metadata) if args.metadata else DEFAULT_METADATA
    if meta_path.exists():
        metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        print(f"[V5] metadata 로드: {meta_path}")
    else:
        metadata = SAMPLE_METADATA
        print(f"[V5] metadata.json 없음 → 샘플 사용")

    dry_run = not args.no_dry_run
    print(f"[V5] dry_run={dry_run}")

    result = analyze_session(metadata, dry_run=dry_run)
    path   = write_preview(result)

    print(f"[V5] 완료: {path}")
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    return 0 if not result.needs_review else 1


if __name__ == "__main__":
    raise SystemExit(main())
