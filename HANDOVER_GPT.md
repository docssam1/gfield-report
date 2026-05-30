# Project Context for New GPT Agent

## SSOT / Working Directory
- Canonical working folder: `G:\내 드라이브\코딩관련\field_report 3`
- GitHub SSOT: `https://github.com/docssam1/gfield-report`
- Branch: `main`
- Latest known commit at handover: `b864ef4` (Apply confirmed mark styles and English preview/apply flow)

## Core Product Scope
G-Field report/ops system:
- 학습 리포트 작성
- CS 관리
- 결석/보강/퇴원 워크플로우
- To-Do 관리
- Calendar/Notion 연동
- AI assistant (query + workflow preview/execute)

## Confirmed UI/Behavior Rules
1. `[[em:...]]` => red box emphasis
2. `[[star:...]]` => red box + star icon
3. Text selection popover includes English action button
4. English conversion flow must be `preview -> apply/cancel` (no direct overwrite)
5. Partial patch only (no full rewrite unless explicitly requested)

## Workflow Safety Rules
- Operational actions must be previewed first.
- Execute only on explicit approval.
- No direct Calendar/Notion/To-Do/StudentDB mutation before approval.

## Homework Import Rule (final)
- Previous report "과제 확인" => do not import
- Previous report "오늘의 과제" => import into current "과제 확인"

## Key Backend Pattern
- `schedule_workflow_preview` -> preview token
- `schedule_workflow_execute` -> execute only when approved
- `preview_only/actions` is for left-form edit preview only

## Known Operational Risk
- Google Drive sync can create `desktop.ini` inside `.git` and break refs/objects.
- Typical symptom: `bad object refs/desktop.ini` or broken ref warnings.
- Recovery pattern:
  1. remove `.git/**/desktop.ini`
  2. clean `packed-refs` lines containing `desktop.ini`
  3. retry `git fetch --prune`, `git pull --rebase`, `git push`

## Repository/Path Reality Check at Handover
- `C:\Users\inki_\Documents\New project 3` is not current final folder (missing at latest check).
- Active final folder is `G:\내 드라이브\코딩관련\field_report 3`.
