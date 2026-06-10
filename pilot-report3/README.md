# pilot-report3

Report3 사진 첨삭 자동화 파일럿 영역입니다.

## 목적

기존 운영 리포트(`김주한/`, 학생별 HTML 등)는 건드리지 않고, Gemini 사진 분석 결과를 Report3 리포트 초안으로 안전하게 변환하는 실험을 진행합니다.

## 현재 원칙

- 운영본 수정 금지
- 학생별 기존 HTML 직접 수정 금지
- Gemini 결과는 바로 HTML에 붙이지 않고 JSON preview로 저장
- 원장 검수 후 HTML 초안 생성
- 개인정보/내부메모는 기본 `public_allowed=false`
- 학생명/날짜/수업세션 분리 필수

## 폴더 구조

```text
pilot-report3/
├─ prompts/
│  └─ gemini_photo_analysis.md
├─ schemas/
│  └─ report3_photo_analysis.schema.json
├─ samples/
│  └─ kimjuhan_202606_sample.json
├─ templates/
│  └─ report3_card_template.html
├─ output/
│  ├─ json/.gitkeep
│  └─ html/.gitkeep
└─ notes/
   └─ decisions.md
```

## 실험 흐름

```text
사진 업로드
→ Gemini 사진/첨삭 분석
→ JSON preview 생성
→ Report3 템플릿으로 HTML 초안 생성
→ 원장 최종 수정
→ 운영본 반영 여부 결정
```
