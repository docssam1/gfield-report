"""
Report3 Auto Recognition V1 — Drive Path Builder

경로 형식:
    report3_input/YYYY-MM-DD/학생명/entry_type/photos/

예시:
    report3_input/2026-05-06/김주한/class_notes/photos/
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
import re

ROOT = "report3_input"


@dataclass
class DrivePath:
    root: str
    date: str
    student_name: str
    entry_type: str
    sub_dir: str
    full_path: str
    valid: bool
    reason: str = ""

    def to_dict(self):
        return asdict(self)


def _sanitize(name: str) -> str:
    return re.sub(r'[/\\:*?"<>|]', '_', name).strip()


def build_drive_path(date: str, student_name: str, entry_type: str,
                     sub_dir: str = "photos") -> DrivePath:
    if not date or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        return DrivePath(ROOT, date, student_name, entry_type, sub_dir,
                         "", False, f"날짜 형식 오류: {date!r}")
    if not student_name or not student_name.strip():
        return DrivePath(ROOT, date, student_name, entry_type, sub_dir,
                         "", False, "학생 이름이 비어 있습니다")
    if entry_type == "unknown":
        return DrivePath(ROOT, date, student_name, entry_type, sub_dir,
                         "", False, "entry_type이 unknown — needs_review 필요")

    full_path = f"{ROOT}/{date}/{_sanitize(student_name)}/{_sanitize(entry_type)}/{_sanitize(sub_dir)}/"
    return DrivePath(ROOT, date, _sanitize(student_name), _sanitize(entry_type),
                     _sanitize(sub_dir), full_path, True)


if __name__ == "__main__":
    for d, n, e in [
        ("2026-05-06", "김주한", "class_notes"),
        ("2026-05-06", "김주한", "homework_check"),
        ("", "김주한", "class_notes"),
        ("2026-05-06", "", "class_notes"),
        ("2026-05-06", "김주한", "unknown"),
    ]:
        r = build_drive_path(d, n, e)
        print(f"{r.full_path or '(invalid)'} | valid={r.valid}")
