const CONFIG = {
  DRIVE_ROOT_ID: '1ydIsZGns3_yq--hRaYEvORViWiCUrgy6',
  DASHBOARD_SHEET_ID: '1Ta1o_v504jtDsyHPY0bER6WpI3xYTbVVffEl0iy58f8',
  GITHUB_OWNER: 'docssam1',
  GITHUB_REPO: 'gfield-report',
  GITHUB_BRANCH: 'main',
  PAGES_BASE_URL: 'https://docssam1.github.io/gfield-report',
  NOTION_DB_ID: 'bd40d0f6-39e5-4097-9155-0cb113327581',
  GOOGLE_CALENDAR_ID: 'primary'
};

const ACTIVITY_SHEET = '수업_활동_기록';
const STUDENT_SHEET = '학생DB 관리';

const ACTIVITY_HEADERS = [
  '기록시간',
  '수업일/상담일',
  '학생명',
  '과정',
  '수업유형',
  '리포트링크',
  '문서구분',
  '세부유형',
  '상담/테스트일',
  '내용',
  '연락처',
  '드라이브링크',
  '학부모문의',
  '처리상태',
  '비고',
  '노션페이지ID',
  '노션페이지URL',
  '구글캘린더ID',
  '구글캘린더이벤트ID'
];

const STUDENT_HEADERS = [
  '이름',
  '학교/유치원',
  '학년/나이',
  '연락처',
  '과정',
  '상태',
  '최근기록일'
];

const TODO_SHEET = '실무_TODO';
const TODO_HEADERS = [
  'ID',
  '기록시간',
  '내용',
  '상태',
  '작성자',
  '출처',
  '완료시간'
];

function authorizeGfieldServices() {
  const root = DriveApp.getFolderById(getDriveRootId_());
  const ss = SpreadsheetApp.openById(getSheetId_());
  ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureSheet_(ss, STUDENT_SHEET, STUDENT_HEADERS);
  UrlFetchApp.fetch('https://api.github.com', { muteHttpExceptions: true });
  return {
    result: 'success',
    message: 'Drive, Spreadsheet, UrlFetch 권한 확인 완료',
    driveRootName: root.getName(),
    spreadsheetName: ss.getName()
  };
}

function 권한_승인() {
  return authorizeGfieldServices();
}

function checkDriveRootAccess() {
  const folderId = getDriveRootId_();
  try {
    const root = DriveApp.getFolderById(folderId);
    return {
      result: 'success',
      message: 'Drive 루트 폴더 접근 가능',
      folderId: folderId,
      folderName: root.getName(),
      folderUrl: root.getUrl()
    };
  } catch (err) {
    throw new Error(
      'Drive 루트 폴더 접근 실패. Apps Script를 실행하는 구글 계정에 폴더 보기/편집 권한이 필요합니다. ' +
      '폴더 ID: ' + folderId + ' / 원본 오류: ' + (err.message || err)
    );
  }
}

function 드라이브_폴더_확인() {
  return checkDriveRootAccess();
}

function testDriveAndSheetSetup() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  const activity = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const students = ensureSheet_(ss, STUDENT_SHEET, STUDENT_HEADERS);
  const folder = getOrCreateStudentFolder_('_권한테스트');
  const file = folder.createFile('_권한테스트.html', '<!doctype html><meta charset="utf-8"><body>G-Field 권한 테스트</body>', MimeType.HTML);
  const sharingWarning = safeSetAnyoneWithLink_(file);
  return {
    result: 'success',
    message: sharingWarning
      ? 'Drive 폴더 생성, HTML 파일 생성, 시트 접근 완료. 단, 링크 공개 권한은 구글 정책에 의해 차단됨.'
      : 'Drive 폴더 생성, HTML 파일 생성, 링크 공개, 시트 접근 테스트 완료',
    testFileUrl: file.getUrl(),
    activitySheet: activity.getName(),
    studentSheet: students.getName(),
    warning: sharingWarning
  };
}

function 드라이브_시트_점검() {
  return testDriveAndSheetSetup();
}

function testGithubToken() {
  const token = getGithubToken_({});
  const repo = parseRepo_('');
  const url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.repo;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: githubHeaders_(token),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('GitHub token/repo 확인 실패: ' + response.getContentText());
  }
  return {
    result: 'success',
    message: 'GitHub token 및 repo 접근 확인 완료',
    repo: repo.owner + '/' + repo.repo
  };
}

function 깃허브_토큰_확인() {
  return testGithubToken();
}

function 시트_열행_맞추기() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  const activity = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const students = ensureSheet_(ss, STUDENT_SHEET, STUDENT_HEADERS);
  const todo = ss.getSheetByName(TODO_SHEET) || ss.insertSheet(TODO_SHEET);
  applySheetLayout_(activity, ACTIVITY_HEADERS, '#16417C', [150, 120, 110, 210, 110, 260, 110, 110, 130, 420, 130, 260, 180, 150, 180, 180, 260, 180, 220]);
  applySheetLayout_(students, STUDENT_HEADERS, '#0f766e', [120, 150, 110, 130, 230, 110, 150]);
  applySheetLayout_(todo, TODO_HEADERS, '#b45309', [160, 150, 360, 100, 100, 120, 150]);
  return {
    result: 'success',
    message: '시트 1행 헤더, 색상, 고정, 열 너비를 맞췄습니다.',
    sheets: [activity.getName(), students.getName(), todo.getName()]
  };
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || '').trim();
    let data;

    if (action === 'save_drive') data = saveDrive_(payload);
    else if (action === 'deploy_github') data = deployGithub_(payload);
    else if (action === 'cs_save_record') data = saveCsRecord_(payload);
    else if (action === 'search_student') data = searchStudent_(payload);
    else if (action === 'update_student') data = upsertStudent_(payload);
    else if (action === 'update_keys') data = updateKeys_(payload);
    else if (action === 'notion') data = saveToNotion_(payload);
    else if (action === 'list_drive_photos') data = listDrivePhotos_(payload);
    else if (action === 'list_drive_folder') data = listDriveFolder_(payload);
    else if (action === 'delete_record' || action === 'delete_activity' || action === 'dashboard_delete') data = deleteRecord_(payload);
    else throw new Error('Unknown action: ' + action);

    return json_(data);
  } catch (err) {
    return json_({ result: 'error', error: err.message || String(err) });
  }
}

function doGet() {
  return json_({ result: 'success', message: 'G-Field Apps Script is running.' });
}

function saveDrive_(p) {
  const name = requireName_(p);
  const html = String(p.htmlContent || p.html || '');
  if (!html) throw new Error('htmlContent가 비어 있습니다.');

  const fileName = sanitizeFileName_(p.fileName || buildFileName_(p, name));
  const folder = getOrCreateStudentFolder_(name);
  const file = folder.createFile(fileName, html, MimeType.HTML);
  const sharingWarning = safeSetAnyoneWithLink_(file);
  const photoSharingWarning = openSharedPhotoFiles_(p.photoDriveUrls);

  const driveUrl = file.getUrl();
  const row = buildActivityRow_(p, {
    name: name,
    driveUrl: driveUrl,
    reportUrl: p.reportUrl || '',
    status: (sharingWarning || photoSharingWarning) ? 'Drive 저장 완료(공유 권한 확인 필요)' : 'Drive 저장 완료'
  });
  appendActivity_(p.sheetId, row);
  upsertStudent_(Object.assign({}, p, { name: name }));

  return { result: 'success', url: driveUrl, fileId: file.getId(), warning: [sharingWarning, photoSharingWarning].filter(Boolean).join(' / ') };
}

function deployGithub_(p) {
  const name = requireName_(p);
  const html = String(p.htmlContent || p.html || '');
  if (!html) throw new Error('htmlContent가 비어 있습니다.');

  const token = getGithubToken_(p);
  const repo = parseRepo_(p.repo);
  const fileName = sanitizeFileName_(p.fileName || lastPathPart_(p.path) || buildFileName_(p, name));
  const path = normalizeGithubPath_(p.path || (name + '/' + fileName));
  const apiPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl = 'https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/contents/' + apiPath;
  const sha = getGithubSha_(apiUrl, token, repo.branch);
  const body = {
    message: p.message || ('[자동배포] ' + name + ' 리포트 저장'),
    content: Utilities.base64Encode(html, Utilities.Charset.UTF_8),
    branch: repo.branch
  };
  if (sha) body.sha = sha;

  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: githubHeaders_(token),
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('GitHub 업로드 실패: ' + response.getContentText());
  }
  const photoSharingWarning = openSharedPhotoFiles_(p.photoDriveUrls);

  const pagesUrl = CONFIG.PAGES_BASE_URL + '/' + path.split('/').map(encodeURIComponent).join('/');
  const updated = updateLatestActivityReportLink_(p.sheetId, name, p.date, p.type, pagesUrl, p.driveUrl || '');
  if (!updated) {
    appendActivity_(p.sheetId, buildActivityRow_(p, {
      name: name,
      driveUrl: p.driveUrl || '',
      reportUrl: pagesUrl,
      status: 'GitHub 링크 생성 완료'
    }));
  }

  return { result: 'success', url: pagesUrl, warning: photoSharingWarning };
}

function saveCsRecord_(p) {
  const name = requireName_(p);
  appendActivity_(p.sheetId, buildActivityRow_(p, {
    name: name,
    driveUrl: '',
    reportUrl: '',
    status: 'CS 시트 기록 완료'
  }));
  upsertStudent_(Object.assign({}, p, { name: name }));
  return { result: 'success', message: '시트 기록 완료' };
}

function listDrivePhotos_(p) {
  const folderId = String(p.folderId || getDriveRootId_()).trim();
  const folder = DriveApp.getFolderById(folderId);
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    const mime = String(file.getMimeType() || '');
    if (mime.indexOf('image/') !== 0) continue;
    const id = file.getId();
    files.push({
      id: id,
      name: file.getName(),
      mimeType: mime,
      url: file.getUrl(),
      thumbUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w700',
      updated: file.getLastUpdated().getTime()
    });
  }
  files.sort(function(a, b) { return b.updated - a.updated; });
  return { result: 'success', files: files.slice(0, 120) };
}

function listDriveFolder_(p) {
  const folderId = String(p.folderId || getDriveRootId_()).trim();
  const folder = DriveApp.getFolderById(folderId);

  const folders = [];
  const folderIter = folder.getFolders();
  while (folderIter.hasNext()) {
    const f = folderIter.next();
    folders.push({
      id: f.getId(),
      name: f.getName(),
      updated: f.getLastUpdated().getTime()
    });
  }
  folders.sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });

  const files = [];
  const fileIter = folder.getFiles();
  while (fileIter.hasNext()) {
    const file = fileIter.next();
    const mime = String(file.getMimeType() || '');
    if (mime.indexOf('image/') !== 0) continue;
    const id = file.getId();
    files.push({
      id: id,
      name: file.getName(),
      mimeType: mime,
      url: file.getUrl(),
      thumbUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w700',
      updated: file.getLastUpdated().getTime()
    });
  }
  files.sort(function(a, b) { return b.updated - a.updated; });

  return {
    result: 'success',
    folder: { id: folder.getId(), name: folder.getName() },
    folders: folders,
    files: files.slice(0, 300)
  };
}

function searchStudent_(p) {
  const keyword = String(p.keyword || p.query || '').trim();
  if (!keyword) throw new Error('검색어가 비어 있습니다.');

  const ss = SpreadsheetApp.openById(p.sheetId || CONFIG.DASHBOARD_SHEET_ID);
  const studentSheet = ensureSheet_(ss, STUDENT_SHEET, STUDENT_HEADERS);
  const student = findStudent_(studentSheet, keyword);
  const history = student ? findHistory_(ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS), student.name || keyword) : [];
  return { result: 'success', student: student || null, history: history };
}

function upsertStudent_(p) {
  const name = String(p.name || p.studentName || '').trim();
  if (!name) return { result: 'success', message: '학생명 없음' };

  const ss = SpreadsheetApp.openById(p.sheetId || CONFIG.DASHBOARD_SHEET_ID);
  const sheet = ensureSheet_(ss, STUDENT_SHEET, STUDENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idx = headerIndex_(headers);
  let row = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx['이름']] || '').trim() === name) {
      row = i + 1;
      break;
    }
  }

  const record = {};
  record['이름'] = name;
  record['학교/유치원'] = p.school || '';
  record['학년/나이'] = p.grade || '';
  record['연락처'] = p.phone || '';
  record['과정'] = p.course || '';
  record['상태'] = p.status || p.dbStatus || '';
  record['최근기록일'] = new Date();

  if (row === -1) {
    sheet.appendRow(STUDENT_HEADERS.map(h => record[h] || ''));
  } else {
    STUDENT_HEADERS.forEach((h, i) => {
      if (record[h] !== '' || h === '최근기록일') sheet.getRange(row, i + 1).setValue(record[h]);
    });
  }
  return { result: 'success', message: '학생DB 저장 완료' };
}

function updateKeys_(p) {
  const props = PropertiesService.getScriptProperties();
  const map = {
    GITHUB_TOKEN: p.github_token,
    GITHUB_OWNER: p.github_user,
    GITHUB_REPO: p.github_repo,
    KAKAO_KEY: p.kakao_key,
    SHEET_ID: p.sheet_id,
    DRIVE_ROOT_ID: p.drive_folder_id,
    NOTION_KEY: p.notion_key,
    NOTION_DB: p.notion_db,
    GOOGLE_CALENDAR_ID: p.google_calendar_id
  };
  Object.keys(map).forEach(key => {
    if (map[key] !== undefined && map[key] !== null && String(map[key]).trim() !== '') {
      props.setProperty(key, String(map[key]).trim());
    }
  });
  return { result: 'success', message: '설정 저장 완료' };
}

function saveToNotion_(p) {
  const token = String(
    p.notion_key ||
    PropertiesService.getScriptProperties().getProperty('NOTION_KEY') ||
    ''
  ).trim();
  const databaseId = String(
    p.notion_db ||
    PropertiesService.getScriptProperties().getProperty('NOTION_DB') ||
    CONFIG.NOTION_DB_ID ||
    ''
  ).trim();
  if (!token) throw new Error('NOTION API KEY가 비어 있습니다.');
  if (!databaseId) throw new Error('NOTION DATABASE ID가 비어 있습니다.');

  const schema = getNotionDatabaseSchema_(token, databaseId);
  const properties = buildNotionProperties_(schema, p);
  const body = {
    parent: { database_id: databaseId },
    properties: properties
  };

  const response = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
    method: 'post',
    contentType: 'application/json',
    headers: notionHeaders_(token),
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Notion 저장 실패: ' + response.getContentText());
  }
  const data = JSON.parse(response.getContentText());
  const calendarResult = createGoogleCalendarEvent_(p, data.url);
  linkNotionCalendarToLatestActivity_(
    p.sheetId,
    String(p.name || p.studentName || ''),
    String(p.date || p.testDate || ''),
    String(p.type || p.cType || p.docType || ''),
    data.id || '',
    data.url || '',
    calendarResult.calendarId || '',
    calendarResult.eventId || ''
  );
  const message = calendarResult.created
    ? '노션 + 구글 캘린더 전송 완료'
    : '노션 전송 완료 (구글 캘린더는 일정일이 없어 생성 생략)';
  return {
    result: 'success',
    id: data.id,
    url: data.url,
    message: message,
    googleCalendar: calendarResult
  };
}

function deleteRecord_(p) {
  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  const sheet = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureActivityHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('삭제할 기록이 없습니다.');
  const idx = headerIndex_(values[0]);

  let rowNumber = Number(p.rowNumber || p.row || 0);
  if (!rowNumber) {
    rowNumber = findActivityRowNumber_(values, idx, p);
  }
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('삭제할 행을 찾지 못했습니다.');
  }

  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const notionPageId = String(p.notionPageId || row[idx['노션페이지ID']] || '').trim();
  const notionPageUrl = String(p.notionPageUrl || row[idx['노션페이지URL']] || '').trim();
  const calendarId = String(p.googleCalendarId || row[idx['구글캘린더ID']] || PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID') || CONFIG.GOOGLE_CALENDAR_ID || 'primary').trim();
  const eventId = String(p.googleEventId || row[idx['구글캘린더이벤트ID']] || '').trim();

  const notionResult = archiveNotionPageSafe_(notionPageId, notionPageUrl, p);
  const calendarResult = deleteGoogleCalendarEventSafe_(calendarId, eventId);

  sheet.deleteRow(rowNumber);
  return {
    result: 'success',
    message: '대시보드 기록 및 캘린더 동기 삭제 완료',
    rowNumber: rowNumber,
    notion: notionResult,
    googleCalendar: calendarResult
  };
}

function getNotionDatabaseSchema_(token, databaseId) {
  const response = UrlFetchApp.fetch('https://api.notion.com/v1/databases/' + databaseId, {
    method: 'get',
    headers: notionHeaders_(token),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Notion DB 조회 실패: ' + response.getContentText());
  }
  const data = JSON.parse(response.getContentText());
  return data.properties || {};
}

function buildNotionProperties_(schema, p) {
  const pairs = [
    ['name', p.name || p.studentName || '학생'],
    ['docType', p.docType || '리포트'],
    ['type', p.type || p.cType || ''],
    ['date', p.date || p.testDate || ''],
    ['school', p.school || ''],
    ['grade', p.grade || ''],
    ['phone', p.phone || ''],
    ['course', p.course || ''],
    ['content', p.content || ''],
    ['url', p.url || '']
  ];

  const titleKey = findNotionTitleKey_(schema);
  if (!titleKey) throw new Error('Notion DB에 title 속성이 없습니다.');

  const values = {};
  pairs.forEach(function(item) { values[item[0]] = String(item[1] || ''); });

  const properties = {};
  properties[titleKey] = { title: [{ text: { content: values.name } }] };

  Object.keys(schema).forEach(function(key) {
    if (key === titleKey) return;
    const def = schema[key] || {};
    const type = def.type;
    const k = key.toLowerCase();
    const v =
      (k.indexOf('type') !== -1 || k.indexOf('유형') !== -1) ? values.type :
      (k.indexOf('date') !== -1 || k.indexOf('일') !== -1) ? values.date :
      (k.indexOf('school') !== -1 || k.indexOf('학교') !== -1) ? values.school :
      (k.indexOf('grade') !== -1 || k.indexOf('학년') !== -1 || k.indexOf('나이') !== -1) ? values.grade :
      (k.indexOf('phone') !== -1 || k.indexOf('연락처') !== -1) ? values.phone :
      (k.indexOf('course') !== -1 || k.indexOf('과정') !== -1) ? values.course :
      (k.indexOf('link') !== -1 || k.indexOf('url') !== -1 || k.indexOf('주소') !== -1) ? values.url :
      (k.indexOf('doc') !== -1 || k.indexOf('문서') !== -1 || k.indexOf('mode') !== -1) ? values.docType :
      (k.indexOf('content') !== -1 || k.indexOf('memo') !== -1 || k.indexOf('내용') !== -1) ? values.content :
      '';
    if (!v) return;

    if (type === 'rich_text') properties[key] = { rich_text: [{ text: { content: v } }] };
    else if (type === 'url') properties[key] = { url: v };
    else if (type === 'phone_number') properties[key] = { phone_number: v };
    else if (type === 'title') properties[key] = { title: [{ text: { content: v } }] };
    else if (type === 'select') properties[key] = { select: { name: v } };
    else if (type === 'multi_select') properties[key] = { multi_select: [{ name: v }] };
    else if (type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(v)) properties[key] = { date: { start: v.slice(0, 10) } };
  });

  return properties;
}

function findNotionTitleKey_(schema) {
  const keys = Object.keys(schema || {});
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (schema[k] && schema[k].type === 'title') return k;
  }
  return '';
}

function notionHeaders_(token) {
  return {
    Authorization: 'Bearer ' + token,
    'Notion-Version': '2022-06-28'
  };
}

function createGoogleCalendarEvent_(p, notionUrl) {
  const dateText = String(p.date || p.testDate || '').trim();
  if (!dateText) return { created: false, reason: 'date_missing' };

  const calendarId = String(
    p.google_calendar_id ||
    PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID') ||
    CONFIG.GOOGLE_CALENDAR_ID
  ).trim();
  const cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('구글 캘린더를 찾을 수 없습니다. calendarId=' + calendarId);

  const day = toDateOnly_(dateText);
  if (!day) return { created: false, reason: 'date_parse_failed', raw: dateText };

  const title = '[지필드] ' + String(p.name || p.studentName || '학생') + ' ' + String(p.docType || p.type || '일정');
  const desc = [
    '학생명: ' + String(p.name || p.studentName || ''),
    '유형: ' + String(p.type || p.cType || p.docType || ''),
    '학교/유치원: ' + String(p.school || ''),
    '학년/나이: ' + String(p.grade || ''),
    '연락처: ' + String(p.phone || ''),
    '과정: ' + String(p.course || ''),
    '내용: ' + String(p.content || ''),
    notionUrl ? ('노션: ' + notionUrl) : '',
    p.url ? ('공유링크: ' + String(p.url)) : ''
  ].filter(Boolean).join('\n');

  const event = cal.createAllDayEvent(title, day, {
    description: desc,
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    guestsCanSeeGuests: false
  });
  try {
    event.addPopupReminder(30);
  } catch (e) {
    // Some calendars may block reminders by policy; ignore safely.
  }
  return { created: true, calendarId: calendarId, eventId: event.getId() };
}

function toDateOnly_(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function requireName_(p) {
  const name = String(p.studentName || p.name || (p.csRecord && p.csRecord.name) || '').trim();
  if (!name) throw new Error('학생명은 필수입니다.');
  return name;
}

function getDriveRootId_() {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_ID') || CONFIG.DRIVE_ROOT_ID;
}

function getSheetId_(given) {
  return given || PropertiesService.getScriptProperties().getProperty('SHEET_ID') || CONFIG.DASHBOARD_SHEET_ID;
}

function getOrCreateStudentFolder_(name) {
  let root;
  const folderId = getDriveRootId_();
  try {
    root = DriveApp.getFolderById(folderId);
  } catch (err) {
    throw new Error(
      'Drive 루트 폴더 접근 실패. Apps Script 실행 계정에 해당 폴더 권한을 부여해 주세요. ' +
      '폴더 ID: ' + folderId + ' / 원본 오류: ' + (err.message || err)
    );
  }
  const folders = root.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : root.createFolder(name);
}

function safeSetAnyoneWithLink_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return '';
  } catch (err) {
    return 'Google Drive 정책 또는 폴더 설정 때문에 anyone with link 권한 부여가 차단되었습니다: ' + (err.message || err);
  }
}

function extractDriveFileId_(url) {
  const s = String(url || '').trim();
  let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return '';
}

function openSharedPhotoFiles_(urls) {
  if (!Array.isArray(urls) || !urls.length) return '';
  const ids = {};
  urls.forEach(function(url) {
    const id = extractDriveFileId_(url);
    if (id) ids[id] = true;
  });
  const errors = [];
  Object.keys(ids).forEach(function(id) {
    try {
      const warning = safeSetAnyoneWithLink_(DriveApp.getFileById(id));
      if (warning) errors.push(id + ': ' + warning);
    } catch (err) {
      errors.push(id + ': ' + (err.message || err));
    }
  });
  return errors.length ? '일부 사진 공유권한 설정 실패: ' + errors.join(', ') : '';
}

function sanitizeFileName_(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
}

function buildFileName_(p, name) {
  const ymd = String(p.date || (p.attendance && p.attendance.date) || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const type = String(p.type || '리포트').trim();
  return '지필드_' + ymd + '_' + name + '_' + type + '_리포트.html';
}

function buildActivityRow_(p, extra) {
  const cs = p.csRecord || {};
  const at = p.attendance || {};
  const date = p.date || cs.date || at.date || '';
  const type = p.type || cs.type || at.type || '';
  const content = p.content || cs.summaryContent || at.memo || at.subjects_merged || cs.content || '';
  const docType = p.mode === '상담' ? 'CS' : '학습리포트';
  return [
    new Date(),
    date,
    extra.name,
    p.course || cs.course || at.course || '',
    docType,
    extra.reportUrl || p.reportUrl || '',
    docType,
    type,
    date,
    content,
    p.phone || cs.phone || at.phone || '',
    extra.driveUrl || '',
    '',
    extra.status || '',
    '',
    '',
    '',
    '',
    ''
  ];
}

function appendActivity_(sheetId, row) {
  const ss = SpreadsheetApp.openById(getSheetId_(sheetId));
  const sheet = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureActivityHeaders_(sheet);
  sheet.appendRow(row);
}

function updateLatestActivityReportLink_(sheetId, name, date, type, reportUrl, driveUrl) {
  const ss = SpreadsheetApp.openById(getSheetId_(sheetId));
  const sheet = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  const idx = headerIndex_(values[0]);
  for (let i = values.length - 1; i >= 1; i--) {
    const sameName = String(values[i][idx['학생명']] || '').trim() === String(name || '').trim();
    const sameDate = !date || String(values[i][idx['수업일/상담일']] || '').trim() === String(date).trim();
    const sameType = !type || String(values[i][idx['세부유형']] || '').trim() === String(type).trim();
    if (sameName && sameDate && sameType) {
      if (driveUrl && !values[i][idx['드라이브링크']]) sheet.getRange(i + 1, idx['드라이브링크'] + 1).setValue(driveUrl);
      sheet.getRange(i + 1, idx['리포트링크'] + 1).setValue(reportUrl);
      sheet.getRange(i + 1, idx['처리상태'] + 1).setValue('GitHub 링크 생성 완료');
      return true;
    }
  }
  return false;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const first = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  const empty = first.every(v => String(v || '').trim() === '');
  if (empty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function ensureActivityHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let changed = false;
  ACTIVITY_HEADERS.forEach(function(h, i) {
    if (String(headerRow[i] || '').trim() !== h) {
      sheet.getRange(1, i + 1).setValue(h);
      changed = true;
    }
  });
  return changed;
}

function applySheetLayout_(sheet, headers, headerColor, widths) {
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (lastCol > headers.length) {
    sheet.getRange(1, headers.length + 1, 1, lastCol - headers.length).clearContent();
  }
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground(headerColor)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  headers.forEach(function(_, i) {
    sheet.setColumnWidth(i + 1, widths && widths[i] ? widths[i] : 140);
  });
}

function headerIndex_(headers) {
  const map = {};
  headers.forEach((h, i) => map[String(h).trim()] = i);
  return map;
}

function findStudent_(sheet, keyword) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const idx = headerIndex_(values[0]);
  const key = keyword.replace(/\D/g, '');
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][idx['이름']] || '').trim();
    const phone = String(values[i][idx['연락처']] || '').trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (name === keyword || name.indexOf(keyword) !== -1 || (key && phoneDigits.endsWith(key))) {
      return {
        name: name,
        school: values[i][idx['학교/유치원']] || '',
        grade: values[i][idx['학년/나이']] || '',
        phone: phone,
        course: values[i][idx['과정']] || '',
        status: values[i][idx['상태']] || ''
      };
    }
  }
  return null;
}

function findHistory_(sheet, name) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const idx = headerIndex_(values[0]);
  const rows = [];
  for (let i = values.length - 1; i >= 1 && rows.length < 20; i--) {
    if (String(values[i][idx['학생명']] || '').trim() === name) {
      rows.push({
        date: values[i][idx['수업일/상담일']] || '',
        type: values[i][idx['세부유형']] || values[i][idx['수업유형']] || '',
        memo: values[i][idx['내용']] || '',
        driveUrl: values[i][idx['드라이브링크']] || '',
        reportUrl: values[i][idx['리포트링크']] || ''
      });
    }
  }
  return rows;
}

function linkNotionCalendarToLatestActivity_(sheetId, name, date, type, notionPageId, notionPageUrl, calendarId, eventId) {
  if (!name) return false;
  const ss = SpreadsheetApp.openById(getSheetId_(sheetId));
  const sheet = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureActivityHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  const idx = headerIndex_(values[0]);

  for (let i = values.length - 1; i >= 1; i--) {
    const sameName = String(values[i][idx['학생명']] || '').trim() === String(name).trim();
    const sameDate = !date || String(values[i][idx['수업일/상담일']] || '').trim() === String(date).trim();
    const sameType = !type || String(values[i][idx['세부유형']] || '').trim() === String(type).trim();
    if (sameName && sameDate && sameType) {
      if (notionPageId) sheet.getRange(i + 1, idx['노션페이지ID'] + 1).setValue(notionPageId);
      if (notionPageUrl) sheet.getRange(i + 1, idx['노션페이지URL'] + 1).setValue(notionPageUrl);
      if (calendarId) sheet.getRange(i + 1, idx['구글캘린더ID'] + 1).setValue(calendarId);
      if (eventId) sheet.getRange(i + 1, idx['구글캘린더이벤트ID'] + 1).setValue(eventId);
      return true;
    }
  }
  return false;
}

function findActivityRowNumber_(values, idx, p) {
  const keyName = String(p.name || p.studentName || '').trim();
  const keyDate = String(p.date || '').trim();
  const keyType = String(p.type || '').trim();
  const keyDrive = String(p.driveUrl || '').trim();
  const keyReport = String(p.reportUrl || '').trim();

  for (let i = values.length - 1; i >= 1; i--) {
    const sameName = !keyName || String(values[i][idx['학생명']] || '').trim() === keyName;
    const sameDate = !keyDate || String(values[i][idx['수업일/상담일']] || '').trim() === keyDate;
    const sameType = !keyType || String(values[i][idx['세부유형']] || '').trim() === keyType;
    const sameDrive = !keyDrive || String(values[i][idx['드라이브링크']] || '').trim() === keyDrive;
    const sameReport = !keyReport || String(values[i][idx['리포트링크']] || '').trim() === keyReport;
    if (sameName && sameDate && sameType && sameDrive && sameReport) return i + 1;
  }
  return 0;
}

function archiveNotionPageSafe_(notionPageId, notionPageUrl, p) {
  const token = String(
    p.notion_key ||
    PropertiesService.getScriptProperties().getProperty('NOTION_KEY') ||
    ''
  ).trim();
  const id = String(notionPageId || extractNotionPageId_(notionPageUrl)).trim();
  if (!id) return { attempted: false, reason: 'no_notion_id' };
  if (!token) return { attempted: false, reason: 'no_notion_token' };

  const response = UrlFetchApp.fetch('https://api.notion.com/v1/pages/' + id, {
    method: 'patch',
    contentType: 'application/json',
    headers: notionHeaders_(token),
    payload: JSON.stringify({ archived: true }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    return { attempted: true, archived: false, error: response.getContentText() };
  }
  return { attempted: true, archived: true, id: id };
}

function extractNotionPageId_(url) {
  const text = String(url || '');
  const m1 = text.match(/([a-f0-9]{32})/i);
  if (m1) return m1[1];
  const m2 = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (m2) return m2[1];
  return '';
}

function deleteGoogleCalendarEventSafe_(calendarId, eventId) {
  if (!eventId) return { attempted: false, reason: 'no_event_id' };
  const cal = CalendarApp.getCalendarById(calendarId || CONFIG.GOOGLE_CALENDAR_ID);
  if (!cal) return { attempted: false, reason: 'calendar_not_found' };
  const ev = cal.getEventById(eventId);
  if (!ev) return { attempted: false, reason: 'event_not_found', eventId: eventId };
  ev.deleteEvent();
  return { attempted: true, deleted: true, eventId: eventId };
}

function getGithubToken_(p) {
  const token = p.github_token || PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GitHub token이 없습니다. API 키 및 환경 설정에서 저장해 주세요.');
  return token;
}

function parseRepo_(repoText) {
  const props = PropertiesService.getScriptProperties();
  const text = String(repoText || '').trim();
  const parts = text.indexOf('/') !== -1 ? text.split('/') : [];
  return {
    owner: parts[0] || props.getProperty('GITHUB_OWNER') || CONFIG.GITHUB_OWNER,
    repo: parts[1] || props.getProperty('GITHUB_REPO') || CONFIG.GITHUB_REPO,
    branch: CONFIG.GITHUB_BRANCH
  };
}

function githubHeaders_(token) {
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function getGithubSha_(apiUrl, token, branch) {
  const response = UrlFetchApp.fetch(apiUrl + '?ref=' + encodeURIComponent(branch), {
    method: 'get',
    headers: githubHeaders_(token),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() === 404) return '';
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('GitHub 파일 확인 실패: ' + response.getContentText());
  }
  const data = JSON.parse(response.getContentText());
  return data.sha || '';
}

function normalizeGithubPath_(path) {
  return String(path || '').replace(/^\/+/, '').split('/').map(sanitizeFileName_).join('/');
}

function lastPathPart_(path) {
  const parts = String(path || '').split('/');
  return parts[parts.length - 1] || '';
}
