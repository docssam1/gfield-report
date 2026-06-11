"""
Report3 V3 — Homework Check Builder

assigned_homework + 오너 상태 입력 → homework_check JSON 생성.
Preview only: 파일 저장만, 메시지 전송 없음.

출력 형식:
  {
    student_name, date, assigned_homework_source_date,
    check_date, items: [{title, status, note}],
    needs_review, public_allowed: false
  }
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from homework_store import AssignedHomework, HomeworkItem
from status_parser import StatusItem

OUTPUT_DIR = Path(__file__).parent.parent / "output" / "homework_check"


@dataclass
class CheckItem:
    title: str
    status: str       # done | partial | not_done | unknown
    note: str = ""


@dataclass
class HomeworkCheckResult:
    student_name: str
    date: str                         # 확인 기준일 (오늘)
    assigned_homework_source_date: str  # 과제 부여일
    check_date: str                   # 실제 확인한 날짜 ISO 8601
    items: list[CheckItem] = field(default_factory=list)
    needs_review: bool = False
    public_allowed: bool = False      # 학부모 전송 금지 — 항상 False

    def to_dict(self) -> dict:
        return asdict(self)


def build_homework_check(
    assigned: AssignedHomework,
    status_items: list[StatusItem],
    check_date: Optional[str] = None,
) -> HomeworkCheckResult:
    """
    과제 부여 목록 + 상태 입력 → HomeworkCheckResult

    Args:
        assigned: 부여된 과제 목록 (HomeworkStore에서 조회)
        status_items: 오너가 입력한 상태 목록 (StatusParser 결과)
        check_date: 확인 날짜 (없으면 현재 시각)

    Returns:
        HomeworkCheckResult — public_allowed 항상 False
    """
    if not check_date:
        check_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # idx → StatusItem 매핑
    status_map = {s.idx: s for s in status_items}
    needs_review = False
    check_items: list[CheckItem] = []

    for hw in assigned.items:
        s = status_map.get(hw.idx)
        if s is None:
            # 입력 누락 → needs_review
            check_items.append(CheckItem(title=hw.title, status="unknown", note="상태 입력 누락"))
            needs_review = True
        else:
            if s.needs_review:
                needs_review = True
            check_items.append(CheckItem(title=hw.title, status=s.status, note=s.note))

    # 과제 수와 상태 입력 수 불일치 체크
    if len(status_items) > len(assigned.items):
        needs_review = True

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return HomeworkCheckResult(
        student_name=assigned.student_name,
        date=today,
        assigned_homework_source_date=assigned.source_date,
        check_date=check_date,
        items=check_items,
        needs_review=needs_review,
        public_allowed=False,  # 절대 변경 금지
    )


def save_homework_check(result: HomeworkCheckResult) -> Path:
    """HomeworkCheckResult를 JSON으로 저장 (Preview)."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"homework_check_{result.student_name}_{result.date}.json"
    path = OUTPUT_DIR / fname
    path.write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


if __name__ == "__main__":
    from homework_store import HomeworkItem, AssignedHomework
    from status_parser import parse_status_input

    # 샘플 과제 목록
    assigned = AssignedHomework(
        student_name="김주한",
        source_date="2026-06-04",
        items=[
            HomeworkItem(1, "수학 p.45 1~10번"),
            HomeworkItem(2, "영어 단어 암기 20개"),
            HomeworkItem(3, "과학 탐구보고서 초안"),
        ],
    )

    # 오너 입력
    raw_input = """1 완료
2 부분완료 틀린문제 많음
3 미수행"""

    status_items = parse_status_input(raw_input)
    result = build_homework_check(assigned, status_items)
    path = save_homework_check(result)

    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    print(f"\n저장: {path}")
