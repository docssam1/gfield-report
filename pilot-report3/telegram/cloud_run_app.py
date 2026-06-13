from __future__ import annotations

import os

from fastapi import FastAPI, Header, HTTPException, Request
from telegram import Update

from pilot_bot_v4_1 import BOT_TOKEN, build_application


WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "").strip()

app = FastAPI(title="Report3 Telegram Webhook", version="v4-cloudrun-experiment")


@app.on_event("startup")
async def startup_event() -> None:
    telegram_app = build_application(use_updater=False)
    await telegram_app.initialize()
    await telegram_app.start()
    app.state.telegram_app = telegram_app


@app.on_event("shutdown")
async def shutdown_event() -> None:
    telegram_app = getattr(app.state, "telegram_app", None)
    if telegram_app is not None:
        await telegram_app.stop()
        await telegram_app.shutdown()


@app.get("/healthz")
async def healthz() -> dict:
    return {
        "ok": True,
        "bot_token_set": bool(BOT_TOKEN),
        "gcs_bucket_set": bool(os.environ.get("REPORT3_GCS_BUCKET")),
        "owner_chat_id_set": bool(os.environ.get("REPORT3_OWNER_CHAT_ID")),
        "webhook_secret_set": bool(WEBHOOK_SECRET),
    }


@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    if WEBHOOK_SECRET and x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="invalid webhook secret")

    telegram_app = getattr(app.state, "telegram_app", None)
    if telegram_app is None:
        raise HTTPException(status_code=503, detail="telegram app not initialized")

    payload = await request.json()
    update = Update.de_json(payload, telegram_app.bot)
    await telegram_app.process_update(update)
    return {"ok": True}
