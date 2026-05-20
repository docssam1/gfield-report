const fs = require('fs');
const path = require('path');

const LATEST_JSON = path.join(__dirname, 'latest-traffic.json');
const SNAPSHOT_PATH = path.join(__dirname, 'traffic-snapshot.png');
const ALLOWED = new Set(['원활', '서행', '정체', '확인필요']);

const PROMPT = `
이 이미지는 서울 강남구 역삼로 460-2 지필드 영재교육 주변 네이버 교통지도 캡처입니다.

목적은 길찾기가 아니라 학부모에게 학원 주변 교통 흐름을 짧게 안내하는 것입니다.

다음 구역별 교통 흐름을 원활 / 서행 / 정체 / 확인필요 중 하나로 판단해 주세요.

1. 학원 정문 앞 100m
2. 반경 500m 이면도로
3. 반경 1km 주요도로
4. 대치 EM프라자 방향
5. 대치4동 주민센터 방향
6. 북측 우회 방향
7. 세븐일레븐 / SNT / 대치 스터디타워 방향

주의:
- 세븐일레븐 / SNT / 대치 스터디타워 방향은 최후 수단입니다.
- 이 구간을 기본 추천 경로처럼 안내하지 마세요.
- 학부모에게 보여줄 문장은 짧고 실용적으로 작성하세요.
- 과장하지 말고, 이미지에서 확인이 어려우면 확인필요라고 하세요.

반드시 아래 JSON 형식으로만 답하세요.

{
  "front100m": "",
  "inner500m": "",
  "main1km": "",
  "emRoute": "",
  "centerRoute": "",
  "northRoute": "",
  "emergencyRoute": "",
  "recommendation": "",
  "parentMessage": "",
  "updatedAt": ""
}
`.trim();

function nowKstString() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function fallbackPayload(msg) {
  return {
    front100m: '확인필요',
    inner500m: '확인필요',
    main1km: '확인필요',
    emRoute: '확인필요',
    centerRoute: '확인필요',
    northRoute: '확인필요',
    emergencyRoute: '확인필요',
    recommendation: '현재 교통 상황을 자동으로 확인하지 못했습니다.',
    parentMessage: msg || '현재 교통 정보 확인이 원활하지 않습니다. 도착 전 지도 앱을 함께 확인해 주세요.',
    updatedAt: nowKstString(),
    source: 'naver-traffic-layer-ai-vision',
    intervalMinutes: 10
  };
}

function normalizePayload(raw) {
  const pick = (v) => (ALLOWED.has(v) ? v : '확인필요');
  return {
    front100m: pick(String(raw.front100m || '').trim()),
    inner500m: pick(String(raw.inner500m || '').trim()),
    main1km: pick(String(raw.main1km || '').trim()),
    emRoute: pick(String(raw.emRoute || '').trim()),
    centerRoute: pick(String(raw.centerRoute || '').trim()),
    northRoute: pick(String(raw.northRoute || '').trim()),
    emergencyRoute: pick(String(raw.emergencyRoute || '').trim()),
    recommendation: String(raw.recommendation || '현재 교통 흐름을 확인 중입니다.').trim(),
    parentMessage: String(raw.parentMessage || '현재 교통 흐름을 확인 중입니다.').trim(),
    updatedAt: nowKstString(),
    source: 'naver-traffic-layer-ai-vision',
    intervalMinutes: 10
  };
}

function extractJson(text) {
  const s = String(text || '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON 응답을 찾지 못했습니다.');
  return JSON.parse(m[0]);
}

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

async function analyzeTrafficFromImage(imagePath = SNAPSHOT_PATH) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    const fb = fallbackPayload('현재 교통 정보 확인이 원활하지 않습니다. 도착 전 지도 앱을 함께 확인해 주세요.');
    writeJsonAtomic(LATEST_JSON, fb);
    return fb;
  }
  if (!fs.existsSync(imagePath)) {
    const fb = fallbackPayload('지도 캡처 이미지가 없어 교통 정보를 확인하지 못했습니다.');
    writeJsonAtomic(LATEST_JSON, fb);
    return fb;
  }

  try {
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');
    const body = {
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: 'image/png', data: imageBase64 } }
        ]
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Gemini API 실패: ${res.status}`);
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    const parsed = extractJson(text);
    const normalized = normalizePayload(parsed);
    writeJsonAtomic(LATEST_JSON, normalized);
    return normalized;
  } catch (err) {
    const fb = fallbackPayload('현재 교통 정보 확인이 원활하지 않습니다. 도착 전 지도 앱을 함께 확인해 주세요.');
    writeJsonAtomic(LATEST_JSON, fb);
    return fb;
  }
}

if (require.main === module) {
  analyzeTrafficFromImage().then((result) => {
    console.log('[traffic-analyzer] done:', result.updatedAt);
  });
}

module.exports = { analyzeTrafficFromImage, fallbackPayload, nowKstString };
