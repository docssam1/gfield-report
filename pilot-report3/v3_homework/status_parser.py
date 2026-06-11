"""
Report3 V3 — Status Parser

오너가 입력한 과제 상태 텍스트를 파싱합니다.
Preview only.

입력 예:
  "1 완료"
  "2 부분완료 틀린문제 많음"
  "3 미수행"
  "1완료\n2부분\n3안함"

출력:
  [
    {"idx": 1, "status": "done",     "note": ""},
    {"idx": 2, "status": "partial",  "note": "틀린문제 많음"},
    {"idx": 3, "status": "not_done", "note": ""},
  ]
"""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Optional


STATUS_MAP = [
    (["완료", "했음", "함", "ok", "OK", "done"],          "done"),
    (["부분완료", "부분", "반", "일부", "partial"],          "partial"),
    (["미수행", "안함", "못함", "안했음", "not_done", "x", "X"], "not_done"),
]


@dataclass
class StatusItem:
    idx: int
    status: str     # done | partial | not_done | unknown
    note: str       # 상태 키워드 이후 나머지 텍스트
    needs_review: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def _match_status(token: str) -> tuple[str, str]:
    """
    토큰에서 status 키워드를 찾고 (status, 나머지 note) 반환.
    키워드는 가장 긴 것 우선.
    """
    # 가장 긴 키워드 먼저 매칭
    all_kw = sorted(
        [(kw, code) for kws, code in STATUS_MAP for kw in kws],
        key=lambda x: -len(x[0])
    )
    for kw, code in all_kw:
        if kw in token:
            note = token.replace(kw, "").strip()
            return code, note
    return "unknown", token.strip()


def parse_status_input(text: str) -> list[StatusItem]:
    """
    오너의 상태 입력 텍스트를 파싱합니다.

    Args:
        text: 줄바꿈 또는 연속 입력
              예: "1 완료\n2 부분완료 틀린문제 많음\n3 미수행"

    Returns:
        list[StatusItem]
    """
    results: list[StatusItem] = []
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]

    for line in lines:
        # "숫자 나머지" 패턴
        m = re.match(r'^(\d+)\s*(.*)', line)
        if not m:
            continue
        idx = int(m.group(1))
        rest = m.group(2).strip()
        status, note = _match_status(rest)
        results.append(StatusItem(
            idx=idx,
            status=status,
            note=note,
            needs_review=(status == "unknown"),
        ))

    return results


if __name__ == "__main__":
    import json

    test_cases = [
        "1 완료\n2 부분완료 틀린문제 많음\n3 미수행",
        "1완료\n2부분\n3안함",
        "1 완료\n2 ok\n3 못함",
        "1 완료\n2 ???",        # needs_review
    ]
    print("=" * 60)
    print("Status Parser — 테스트")
    print("=" * 60)
    for tc in test_cases:
        print(f"\n입력:\n{tc}")
        results = parse_status_input(tc)
        for r in results:
            print(f"  {r.to_dict()}")
