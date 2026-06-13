# Report3 V3 — Homework Flow 개발 기록

> 작성: Claude (관호 지시하에) | 2026-06-11

---

## 완료 파이프라인

```
오너: "김주한 6/4 과제 불러와줘"
      ↓
 query_parser.py
   intent=recall_homework, student=김주한, date=2026-06-04
      ↓
 homework_store.py  →  AssignedHomework 조회
      ↓
 [PREVIEW 응답 포맷]
   📋 김주한 (2026-06-04) 과제 목록
   1. 수학 p.45 1~10번
   2. 영어 단어 암기 20개
   3. 과학 탐구보고서 초안
   상태 입력: 1 완료 / 2 부분완료 [메모] / 3 미수행
      ↓
state: waiting_status 저장

오너: "1 완료\n2 부분완료 틀린문제 많음\n3 미수행"
      ↓
 status_parser.py
   [{idx:1, done}, {idx:2, partial, 틀린문제 많음}, {idx:3, not_done}]
      ↓
 check_builder.py
   HomeworkCheckResult → JSON 저장
      ↓
state: 초기화
```

---

## 샘플 출력 JSON

```json
{
  "student_name": "김주한",
  "date": "2026-06-11",
  "assigned_homework_source_date": "2026-06-04",
  "check_date": "2026-06-11T10:30:00Z",
  "items": [
    {"title": "수학 p.45 1~10번",       "status": "done",     "note": ""},
    {"title": "영어 단어 암기 20개",   "status": "partial",  "note": "틀린문제 많음"},
    {"title": "과학 탐구보고서 초안", "status": "not_done", "note": ""}
  ],
  "needs_review": false,
  "public_allowed": false
}
```

---

## 파일 목록

| 파일 | 역할 | 상태 |
|---|---|---|
| `telegram/bot_handler_v3.py` | E2E 흐름 연결, state 관리 | ✅ |
| `homework/query_parser.py` | 입력 → RecallQuery | ✅ |
| `homework/homework_store.py` | assigned_homework 저장/조회 | ✅ |
| `homework/status_parser.py` | 상태 입력 파싱 | ✅ |
| `homework/check_builder.py` | homework_check JSON 생성 | ✅ |
| `homework/samples/assigned_*.json` | 샘플 부여과제 | ✅ |
| `homework/samples/homework_check_*.json` | 샘플 확인결과 | ✅ |
| `homework/README.md` | 모듈 안내 | ✅ |

---

## 남은 문제 / V4 예정

| 항목 | 설명 |
|---|---|
| assigned_homework 자동 생성 | Gemini 분석 결과에서 자동 추출 (V4) |
| Drive 실제 저장 | 로컬 파일 → Drive 업로드 (V4) |
| 학생별 복수 세션 관리 | 한 채팅에 복수 학생 동시 진행 시 (V4) |
| Report3 Preview 연결 | homework_check → HTML 보고서 초안 (V4) |
| 실제 텔레봇 배포 | VM에 bot_handler_v3 통합 (V4) |
