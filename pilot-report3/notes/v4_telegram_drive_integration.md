V4 Telegram Bot + Drive Integration

Scope:
- Telegram text session capture
- Telegram photo capture
- Drive upload integration through preview-only dry run
- Queue preview JSON generation

Explicitly excluded:
- Calendar
- parent messaging
- DB update
- production report overwrite

Connected flow:
1. text message
2. session_detector
3. session state save
4. photo message
5. photo_grouping
6. drive_uploader (dry_run default)
7. preview queue JSON save

Current output:
- reply preview string
- preview queue JSON file under telegram/preview_queue
- drive path preview

Review rules:
- no session -> needs_review=true
- invalid date/student/entry_type -> needs_review=true
- drive uploader validation fail -> needs_review=true
