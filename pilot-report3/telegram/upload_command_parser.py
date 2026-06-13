from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date


TYPE_RULES = [
    (("과제", "사진"), "homework_photo", "photos"),
    (("숙제", "사진"), "homework_photo", "photos"),
    (("수업", "사진"), "class_photo", "photos"),
    (("과제", "영상"), "homework_video", "videos"),
    (("숙제", "영상"), "homework_video", "videos"),
    (("수업", "영상"), "class_video", "videos"),
]


@dataclass
class UploadCommand:
    raw_text: str
    student_name: str
    date: str
    entry_type: str
    media_kind: str
    expected_count: int
    needs_review: bool
    review_reason: str

    def to_dict(self) -> dict:
        return asdict(self)


def _infer_year(month: int, day: int) -> int:
    today = date.today()
    candidate = date(today.year, month, day)
    return today.year - 1 if candidate > today else today.year


def _parse_date(text: str) -> tuple[str, bool]:
    match = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", text)
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}", False

    match = re.search(r"\b(\d{1,2})/(\d{1,2})\b", text)
    if not match:
        return "", True

    month = int(match.group(1))
    day = int(match.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return "", True
    year = _infer_year(month, day)
    return f"{year:04d}-{month:02d}-{day:02d}", False


def _parse_expected_count(text: str) -> int:
    match = re.search(r"(\d+)\s*장", text)
    if match:
        return max(1, int(match.group(1)))
    return 1


def _parse_entry_type(text: str) -> tuple[str, str, bool]:
    for keywords, entry_type, media_kind in TYPE_RULES:
        if all(keyword in text for keyword in keywords):
            return entry_type, media_kind, False
    return "unknown", "unknown", True


def _parse_student_name(text: str) -> tuple[str, bool]:
    cleaned = re.sub(r"\d{4}[/-]\d{1,2}[/-]\d{1,2}", " ", text)
    cleaned = re.sub(r"\b\d{1,2}/\d{1,2}\b", " ", cleaned)
    cleaned = re.sub(r"\d+\s*장", " ", cleaned)
    for keywords, _, _ in TYPE_RULES:
        for keyword in keywords:
            cleaned = cleaned.replace(keyword, " ")
    cleaned = cleaned.replace("보내줘", " ").replace("저장", " ").replace("업로드", " ")
    names = re.findall(r"[가-힣]{2,4}", cleaned)
    if not names:
        return "", True
    return names[0], False


def parse_upload_command(text: str) -> UploadCommand:
    normalized = " ".join((text or "").strip().split())
    parsed_date, date_unknown = _parse_date(normalized)
    entry_type, media_kind, type_unknown = _parse_entry_type(normalized)
    student_name, name_unknown = _parse_student_name(normalized)
    expected_count = _parse_expected_count(normalized)

    reasons: list[str] = []
    if date_unknown:
        reasons.append("date_missing_or_invalid")
    if name_unknown:
        reasons.append("student_missing")
    if type_unknown:
        reasons.append("entry_type_unknown")

    return UploadCommand(
        raw_text=normalized,
        student_name=student_name,
        date=parsed_date,
        entry_type=entry_type,
        media_kind=media_kind,
        expected_count=expected_count,
        needs_review=bool(reasons),
        review_reason=";".join(reasons),
    )

