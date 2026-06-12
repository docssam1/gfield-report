from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
SAMPLE_DIR = BASE_DIR / "sample_data"
PREVIEW_DIR = BASE_DIR.parent / "output" / "assigned"


@dataclass
class HomeworkItem:
    idx: int
    title: str
    source: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AssignedHomework:
    student_name: str
    source_date: str
    items: list[HomeworkItem] = field(default_factory=list)
    created_at: str = ""
    entry_type: str = "assigned_homework"

    def to_dict(self) -> dict:
        return {
            "student_name": self.student_name,
            "source_date": self.source_date,
            "created_at": self.created_at,
            "entry_type": self.entry_type,
            "items": [item.to_dict() for item in self.items],
        }

    def format_for_bot(self) -> str:
        if not self.items:
            return "[PREVIEW] 등록된 과제가 없습니다."

        lines = [f"[PREVIEW] {self.student_name} {self.source_date} 과제 목록"]
        for item in self.items:
            lines.append(f"{item.idx}. {item.title}")
        lines.append("")
        lines.append("상태 입력 예시:")
        lines.append("1 완료")
        lines.append("2 부분")
        lines.append("3 미수행")
        return "\n".join(lines)


def _candidate_paths(student_name: str, source_date: str) -> list[Path]:
    filename = f"assigned_{student_name}_{source_date}.json"
    return [
        SAMPLE_DIR / filename,
        PREVIEW_DIR / filename,
    ]


def _load_path(path: Path) -> AssignedHomework:
    data = json.loads(path.read_text(encoding="utf-8"))
    return AssignedHomework(
        student_name=data["student_name"],
        source_date=data["source_date"],
        items=[HomeworkItem(**item) for item in data.get("items", [])],
        created_at=data.get("created_at", ""),
        entry_type=data.get("entry_type", "assigned_homework"),
    )


def get_assigned_homework(student_name: str, source_date: str) -> AssignedHomework | None:
    for path in _candidate_paths(student_name, source_date):
        if path.exists():
            return _load_path(path)
    return None
