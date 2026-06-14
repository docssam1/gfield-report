"""AnalysisResult → analysis_preview.json 저장."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Union

from gemini_analyzer_v5 import AnalysisResult

OUTPUT_DIR = Path(__file__).parent.parent / "output" / "analysis"


def write_preview(
    result: AnalysisResult,
    output_dir: Path = OUTPUT_DIR,
    filename: str = "",
) -> Path:
    """
    AnalysisResult → analysis_preview.json 저장.
    Preview only: DB/리포트/학부모 발송 없음.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    if not filename:
        filename = (
            f"analysis_preview_{result.student_name}"
            f"_{result.source_date}_{result.entry_type}.json"
        )

    data = result.to_dict()
    # safety 블록 항상 false 보장
    data["safety"] = {
        "db_updated": False,
        "parent_message_sent": False,
        "final_report_generated": False,
    }

    path = output_dir / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
