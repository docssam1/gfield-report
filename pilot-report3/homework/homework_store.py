"""
Report3 V3 — Homework Store

assigned_homework JSON 저장 및 조회.
Preview only: 로컬 파일 기반. 실서비스에서는 Drive/DB 연동.

저장 경로:
  pilot-report3/output/assigned/assigned_{student}_{YYYY-MM-DD}.json
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

STORE_DIR = Path(__file__).parent.parent / "output" / "assigned"


@dataclass
class HomeworkItem:
    idx: int
    title: str
    source: str = ""

    def __dict__(self):
        return asdict(self) if hasattr(self, '__dataclass_fields__') else self.__dict__


@dataclass
class AssignedHomework:
    student_name: str
    source_date: str
    items: list = field(default_factory=list)
    created_at: str = ""
    entry_type: str = "assigned_homework"

    def to_dict(self) -> dict:
        return {
            "student_name": self.student_name,
            "source_date": self.source_date,
            "entry_type": self.entry_type,
            "created_at": self.created_at,
            "items": [i.__dict__ if not isinstance(i, dict) else i for i in self.items]
                     if self.items and not isinstance(self.items[0], dict)
                     else self.items,
        }

    def format_for_bot(self) -> str:
        """텔레봇 응답용 번호 목록 문자열."""
        if not self.items:
            return "등록된 과제가 없습니다."
        lines = [f"📋 {self.student_name} ({self.source_date}) 과제 목록\n"]
        for item in self.items:
            title = item.title if hasattr(item, 'title') else item.get('title', '')
            idx   = item.idx   if hasattr(item, 'idx')   else item.get('idx', 0)
            lines.append(f"{idx}. {title}")
        lines.append("\n상태 입력: 1 완료 / 2 부분완료 [메모] / 3 미수행")
        return "\n".join(lines)


def save_assigned_homework(hw: AssignedHomework) -> Path:
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    if not hw.created_at:
        hw.created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path = STORE_DIR / f"assigned_{hw.student_name}_{hw.source_date}.json"
    path.write_text(json.dumps(hw.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def get_assigned_homework(student_name: str, source_date: str) -> Optional[AssignedHomework]:
    """저장된 AssignedHomework 조회. 없으면 None."""
    path = STORE_DIR / f"assigned_{student_name}_{source_date}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    items = [HomeworkItem(**i) for i in data.get("items", [])]
    return AssignedHomework(
        student_name=data["student_name"],
        source_date=data["source_date"],
        items=items,
        created_at=data.get("created_at", ""),
    )
