V4-1 Real Drive Write Test + Telegram Photo Download Test

Update:
- if `REPORT3_GCS_BUCKET` is set, V4-1 now uses GCS first
- Drive remains as fallback only

Scope:
- verify REPORT3_DRIVE_ROOT_ID presence
- verify service account credential path presence
- attempt one real Drive write only if both are available
- attempt one Telegram photo download only after Drive test passes
- generate metadata sample only

Excluded:
- Gemini
- final report generation
- DB update
- calendar
- parent messaging

Output files:
- telegram/test_outputs/drive_write_test_result.json
- telegram/test_outputs/telegram_photo_download_test_result.json
- telegram/test_outputs/metadata.json

Stop rule:
- if any permission precheck fails, stop immediately and report through result JSON
