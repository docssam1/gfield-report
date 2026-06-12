from __future__ import annotations

import re
from dataclasses import asdict, dataclass


@dataclass
class StatusItem:
    idx: int
    status: str
    note: str
    needs_review: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


STATUS_KEYWORDS = [
    ("done", ["완료", "다함", "끝", "ok", "done"]),
    ("partial", ["부분", "부분완료", "조금", "미완", "partial"]),
    ("not_done", ["미수행", "못함", "안함", "x", "not_done"]),
]


def _detect_status(text: str) -> tuple[str, str]:
    lowered = text.lower()
    for code, keywords in STATUS_KEYWORDS:
        for keyword in keywords:
            if keyword.lower() in lowered:
                note = text.replace(keyword, "", 1).strip(" -:/")
                return code, note
    return "unknown", text.strip()


def parse_status_input(text: str) -> list[StatusItem]:
    items: list[StatusItem] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(r"^(\d+)\s*(.*)$", line)
        if not match:
            continue
        idx = int(match.group(1))
        remainder = match.group(2).strip()
        status, note = _detect_status(remainder)
        items.append(
            StatusItem(
                idx=idx,
                status=status,
                note=note,
                needs_review=(status == "unknown"),
            )
        )
    return items
