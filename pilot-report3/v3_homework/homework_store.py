"""
Report3 V3 — Homework Store

assigned_homework JSON 저장 및 조회.
Preview only: 파일 기반 로컬 저장소. 실서비스에서는 Drive/DB 연동.

저장 경로:
  pilot-report3/output/assigned/{student_name}_{YYYY-MM-DD}.json

조회:
  get_assigned_homework(student_name, date) → dict | None
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
    idx: int           # 1-based 번호
    title: str         # 과제 내용
    source: str = ""   # 출처 (수업사진 분석 등)


@dataclass
class AssignedHomework:
    student_name: str
    source_date: str            # 과제 부여일 YYYY-MM-DD
    items: list[HomeworkItem] = field(default_factory=list)
    created_at: str = ""
    entry_type: str = "assigned_homework"

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    def format_for_bot(self) -> str:
        """텔레봇 응답용 번호 목록 문자열."""
        if not self.items:
            return "등록된 과제가 없습니다."
        lines = [f"📋 {self.student_name} ({self.source_date}) 과제 목록\n"]
        for item in self.items:
            lines.append(f"{item.idx}. {item.title}")
        lines.append("\n상태 입력: 1 완료 / 2 부분완료 [메모] / 3 미수행")
        return "\n".join(lines)


def save_assigned_homework(hw: AssignedHomework) -> Path:
    """AssignedHomework를 로컬 JSON으로 저장 (Preview)."""
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"assigned_{hw.student_name}_{hw.source_date}.json"
    path = STORE_DIR / fname
    if not hw.created_at:
        hw.created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path.write_text(json.dumps(hw.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def get_assigned_homework(student_name: str, source_date: str) -> Optional[AssignedHomework]:
    """저장된 AssignedHomework 조회. 없으면 None."""
    fname = f"assigned_{student_name}_{source_date}.json"
    path = STORE_DIR / fname
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


if __name__ == "__main__":
    # 샘플 저장 테스트
    hw = AssignedHomework(
        student_name="김주한",
        source_date="2026-06-04",
        items=[
            HomeworkItem(1, "수학 p.45 1~10번"),
            HomeworkItem(2, "영어 단어 암기 20개"),
            HomeworkItem(3, "과학 탐구보고서 초안"),
        ],
    )
    path = save_assigned_homework(hw)
    print(f"저장: {path}")
    print(hw.format_for_bot())

    # 조회 테스트
    loaded = get_assigned_homework("김주한", "2026-06-04")
    if loaded:
        print(f"\n조회 성공: {loaded.student_name} / {len(loaded.items)}개")
