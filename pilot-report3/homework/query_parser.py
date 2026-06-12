from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date, datetime


@dataclass
class RecallQuery:
    student_name: str
    date: str
    entry_type: str
    intent: str
    year_inferred: bool
    needs_review: bool
    raw_text: str
    parsed_at: str

    def to_dict(self) -> dict:
        return asdict(self)


INTENT_PATTERNS = [
    (r"과제\s*확인.*불러", "homework_check", "recall_homework_check"),
    (r"과제.*불러", "assigned_homework", "recall_homework"),
    (r"수업\s*내용.*불러|수업.*불러", "class_notes", "recall_class_notes"),
]

STOP_WORDS = [
    "불러와줘",
    "불러 주세요",
    "불러줘",
    "불러",
    "과제확인",
    "과제 확인",
    "수업내용",
    "수업 내용",
    "과제",
    "수업",
]


def _infer_year(month: int, day: int) -> int:
    today = date.today()
    candidate = date(today.year, month, day)
    return today.year - 1 if candidate > today else today.year


def _parse_date(text: str) -> tuple[str, bool]:
    full = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", text)
    if full:
        y, m, d = map(int, full.groups())
        return date(y, m, d).strftime("%Y-%m-%d"), False

    short = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b", text)
    if short:
        m, d = map(int, short.groups())
        return date(_infer_year(m, d), m, d).strftime("%Y-%m-%d"), True

    return "", False


def _parse_intent(text: str) -> tuple[str, str]:
    for pattern, entry_type, intent in INTENT_PATTERNS:
        if re.search(pattern, text):
            return entry_type, intent
    return "unknown", "unknown"


def _parse_student(text: str) -> str:
    cleaned = re.sub(r"\d{4}[/-]\d{1,2}[/-]\d{1,2}", "", text)
    cleaned = re.sub(r"\b\d{1,2}[/-]\d{1,2}\b", "", cleaned)
    for word in STOP_WORDS:
        cleaned = cleaned.replace(word, "")
    names = re.findall(r"[가-힣]{2,4}", cleaned)
    return names[0] if names else ""


def parse_query(text: str) -> RecallQuery:
    parsed_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_type, intent = _parse_intent(text)
    parsed_date, year_inferred = _parse_date(text)
    student_name = _parse_student(text)

    needs_review = False
    if intent == "unknown" or not parsed_date or not student_name:
        needs_review = True

    return RecallQuery(
        student_name=student_name,
        date=parsed_date,
        entry_type=entry_type,
        intent=intent,
        year_inferred=year_inferred,
        needs_review=needs_review,
        raw_text=text,
        parsed_at=parsed_at,
    )
