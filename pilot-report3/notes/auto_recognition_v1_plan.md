# Report3 Auto Recognition V1 — 다음 단계 계획

> 작성: Claude (관호 지시하에) | 2026-06-11

---

## 전체 파이프라인

```
[1] Telegram 입력 → [2] Session Detection → [3] Photo Grouping
→ [4] Drive Save Path → [5] Analysis Queue → [6] Gemini 분석 → [7] Report3 Preview
```

## V1 완료
| 파일 | 상태 |
|---|---|
| session_detector.py | ✅ |
| photo_grouping.py | ✅ |
| drive_path_builder.py | ✅ |
| analysis_queue_schema.json | ✅ |
| sample_queue/kimjuhan_*.json | ✅ |

## V2 예정
- 텔레봇 핸들러 통합
- Drive 실제 업로드
- Gemini Vision 분석
- Report3 Preview 생성 및 오너 승인 전송

## 안전 원칙
- 오너 승인 없이 전송 금지
- 원본 사진 수정 금지
- needs_review=true 아이템 수동 확인 필수
