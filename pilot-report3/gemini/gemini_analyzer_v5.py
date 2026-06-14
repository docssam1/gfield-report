"""V5 Gemini Vision 분석기.
Preview only. dry_run=True 시 실제 API 호출 없음.
API 키 없으면 자동 dry_run fallback.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

from analysis_prompts import get_prompt
from gcs_media_loader import load_media_list

MODEL = "gemini-1.5-flash"

DRY_RUN_PARSED = {
    "homework_photo_analysis": {
        "problems": [
            {
                "number": "1",
                "student_answer": "x = 3",
                "correct": None,
                "error_type": "판독불가",
                "correction_candidate": "풀이 과정 확인 필요",
                "comment_candidate": "계산 과정을 더 자세히 써보세요"
            }
        ],
        "overall_completion": "부분완료",
        "needs_teacher_review": True,
        "summary": "[DRY RUN] 과제 분석 더미 데이터"
    },
    "class_photo_analysis": {
        "keywords": ["이차방정식", "근의공식", "판별식"],
        "board_summary": "[DRY RUN] 이차방정식 풀이 수업 판서 내용입니다.",
        "topic": "이차방정식",
        "difficulty": "중",
        "needs_teacher_review": False,
        "summary": "[DRY RUN] 수업 내용 더미 데이터"
    }
}


@dataclass
class AnalysisResult:
    student_name: str
    source_date: str
    entry_type: str
    media_count: int
    media_paths: list[str]
    analysis_kind: str
    raw_response: str
    parsed: dict
    needs_review: bool
    review_reason: str
    analyzed_at: str
    model: str
    dry_run: bool
    safety: dict = field(default_factory=lambda: {
        "db_updated": False,
        "parent_message_sent": False,
        "final_report_generated": False,
    })

    def to_dict(self) -> dict:
        return asdict(self)


def analyze_session(
    metadata: dict,
    dry_run: Optional[bool] = None,
) -> AnalysisResult:
    """
    V4 metadata.json 기반으로 Gemini 분석 수행.

    Args:
        metadata: V4 출력 metadata.json dict
        dry_run: None이면 GEMINI_API_KEY 유무로 자동 결정

    Returns:
        AnalysisResult
    """
    now_iso      = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    student_name = metadata.get("student_name", "")
    source_date  = metadata.get("source_date", "")
    entry_type   = metadata.get("entry_type", "")
    session      = metadata.get("session", {})
    storage      = metadata.get("storage", {})

    # 미디어 URI 목록
    stored_items = session.get("stored_items") or []
    if stored_items:
        media_paths = [i.get("uri", "") for i in stored_items if i.get("uri")]
    else:
        uri = storage.get("uri", "")
        media_paths = [uri] if uri else []

    prompt, analysis_kind = get_prompt(entry_type)

    # dry_run 자동 결정
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if dry_run is None:
        dry_run = not bool(api_key)

    # dry_run 처리
    if dry_run:
        parsed = DRY_RUN_PARSED.get(analysis_kind,
                                     DRY_RUN_PARSED["class_photo_analysis"]).copy()
        return AnalysisResult(
            student_name=student_name,
            source_date=source_date,
            entry_type=entry_type,
            media_count=len(media_paths),
            media_paths=media_paths,
            analysis_kind=analysis_kind,
            raw_response=json.dumps(parsed, ensure_ascii=False),
            parsed=parsed,
            needs_review=parsed.get("needs_teacher_review", False),
            review_reason="dry_run" if not parsed.get("needs_teacher_review") else "needs_teacher_review",
            analyzed_at=now_iso,
            model=MODEL,
            dry_run=True,
        )

    # 실제 GCS 다운로드
    payloads, failed = load_media_list(media_paths)
    if not payloads:
        return AnalysisResult(
            student_name=student_name, source_date=source_date,
            entry_type=entry_type, media_count=0, media_paths=media_paths,
            analysis_kind=analysis_kind, raw_response="", parsed={},
            needs_review=True,
            review_reason=f"GCS 다운로드 실패: {'; '.join(failed)}",
            analyzed_at=now_iso, model=MODEL, dry_run=False,
        )

    # Gemini API 호출
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL)

        parts = [prompt]
        for data in payloads:
            parts.append({"mime_type": "image/jpeg", "data": data})

        response = model.generate_content(parts)
        raw = response.text.strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean)
        needs_review = bool(parsed.get("needs_teacher_review", False) or failed)
        review_reason = "; ".join(
            (["needs_teacher_review"] if parsed.get("needs_teacher_review") else []) +
            ([f"load_failed: {', '.join(failed)}"] if failed else [])
        )
        return AnalysisResult(
            student_name=student_name, source_date=source_date,
            entry_type=entry_type, media_count=len(payloads),
            media_paths=media_paths, analysis_kind=analysis_kind,
            raw_response=raw, parsed=parsed,
            needs_review=needs_review, review_reason=review_reason,
            analyzed_at=now_iso, model=MODEL, dry_run=False,
        )
    except Exception as e:
        return AnalysisResult(
            student_name=student_name, source_date=source_date,
            entry_type=entry_type, media_count=len(payloads),
            media_paths=media_paths, analysis_kind=analysis_kind,
            raw_response="", parsed={},
            needs_review=True, review_reason=f"Gemini 오류: {e}",
            analyzed_at=now_iso, model=MODEL, dry_run=False,
        )
