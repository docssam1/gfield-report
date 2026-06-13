"""
Report3 V3 — Check Builder

assigned_homework + 상태 입력 → homework_check JSON 생성.
Preview only: 로컬 저장만, 메시지 전송 없음.
public_allowed 항상 false.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from homework_store import AssignedHomework
from status_parser import StatusItem

OUTPUT_DIR = Path(__file__).parent.parent / "output" / "homework_check"


@dataclass
class CheckItem:
    title: str
    status: str
    note: str = ""


@dataclass
class HomeworkCheckResult:
    student_name: str
    date: str
    assigned_homework_source_date: str
    check_date: str
    items: list = field(default_factory=list)
    needs_review: bool = False
    public_allowed: bool = False   # 항상 False — 학부모 전송 금지

    def to_dict(self) -> dict:
        return {
            "student_name":                  self.student_name,
            "date":                          self.date,
            "assigned_homework_source_date": self.assigned_homework_source_date,
            "check_date":                    self.check_date,
            "items":                         [asdict(i) if isinstance(i, CheckItem) else i
                                              for i in self.items],
            "needs_review":                  self.needs_review,
            "public_allowed":                False,  # 절대 True 가능 안 함
        }


def build_homework_check(
    assigned: AssignedHomework,
    status_items: list[StatusItem],
    check_date: Optional[str] = None,
) -> HomeworkCheckResult:
    """
    과제 부여 목록 + 상태 입력 → HomeworkCheckResult

    Args:
        assigned: HomeworkStore에서 조회한 부여 과제
        status_items: StatusParser 결과
        check_date: 확인 날짜 (None이면 현재시각)

    Returns:
        HomeworkCheckResult — public_allowed 항상 False
    """
    if not check_date:
        check_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    status_map = {s.idx: s for s in status_items}
    needs_review = False
    check_items: list[CheckItem] = []

    for hw in assigned.items:
        idx   = hw.idx   if hasattr(hw, 'idx')   else hw.get('idx', 0)
        title = hw.title if hasattr(hw, 'title') else hw.get('title', '')
        s = status_map.get(idx)
        if s is None:
            check_items.append(CheckItem(title=title, status="unknown", note="상태 입력 누락"))
            needs_review = True
        else:
            if s.needs_review:
                needs_review = True
            check_items.append(CheckItem(title=title, status=s.status, note=s.note))

    if len(status_items) > len(assigned.items):
        needs_review = True

    return HomeworkCheckResult(
        student_name=assigned.student_name,
        date=today,
        assigned_homework_source_date=assigned.source_date,
        check_date=check_date,
        items=check_items,
        needs_review=needs_review,
        public_allowed=False,
    )


def save_homework_check(result: HomeworkCheckResult) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"homework_check_{result.student_name}_{result.date}.json"
    path.write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_homework_check(student_name: str, date: str) -> Optional[dict]:
    path = OUTPUT_DIR / f"homework_check_{student_name}_{date}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    from homework_store import HomeworkItem, AssignedHomework
    from status_parser import parse_status_input

    assigned = AssignedHomework(
        student_name="김주한",
        source_date="2026-06-04",
        items=[
            HomeworkItem(1, "수학 p.45 1~10번"),
            HomeworkItem(2, "영어 단어 암기 20개"),
            HomeworkItem(3, "과학 탐구보고서 초안"),
        ],
    )
    status_items = parse_status_input("1 완료\n2 부분완료 틀린문제 많음\n3 미수행")
    result = build_homework_check(assigned, status_items)
    path = save_homework_check(result)
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    print(f"\n저장: {path}")
