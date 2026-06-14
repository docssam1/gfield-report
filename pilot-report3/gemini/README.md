# Report3 V5 — Gemini Analysis

> Preview only — DB 없음, 학부모 발송 없음, 원본 사진 수정 없음

---

## 흐름

```
V4 metadata.json
  └─ gcs_media_loader.py  → GCS 사진 bytes 다운로드
  └─ analysis_prompts.py  → entry_type별 프롬프트 선택
  └─ gemini_analyzer_v5.py → Gemini Vision 호출 → AnalysisResult
  └─ analysis_preview_writer.py → analysis_preview.json 저장
```

## entry_type별 분석 구조

| entry_type | analysis_kind | 추출 항목 |
|---|---|---|
| homework_photo | homework_photo_analysis | 문제번호, 답안, 오답, 첨삭후보, 코멘트후보 |
| class_photo | class_photo_analysis | 키워드, 판서요약, 학습주제, 난이도 |

## 환경변수

```
GEMINI_API_KEY                  # 실행 모드
REPORT3_GCS_BUCKET              # 이미 설정됨
GOOGLE_APPLICATION_CREDENTIALS  # 이미 설정됨
```

## 안전 원칙

- API 키 없으면 dry_run 자동 fallback
- 분석 실패 시 needs_review=true
- safety 블록 항상 false
- 원본 사진 미수정
