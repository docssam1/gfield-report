# Report3 V3 Homework Module

> Preview only — 메시지 전송 없음, production DB 수정 없음, 기존 학생 HTML 수정 없음

---

## 개념 분리

| 개념 | 설명 | 생성 시점 |
|---|---|---|
| `assigned_homework` | 교사가 부여한 과제 목록 | 수업 사진 Gemini 분석 후 |
| `homework_check` | 학생이 실제 완료한 현황 | 오너가 상태 입력 후 |

---

## 파일 구조

```
pilot-report3/homework/
  README.md               ← 이 파일
  query_parser.py         ← 오너 텍스트 → RecallQuery
  homework_store.py       ← assigned_homework 저장/조회
  status_parser.py        ← "1 완료\n2 부분" → [StatusItem]
  check_builder.py        ← assigned + status → homework_check JSON
  samples/
    assigned_kimjuhan_2026-06-04.json
    homework_check_kimjuhan_2026-06-11.json

pilot-report3/telegram/
  bot_handler_v3.py       ← 전체 플로우 연결
  state/v3_state.json     ← chat별 pending 상태 (런타임)
```

---

## E2E 플로우

```
오너: "김주한 6/4 과제 불러와줘"
  └─ query_parser  → intent=recall_homework
  └─ homework_store → AssignedHomework 조회
  └─ 봇 reply: 번호 목록 (preview 로그)
  └─ state: waiting_status 저장

오너: "1 완료\n2 부분완료 틀린문제 많음\n3 미수행"
  └─ status_parser → [StatusItem]
  └─ check_builder → HomeworkCheckResult
  └─ output/ 저장 (preview)
  └─ state: 초기화
```

---

## 지원 intent

| 입력 패턴 | intent |
|---|---|
| `{학생} {날짜} 과제 불러와줘` | `recall_homework` |
| `{학생} {날짜} 과제확인 불러와줘` | `recall_homework_check` |
| `{학생} {날짜} 수업내용 불러와줘` | `recall_class_notes` |
| `{학생} {날짜} 과제 등록해줘` | `register_homework` |

---

## 상태(status) 코드

| 입력 키워드 | status |
|---|---|
| 완료, 했음, ok | `done` |
| 부분, 부분완료, 반 | `partial` |
| 미수행, 안함, 못함 | `not_done` |
| 기타 | `unknown` → needs_review=true |

---

## 안전 원칙

- `public_allowed` 항상 `false` — 학부모 전송 금지
- `needs_review=true` 아이템 오너 수동 확인 필수
- production report 파일 무접촉
- 기존 학생 HTML 수정 없음
