"""
Report3 Auto Recognition V1 — Session Detector

Telegram 텍스트에서 세션 정보를 인식합니다.
Preview only: 어떤 외부 시스템도 수정하지 않습니다.

사용 예시:
    from session_detector import detect_session
    result = detect_session("5/6 김주한 수업내용")
"""

import re
from datetime import datetime, date
from typing import Optional
from dataclasses import dataclass, asdict

ENTRY_TYPE_MAP = {
    "수업내용": "class_notes",
    "과제확인": "homework_check",
    "시험결과": "test_result",
    "상담내용": "consultation",
    "테스트":   "test_result",
    "과제":     "homework_check",
    "수업":     "class_notes",
}


@dataclass
class SessionResult:
    date: str
    student_name: str
    entry_type: str
    raw_type: str
    year_inferred: bool
    needs_review: bool
    raw_text: str
    detected_at: str

    def to_dict(self) -> dict:
        return asdict(self)


def _infer_year(month: int, day: int) -> int:
    today = date.today()
    try:
        candidate = date(today.year, month, day)
    except ValueError:
        return today.year
    if candidate > today:
        return today.year - 1
    return today.year


def _parse_date(text: str):
    m = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d).strftime("%Y-%m-%d"), False
        except ValueError:
            return None, False
    m = re.search(r'\b(\d{1,2})/(\d{1,2})\b', text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            y = _infer_year(mo, d)
            try:
                return date(y, mo, d).strftime("%Y-%m-%d"), True
            except ValueError:
                return None, False
    return None, False


def _parse_entry_type(text: str):
    for keyword, etype in ENTRY_TYPE_MAP.items():
        if keyword in text:
            return etype, keyword, False
    return "unknown", "", True


def _parse_student_name(text: str):
    cleaned = text
    cleaned = re.sub(r'\d{4}[/-]\d{1,2}[/-]\d{1,2}', '', cleaned)
    cleaned = re.sub(r'\b\d{1,2}/\d{1,2}\b', '', cleaned)
    for keyword in ENTRY_TYPE_MAP:
        cleaned = cleaned.replace(keyword, '')
    names = re.findall(r'[가-힣]{2,4}', cleaned)
    if not names:
        return None, True
    return names[0], False


def detect_session(text: str) -> SessionResult:
    """
    Telegram 텍스트에서 세션 정보를 인식합니다.

    예: "5/6 김주한 수업내용" →
    {
      "date": "2026-05-06",
      "student_name": "김주한",
      "entry_type": "class_notes",
      "raw_type": "수업내용",
      "year_inferred": true,
      "needs_review": false
    }
    """
    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    needs_review = False

    parsed_date, year_inferred = _parse_date(text)
    if parsed_date is None:
        needs_review = True
        parsed_date = ""

    entry_type, raw_type, type_unknown = _parse_entry_type(text)
    if type_unknown:
        needs_review = True

    student_name, name_unknown = _parse_student_name(text)
    if name_unknown or not student_name:
        needs_review = True
        student_name = student_name or ""

    return SessionResult(
        date=parsed_date,
        student_name=student_name,
        entry_type=entry_type,
        raw_type=raw_type,
        year_inferred=year_inferred,
        needs_review=needs_review,
        raw_text=text,
        detected_at=now_iso,
    )


if __name__ == "__main__":
    import json
    for tc in ["5/6 김주한 수업내용", "5/6 김주한 과제확인", "2026/05/06 이수진 시험결과", "김철수 수업", "hello"]:
        print(json.dumps(detect_session(tc).to_dict(), ensure_ascii=False, indent=2))
