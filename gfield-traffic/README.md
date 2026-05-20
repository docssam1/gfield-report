# G-Field Traffic Monitor

## 1. 프로젝트 목적
지필드 영재교육(서울 강남구 역삼로 460-2) 주변 교통 흐름을 10분마다 자동 판독해 `latest-traffic.json`으로 저장하고, 학부모 리포트는 해당 JSON만 읽어 교통 안내 카드를 표시합니다.

이 시스템은 길찾기가 아니라 **학원 주변 교통 상태 요약 안내**가 목적입니다.

---

## 2. 설치 방법
```bash
cd /var/www/gfield-traffic
npm init -y
npm i puppeteer
```

Node.js 18+ 권장(내장 `fetch` 사용).

---

## 3. .env 설정 방법
`.env` 파일 예시:

```env
NAVER_NCP_CLIENT_ID=your_naver_ncp_client_id
GEMINI_API_KEY=your_gemini_api_key
```

운영 시에는 쉘 환경변수 export를 권장합니다.

---

## 4. 네이버 지도 API 키 설정 위치
- 파일: `traffic-monitor.html`
- 캡처 스크립트(`traffic-capture.js`)가 `NAVER_NCP_CLIENT_ID`를 URL 파라미터로 전달
- `<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=...">` 형태로 로드

---

## 5. Gemini API 키 설정 위치
- 파일: `traffic-analyzer.js`
- 환경변수: `GEMINI_API_KEY`
- 프론트엔드 HTML에는 절대 노출하지 않음

---

## 6. cron 등록 방법
10분마다 실행:

```bash
*/10 * * * * cd /var/www/gfield-traffic && node traffic-capture.js >> /var/log/gfield-traffic.log 2>&1
```

운영 시간은 스크립트 내부에서 제한:
- 평일 13:00 ~ 21:00 (KST)
- 운영 시간 밖이면 `latest-traffic.json`에 `status: "closed"` 저장

---

## 7. latest-traffic.json을 학부모 리포트에서 불러오는 방법
학부모 화면에서 `fetch('/gfield-traffic/latest-traffic.json')`으로 읽어 카드 렌더링:
- `sample-parent-report-card.html` 참고
- 리포트 열람 시 AI 호출은 하지 않음

---

## 8. 최후 수단 구간 주의사항
`세븐일레븐 / SNT / 대치 스터디타워 방향`은 **최후 수단**입니다.

기본 추천 경로처럼 안내하면 안 되며, 카드에는 아래 주의 문구를 고정 표기합니다.

> ※ 세븐일레븐 / SNT / 대치 스터디타워 방향은 정차가 어렵거나 주변 흐름이 매우 혼잡할 때만 확인해 주세요.

---

## 파일 설명
- `traffic-monitor.html` : 네이버 지도 + TrafficLayer 모니터 화면
- `traffic-capture.js` : Puppeteer 캡처 + 운영시간/락 처리
- `traffic-analyzer.js` : Gemini Vision 판독 + JSON 저장
- `latest-traffic.json` : 최신 판독 결과 저장
- `sample-parent-report-card.html` : 학부모 표시 카드 샘플

---

## 실행
수동 1회 실행:

```bash
node traffic-capture.js
```

성공 시 `latest-traffic.json`이 갱신됩니다.
