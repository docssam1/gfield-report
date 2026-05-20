const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { analyzeTrafficFromImage, fallbackPayload } = require('./traffic-analyzer');

const SNAPSHOT_PATH = path.join(__dirname, 'traffic-snapshot.png');
const LATEST_JSON = path.join(__dirname, 'latest-traffic.json');
const LOCK_PATH = path.join(__dirname, 'capture.lock');

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function isOperatingTimeKst() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const day = now.getDay(); // 0 Sunday
  const hour = now.getHours();
  const weekday = day >= 1 && day <= 5;
  return weekday && hour >= 13 && hour < 21;
}

function writeClosedPayload() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  writeJsonAtomic(LATEST_JSON, {
    status: 'closed',
    parentMessage: '현재는 교통 안내 운영 시간이 아닙니다.',
    updatedAt: `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  });
}

function acquireLock() {
  if (fs.existsSync(LOCK_PATH)) return false;
  fs.writeFileSync(LOCK_PATH, String(Date.now()), 'utf8');
  return true;
}

function releaseLock() {
  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

async function captureTrafficMap() {
  if (!isOperatingTimeKst()) {
    writeClosedPayload();
    return { status: 'closed' };
  }
  const ncpClientId = process.env.NAVER_NCP_CLIENT_ID || '';
  if (!ncpClientId) {
    const fb = fallbackPayload('지도 API 설정이 없어 교통 정보를 확인하지 못했습니다.');
    writeJsonAtomic(LATEST_JSON, fb);
    return fb;
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    const fileUrl = 'file://' + path.join(__dirname, 'traffic-monitor.html').replace(/\\/g, '/')
      + '?ncpClientId=' + encodeURIComponent(ncpClientId);
    await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(7000);
    const root = await page.$('#mapCaptureRoot');
    if (!root) throw new Error('#mapCaptureRoot not found');
    await root.screenshot({ path: SNAPSHOT_PATH, type: 'png' });
  } finally {
    await browser.close();
  }

  return analyzeTrafficFromImage(SNAPSHOT_PATH);
}

if (require.main === module) {
  if (!acquireLock()) {
    console.log('[traffic-capture] already running, skip');
    process.exit(0);
  }
  captureTrafficMap()
    .then((r) => console.log('[traffic-capture] done', r.updatedAt || r.status))
    .catch((err) => {
      const fb = fallbackPayload('현재 교통 정보 확인이 원활하지 않습니다. 도착 전 지도 앱을 함께 확인해 주세요.');
      writeJsonAtomic(LATEST_JSON, fb);
      console.error('[traffic-capture] error', err.message || err);
    })
    .finally(() => releaseLock());
}

module.exports = { captureTrafficMap };
