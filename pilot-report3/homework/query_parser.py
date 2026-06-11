"""
Report3 V3 — Query Parser

오너 텍스트에서 과제 조회/확인 의도를 파싱합니다.
Preview only.

지원 패턴:
  "김주한 6/4 과제 불러와줘"         → intent=recall_homework
  "김주한 6/4 과제확인 불러와줘"      → intent=recall_homework_check
  "김주한 6/4 수업내용 불러와줘"      → intent=recall_class_notes
  "김주한 6/4 과제 등록해줘"          → intent=register_homework
"""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from datetime import datetime, date
from typing import Optional


INTENT_MAP = [
    (r"과제확인.*불러",           "homework_check",   "recall_homework_check"),
    (r"과제.*불러",               "assigned_homework", "recall_homework"),
    (r"수업내용.*불러|수업.*불러", "class_notes",       "recall_class_notes"),
    (r"시험.*불러",               "test_result",       "recall_test_result"),
    (r"과제확인",                 "homework_check",   "register_homework_check"),
    (r"과제",                     "assigned_homework", "register_homework"),
    (r"수업내용|수업",             "class_notes",       "register_class_notes"),
]

STOP_WORDS = [
    "불러와줘", "불러와", "불러줘", "등록해줘", "확인해줘",
    "과제확인", "수업내용", "시험결과", "상담내용", "과제", "수업",
]


@dataclass
class RecallQuery:
    student_name: str
    date: str                # YYYY-MM-DD
    entry_type: str
    intent: str
    year_inferred: bool
    needs_review: bool
    raw_text: str
    parsed_at: str

    def to_dict(self) -> dict:
        return asdict(self)


def _infer_year(month: int, day: int) -> int:
    today = date.today()
    try:
        candidate = date(today.year, month, day)
    except ValueError:
        return today.year
    return today.year - 1 if candidate > today else today.year


def _parse_date(text: str):
    m = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d).strftime("%Y-%m-%d"), False
        except ValueError:
            return None, False
    m = re.search(r'\b(\d{1,2})[/-](\d{1,2})\b', text)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            y = _infer_year(mo, d)
            try:
                return date(y, mo, d).strftime("%Y-%m-%d"), True
            except ValueError:
                return None, False
    return None, False


def _parse_intent(text: str):
    for pattern, etype, intent in INTENT_MAP:
        if re.search(pattern, text):
            return etype, intent
    return "unknown", "unknown"


def _parse_student(text: str) -> Optional[str]:
    cleaned = re.sub(r'\d{4}[/-]\d{1,2}[/-]\d{1,2}', '', text)
    cleaned = re.sub(r'\b\d{1,2}[/-]\d{1,2}\b', '', cleaned)
    for w in sorted(STOP_WORDS, key=len, reverse=True):
        cleaned = cleaned.replace(w, '')
    names = re.findall(r'[가-힣]{2,4}', cleaned)
    return names[0] if names else None


def parse_query(text: str) -> RecallQuery:
    """
    오너 텍스트 → RecallQuery

    예:
        parse_query("김주한 6/4 과제 불러와줘")
        → RecallQuery(student_name='김주한', date='2026-06-04',
                      entry_type='assigned_homework', intent='recall_homework')
    """
    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    needs_review = False

    parsed_date, year_inferred = _parse_date(text)
    if not parsed_date:
        needs_review = True
        parsed_date = ""

    entry_type, intent = _parse_intent(text)
    if intent == "unknown":
        needs_review = True

    student_name = _parse_student(text)
    if not student_name:
        needs_review = True
        student_name = ""

    return RecallQuery(
        student_name=student_name,
        date=parsed_date,
        entry_type=entry_type,
        intent=intent,
        year_inferred=year_inferred,
        needs_review=needs_review,
        raw_text=text,
        parsed_at=now_iso,
    )


if __name__ == "__main__":
    import json
    cases = [
        "김주한 6/4 과제 불러와줘",
        "김주한 6/4 과제확인 불러와줘",
        "김주한 6/4 수업내용 불러와줘",
        "이수진 5/20 시험결과 불러와줘",
        "김주한 6/4 과제 등록해줘",
        "불러와줘",
    ]
    print("=" * 60)
    for tc in cases:
        r = parse_query(tc)
        print(f"입력: {tc!r}")
        print(f"  → intent={r.intent}, student={r.student_name}, date={r.date}, needs_review={r.needs_review}")
