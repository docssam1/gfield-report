from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from homework_store import AssignedHomework
from status_parser import StatusItem


@dataclass
class CheckItem:
    idx: int
    title: str
    status: str
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class HomeworkCheckPreview:
    student_name: str
    date: str
    assigned_homework_source_date: str
    check_date: str
    items: list[CheckItem] = field(default_factory=list)
    needs_review: bool = False
    public_allowed: bool = False

    def to_dict(self) -> dict:
        return {
            "student_name": self.student_name,
            "date": self.date,
            "assigned_homework_source_date": self.assigned_homework_source_date,
            "check_date": self.check_date,
            "items": [item.to_dict() for item in self.items],
            "needs_review": self.needs_review,
            "public_allowed": self.public_allowed,
        }


def build_homework_check(
    assigned: AssignedHomework,
    status_items: list[StatusItem],
) -> HomeworkCheckPreview:
    status_map = {item.idx: item for item in status_items}
    preview_items: list[CheckItem] = []
    needs_review = False

    for hw_item in assigned.items:
        status_item = status_map.get(hw_item.idx)
        if status_item is None:
            preview_items.append(
                CheckItem(
                    idx=hw_item.idx,
                    title=hw_item.title,
                    status="unknown",
                    note="status_missing",
                )
            )
            needs_review = True
            continue

        if status_item.needs_review:
            needs_review = True

        preview_items.append(
            CheckItem(
                idx=hw_item.idx,
                title=hw_item.title,
                status=status_item.status,
                note=status_item.note,
            )
        )

    if len(status_items) != len(assigned.items):
        needs_review = True

    return HomeworkCheckPreview(
        student_name=assigned.student_name,
        date=assigned.source_date,
        assigned_homework_source_date=assigned.source_date,
        check_date=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        items=preview_items,
        needs_review=needs_review,
        public_allowed=False,
    )
