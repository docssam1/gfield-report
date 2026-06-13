from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date


# (keywords, entry_type, media_kind)
# media_kind: "photos" | "video_link" | "video_file"
TYPE_RULES = [
    (("과제", "사진"),  "homework_photo",  "photos"),
    (("숙제", "사진"),  "homework_photo",  "photos"),
    (("수업", "사진"),  "class_photo",     "photos"),
    (("과제", "영상"),  "homework_video",  "video_link"),
    (("숙제", "영상"),  "homework_video",  "video_link"),
    (("수업", "영상"),  "class_video",     "video_link"),
    # V4-2: 링크 없이 "영상" 만 있으면 video_file (직접 업로드)
    (("과제", "동영상"), "homework_video",  "video_file"),
    (("수업", "동영상"), "class_video",     "video_file"),
    (("동영상",),       "class_video",     "video_file"),
]


@dataclass
class UploadCommand:
    raw_text: str
    student_name: str
    date: str
    entry_type: str
    media_kind: str   # photos | video_link | video_file
    link_url: str
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
    m = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", text)
    if m:
        return (
            f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}",
            False,
        )
    m = re.search(r"\b(\d{1,2})/(\d{1,2})\b", text)
    if not m:
        return "", True
    mo, d = int(m.group(1)), int(m.group(2))
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return "", True
    return f"{_infer_year(mo, d):04d}-{mo:02d}-{d:02d}", False


def _parse_expected_count(text: str) -> int:
    m = re.search(r"(\d+)\s*장", text)
    return max(1, int(m.group(1))) if m else 1


def _parse_entry_type(text: str) -> tuple[str, str, bool]:
    # 링크가 있으면 video_link 우선
    has_link = bool(re.search(r"https?://\S+", text))
    for keywords, entry_type, media_kind in TYPE_RULES:
        if all(k in text for k in keywords):
            # 링크 없이 video_link 규칙에 걸리면 video_file 로 전환
            if media_kind == "video_link" and not has_link:
                return entry_type, "video_file", False
            return entry_type, media_kind, False
    # 영상/동영상 단어만 있고 키워드 조합이 없으면 video_file
    if re.search(r"영상|동영상", text) and not has_link:
        return "class_video", "video_file", False
    return "unknown", "unknown", True


def _parse_link_url(text: str) -> str:
    m = re.search(r"(https?://\S+)", text)
    return m.group(1) if m else ""


def _parse_student_name(text: str) -> tuple[str, bool]:
    cleaned = re.sub(r"\d{4}[/-]\d{1,2}[/-]\d{1,2}", " ", text)
    cleaned = re.sub(r"\b\d{1,2}/\d{1,2}\b", " ", cleaned)
    cleaned = re.sub(r"\d+\s*장", " ", cleaned)
    cleaned = re.sub(r"https?://\S+", " ", cleaned)
    for keywords, _, _ in TYPE_RULES:
        for kw in keywords:
            cleaned = cleaned.replace(kw, " ")
    for w in ("보내줘", "저장", "업로드", "링크", "영상", "동영상", "사진"):
        cleaned = cleaned.replace(w, " ")
    names = re.findall(r"[가-힣]{2,4}", cleaned)
    return (names[0], False) if names else ("", True)


def parse_upload_command(text: str) -> UploadCommand:
    normalized = " ".join((text or "").strip().split())
    parsed_date, date_unknown     = _parse_date(normalized)
    entry_type, media_kind, type_unknown = _parse_entry_type(normalized)
    student_name, name_unknown    = _parse_student_name(normalized)
    link_url                      = _parse_link_url(normalized)
    expected_count                = _parse_expected_count(normalized)

    reasons: list[str] = []
    if date_unknown:   reasons.append("date_missing_or_invalid")
    if name_unknown:   reasons.append("student_missing")
    if type_unknown:   reasons.append("entry_type_unknown")
    if media_kind == "video_link" and not link_url:
        reasons.append("video_link_missing")

    return UploadCommand(
        raw_text=normalized,
        student_name=student_name,
        date=parsed_date,
        entry_type=entry_type,
        media_kind=media_kind,
        link_url=link_url,
        expected_count=expected_count,
        needs_review=bool(reasons),
        review_reason=";".join(reasons),
    )
