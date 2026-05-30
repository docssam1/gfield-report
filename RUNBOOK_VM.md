# VM Runbook (GCP VM + Telegram Bot + GitHub)

## 0) Source of Truth
- GitHub repo: `https://github.com/docssam1/gfield-report`
- Branch: `main`
- Local canonical folder before migration: `G:\내 드라이브\코딩관련\field_report 3`

## 1) GCP VM Base Setup (Ubuntu)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

## 2) Node Runtime Setup
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
node -v
npm -v
```

## 3) Clone SSOT Repository
```bash
git clone https://github.com/docssam1/gfield-report.git
cd gfield-report
git checkout main
git pull --rebase origin main
```

## 4) Environment Variables (.env)
Create `.env` (do not commit):
```env
OPENAI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...
APPS_SCRIPT_URL=...
NOTION_API_KEY=...
GOOGLE_CALENDAR_ID=primary
```

## 5) Telegram Bot Service (PM2)
```bash
npm i -g pm2
# Example (adjust entrypoint):
pm2 start bot.js --name gfield-bot
pm2 save
pm2 startup
```

## 6) Recommended Telegram Command Set
- `/status`: current branch / latest commit / process health
- `/pull`: `git pull --rebase origin main`
- `/deploy`: restart bot/service
- `/logs`: recent logs summary

## 7) Safety/Approval Policy
- All write operations are preview-first.
- Execute only on explicit approval token.
- Keep action logs (who / when / what / result).

## 8) Git Sync Routine (VM)
```bash
git fetch origin
git checkout main
git pull --rebase origin main
git status
git add .
git commit -m "sync: <message>"
git push origin main
```

## 9) If Git Gets Corrupted by desktop.ini
When Drive-like sync contaminates `.git` with `desktop.ini`:
```bash
# 1) remove desktop.ini under .git
find .git -name desktop.ini -type f -delete

# 2) remove broken desktop.ini refs from packed-refs
grep -v 'desktop.ini' .git/packed-refs > /tmp/packed-refs.clean && mv /tmp/packed-refs.clean .git/packed-refs

# 3) recover
 git fetch --prune origin
 git pull --rebase origin main
 git push origin main
```

## 10) Post-Migration Validation Checklist
1. `git log -1` matches expected latest main commit
2. Telegram bot receives and responds to `/status`
3. Preview/execute separation works (no pre-approval writes)
4. Apps Script URL reachable and returns health response
5. English conversion UI behavior validated in web app
