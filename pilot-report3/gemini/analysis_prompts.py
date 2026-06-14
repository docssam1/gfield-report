"""V5 Gemini 분석 프롬프트 정의."""

HOMEWORK_PHOTO_PROMPT = """
다음 과제 사진을 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "problems": [
    {
      "number": "문제번호 (예: 1, 2a, 3-1)",
      "student_answer": "학생 답안 텍스트",
      "correct": null,
      "error_type": "계산오류|개념오류|풀이누락|정답|판독불가",
      "correction_candidate": "첨삭이 필요한 부분 설명",
      "comment_candidate": "격려 또는 지적 코멘트 후보"
    }
  ],
  "overall_completion": "완료|부분완료|미완료",
  "needs_teacher_review": false,
  "summary": "전체 과제 한줄 요약"
}

판독 불가 항목은 correct=null, error_type=판독불가 로 처리하세요.
""".strip()

CLASS_PHOTO_PROMPT = """
다음 수업 판서/필기 사진을 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "keywords": ["핵심 키워드 최대 5개"],
  "board_summary": "판서 내용 요약 (2~3문장)",
  "topic": "학습 주제",
  "difficulty": "상|중|하",
  "needs_teacher_review": false,
  "summary": "수업 내용 한줄 요약"
}

판독 불가 항목은 빈 문자열로 처리하세요.
""".strip()

PROMPT_MAP = {
    "homework_photo": HOMEWORK_PHOTO_PROMPT,
    "class_photo":    CLASS_PHOTO_PROMPT,
    "homework_check": HOMEWORK_PHOTO_PROMPT,  # 동일 구조
}

ANALYSIS_KIND_MAP = {
    "homework_photo": "homework_photo_analysis",
    "class_photo":    "class_photo_analysis",
    "homework_check": "homework_photo_analysis",
}


def get_prompt(entry_type: str) -> tuple[str, str]:
    """(prompt, analysis_kind) 반환. 미지원 entry_type은 class_photo 기본값."""
    prompt       = PROMPT_MAP.get(entry_type, CLASS_PHOTO_PROMPT)
    analysis_kind = ANALYSIS_KIND_MAP.get(entry_type, "class_photo_analysis")
    return prompt, analysis_kind
