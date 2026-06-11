# Do-it Voice / Calendar Pipeline Memo

## 목적

Report3 파이프라인과 별도로, 텔레그램 음성 입력을 이용해 원장의 할 일/리마인드/Google Calendar 등록을 처리하는 Do-it 파이프라인을 설계한다.

## 핵심 방향

Report3 Bot은 수업/과제/사진/리포트 입력에 집중한다.
Do-it 기능은 별도 파이프라인으로 분리한다.

```text
Report3 Pipeline
= 수업내용 / 과제확인 / 사진 / 리포트 preview

Do-it Pipeline
= 음성 메모 / 할 일 / 리마인드 / Google Calendar
```

## 예상 입력 예시

텔레그램 음성 또는 텍스트:

```text
두잇 내일 오후 3시에 김주한 어머님 전화 상담 리마인드 해줘
```

또는:

```text
/doit 내일 3시 김주한 어머님 전화
```

## 처리 흐름

```text
Telegram voice/text
→ STT 변환
→ intent 분류
→ 일정/할 일 후보 JSON 생성
→ 원장 확인 메시지
→ 확인 후 Google Calendar 등록 또는 ToDo 생성
```

## 필수 안전장치

- Calendar 등록은 자동 실행하지 않는다.
- 반드시 원장 확인 후 등록한다.
- 학생명/시간/날짜가 불확실하면 `needs_review=true`.
- 학부모 연락/문자/카카오 발송은 자동 실행 금지.
- Report3 수업 리포트와 Do-it 일정 등록은 저장소/파이프라인을 분리한다.

## 후보 JSON

```json
{
  "intent": "calendar_reminder",
  "title": "김주한 어머님 전화 상담",
  "date_text": "내일",
  "time_text": "오후 3시",
  "normalized_datetime": "",
  "student_name": "김주한",
  "action": "create_calendar_event",
  "needs_confirmation": true,
  "needs_review": true,
  "source": {
    "platform": "telegram",
    "input_type": "voice|text",
    "message_id": ""
  }
}
```

## 봇 확인 메시지 예시

```text
확인: 내일 오후 3시에 “김주한 어머님 전화 상담” 일정을 등록할까요?
[등록] [취소]
```

## API / 파이프라인 분리

```text
GEMINI_API_KEY
= 사진/음성 텍스트 해석 보조 가능

OPENAI_API_KEY
= 일정 문장 정리, 자연어 의도 분류 보조 가능

GOOGLE_CALENDAR
= 확인 후 일정 등록 전용
```

초기 구현은 Report3와 섞지 않고, notes 수준에서 설계만 보관한다.
