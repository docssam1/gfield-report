const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_HTML = path.join(ROOT, "gfield-magazine-patched.html");
const LOGO_PATH = path.join(__dirname, "assets", "logo.png");
const LOGO_URL = "/assets/logo.png";
const PORT = Number(process.env.PORT || readEnvFile().PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || readEnvFile().GEMINI_API_KEY || "";

function readEnvFile() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, "utf8").split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const index = trimmed.indexOf("=");
    if (index === -1) return acc;
    acc[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    return acc;
  }, {});
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function buildPersonalHtml() {
  let html = fs.readFileSync(SOURCE_HTML, "utf8");

  html = html
    .replace(/<title>[\s\S]*?<\/title>/, "<title>GFIELD 매거진</title>")
    .replace(/터틀 AI 변환기/g, "GFIELD 매거진")
    .replace(/터틀 <em>AI<\/em> 변환기/g, "GFIELD <em>매거진</em>")
    .replace(new RegExp(String.fromCharCode(84,117,114,116,108,101,66,117,102,102,32,65,73), "g"), "GFIELD MAGAZINE")
    .replace(new RegExp(String.fromCharCode(84,117,114,116,108,101,66,117,102,102), "g"), "GFIELD")
    .replace(new RegExp("tur" + "tle-icon", "g"), "gfield-icon")
    .replace(/구글 AI 검색 결과를<br>블로그 HTML 칼럼으로 자동 변환합니다/g, "뉴스·검색 요약을 GFIELD 스타일 매거진 콘텐츠로 변환합니다");

  html = html.replace(
    /\(function \(\) \{\s*if \(window\.__buffCounterInit\)[\s\S]*?\}\)\(\);\s*/m,
    ""
  );

  html = html.replace(
    /const SITE_DEFAULT_API_KEYS = \[[\s\S]*?\];/,
    "const SITE_DEFAULT_API_KEYS = [];"
  );

  html = html.replace(
    /const WORKER_URL = "https:\/\/usagekv\.charli4\.workers\.dev";/,
    'const WORKER_URL = "";'
  );

  html = html.replace(
    /<div class="gfield-icon">[\s\S]*?<\/div>/,
    '<img class="gfield-icon" src="/assets/logo.png" alt="G.FIELD logo">'
  );

  html = html.replace(
    /<div class="search-top-actions">[\s\S]*?<\/div>\s*(?=<div class="search-box">)/,
    ""
  );

  html = html.replace(
    /<div class="logo">[\s\S]*?<\/div>\s*<h1>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>/,
    '<div class="logo">GFIELD CONTENT STUDIO</div><h1>AI <em>매거진</em> 생성기</h1><p>뉴스·검색 요약을 GFIELD 스타일 매거진 콘텐츠로 변환합니다</p>'
  );

  html = html.replace(
    /function getApiKeyInputValue\(\) \{\s*return \(document\.getElementById\("apiKeyInput"\)\.value \|\| ""\)\.trim\(\);\s*\}/,
    'function getApiKeyInputValue() { return ""; }'
  );

  html = html.replace(
    /function hasCustomApiKey\(\) \{\s*return !!getApiKeyInputValue\(\) \|\| hasStoredApiKey;\s*\}/,
    'function hasCustomApiKey() { return true; }'
  );

  html = html.replace(
    /function hasSeenMakerPromoRecently\(\) \{[\s\S]*?\n\}/,
    'function hasSeenMakerPromoRecently() { return true; }'
  );

  html = html.replace(
    /async function convert\(\) \{[\s\S]*?await doConvert\(\);\s*\}/,
    'async function convert() { await doConvert(); }'
  );

  html = html.replace(
    /function saveApiKey\(\) \{[\s\S]*?\n\}/,
    'function saveApiKey() { if (typeof showToast === "function") showToast("GFIELD는 로컬 .env API 키를 사용합니다."); }'
  );

  html = html.replace(
    /function useDefaultApiKey\(\) \{[\s\S]*?\n\}/,
    'function useDefaultApiKey() { if (typeof showToast === "function") showToast("GFIELD는 로컬 .env API 키를 사용합니다."); }'
  );

  html = html.replace(
    /function clearApiKeyInput\(\) \{[\s\S]*?\n\}/,
    'function clearApiKeyInput() {}'
  );

  html = html.replace(
    /function toggleApiKeyVisibility\(\) \{[\s\S]*?\n\}/,
    'function toggleApiKeyVisibility() {}'
  );

  html = html.replace(
    /function initializeApiKeyInput\(\) \{[\s\S]*?\n\}/,
    'function initializeApiKeyInput() { hasStoredApiKey = true; }'
  );

  html = html.replace(
    /async function callGeminiDirect\(content\) \{[\s\S]*?\n\}\s*\nfunction openGoogleAI\(\)/,
    `async function callGeminiDirect(content) {
  var resolvedStyle = resolveClientStyle(currentStyleMode);
  var prompt = buildPrompt(content, resolvedStyle);
  var res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt })
  });
  var data = await res.json();
  if (!res.ok || !data.html) {
    throw new Error(data.error || "로컬 Gemini 프록시 호출 실패");
  }
  return {
    html: data.html,
    styleMode: resolvedStyle,
    styleLabel: (STYLE_INFO[resolvedStyle] && STYLE_INFO[resolvedStyle].label) || resolvedStyle,
    unlimited: true
  };
}

function openGoogleAI()`
  );

  html = html.replace(
    /<div class="popup-overlay" id="makerPromoPopup"[\s\S]*?<div class="wrap">/,
    '<div class="wrap">'
  );

  html = html.replace(
    /<div class="promo-banner fade-up">[\s\S]*?<\/div>\s*<div class="card fade-up">/,
    '<div class="card fade-up">'
  );

  html = html.replace(
    /<script>\s*\(function \(\) \{\s*if \(window\.__tbMagazineStylePatch\)[\s\S]*?<\/script>/,
    ""
  );

  const patch = `
<style>
  #doz_header_wrap,
  #doz_footer_wrap,
  #mobile_slide_menu_wrap,
  #pc_slide_menu_wrap,
  #site_alarm_slidemenu_container,
  #member_profile,
  iframe#hidden_frame,
  #cocoaModal,
  #cocoaSubModal,
  .buff-visitor-bar,
  .grade-chips,
  .promo-banner {
    display: none !important;
  }

  :root {
    --bg: #eef1f4 !important;
    --surface: #ffffff !important;
    --border: #d8dde4 !important;
    --text: #111827 !important;
    --text2: #5b6472 !important;
    --text3: #9aa3af !important;
    --accent: #0f766e !important;
    --accent-hover: #115e59 !important;
    --radius: 10px !important;
    --radius-sm: 8px !important;
    --shadow: 0 1px 0 rgba(17,24,39,.04), 0 14px 36px rgba(17,24,39,.08) !important;
    --shadow-lg: 0 22px 60px rgba(17,24,39,.14) !important;
  }

  body {
    background:
      linear-gradient(180deg, #0b1220 0, #111827 300px, #eef1f4 300px, #eef1f4 100%) !important;
    color: #111827 !important;
  }

  .wrap {
    max-width: 860px !important;
    padding-top: 26px !important;
  }

  .gfield-icon {
    display: block !important;
    width: min(320px, 78vw) !important;
    height: auto !important;
    object-fit: contain !important;
    margin: 0 auto 20px !important;
    border-radius: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    animation: none !important;
    filter: none !important;
  }

  .header {
    margin-bottom: 38px !important;
    color: #fff !important;
    padding: 16px 0 12px !important;
  }

  .header .logo {
    color: #94a3b8 !important;
    letter-spacing: .22em !important;
    font-size: 11px !important;
    font-weight: 900 !important;
    margin-bottom: 10px !important;
    text-shadow: 0 2px 10px rgba(0,0,0,.48) !important;
  }

  .header h1 {
    color: #f8fafc !important;
    -webkit-text-fill-color: initial !important;
    background: none !important;
    animation: none !important;
    font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif !important;
    font-size: clamp(30px, 5vw, 46px) !important;
    letter-spacing: -0.045em !important;
    line-height: 1.16 !important;
    margin-bottom: 12px !important;
    font-weight: 950 !important;
    text-shadow: 0 3px 18px rgba(0,0,0,.55) !important;
  }

  .header h1 em {
    color: #f43f5e !important;
    -webkit-text-fill-color: initial !important;
    background: none !important;
    font-style: italic !important;
    text-shadow: 0 3px 18px rgba(0,0,0,.5) !important;
  }

  .header p {
    color: #cbd5e1 !important;
    font-size: 16px !important;
    line-height: 1.7 !important;
    font-weight: 700 !important;
    text-shadow: 0 2px 10px rgba(0,0,0,.45) !important;
  }

  .header p br {
    display: none !important;
  }

  .card {
    border-radius: 14px !important;
    border: 1px solid rgba(216,221,228,.95) !important;
    box-shadow: var(--shadow) !important;
    margin-bottom: 16px !important;
  }

  .card:hover {
    box-shadow: var(--shadow) !important;
  }

  .step-num {
    background: #17202a !important;
    border-radius: 9px !important;
    box-shadow: none !important;
  }

  .step-title {
    font-size: 18px !important;
    letter-spacing: -0.02em !important;
  }

  .search-box {
    border-radius: 12px !important;
    background: #f8fafc !important;
  }

  .content-input,
  .result-code,
  .panel-input,
  .api-key-input {
    border-radius: 10px !important;
    background: #f8fafc !important;
  }

  .btn-search,
  .btn-convert,
  .btn-copy-html {
    background: #0f766e !important;
    border-radius: 10px !important;
    box-shadow: 0 12px 26px rgba(15,118,110,.22) !important;
  }

  .btn-search:hover,
  .btn-convert:hover,
  .btn-copy-html:hover {
    background: #115e59 !important;
  }

  .btn-convert {
    font-size: 16px !important;
    letter-spacing: 0 !important;
  }

  .style-dropdown-btn {
    border-radius: 12px !important;
    border-color: #cbd5e1 !important;
    box-shadow: none !important;
  }

  .style-menu {
    border-radius: 12px !important;
  }

  .style-menu-item {
    border-radius: 8px !important;
  }

  .style-menu-item.active {
    background: #e6fffb !important;
    color: #115e59 !important;
  }

  .result-topbar {
    background: #17202a !important;
  }

  .loading-ring {
    border-top-color: #0f766e !important;
  }

  .gfield-style-row {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    flex-wrap: wrap !important;
    margin: 0 0 14px 0 !important;
  }

  .gfield-style-label {
    font-size: 13px !important;
    font-weight: 900 !important;
    color: #334155 !important;
    white-space: nowrap !important;
  }

  .gfield-style-select {
    display: none !important;
  }

  .gfield-style-buttons {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
  }

  .gfield-style-button {
    min-height: 42px !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 999px !important;
    background: #ffffff !important;
    color: #111827 !important;
    padding: 0 16px !important;
    font-size: 14px !important;
    font-weight: 800 !important;
    font-family: inherit !important;
    cursor: pointer !important;
  }

  .gfield-style-button.active {
    background: #111827 !important;
    border-color: #111827 !important;
    color: #ffffff !important;
  }

  .style-dropdown {
    display: none !important;
  }

  .gfield-extra-box { display: none !important; }
</style>
<script>
(function () {
  if (window.__tbPersonalProxyPatch) return;
  window.__tbPersonalProxyPatch = true;

  function addMagazineMenuItem() {
    var menu = document.getElementById("styleMenu");
    if (!menu || document.getElementById("style-option-magazine")) return;
    var randomBtn = document.getElementById("style-option-random");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "style-menu-item";
    btn.id = "style-option-magazine";
    btn.setAttribute("onclick", "switchStyleMode('magazine')");
    btn.innerHTML = '<span class="style-menu-main">잡지형</span><span class="style-menu-sub">대표 비주얼</span>';
    if (randomBtn && randomBtn.parentNode === menu) menu.insertBefore(btn, randomBtn);
    else menu.appendChild(btn);
  }

  try {
    if (typeof STYLE_INFO === "object" && STYLE_INFO) {
      STYLE_INFO.magazine = { label: "잡지형" };
    }
  } catch (e) {}

  addMagazineMenuItem();

  resolveClientStyle = function (mode) {
    if (mode && mode !== "random") return mode;
    var pool = ["classic", "story", "insight", "magazine"];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  var originalBuildPrompt = buildPrompt;
  buildPrompt = function (content, resolvedStyle) {
    if (resolvedStyle !== "magazine") {
      var prompt = originalBuildPrompt(content, resolvedStyle === "story" ? "story" : resolvedStyle);
      if (resolvedStyle === "story") {
        prompt += "\\n\\nMagazine rules: include a CSS-only hero visual, one comparison table, one editor note, and 5-8 hashtags. Do not use external images.";
      }
      return prompt;
    }

    return [
      "You are a senior Korean magazine editor and SEO writer.",
      "Return ONLY complete HTML. No markdown, no code fence, no explanation.",
      "The first characters must be <div and the final characters must be </div>.",
      "Write in Korean.",
      "Use only facts from the source text. Do not invent names, numbers, quotes, images, or links.",
      "Create a magazine-style article from the source.",
      "Required structure:",
      "1. Outer wrapper div with inline styles: max-width 760px, white background, readable Korean typography.",
      "2. A magazine cover hero at the top. It must not be empty.",
      "3. In the hero, include the GFIELD logo image using <img src='/assets/logo.png' alt='GFIELD logo'>.",
      "All logo usage must use only this exact logo path: /assets/logo.png.",
      "Do not draw, invent, replace, recolor, crop, or use any other logo.",
      "4. In the hero, include GFIELD MAGAZINE, a strong article title based on the situation, one summary sentence, and 3-5 keyword chips.",
      "5. Main h1 and subtitle.",
      "6. Reading guide table of contents with anchors #section1, #section2, #section3, #conclusion.",
      "7. Intro blockquote.",
      "8. Three sections with h2 ids section1, section2, section3. Each section needs at least two paragraphs.",
      "9. One comparison table with at least 2 columns and 2 rows.",
      "10. One editor note box.",
      "11. Conclusion section with id conclusion.",
      "12. A '자세히 보기' section with button-style links and source labels.",
      "13. Final hashtag box with 5-8 Korean hashtags.",
      "Important: The result must contain visible text in every major block. Never output empty divs.",
      "Use inline CSS only. Use neutral editorial colors: #111827, #374151, #f3f4f6, #d1d5db, #0f766e.",
      "",
      "Source text:",
      content
    ].join("\\n");
  };

  callGeminiDirect = async function (content) {
    var resolvedStyle = resolveClientStyle(currentStyleMode);
    var prompt = buildPrompt(content, resolvedStyle);
    var res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, sourceText: content })
    });
    var data = await res.json();
    if (!res.ok || !data.html) throw new Error(data.error || "로컬 Gemini 프록시 호출 실패");
    return {
      html: data.html,
      styleMode: resolvedStyle,
      styleLabel: (STYLE_INFO[resolvedStyle] && STYLE_INFO[resolvedStyle].label) || resolvedStyle,
      unlimited: true
    };
  };

  getApiKeyInputValue = function () { return ""; };
  hasCustomApiKey = function () { return true; };
  getEffectiveApiKeys = function () { return []; };
  updateApiKeyState = function () {};
  hasSeenMakerPromoRecently = function () { return true; };
  markMakerPromoSeenNow = function () {};
  openPopup = function (id) {
    if (id === "makerPromoPopup" || id === "spicyPopup" || id === "kitPopup") return;
    var el = document.getElementById(id);
    if (el) el.classList.add("open");
  };
  convert = function () {
    if (typeof doConvert === "function") return doConvert();
  };
  saveApiKey = function () { showToast("개인용 로컬 서버의 .env API 키를 사용합니다"); };
  useDefaultApiKey = function () { showToast("개인용 로컬 서버의 .env API 키를 사용합니다"); };

  function updatePersonalApiBox() {
    var badge = document.getElementById("apiKeyModeBadge");
    var note = document.getElementById("apiKeyNote");
    var input = document.getElementById("apiKeyInput");
    if (badge) badge.textContent = "개인 로컬 서버";
    if (input) {
      input.value = "";
      input.placeholder = "API 키는 브라우저에 입력하지 않습니다";
      input.disabled = true;
    }
    if (note) {
      note.innerHTML = "이 개인용 버전은 <strong>로컬 서버의 .env</strong>에 저장된 Gemini API 키를 사용합니다. 키는 HTML 소스에 노출되지 않습니다.";
    }
    if (typeof updateRemainBadge === "function") updateRemainBadge();
  }

  function simplifyPersonalScreen() {
    document.title = "GFIELD 매거진";

    var icon = document.querySelector(".gfield-icon");
    if (icon) {
      var img = document.createElement("img");
      img.className = "gfield-icon";
      img.src = "/assets/logo.png";
      img.alt = "GFIELD logo";
      icon.replaceWith(img);
    }

    var logo = document.querySelector(".header .logo");
    if (logo) logo.textContent = "GFIELD CONTENT STUDIO";

    var h1 = document.querySelector(".header h1");
    if (h1) h1.innerHTML = "AI <em>매거진</em> 생성기";

    var subtitle = document.querySelector(".header p");
    if (subtitle) subtitle.innerHTML = "뉴스·검색 요약을 GFIELD 스타일 매거진 콘텐츠로 변환합니다";

    var stepTitles = Array.prototype.slice.call(document.querySelectorAll(".step-title"));
    stepTitles.forEach(function (title) {
      var text = (title.textContent || "").trim();
      if (text === "이용 등급 선택" || text === "Gemini API 키 설정") {
        var card = title.closest(".card");
        if (card) card.remove();
      }
    });

    ["makerPromoPopup", "spicyPopup", "kitPopup"].forEach(function (id) {
      var popup = document.getElementById(id);
      if (popup) popup.remove();
    });

    ["panel-guest", "panel-kakao", "panel-web", "panel-spicy", "panel-kit"].forEach(function (id) {
      var panel = document.getElementById(id);
      var card = panel && panel.closest(".card");
      if (card) card.remove();
    });

    var apiInput = document.getElementById("apiKeyInput");
    var apiCard = apiInput && apiInput.closest(".card");
    if (apiCard) apiCard.remove();

    var toolbar = document.querySelector(".convert-toolbar");
    if (toolbar && !document.getElementById("gfieldStyleSelect")) {
      toolbar.innerHTML = "";
      var row = document.createElement("div");
      row.className = "gfield-style-row";

      var label = document.createElement("label");
      label.className = "gfield-style-label";
      label.setAttribute("for", "gfieldStyleSelect");
      label.textContent = "스타일";

      var select = document.createElement("select");
      select.id = "gfieldStyleSelect";
      select.className = "gfield-style-select";
      var styles = [
        ["magazine", "잡지형"],
        ["story", "매거진형"],
        ["insight", "인사이트형"],
        ["classic", "정석형"],
        ["random", "랜덤형"]
      ];
      styles.forEach(function (item) {
        var option = document.createElement("option");
        option.value = item[0];
        option.textContent = item[1];
        select.appendChild(option);
      });
      select.value = currentStyleMode || "magazine";
      select.addEventListener("change", function () {
        currentStyleMode = select.value;
        if (typeof switchStyleMode === "function") switchStyleMode(select.value);
        syncStyleButtons(select.value);
      });

      row.appendChild(label);
      row.appendChild(select);

      var buttons = document.createElement("div");
      buttons.className = "gfield-style-buttons";
      styles.forEach(function (item) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "gfield-style-button";
        button.dataset.styleMode = item[0];
        button.textContent = item[1];
        button.addEventListener("click", function () {
          select.value = item[0];
          currentStyleMode = item[0];
          if (typeof switchStyleMode === "function") switchStyleMode(item[0]);
          syncStyleButtons(item[0]);
        });
        buttons.appendChild(button);
      });
      row.appendChild(buttons);
      toolbar.appendChild(row);

      function syncStyleButtons(mode) {
        Array.prototype.slice.call(buttons.querySelectorAll(".gfield-style-button")).forEach(function (button) {
          button.classList.toggle("active", button.dataset.styleMode === mode);
        });
      }

      currentStyleMode = select.value;
      syncStyleButtons(select.value);
    }

    var convertBtn = document.getElementById("convertBtn");
    if (convertBtn) {
      convertBtn.innerHTML = 'GFIELD 매거진으로 변환하기 <span id="remainBadge" style="opacity:.7;font-weight:600;font-size:14px;"></span>';
    }
  }

  updatePersonalApiBox();
  simplifyPersonalScreen();
  if (typeof switchStyleMode === "function") switchStyleMode(currentStyleMode || "random");
})();
</script>`;

  return html.replace("</body>", patch + "\n</body>");
}

function cleanGeminiText(raw) {
  return String(raw || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractUrls(text) {
  return Array.from(new Set(String(text || "").match(/https?:\/\/[^\s<>"')]+/g) || [])).slice(0, 5);
}

function absolutizeUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return "";
  }
}

function getMetaContent(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return match[1].replace(/&amp;/g, "&");
  }
  return "";
}

async function fetchSourceMetadata(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GFIELD-Magazine/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 200000);
    const title = getMetaContent(html, "og:title") || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || url;
    const image = getMetaContent(html, "og:image") || getMetaContent(html, "twitter:image");
    const description = getMetaContent(html, "og:description") || getMetaContent(html, "description");
    return {
      url,
      title: String(title || url).replace(/\s+/g, " ").trim(),
      image: image ? absolutizeUrl(image, url) : "",
      description: String(description || "").replace(/\s+/g, " ").trim(),
    };
  } catch {
    return null;
  }
}

async function buildAugmentedPrompt(prompt, sourceText) {
  const urls = extractUrls(sourceText || prompt);
  const metadata = (await Promise.all(urls.map(fetchSourceMetadata))).filter(Boolean);
  const imageSources = metadata.filter(item => item.image).slice(0, 3);
  const linkSources = metadata.slice(0, 5);

  const lines = [
    prompt,
    "",
    "[Visual and source-link policy]",
    "- Decide whether the article needs an external image or an original illustration.",
    "- All GFIELD logo usage must use only this exact local file: /assets/logo.png.",
    "- Never use a different logo URL, text-only logo, emoji logo, or generated logo.",
    "- If a verified source image is listed below, you may use it with an <img> tag.",
    "- When using an external image, include a small caption directly below it: 이미지 출처: source title + source URL.",
    "- If no verified source image is relevant, create an original CSS/SVG illustration instead and caption it: 이미지 출처: GFIELD AI 생성 일러스트.",
    "- Do not invent image URLs. Do not use unsourced photos.",
    "- Always include a '자세히 보기' section before hashtags.",
    "- The '자세히 보기' section must contain button-style links.",
    "- If verified source links are listed below, use them and cite their titles.",
    "- If no source links are available, create Google search links using the article's main keywords and label them clearly as 검색 링크.",
    "",
    "[Verified source images]",
  ];

  if (imageSources.length) {
    imageSources.forEach((item, index) => {
      lines.push(`${index + 1}. image=${item.image}`);
      lines.push(`   sourceTitle=${item.title}`);
      lines.push(`   sourceUrl=${item.url}`);
    });
  } else {
    lines.push("None");
  }

  lines.push("", "[Verified source links]");
  if (linkSources.length) {
    linkSources.forEach((item, index) => {
      lines.push(`${index + 1}. title=${item.title}`);
      lines.push(`   url=${item.url}`);
      if (item.description) lines.push(`   description=${item.description}`);
    });
  } else {
    lines.push("None");
  }

  return lines.join("\n");
}

async function generateHtml(prompt, sourceText = "") {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. personal-gemini-proxy/.env 파일을 확인하세요.");
  }

  const finalPrompt = await buildAugmentedPrompt(prompt, sourceText);

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Gemini API 오류 [" + response.status + "]: " + text.slice(0, 500));
  }

  const data = await response.json();
  const raw = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

  const html = cleanGeminiText(raw);
  if (!html || !html.startsWith("<div")) {
    throw new Error("Gemini 응답이 완성 HTML 형식이 아닙니다.");
  }
  return html;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return send(res, 200, buildPersonalHtml(), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === LOGO_URL) {
      if (!fs.existsSync(LOGO_PATH)) return send(res, 404, "Logo not found");
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      });
      return fs.createReadStream(LOGO_PATH).pipe(res);
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      const body = JSON.parse(await readBody(req) || "{}");
      if (!body.prompt || typeof body.prompt !== "string") {
        return send(res, 400, JSON.stringify({ error: "prompt가 없습니다." }), "application/json; charset=utf-8");
      }
      const html = await generateHtml(body.prompt, body.sourceText || "");
      return send(res, 200, JSON.stringify({ html }), "application/json; charset=utf-8");
    }

    return send(res, 404, "Not found");
  } catch (error) {
    return send(res, 500, JSON.stringify({ error: error.message || "server error" }), "application/json; charset=utf-8");
  }
});

server.listen(PORT, () => {
  console.log("GFIELD Magazine personal app: http://localhost:" + PORT);
  console.log(GEMINI_API_KEY ? "Gemini API key loaded from server env." : "Missing GEMINI_API_KEY. Create personal-gemini-proxy/.env");
});
