"""
Report3 V3 — Status Parser

오너가 입력한 과제 상태 텍스트를 파싱합니다.
Preview only.

입력 예:
  "1 완료"
  "2 부분완료 틀린문제 많음"
  "3 미수행"
"""

from __future__ import annotations
import re
from dataclasses import dataclass, asdict

STATUS_MAP = [
    (["완료", "했음", "함", "ok", "OK", "done"],              "done"),
    (["부분완료", "부분", "반", "일부", "partial"],          "partial"),
    (["미수행", "안함", "못함", "안했음", "not_done", "x", "X"], "not_done"),
]


@dataclass
class StatusItem:
    idx: int
    status: str
    note: str
    needs_review: bool = False

    def to_dict(self):
        return asdict(self)


def _match_status(token: str):
    all_kw = sorted(
        [(kw, code) for kws, code in STATUS_MAP for kw in kws],
        key=lambda x: -len(x[0])
    )
    for kw, code in all_kw:
        if kw in token:
            return code, token.replace(kw, "").strip()
    return "unknown", token.strip()


def parse_status_input(text: str) -> list[StatusItem]:
    """
    오너의 상태 입력 텍스트를 파싱합니다.

    Args:
        text: 즌 1 완료\n2 부분완료 틀린문제 많음\n3 미수행"

    Returns:
        list[StatusItem]
    """
    results = []
    for line in [l.strip() for l in text.strip().splitlines() if l.strip()]:
        m = re.match(r'^(\d+)\s*(.*)', line)
        if not m:
            continue
        idx = int(m.group(1))
        rest = m.group(2).strip()
        status, note = _match_status(rest)
        results.append(StatusItem(
            idx=idx, status=status, note=note,
            needs_review=(status == "unknown"),
        ))
    return results


if __name__ == "__main__":
    cases = [
        "1 완료\n2 부분완료 틀린문제 많음\n3 미수행",
        "1완료\n2부분\n3안함",
        "1 ok\n2 partial\n3 x",
        "1 완료\n2 ???",
    ]
    print("=" * 50)
    for tc in cases:
        print(f"\n입력:\n{tc}")
        for r in parse_status_input(tc):
            print(f"  {r.to_dict()}")
