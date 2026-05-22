# doossam의 교육 브리핑

GitHub Pages에서 볼 수 있는 인스타그램형 교육 칼럼/브리핑 게시판입니다.

## 구조

- `index.html`: GitHub Pages용 화면
- `apps-script/Code.gs`: Google Apps Script 백엔드
- 저장소: Apps Script가 자동 생성하거나 연결한 Google Sheet

## 사용 순서

1. Google Apps Script 새 프로젝트를 만듭니다.
2. `apps-script/Code.gs` 내용을 붙여넣습니다.
3. Apps Script 편집기에서 `setup()`을 한 번 실행합니다.
4. 프로젝트 설정 > 스크립트 속성에서 필요 시 `BOARD_WRITE_TOKEN`을 설정합니다.
5. 배포 > 새 배포 > 웹 앱으로 배포합니다.
6. 발급된 `/exec` URL을 `index.html`의 `APPS_SCRIPT_URL`에 넣습니다.
7. GitHub Pages 주소로 접속합니다.

## 보안

- Google Sheet ID와 등록 토큰은 Apps Script Properties에 저장합니다.
- 등록 토큰은 GitHub 코드에 넣지 말고, 페이지의 관리자 토큰 입력칸에만 넣어 사용하세요.
- 토큰이 없는 상태로 공개하면 누구나 글을 등록할 수 있습니다.

