const SHEET_PROPERTY = 'BRIEFING_SHEET_ID';
const FOLDER_PROPERTY = 'BRIEFING_FOLDER_ID';
const TOKEN_PROPERTY = 'BOARD_WRITE_TOKEN';
const POSTS_SHEET = 'posts';
const HTML_SHEET = 'html_files';

function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = ensureSpreadsheet_(props);
  const folder = ensureDriveFolder_(props);

  ensurePostsHeader_(getSheet_(ss, POSTS_SHEET));
  ensureHtmlHeader_(getSheet_(ss, HTML_SHEET));

  return {
    spreadsheetUrl: ss.getUrl(),
    driveFolderUrl: folder.getUrl()
  };
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || 'listPosts');
  const callback = params.callback;
  let data;

  try {
    if (action === 'listPosts' || action === 'list') {
      data = { ok: true, posts: listPosts_() };
    } else if (action === 'listHtml') {
      data = { ok: true, files: listHtmlFiles_() };
    } else if (action === 'getHtml') {
      data = { ok: true, file: getHtmlFile_(params.id) };
    } else {
      data = { ok: false, error: 'unknown_action' };
    }
  } catch (err) {
    data = { ok: false, error: String(err && err.message || err) };
  }

  return output_(data, callback);
}

function doPost(e) {
  const body = parseBody_(e);
  try {
    verifyToken_(body.token);

    if (body.action === 'saveHtml') {
      const file = saveHtmlFile_(body);
      return output_({ ok: true, file: file }, body.callback);
    }

    const post = normalizePost_(body);
    appendPost_(post);
    return output_({ ok: true, post: post }, body.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message || err) }, body.callback);
  }
}

function listPosts_() {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, POSTS_SHEET);
  ensurePostsHeader_(sheet);

  return sheet.getDataRange().getValues()
    .slice(1)
    .filter(row => row[0])
    .map(row => ({
      id: row[0],
      createdAt: row[1],
      title: row[2],
      category: row[3],
      summary: row[4],
      body: row[5],
      imageUrl: row[6],
      sourceUrl: row[7],
      htmlFileId: row[8],
      htmlFileUrl: row[9],
      status: row[10] || 'published'
    }))
    .filter(post => post.status === 'published')
    .reverse()
    .slice(0, 120);
}

function listHtmlFiles_() {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, HTML_SHEET);
  ensureHtmlHeader_(sheet);

  return sheet.getDataRange().getValues()
    .slice(1)
    .filter(row => row[0])
    .map(row => ({
      id: row[0],
      createdAt: row[1],
      title: row[2],
      summary: row[3],
      fileId: row[4],
      fileUrl: row[5],
      sourceUrl: row[6],
      status: row[7] || 'published'
    }))
    .filter(file => file.status === 'published')
    .reverse()
    .slice(0, 120);
}

function getHtmlFile_(id) {
  const target = String(id || '').trim();
  if (!target) throw new Error('id_required');

  const file = DriveApp.getFileById(target);
  return {
    fileId: file.getId(),
    title: file.getName(),
    html: file.getBlob().getDataAsString('UTF-8'),
    fileUrl: file.getUrl()
  };
}

function saveHtmlFile_(body) {
  const title = clean_(body.title).slice(0, 120);
  const html = String(body.html || '').trim();
  const summary = clean_(body.summary).slice(0, 260);
  const sourceUrl = clean_(body.sourceUrl).slice(0, 1000);

  if (!title) throw new Error('title_required');
  if (!html || !html.includes('<')) throw new Error('html_required');

  const folder = getDriveFolder_();
  const filename = safeFileName_(title) + '.html';
  const file = folder.createFile(filename, html, 'text/html');
  file.setDescription(summary || title);

  const record = {
    id: Utilities.getUuid(),
    createdAt: new Date().toISOString(),
    title: title,
    summary: summary,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    sourceUrl: sourceUrl,
    status: 'published'
  };

  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, HTML_SHEET);
  ensureHtmlHeader_(sheet);
  sheet.appendRow([
    record.id,
    record.createdAt,
    record.title,
    record.summary,
    record.fileId,
    record.fileUrl,
    record.sourceUrl,
    record.status
  ]);

  if (body.publishToBoard === true || body.publishToBoard === 'Y') {
    appendPost_({
      id: Utilities.getUuid(),
      createdAt: record.createdAt,
      title: title,
      category: clean_(body.category || '교육 브리핑').slice(0, 40),
      summary: summary || 'Google Drive에 저장된 HTML 칼럼입니다.',
      body: clean_(body.body || summary || ''),
      imageUrl: clean_(body.imageUrl).slice(0, 1000),
      sourceUrl: sourceUrl,
      htmlFileId: record.fileId,
      htmlFileUrl: record.fileUrl,
      status: 'published'
    });
  }

  return record;
}

function appendPost_(post) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const sheet = getSheet_(ss, POSTS_SHEET);
    ensurePostsHeader_(sheet);
    sheet.appendRow([
      post.id,
      post.createdAt,
      post.title,
      post.category,
      post.summary,
      post.body,
      post.imageUrl,
      post.sourceUrl,
      post.htmlFileId || '',
      post.htmlFileUrl || '',
      post.status
    ]);
  } finally {
    lock.releaseLock();
  }
}

function normalizePost_(body) {
  const title = clean_(body.title).slice(0, 120);
  const summary = clean_(body.summary).slice(0, 260);
  const fullBody = clean_(body.body).slice(0, 8000);

  if (!title) throw new Error('title_required');
  if (!summary && !fullBody) throw new Error('content_required');

  return {
    id: Utilities.getUuid(),
    createdAt: new Date().toISOString(),
    title: title,
    category: clean_(body.category || '교육 브리핑').slice(0, 40),
    summary: summary || fullBody.slice(0, 220),
    body: fullBody,
    imageUrl: clean_(body.imageUrl).slice(0, 1000),
    sourceUrl: clean_(body.sourceUrl).slice(0, 1000),
    htmlFileId: clean_(body.htmlFileId).slice(0, 200),
    htmlFileUrl: clean_(body.htmlFileUrl).slice(0, 1000),
    status: 'published'
  };
}

function verifyToken_(token) {
  const requiredToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY) || '';
  if (requiredToken && token !== requiredToken) {
    throw new Error('invalid_token');
  }
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return e.parameter || {};
    }
  }
  return e && e.parameter ? e.parameter : {};
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback).replace(/[^\w.$]/g, '') + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSpreadsheet_(props) {
  const sheetId = props.getProperty(SHEET_PROPERTY);
  if (sheetId) return SpreadsheetApp.openById(sheetId);

  const ss = SpreadsheetApp.create('doossam education briefing');
  props.setProperty(SHEET_PROPERTY, ss.getId());
  return ss;
}

function ensureDriveFolder_(props) {
  const folderId = props.getProperty(FOLDER_PROPERTY);
  if (folderId) return DriveApp.getFolderById(folderId);

  const folder = DriveApp.createFolder('doossam education briefing html');
  props.setProperty(FOLDER_PROPERTY, folder.getId());
  return folder;
}

function getSpreadsheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty(SHEET_PROPERTY);
  if (!sheetId) throw new Error('Run setup() first.');
  return SpreadsheetApp.openById(sheetId);
}

function getDriveFolder_() {
  const folderId = PropertiesService.getScriptProperties().getProperty(FOLDER_PROPERTY);
  if (!folderId) throw new Error('Run setup() first.');
  return DriveApp.getFolderById(folderId);
}

function getSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensurePostsHeader_(sheet) {
  const header = ['id', 'createdAt', 'title', 'category', 'summary', 'body', 'imageUrl', 'sourceUrl', 'htmlFileId', 'htmlFileUrl', 'status'];
  ensureHeader_(sheet, header);
}

function ensureHtmlHeader_(sheet) {
  const header = ['id', 'createdAt', 'title', 'summary', 'fileId', 'fileUrl', 'sourceUrl', 'status'];
  ensureHeader_(sheet, header);
}

function ensureHeader_(sheet, header) {
  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  if (current.join('') !== header.join('')) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
}

function clean_(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function safeFileName_(value) {
  return clean_(value)
    .replace(/[\\/:*?"<>|#%{}$!'@+`=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'briefing';
}
