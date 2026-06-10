# Report3 Pilot Decisions

## 2026-06-10

### 파일럿 위치

- 기존 운영 저장소 `docssam1/gfield-report` 안에 `pilot-report3/` 폴더로 생성한다.
- 별도 repo는 만들지 않는다.
- 운영 학생 폴더(`김주한/` 등)는 파일럿 중 직접 수정하지 않는다.

### 역할 분리

- ChatGPT: Report3 지휘소, 설계, 검수, 품질 판정
- Gemini / Google AI Studio: 사진 첨삭 분석 엔진
- Google Cloud: batch 실행 공간
- Drive: 원본 사진 및 결과 저장소
- GitHub: 코드/템플릿/스키마 버전 관리
- Codex/Claude: 최소 사용, 필요할 때만 코드 수정 보조

### 안전 원칙

- Gemini 결과는 완성 리포트가 아니라 분석 원재료다.
- 분석 결과는 JSON preview로 먼저 저장한다.
- HTML은 JSON을 바탕으로 초안만 생성한다.
- 원장 검수 전 운영 리포트에 반영하지 않는다.
- 내부메모/민감정보는 기본 `public_allowed=false`다.

### 다음 작업

1. Gemini 사진첨삭 분석 프롬프트 테스트
2. 김주한 샘플 사진 세트 3~5회 실험
3. 분석 JSON 품질 확인
4. JSON → HTML 초안 변환 방식 확정
5. 원장 수정 시간이 10분 이내로 줄어드는지 측정
