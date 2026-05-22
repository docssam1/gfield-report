const SHEET_PROPERTY = 'BRIEFING_SHEET_ID';
const TOKEN_PROPERTY = 'BOARD_WRITE_TOKEN';
const SHEET_NAME = 'posts';

function setup() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty(SHEET_PROPERTY);
  let ss;

  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('doossam education briefing');
    props.setProperty(SHEET_PROPERTY, ss.getId());
  }

  const sheet = getSheet_(ss);
  ensureHeader_(sheet);
  return ss.getUrl();
}

function doGet(e) {
  const action = String(e.parameter.action || 'list');
  const callback = e.parameter.callback;
  let data;

  if (action === 'list') {
    data = { ok: true, posts: listPosts_() };
  } else {
    data = { ok: false, error: 'unknown_action' };
  }

  return output_(data, callback);
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const props = PropertiesService.getScriptProperties();
    const requiredToken = props.getProperty(TOKEN_PROPERTY) || '';

    if (requiredToken && body.token !== requiredToken) {
      return output_({ ok: false, error: 'invalid_token' }, body.callback);
    }

    const post = normalizePost_(body);
    appendPost_(post);
    return output_({ ok: true, post: post }, body.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message || err) }, '');
  }
}

function listPosts_() {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss);
  ensureHeader_(sheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter(row => row[0]);

  return rows
    .map(row => ({
      id: row[0],
      createdAt: row[1],
      title: row[2],
      category: row[3],
      summary: row[4],
      body: row[5],
      imageUrl: row[6],
      sourceUrl: row[7],
      status: row[8] || 'published'
    }))
    .filter(post => post.status === 'published')
    .reverse()
    .slice(0, 120);
}

function appendPost_(post) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const sheet = getSheet_(ss);
    ensureHeader_(sheet);
    sheet.appendRow([
      post.id,
      post.createdAt,
      post.title,
      post.category,
      post.summary,
      post.body,
      post.imageUrl,
      post.sourceUrl,
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
    status: 'published'
  };
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

function getSpreadsheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty(SHEET_PROPERTY);
  if (!sheetId) {
    throw new Error('Run setup() first.');
  }
  return SpreadsheetApp.openById(sheetId);
}

function getSheet_(ss) {
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeader_(sheet) {
  const header = ['id', 'createdAt', 'title', 'category', 'summary', 'body', 'imageUrl', 'sourceUrl', 'status'];
  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  if (current.join('') !== header.join('')) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
}

function clean_(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

