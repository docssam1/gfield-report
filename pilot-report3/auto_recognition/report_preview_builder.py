"""
Report3 Auto Recognition V2-D — Report Preview Builder

Gemini 분석 결과를 받아 Report3 HTML 미리보기를 생성합니다.
Preview only: 실제 전송 없음, 오너 승인 후 전송.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "output"


@dataclass
class PreviewResult:
    queue_id: str
    html_path: str
    success: bool
    error: str = ""


def build_preview(
    queue_item: dict,
    analysis: dict,
    output_dir: Path = OUTPUT_DIR,
) -> PreviewResult:
    """
    분석 결과 → HTML 보고서 미리보기 생성.

    Args:
        queue_item: analysis_queue_schema 형식
        analysis: gemini_analyzer.AnalysisResult.parsed
        output_dir: HTML 출력 디렉토리

    Returns:
        PreviewResult
    """
    try:
        qid       = queue_item.get("queue_id", "unknown")
        date      = queue_item.get("date", "")
        student   = queue_item.get("student_name", "")
        etype     = queue_item.get("entry_type", "")
        photos    = queue_item.get("photo_count", 0)
        reviewed  = queue_item.get("needs_review", False)
        generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        # entry_type 한글 레이블
        label_map = {
            "class_notes":    "수업내용",
            "homework_check": "과제확인",
            "test_result":    "시험결과",
            "consultation":   "상담내용",
        }
        etype_label = label_map.get(etype, etype)

        # 분석 데이터 타입별 렌더링
        analysis_html = _render_analysis(etype, analysis)

        review_badge = (
            '<span style="background:#e74c3c;color:#fff;padding:2px 8px;border-radius:4px;">'
            '수동확인 필요</span>'
            if reviewed else
            '<span style="background:#27ae60;color:#fff;padding:2px 8px;border-radius:4px;">'
            '자동인식 완료</span>'
        )

        html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report3 Preview — {student} {date}</title>
<style>
  body {{ font-family: 'Noto Sans KR', sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #333; }}
  h1 {{ font-size: 1.4rem; border-bottom: 2px solid #2c3e50; padding-bottom: 8px; }}
  .meta {{ background: #f8f9fa; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 0.9rem; }}
  .meta span {{ margin-right: 16px; }}
  .section {{ margin: 24px 0; }}
  .section h2 {{ font-size: 1.1rem; color: #2c3e50; margin-bottom: 8px; }}
  .tag {{ display: inline-block; background: #3498db; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 0.85rem; margin: 2px; }}
  .warn {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 14px; border-radius: 4px; }}
  .footer {{ margin-top: 40px; font-size: 0.8rem; color: #aaa; text-align: center; }}
</style>
</head>
<body>
<h1>📊 Report3 Preview</h1>
<div class="meta">
  <span>👤 {student}</span>
  <span>📅 {date}</span>
  <span>📝 {etype_label}</span>
  <span>🖼️ {photos}장</span>
  {review_badge}
</div>
{analysis_html}
<div class="footer">Generated: {generated} | Preview only — 오너 승인 후 전송</div>
</body>
</html>"""

        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{qid}_preview.html"
        out_path.write_text(html, encoding="utf-8")

        return PreviewResult(queue_id=qid, html_path=str(out_path), success=True)

    except Exception as e:
        return PreviewResult(queue_id=queue_item.get("queue_id", ""),
                             html_path="", success=False, error=str(e))


def _render_analysis(etype: str, data: dict) -> str:
    if etype == "class_notes" or etype == "consultation":
        keywords = data.get("keywords", [])
        summary  = data.get("summary", "")
        level    = data.get("level", "")
        weak     = data.get("weak_areas", [])
        kw_html  = "".join(f'<span class="tag">{k}</span>' for k in keywords)
        weak_html = "".join(f"<li>{w}</li>" for w in weak) or "<li>해당 없음</li>"
        return f"""
<div class="section">
  <h2>키워드</h2><div>{kw_html}</div>
</div>
<div class="section">
  <h2>수업 요약</h2><p>{summary}</p>
</div>
<div class="section">
  <h2>수준 예측</h2><p>{level}</p>
</div>
<div class="section">
  <h2>보완 필요 영역</h2><ul>{weak_html}</ul>
</div>"""
    else:  # homework_check, test_result
        total    = data.get("total_problems", 0)
        solved   = data.get("solved", 0)
        patterns = data.get("error_patterns", [])
        notes    = data.get("notes", "")
        pct      = round(solved / total * 100) if total else 0
        pat_html = "".join(f"<li>{p}</li>" for p in patterns) or "<li>해당 없음</li>"
        return f"""
<div class="section">
  <h2>과제 현황</h2>
  <p>전체 {total}문제 — {solved}문제 풀이 ({pct}%)</p>
</div>
<div class="section">
  <h2>오답 패턴</h2><ul>{pat_html}</ul>
</div>
<div class="section">
  <h2>특이사항</h2><p>{notes}</p>
</div>"""


# ---------------------------------------------------------------------------
# 테스트
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    sample_queue = {
        "queue_id": "kimjuhan_2026-05-06_class_notes_test",
        "date": "2026-05-06",
        "student_name": "김주한",
        "entry_type": "class_notes",
        "photo_count": 3,
        "needs_review": False,
    }
    sample_analysis = {
        "keywords": ["이차방정식", "그래프", "점화선"],
        "summary": "이차함수의 그래프 해석과 평행이동 학습",
        "level": "중",
        "weak_areas": ["그래프 해석", "절편값 개념"],
    }

    r = build_preview(sample_queue, sample_analysis)
    print(f"success={r.success} | path={r.html_path}")
    if r.success:
        print("HTML 생성 완료. 브라우저로 확인하세요.")
