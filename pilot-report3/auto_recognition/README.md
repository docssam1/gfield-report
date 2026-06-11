# Report3 Auto Recognition V1

> 상태: Preview Only — 메시지 전송 없음, DB 수정 없음, 원본 사진 수정 없음

---

## 흐름 개요

```
Telegram 텍스트 수신
  └─ session_detector.py
       ├─ date 파싱 (MM/DD → YYYY-MM-DD, 연도 추론)
       ├─ student_name 추출
       ├─ entry_type 매핑 (수업내용 → class_notes 등)
       └─ SessionResult 반환

사진 업로드 감지
  └─ photo_grouping.py
       ├─ 직전 SessionResult 조회
       ├─ 타임스탬프 차이 ≤ 10분 → 세션에 귀속
       ├─ 세션 없음 or 초과 → needs_review=true
       └─ PhotoGroup 반환

Drive 경로 생성
  └─ drive_path_builder.py
       └─ report3_input/YYYY-MM-DD/학생명/entry_type/photos/

Analysis Queue 등록
  └─ analysis_queue_schema.json 구조
       ├─ status: "waiting"
       ├─ needs_review: bool
       └─ source.telegram_message_ids 보존

(다음 단계) Gemini 분석 → Report3 Preview 생성
```

---

## entry_type 매핑표

| Telegram 입력 | entry_type |
|---|---|
| 수업내용 | class_notes |
| 과제확인 | homework_check |
| 시험결과 | test_result |
| 상담내용 | consultation |
| 기타 / 미인식 | unknown → needs_review=true |

---

## 안전 원칙

- Preview 단계: 어떤 메시지도 전송하지 않음
- 원본 사진 수정/삭제 없음
- 인식 불확실 시 `needs_review=true` 처리
- Drive 저장 경로만 계산, 실제 업로드는 다음 단계
- production DB/report 파일 접근 없음
