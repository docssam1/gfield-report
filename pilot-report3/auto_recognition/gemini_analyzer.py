"""
Report3 Auto Recognition V2-C — Gemini Analyzer

Drive 사진들을 Gemini Vision으로 분석합니다.
Preview only: dry_run=True 시 실제 API 호출 없음.

연동 시 필요:
  pip install google-generativeai
  환경변수: GEMINI_API_KEY
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from typing import Optional

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

PROMPT_CLASS_NOTES = """
다음 수업 사진들을 분석해주세요.
1. 핵심 키워드 5개 이내 추출
2. 판서/개념 요약 (1문장)
3. 학생 지식 수준 예측 (상/중/하)
4. 미파악 의심 영역

JSON으로만 응답: {"keywords": [], "summary": "", "level": "", "weak_areas": []}
"""

PROMPT_HOMEWORK_CHECK = """
다음 과제 사진들을 분석해주세요.
1. 전체 문제 수 추정
2. 풀이된 문제 수
3. 오답 패턴 (오배답 유형등)
4. 특이사항

JSON으로만 응답: {"total_problems": 0, "solved": 0, "error_patterns": [], "notes": ""}
"""

PROMPT_MAP = {
    "class_notes":    PROMPT_CLASS_NOTES,
    "homework_check": PROMPT_HOMEWORK_CHECK,
    "test_result":    PROMPT_HOMEWORK_CHECK,  # 유사 구조
    "consultation":   PROMPT_CLASS_NOTES,
}


@dataclass
class AnalysisResult:
    queue_id: str
    entry_type: str
    raw_response: str = ""
    parsed: dict = field(default_factory=dict)
    success: bool = False
    error: str = ""
    dry_run: bool = False

    def to_dict(self):
        return asdict(self)


def analyze_photos(
    queue_id: str,
    entry_type: str,
    photo_paths: list[str],
    dry_run: bool = True,
) -> AnalysisResult:
    """
    사진들을 Gemini Vision으로 분석합니다.

    Args:
        queue_id: 큐 아이템 ID
        entry_type: class_notes | homework_check | ...
        photo_paths: 로컴 사진 경로 리스트
        dry_run: True 시 실제 API 호출 없음

    Returns:
        AnalysisResult
    """
    if dry_run:
        # 더미 분석 결과
        dummy = {
            "class_notes":    {"keywords": ["이차방정식", "그래프"], "summary": "이차함수 관계 학습", "level": "중", "weak_areas": ["그래프 해석"]},
            "homework_check": {"total_problems": 10, "solved": 8, "error_patterns": ["부호 오류"], "notes": "문제 3, 7 오답"},
        }
        result_data = dummy.get(entry_type, dummy["class_notes"])
        print(f"[DRY RUN] Gemini 분석 미실행 | queue_id={queue_id}")
        return AnalysisResult(
            queue_id=queue_id,
            entry_type=entry_type,
            raw_response=json.dumps(result_data, ensure_ascii=False),
            parsed=result_data,
            success=True,
            dry_run=True,
        )

    if not GEMINI_API_KEY:
        return AnalysisResult(
            queue_id=queue_id, entry_type=entry_type,
            success=False, error="GEMINI_API_KEY 환경변수 미설정"
        )

    try:
        import google.generativeai as genai
        from pathlib import Path

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = PROMPT_MAP.get(entry_type, PROMPT_CLASS_NOTES)
        parts = [prompt]

        for path in photo_paths:
            img_bytes = Path(path).read_bytes()
            parts.append({"mime_type": "image/jpeg", "data": img_bytes})

        response = model.generate_content(parts)
        raw = response.text.strip()

        # JSON 파싱
        clean = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean)

        return AnalysisResult(
            queue_id=queue_id,
            entry_type=entry_type,
            raw_response=raw,
            parsed=parsed,
            success=True,
        )

    except Exception as e:
        return AnalysisResult(
            queue_id=queue_id, entry_type=entry_type,
            success=False, error=str(e)
        )


# ---------------------------------------------------------------------------
# dry_run 테스트
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("Gemini Analyzer — dry_run 테스트")
    print("=" * 60)
    for etype in ["class_notes", "homework_check"]:
        r = analyze_photos(
            queue_id=f"test_{etype}",
            entry_type=etype,
            photo_paths=[],
            dry_run=True,
        )
        print(f"\nentry_type={etype}")
        print(json.dumps(r.to_dict(), ensure_ascii=False, indent=2))
