V3 Bot Handler Integration

Scope:
- preview only
- no parent messages
- no DB update
- no production student-folder edits

Connected chain:
- query_parser
- homework_store
- status_parser
- check_builder
- bot_handler_v3

Supported preview flow:
1. "김주한 6/4 과제 불러와줘"
2. numbered homework list reply
3. "1 완료 / 2 부분 / 3 미수행"
4. homework_check preview JSON output

Fallback:
- if query parse fails, needs_review=true
- if homework data is missing, needs_review=true
- if status count mismatches assigned count, needs_review=true
