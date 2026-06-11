# Report3 V3 — Homework Recall & Check Flow

> Preview only — 메시지 전송 없음, production DB 수정 없음, 기존 학생 HTML 수정 없음

---

## 개념 분리

| 개념 | 설명 | 출처 |
|---|---|---|
| `assigned_homework` | 교사가 부여한 과제 목록 | 수업 사진 분석 결과 |
| `homework_check` | 학생이 실제 완료한 과제 현황 | 오너 텔레봇 입력 |

> 두 개념은 별도 JSON으로 관리. `assigned_homework`는 수업 세션에서 생성, `homework_check`는 확인 세션에서 생성.

---

## 전체 흐름

```
오너: "김주한 6/4 과제 불러와줘"
  └─ query_parser.py → RecallQuery{student, date, intent=recall_homework}
  └─ homework_store.py → assigned_homework JSON 조회
  └─ 봇 응답: 번호 매긴 과제 목록

오너:
  1 완료
  2 부분완료 틀린문제 많음
  3 미수행
  └─ status_parser.py → [{idx, status, note}]
  └─ homework_check_builder.py → homework_check JSON 생성
  └─ output/ 저장 (preview)
```

---

## 파일 구조

```
pilot-report3/v3_homework/
  README.md                        ← 이 파일
  query_parser.py                  ← 텍스트 → RecallQuery
  homework_store.py                ← assigned_homework 저장/조회
  status_parser.py                 ← "1 완료\n2 부분" → [{idx, status, note}]
  homework_check_builder.py        ← homework_check JSON 생성
  sample_data/
    assigned_kimjuhan_2026-06-04.json   ← 샘플 부여과제
    homework_check_kimjuhan_2026-06-11.json  ← 샘플 확인결과
```

---

## 상태(status) 코드

| 입력 키워드 | status 값 |
|---|---|
| 완료 | `done` |
| 부분, 부분완료 | `partial` |
| 미수행, 안함, 못함 | `not_done` |
| 기타 / 미인식 | `unknown` → needs_review=true |

---

## 안전 원칙

- 학부모 메시지 전송 금지 (`public_allowed: false` 고정)
- 기존 학생 HTML 수정 없음
- production DB 접근 없음
- 인식 불확실 → `needs_review: true`
