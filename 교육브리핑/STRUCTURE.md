# 구조

```mermaid
flowchart TD
  A["GitHub Pages: 교육브리핑/index.html"] --> B["게시판 카드 목록"]
  A --> C["게시글 등록 폼"]
  D["GitHub Pages: 교육브리핑/html-storage.html"] --> E["HTML 저장 폼"]
  D --> F["Drive HTML 저장 목록"]
  K["GitHub Pages: 교육브리핑/html-viewer.html"] --> G
  C --> G["Apps Script Web App"]
  E --> G
  G --> H["Google Sheet: posts"]
  G --> I["Google Sheet: html_files"]
  G --> J["Google Drive Folder: HTML files"]
  B --> G
  F --> G
  K --> L["iframe srcdoc로 HTML 미리보기"]
```

## 역할

- GitHub Pages: 사용자가 보는 화면입니다.
- Apps Script: 글 등록, 목록 불러오기, HTML 파일 저장을 처리합니다.
- Google Sheet `posts`: 게시판 카드 데이터를 저장합니다.
- Google Sheet `html_files`: Drive에 저장된 HTML 파일 목록을 저장합니다.
- Google Drive Folder: 실제 HTML 파일을 보관합니다.
- `html-viewer.html`: Drive 파일을 직접 공개하지 않고 Apps Script가 읽어온 HTML을 보여줍니다.

## URL 흐름

1. 사용자는 GitHub Pages 주소로 접속합니다.
2. 페이지에 Apps Script Web App URL을 한 번 입력합니다.
3. 목록 조회는 JSONP 방식으로 Apps Script에서 불러옵니다.
4. 등록/저장은 Apps Script `doPost`로 보냅니다.
5. Apps Script는 Google Sheet와 Google Drive에 저장합니다.
