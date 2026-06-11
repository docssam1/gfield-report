"""
Report3 Auto Recognition V1 — Photo Grouping

규칙:
 - 세션 텍스트 후 10분 이내 수신된 사진 → 해당 세션 귀속
 - 세션 없음 or 10분 초과 → needs_review=true
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

SESSION_WINDOW_SECONDS = 600


@dataclass
class TelegramPhoto:
    telegram_message_id: str
    timestamp: str
    file_id: str
    file_name: str


@dataclass
class PhotoGroup:
    session_date: str
    student_name: str
    entry_type: str
    photos: list = field(default_factory=list)
    needs_review: bool = False
    review_reason: str = ""
    session_message_id: str = ""
    session_detected_at: str = ""
    grouped_at: str = ""

    def photo_count(self):
        return len(self.photos)

    def to_dict(self):
        d = asdict(self)
        d["photo_count"] = self.photo_count()
        return d


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def group_photos(photos, session_message_id, session_detected_at,
                 session_date, student_name, entry_type,
                 window_seconds=SESSION_WINDOW_SECONDS) -> PhotoGroup:
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    group = PhotoGroup(
        session_date=session_date, student_name=student_name,
        entry_type=entry_type, session_message_id=session_message_id,
        session_detected_at=session_detected_at, grouped_at=now_iso,
    )
    if not session_detected_at:
        group.needs_review = True
        group.review_reason = "세션 메시지 없음"
        group.photos = photos
        return group

    session_dt = _parse_iso(session_detected_at)
    accepted, rejected = [], 0
    for photo in photos:
        delta = (_parse_iso(photo.timestamp) - session_dt).total_seconds()
        if 0 <= delta <= window_seconds:
            accepted.append(photo)
        else:
            rejected += 1
    group.photos = accepted
    if rejected > 0:
        group.needs_review = True
        group.review_reason = f"{rejected}장이 {window_seconds//60}분 창 밖: 수동 확인 필요"
    return group


def group_photos_no_session(photos) -> PhotoGroup:
    return PhotoGroup(
        session_date="", student_name="", entry_type="unknown",
        photos=photos, needs_review=True,
        review_reason="선행 세션 메시지 없이 사진만 수신됨",
        grouped_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
