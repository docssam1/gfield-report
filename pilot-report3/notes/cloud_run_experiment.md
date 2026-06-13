Cloud Run Experiment for Report3 Telegram Bot

Goal:
- keep VM polling bot untouched
- add a webhook-only entrypoint for Cloud Run experiments
- preserve GCS storage, preview JSON, and link-only video policy

Entry point:
- `pilot-report3/telegram/cloud_run_app.py`
- webhook route: `/telegram/webhook`
- health route: `/healthz`

Required environment variables:
- `REPORT3_TELEGRAM_BOT_TOKEN`
- `REPORT3_GCS_BUCKET`

Optional environment variables:
- `REPORT3_OWNER_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS`

Notes:
- On Cloud Run, prefer attaching a service account with bucket access instead of a JSON file.
- If attached service account is used, `GOOGLE_APPLICATION_CREDENTIALS` can stay unset.
- Existing VM polling flow remains the primary stable path.

Run locally:
- `uvicorn pilot-report3.telegram.cloud_run_app:app --host 0.0.0.0 --port 8080`

Cloud Run experiment deploy outline:
1. Build from source or container
2. Expose unauthenticated HTTPS endpoint
3. Set env vars for token, bucket, owner id, and webhook secret
4. Register Telegram webhook to:
   - `https://<service-url>/telegram/webhook`
5. Verify:
   - `GET /healthz`
   - Telegram text/photo/video-link flows

Safety:
- no DB update
- no final report generation
- no parent messaging
- no calendar update
