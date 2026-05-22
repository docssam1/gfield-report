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

const MASTER_SHEET = '일정_마스터';
const MASTER_HEADERS = [
  '마스터ID',
  '관련그룹ID',
  '원본출처',
  '원본키',
  '학생명',
  '일정유형',
  '상태',
  '기준일',
  '시작일시',
  '종료일시',
  '요약',
  '상세',
  '확인필요',
  '캘린더이벤트ID',
  '노션페이지ID',
  '드라이브링크',
  '리포트링크',
  '동기화상태',
  '실패단계',
  '오류로그',
  '생성시각',
  '수정시각'
];
const SYNC_LOG_SHEET = '동기화_로그';
const SYNC_LOG_HEADERS = ['시간', '작업', '단계', '상태', '메시지', '상세JSON'];
const APPROVAL_QUEUE_SHEET = '승인_대기';
const APPROVAL_QUEUE_HEADERS = ['토큰', '작업', '요청JSON', '요약', '상태', '요청시각', '승인시각', '실행시각', '실행결과JSON'];

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
  let payload = {};
  let action = '';
  try {
    payload = parsePayload_(e);
    action = String(payload.action || '').trim();
    let data;

    if (action === 'save_drive') data = saveDrive_(payload);
    else if (action === 'deploy_github') data = deployGithub_(payload);
    else if (action === 'cs_save_record') data = saveCsRecord_(payload);
    else if (action === 'search_student') data = searchStudent_(payload);
    else if (action === 'update_student') data = upsertStudent_(payload);
    else if (action === 'update_keys') data = updateKeys_(payload);
    else if (action === 'todo_list') data = todoList_(payload);
    else if (action === 'todo_add') data = todoAdd_(payload);
    else if (action === 'todo_toggle') data = todoToggle_(payload);
    else if (action === 'todo_delete') data = todoDelete_(payload);
    else if (action === 'todo_to_calendar_ai') throw new Error('직접 실행이 차단되었습니다. ai_op_preview -> ai_op_execute 승인 절차를 사용하세요.');
    else if (action === 'backup_core_sheets') data = backupCoreSheets_(payload);
    else if (action === 'sync_master_preview') data = syncMasterPreview_(payload);
    else if (action === 'sync_master_execute') data = syncMasterExecute_(payload);
    else if (action === 'ai_op_preview') data = aiOperationPreview_(payload);
    else if (action === 'ai_op_execute') data = aiOperationExecute_(payload);
    else if (action === 'resync_calendar_from_week_start') data = resyncCalendarFromWeekStart_(payload);
    else if (action === 'notion') data = saveToNotion_(payload);
    else if (action === 'assistant_query') data = assistantQuery_(payload);
    else if (action === 'list_drive_photos') data = listDrivePhotos_(payload);
    else if (action === 'list_drive_folder') data = listDriveFolder_(payload);
    else if (action === 'delete_record' || action === 'delete_activity' || action === 'dashboard_delete') data = deleteRecord_(payload);
    else throw new Error('Unknown action: ' + action);

    return json_(data);
  } catch (err) {
    safeLogActionFailure_(action, payload, err);
    return json_({ result: 'error', error: err.message || String(err) });
  }
}

function doGet() {
  return json_({ result: 'success', message: 'G-Field Apps Script is running.' });
}

function safeLogActionFailure_(action, payload, err) {
  try {
    const ss = SpreadsheetApp.openById(getSheetId_(payload && payload.sheetId));
    ensureMasterInfra_(ss);
    const stage = resolveFailureStage_(action);
    const sh = ensureSyncLogSheet_(ss);
    sh.appendRow([
      new Date(),
      String(action || 'unknown'),
      stage,
      'error',
      String((err && err.message) || err || 'unknown error'),
      JSON.stringify({
        action: String(action || ''),
        stage: stage,
        sheetId: String((payload && payload.sheetId) || ''),
        payloadKeys: Object.keys(payload || {}),
        at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
      })
    ]);
  } catch (ignore) {}
}

function resolveFailureStage_(action) {
  const a = String(action || '');
  if (a === 'save_drive') return 'Drive';
  if (a === 'deploy_github') return 'GitHub';
  if (a === 'notion') return 'Notion/Calendar';
  if (a.indexOf('todo_') === 0) return 'To-Do';
  if (a === 'sync_master_preview' || a === 'sync_master_execute' || a === 'backup_core_sheets') return 'Sync';
  return 'General';
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
    GOOGLE_CALENDAR_ID: p.google_calendar_id,
    GEMINI_API_KEY: p.gemini_key
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

  const student = String(p.name || p.studentName || '학생').trim();
  const rawType = String(p.type || p.cType || p.docType || '일정').trim();
  const startTime = String(p.start || p.startTime || p.time || '').trim();
  const typeLabel =
    (rawType.indexOf('결석') !== -1 || rawType.indexOf('휴강') !== -1) ? '결석' :
    (rawType.indexOf('보강') !== -1 || rawType.indexOf('보충') !== -1) ? '보강' :
    (rawType.indexOf('상담') !== -1 || rawType.indexOf('테스트') !== -1) ? '상담' :
    rawType || '일정';
  const title = startTime
    ? ('[' + typeLabel + '] ' + student + ' ' + startTime)
    : ('[' + typeLabel + '] ' + student);

  const desc = [
    '학생명: ' + student,
    '유형: ' + rawType,
    startTime ? ('시작시간: ' + startTime) : '',
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

function assistantQuery_(p) {
  const q = String(p.question || '').trim();
  if (!q) return { result: 'error', error: 'question is required' };
  const key = String(
    p.gemini_key ||
    PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') ||
    ''
  ).trim();
  if (!key) return { result: 'error', error: 'GEMINI API KEY가 비어 있습니다.' };

  const todos = Array.isArray(p.todos) ? p.todos.slice(0, 200) : [];
  const ctx = {
    now: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
    currentMode: String(p.currentMode || ''),
    classType: String(p.classType || ''),
    name: String(p.name || ''),
    date: String(p.date || ''),
    todos: todos
  };

  const systemPrompt =
    '너는 학원 운영 비서다. 한국어로 간결하게 답한다. ' +
    '질문에 답하면서 intent(일반수업|결석|보강|상담|테스트진행)와 confidence(0~1)를 반드시 판단한다. ' +
    '질문에서 기간(오늘|내일|이번주|다음주|이번달|날짜범위)과 대상유형(보강|결석|상담|테스트)을 우선 해석해 todos에서 근거를 찾아 답한다. ' +
    '근거가 없으면 없다고 명확히 말하고, 추정하지 않는다. ' +
    '개인정보는 과도하게 노출하지 말고 필요한 정보만 요약한다. ' +
    '응답은 반드시 JSON만 출력한다. 형식: {"intent":"...","confidence":0.00,"answer":"..."}';
  const userPrompt =
    '질문:\n' + q + '\n\n' +
    '현재 컨텍스트(JSON):\n' + JSON.stringify(ctx);

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(key);
  const body = {
    contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Gemini 호출 실패: ' + response.getContentText());
  }
  const data = JSON.parse(response.getContentText() || '{}');
  const answer =
    (((data.candidates || [])[0] || {}).content || {}).parts &&
    (((data.candidates || [])[0] || {}).content || {}).parts[0] &&
    (((data.candidates || [])[0] || {}).content || {}).parts[0].text
      ? (((data.candidates || [])[0] || {}).content || {}).parts[0].text
      : '';
  if (!answer) return { result: 'error', error: 'Gemini 응답이 비어 있습니다.' };

  var parsed = null;
  try {
    parsed = JSON.parse(String(answer).trim());
  } catch (e) {
    var m = String(answer).match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (e2) {}
    }
  }
  if (!parsed) {
    return { result: 'success', intent: '일반수업', confidence: 0.55, answer: String(answer).trim() };
  }
  var intent = String(parsed.intent || '일반수업').trim();
  var confidence = Number(parsed.confidence || 0.6);
  if (isNaN(confidence)) confidence = 0.6;
  confidence = Math.max(0, Math.min(1, confidence));
  var finalAnswer = String(parsed.answer || '').trim() || String(answer).trim();
  return { result: 'success', intent: intent, confidence: confidence, answer: finalAnswer };
}

function ensureTodoSheet_(sheetId) {
  const ss = SpreadsheetApp.openById(getSheetId_(sheetId));
  const sh = ss.getSheetByName(TODO_SHEET) || ss.insertSheet(TODO_SHEET);
  const first = sh.getRange(1, 1, 1, TODO_HEADERS.length).getValues()[0];
  const empty = first.every(function(v) { return String(v || '').trim() === ''; });
  if (empty) sh.getRange(1, 1, 1, TODO_HEADERS.length).setValues([TODO_HEADERS]);
  return sh;
}

function todoList_(p) {
  const sh = ensureTodoSheet_(p.sheetId);
  const last = sh.getLastRow();
  if (last < 2) return { result: 'success', todos: [] };

  const rows = sh.getRange(2, 1, last - 1, TODO_HEADERS.length).getValues();
  const includeCompleted = p.includeCompleted === true;

  const todos = rows.map(function(r) {
    return {
      id: String(r[0] || ''),
      text: String(r[2] || ''),
      status: String(r[3] || '진행중'),
      done: String(r[3] || '') === '완료',
      writer: String(r[4] || ''),
      source: String(r[5] || ''),
      createdAt: String(r[1] || ''),
      completedAt: String(r[6] || '')
    };
  }).filter(function(t) { return t.id && t.text; });

  const filtered = includeCompleted
    ? todos.filter(function(t) { return t.status !== '삭제'; })
    : todos.filter(function(t) { return !t.done && t.status !== '삭제'; });

  return { result: 'success', todos: filtered };
}

function todoAdd_(p) {
  const text = String(p.text || '').trim();
  if (!text) return { result: 'error', error: 'text is required' };

  const sh = ensureTodoSheet_(p.sheetId);
  const now = new Date();
  const id = Utilities.getUuid();
  sh.appendRow([
    id,
    now,
    text,
    '진행중',
    String(p.writer || '원장'),
    String(p.source || '수동입력'),
    ''
  ]);
  return { result: 'success', id: id };
}

function todoToggle_(p) {
  const id = String(p.id || '').trim();
  if (!id) return { result: 'error', error: 'id is required' };

  const sh = ensureTodoSheet_(p.sheetId);
  const last = sh.getLastRow();
  if (last < 2) return { result: 'error', error: 'todo not found' };

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(function(r) { return String(r[0] || ''); });
  const idx = ids.indexOf(id);
  if (idx === -1) return { result: 'error', error: 'todo not found' };

  const row = idx + 2;
  const done = !!p.done;
  sh.getRange(row, 4).setValue(done ? '완료' : '진행중');
  sh.getRange(row, 7).setValue(done ? new Date() : '');
  return { result: 'success' };
}

function todoDelete_(p) {
  const id = String(p.id || '').trim();
  if (!id) return { result: 'error', error: 'id is required' };

  const sh = ensureTodoSheet_(p.sheetId);
  const last = sh.getLastRow();
  if (last < 2) return { result: 'error', error: 'todo not found' };

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(function(r) { return String(r[0] || ''); });
  const idx = ids.indexOf(id);
  if (idx === -1) return { result: 'error', error: 'todo not found' };

  const row = idx + 2;
  sh.getRange(row, 4).setValue('삭제');
  return { result: 'success' };
}

function todoToCalendarAi_(p) {
  var text = String(p.text || '').trim();
  if (!text) return { result: 'error', error: 'text is required' };

  var calendarId = String(
    p.google_calendar_id ||
    PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID') ||
    CONFIG.GOOGLE_CALENDAR_ID ||
    'primary'
  ).trim();
  var cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('구글 캘린더를 찾을 수 없습니다. calendarId=' + calendarId);

  var parsed = parseTodoScheduleByAiOrRegex_(text, p);
  if (!parsed || !parsed.start) {
    return { result: 'error', error: '일정 날짜/시간을 해석하지 못했습니다. To-Do 문장에 날짜를 포함해 주세요.' };
  }
  if (parsed.needConfirm) {
    return { result: 'error', error: parsed.needConfirm };
  }

  var title = String(parsed.title || text).trim().slice(0, 120);
  var desc = String(parsed.description || text).trim();
  var event;

  if (parsed.allDay) {
    event = cal.createAllDayEvent(title, parsed.start, { description: desc });
  } else {
    var end = parsed.end || new Date(parsed.start.getTime() + 60 * 60 * 1000);
    if (end.getTime() <= parsed.start.getTime()) end = new Date(parsed.start.getTime() + 60 * 60 * 1000);
    event = cal.createEvent(title, parsed.start, end, { description: desc });
  }

  return {
    result: 'success',
    calendarId: calendarId,
    eventId: event.getId(),
    eventTitle: title,
    start: parsed.start,
    end: parsed.end || ''
  };
}

function parseTodoScheduleByAiOrRegex_(text, p) {
  var ai = parseTodoScheduleByAi_(text, p);
  if (ai && ai.start) return ai;
  return parseTodoScheduleByRegex_(text);
}

function parseTodoScheduleByAi_(text, p) {
  var key = String(
    p.gemini_key ||
    PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') ||
    ''
  ).trim();
  if (!key) return null;

  var now = new Date();
  var nowYmd = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  var prompt =
    '다음 To-Do 문장에서 캘린더 일정을 추출해 JSON으로만 답해라.\n' +
    '오늘 날짜 기준: ' + nowYmd + '\n' +
    '필수 키: title, date(yyyy-MM-dd), start(HH:mm or ""), end(HH:mm or ""), allDay(true/false), description\n' +
    '날짜를 못 찾으면 {"error":"date_missing"} 만 출력.\n' +
    '문장: ' + text;

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(key);
  var body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
  };
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return null;
  var data = JSON.parse(response.getContentText() || '{}');
  var answer =
    (((data.candidates || [])[0] || {}).content || {}).parts &&
    (((data.candidates || [])[0] || {}).content || {}).parts[0] &&
    (((data.candidates || [])[0] || {}).content || {}).parts[0].text
      ? (((data.candidates || [])[0] || {}).content || {}).parts[0].text
      : '';
  if (!answer) return null;

  var obj = null;
  try {
    obj = JSON.parse(String(answer).trim());
  } catch (e) {
    var m = String(answer).match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch (e2) {}
    }
  }
  if (!obj || obj.error) return null;

  var dateText = String(obj.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  var startText = String(obj.start || '').trim();
  var endText = String(obj.end || '').trim();
  var allDay = obj.allDay === true || !startText;

  var start = allDay ? toDateOnly_(dateText) : mergeDateAndTime_(dateText, startText);
  if (!start) return null;
  var end = null;
  if (!allDay && endText) end = mergeDateAndTime_(dateText, endText);

  return {
    title: String(obj.title || '').trim() || text,
    description: String(obj.description || '').trim() || text,
    allDay: allDay,
    start: start,
    end: end
  };
}

function parseTodoScheduleByRegex_(text) {
  var s = String(text || '');
  var now = new Date();
  var y = now.getFullYear();
  var m;

  var date = null;
  if (/오늘/.test(s)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (/내일/.test(s)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else {
    m = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    if (m) date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!date) {
      m = s.match(/(\d{1,2})\/(\d{1,2})/);
      if (m) date = new Date(y, Number(m[1]) - 1, Number(m[2]));
    }
  }
  if (!date) return null;

  var tm = s.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
  if (tm) {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(tm[1]), Number(tm[2]), 0, 0);
    var end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(tm[3]), Number(tm[4]), 0, 0);
    return { title: s.slice(0, 120), description: s, allDay: false, start: start, end: end };
  }
  tm = s.match(/(\d{1,2}):(\d{2})/);
  if (tm) {
    var st = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(tm[1]), Number(tm[2]), 0, 0);
    return { title: s.slice(0, 120), description: s, allDay: false, start: st, end: null };
  }
  var k = parseKoreanClockExpr_(s);
  if (k && k.needConfirm) {
    return { needConfirm: k.needConfirm };
  }
  if (k) {
    var st2 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), k.hour, k.minute, 0, 0);
    return { title: s.slice(0, 120), description: s, allDay: false, start: st2, end: null };
  }
  return { title: s.slice(0, 120), description: s, allDay: true, start: date, end: null };
}

function mergeDateAndTime_(dateText, timeText) {
  var dm = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var tm = String(timeText || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0);
}

function parseKoreanClockExpr_(s) {
  var t = String(s || '');
  var m = t.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (!m) return null;
  var mer = String(m[1] || '').trim();
  var h = Number(m[2]);
  var mm = Number(m[3] || 0);
  if (isNaN(h) || h < 1 || h > 12 || isNaN(mm) || mm < 0 || mm > 59) return null;

  if (mer === '오전') {
    if (h === 12) h = 0;
    return { hour: h, minute: mm };
  }
  if (mer === '오후') {
    if (h < 12) h += 12;
    return { hour: h, minute: mm };
  }

  // no meridiem: custom business rule
  // 3시 -> 15:00, 12시 -> 12:00, 11시 -> 11:00, 1시30분 -> 13:30
  // 9시는 모호하므로 확인 요청
  if (h === 9) {
    return { needConfirm: '9시는 오전/오후 확인이 필요합니다. 예: 오전 9시 또는 오후 9시' };
  }
  if (h === 11) return { hour: 11, minute: mm };
  if (h === 12) return { hour: 12, minute: mm };
  if (h >= 1 && h <= 8) return { hour: h + 12, minute: mm };
  if (h === 10) return { hour: 22, minute: mm };
  return { hour: h, minute: mm };
}

function resyncCalendarFromWeekStart_(p) {
  var ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  var sheet = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureActivityHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { result: 'success', message: '재동기화할 데이터가 없습니다.', updated: 0 };
  }
  var idx = headerIndex_(values[0]);
  var startDate = p.startDate ? toDateOnly_(String(p.startDate)) : mondayOfCurrentWeek_();
  if (!startDate) throw new Error('startDate 해석 실패');

  var calendarId = String(
    p.google_calendar_id ||
    PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID') ||
    CONFIG.GOOGLE_CALENDAR_ID ||
    'primary'
  ).trim();
  var cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('구글 캘린더를 찾을 수 없습니다. calendarId=' + calendarId);

  var updated = 0;
  var skipped = 0;
  var errors = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var dateText = String(row[idx['수업일/상담일']] || row[idx['상담/테스트일']] || '').trim();
    var day = toDateOnly_(dateText);
    if (!day) { skipped++; continue; }
    if (day.getTime() < startDate.getTime()) continue;

    var name = String(row[idx['학생명']] || '').trim() || '학생';
    var typeRaw = String(row[idx['세부유형']] || row[idx['수업유형']] || row[idx['문서구분']] || '').trim();
    var content = String(row[idx['내용']] || '').trim();
    var phone = String(row[idx['연락처']] || '').trim();
    var schoolOrCourse = String(row[idx['과정']] || '').trim();
    var reportUrl = String(row[idx['리포트링크']] || '').trim();

    var typeLabel =
      (typeRaw.indexOf('결석') !== -1 || typeRaw.indexOf('휴강') !== -1) ? '결석' :
      (typeRaw.indexOf('보강') !== -1 || typeRaw.indexOf('보충') !== -1) ? '보강' :
      (typeRaw.indexOf('상담') !== -1 || typeRaw.indexOf('테스트') !== -1) ? '상담' :
      (typeRaw || '일정');

    var title = '[' + typeLabel + '] ' + name;
    var desc = [
      '학생명: ' + name,
      '유형: ' + typeRaw,
      schoolOrCourse ? ('과정: ' + schoolOrCourse) : '',
      phone ? ('연락처: ' + phone) : '',
      content ? ('내용: ' + content) : '',
      reportUrl ? ('리포트: ' + reportUrl) : ''
    ].filter(Boolean).join('\n');

    try {
      var oldCalendarId = String(row[idx['구글캘린더ID']] || calendarId).trim();
      var oldEventId = String(row[idx['구글캘린더이벤트ID']] || '').trim();
      if (oldEventId) {
        var oldCal = CalendarApp.getCalendarById(oldCalendarId || calendarId);
        if (oldCal) {
          var oldEv = oldCal.getEventById(oldEventId);
          if (oldEv) oldEv.deleteEvent();
        }
      }

      var newEv = cal.createAllDayEvent(title, day, {
        description: desc,
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        guestsCanSeeGuests: false
      });
      try { newEv.addPopupReminder(30); } catch (eRem) {}

      var rowNum = i + 1;
      sheet.getRange(rowNum, idx['구글캘린더ID'] + 1).setValue(calendarId);
      sheet.getRange(rowNum, idx['구글캘린더이벤트ID'] + 1).setValue(newEv.getId());
      updated++;
    } catch (rowErr) {
      errors.push('row ' + (i + 1) + ': ' + (rowErr.message || rowErr));
    }
  }

  return {
    result: 'success',
    message: '이번 주 시작일 기준 캘린더 재동기화 완료',
    startDate: Utilities.formatDate(startDate, 'Asia/Seoul', 'yyyy-MM-dd'),
    updated: updated,
    skipped: skipped,
    errors: errors.slice(0, 20)
  };
}

function mondayOfCurrentWeek_() {
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var day = d.getDay(); // 0=Sun
  var diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Manual runner for Apps Script UI (Run button)
function resync_calendar_from_week_start() {
  return resyncCalendarFromWeekStart_({});
}

// Step 0 manual runners
function step0_backup_core_sheets() {
  return backupCoreSheets_({});
}

function step0_sync_master_preview() {
  const result = syncMasterPreview_({
    includeDriveHtml: true,
    maxDriveFiles: 500
  });
  if (result && result.token) {
    PropertiesService.getScriptProperties().setProperty('STEP0_LAST_SYNC_TOKEN', String(result.token));
  }
  return result;
}

function step0_sync_master_execute() {
  const token = String(PropertiesService.getScriptProperties().getProperty('STEP0_LAST_SYNC_TOKEN') || '').trim();
  if (!token) throw new Error('STEP0_LAST_SYNC_TOKEN 이 없습니다. step0_sync_master_preview를 먼저 실행하세요.');
  return syncMasterExecute_({ token: token, approved: true });
}

function backupCoreSheets_(p) {
  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  ensureMasterInfra_(ss);
  const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  const targets = [ACTIVITY_SHEET, TODO_SHEET, STUDENT_SHEET, MASTER_SHEET, SYNC_LOG_SHEET];
  const created = [];
  targets.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const cp = sh.copyTo(ss);
    cp.setName(makeUniqueSheetName_(ss, 'bak_' + name + '_' + ts));
    created.push(cp.getName());
  });
  logSyncStep_('backup_core_sheets', 'done', '핵심 시트 백업 완료', { created: created });
  return { result: 'success', created: created, timestamp: ts };
}

function syncMasterPreview_(p) {
  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  ensureMasterInfra_(ss);
  const plan = buildSyncMasterPlan_(ss, p || {});
  const summary = {
    totalCandidates: plan.totalCandidates,
    newRows: plan.newRows.length,
    existingSkipped: plan.existingSkipped,
    parseErrors: plan.parseErrors.length,
    bySource: plan.bySource
  };
  const token = createApprovalRequest_(
    ss,
    'sync_master_execute',
    { options: p || {} },
    JSON.stringify(summary)
  );
  logSyncStep_('sync_master_preview', 'done', '초기 동기화 미리보기 생성', summary);
  return {
    result: 'success',
    token: token,
    summary: summary,
    sample: plan.newRows.slice(0, 20).map(masterRowToObject_)
  };
}

function syncMasterExecute_(p) {
  const token = String((p && p.token) || '').trim();
  if (!token) return { result: 'error', error: 'token is required' };
  if (!(p && p.approved === true)) return { result: 'error', error: '승인되지 않았습니다. approved=true 로 호출하세요.' };

  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  ensureMasterInfra_(ss);
  const req = getApprovalRequest_(ss, token);
  if (!req) return { result: 'error', error: '승인 요청을 찾을 수 없습니다.' };
  if (req.status !== 'pending') return { result: 'error', error: '이미 처리된 토큰입니다. status=' + req.status };
  if (req.action !== 'sync_master_execute') return { result: 'error', error: '토큰 작업이 일치하지 않습니다.' };

  const payload = req.payload || {};
  const options = payload.options || {};
  setApprovalStatus_(ss, token, 'approved', { approvedAt: new Date() });

  const plan = buildSyncMasterPlan_(ss, options);
  const master = ensureMasterSheet_(ss);
  const rows = plan.newRows;
  if (rows.length) {
    master.getRange(master.getLastRow() + 1, 1, rows.length, MASTER_HEADERS.length).setValues(rows);
  }
  const result = {
    inserted: rows.length,
    existingSkipped: plan.existingSkipped,
    parseErrors: plan.parseErrors.slice(0, 30),
    bySource: plan.bySource
  };
  setApprovalStatus_(ss, token, 'executed', result);
  logSyncStep_('sync_master_execute', 'done', '초기 동기화 실행 완료', result);
  return { result: 'success', message: '일정_마스터 동기화 완료', summary: result };
}

function aiOperationPreview_(p) {
  const op = String((p && p.operation) || '').trim();
  if (!op) return { result: 'error', error: 'operation is required' };
  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  ensureMasterInfra_(ss);

  if (op === 'todo_to_calendar_ai') {
    const params = p.params || {};
    const text = String(params.text || '').trim();
    if (!text) return { result: 'error', error: 'params.text is required' };
    const parsed = parseTodoScheduleByAiOrRegex_(text, params);
    if (!parsed || !parsed.start) return { result: 'error', error: '일정 날짜/시간을 해석하지 못했습니다.' };
    if (parsed.needConfirm) return { result: 'error', error: parsed.needConfirm };
    const preview = {
      title: String(parsed.title || text),
      allDay: !!parsed.allDay,
      start: parsed.start,
      end: parsed.end || ''
    };
    const token = createApprovalRequest_(ss, op, { params: params }, JSON.stringify(preview));
    return { result: 'success', token: token, preview: preview };
  }

  return { result: 'error', error: '지원하지 않는 operation: ' + op };
}

function aiOperationExecute_(p) {
  const token = String((p && p.token) || '').trim();
  if (!token) return { result: 'error', error: 'token is required' };
  if (!(p && p.approved === true)) return { result: 'error', error: '승인되지 않았습니다. approved=true 로 호출하세요.' };

  const ss = SpreadsheetApp.openById(getSheetId_(p.sheetId));
  ensureMasterInfra_(ss);
  const req = getApprovalRequest_(ss, token);
  if (!req) return { result: 'error', error: '승인 요청을 찾을 수 없습니다.' };
  if (req.status !== 'pending') return { result: 'error', error: '이미 처리된 토큰입니다. status=' + req.status };
  setApprovalStatus_(ss, token, 'approved', { approvedAt: new Date() });

  if (req.action === 'todo_to_calendar_ai') {
    const out = todoToCalendarAi_(req.payload.params || {});
    setApprovalStatus_(ss, token, 'executed', out);
    return out;
  }

  return { result: 'error', error: '지원하지 않는 승인 실행 작업: ' + req.action };
}

function ensureMasterInfra_(ss) {
  ensureMasterSheet_(ss);
  ensureSyncLogSheet_(ss);
  ensureApprovalQueueSheet_(ss);
}

function ensureMasterSheet_(ss) {
  const sh = ensureSheet_(ss, MASTER_SHEET, MASTER_HEADERS);
  applySheetLayout_(sh, MASTER_HEADERS, '#334155', [180, 180, 110, 180, 120, 100, 100, 110, 140, 140, 260, 360, 100, 180, 180, 120, 260, 120, 120, 260, 150, 150]);
  return sh;
}

function ensureSyncLogSheet_(ss) {
  const sh = ensureSheet_(ss, SYNC_LOG_SHEET, SYNC_LOG_HEADERS);
  applySheetLayout_(sh, SYNC_LOG_HEADERS, '#0f766e', [150, 150, 120, 100, 260, 520]);
  return sh;
}

function ensureApprovalQueueSheet_(ss) {
  const sh = ensureSheet_(ss, APPROVAL_QUEUE_SHEET, APPROVAL_QUEUE_HEADERS);
  applySheetLayout_(sh, APPROVAL_QUEUE_HEADERS, '#7c3aed', [190, 150, 420, 260, 100, 150, 150, 150, 420]);
  return sh;
}

function logSyncStep_(job, status, message, detail) {
  const ss = SpreadsheetApp.openById(getSheetId_(''));
  const sh = ensureSyncLogSheet_(ss);
  sh.appendRow([new Date(), String(job || ''), '', String(status || ''), String(message || ''), JSON.stringify(detail || {})]);
}

function createApprovalRequest_(ss, action, payload, summaryText) {
  const sh = ensureApprovalQueueSheet_(ss);
  const token = Utilities.getUuid();
  sh.appendRow([
    token,
    String(action || ''),
    JSON.stringify(payload || {}),
    String(summaryText || ''),
    'pending',
    new Date(),
    '',
    '',
    ''
  ]);
  return token;
}

function getApprovalRequest_(ss, token) {
  const sh = ensureApprovalQueueSheet_(ss);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const rows = sh.getRange(2, 1, last - 1, APPROVAL_QUEUE_HEADERS.length).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0] || '').trim() === token) {
      var payload = {};
      try { payload = JSON.parse(String(rows[i][2] || '{}')); } catch (e) {}
      return {
        rowNumber: i + 2,
        token: token,
        action: String(rows[i][1] || ''),
        payload: payload,
        status: String(rows[i][4] || '')
      };
    }
  }
  return null;
}

function setApprovalStatus_(ss, token, status, resultObj) {
  const req = getApprovalRequest_(ss, token);
  if (!req) return false;
  const sh = ensureApprovalQueueSheet_(ss);
  sh.getRange(req.rowNumber, 5).setValue(status);
  if (status === 'approved') sh.getRange(req.rowNumber, 7).setValue(new Date());
  if (status === 'executed') sh.getRange(req.rowNumber, 8).setValue(new Date());
  if (resultObj !== undefined) sh.getRange(req.rowNumber, 9).setValue(JSON.stringify(resultObj || {}));
  return true;
}

function buildSyncMasterPlan_(ss, options) {
  const master = ensureMasterSheet_(ss);
  const existing = getExistingMasterKeyMap_(master);
  const candidates = [];
  const parseErrors = [];
  const bySource = {};

  pushCandidates_(candidates, parseErrors, bySource, buildCandidatesFromActivity_(ss, options));
  pushCandidates_(candidates, parseErrors, bySource, buildCandidatesFromTodo_(ss, options));
  pushCandidates_(candidates, parseErrors, bySource, buildCandidatesFromDriveHtml_(options));

  const out = [];
  const dedupe = {};
  let existingSkipped = 0;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var mapKey = c.source + '|' + c.sourceKey;
    if (existing[mapKey] || dedupe[mapKey]) {
      existingSkipped++;
      continue;
    }
    dedupe[mapKey] = true;
    out.push(buildMasterRow_(c));
  }
  return {
    totalCandidates: candidates.length,
    newRows: out,
    existingSkipped: existingSkipped,
    parseErrors: parseErrors,
    bySource: bySource
  };
}

function pushCandidates_(arr, errs, bySource, pack) {
  (pack.rows || []).forEach(function(x) { arr.push(x); });
  (pack.errors || []).forEach(function(e) { errs.push(e); });
  Object.keys(pack.bySource || {}).forEach(function(k) {
    bySource[k] = (bySource[k] || 0) + Number(pack.bySource[k] || 0);
  });
}

function buildCandidatesFromActivity_(ss) {
  const sh = ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const vals = sh.getDataRange().getValues();
  const rows = [];
  const errors = [];
  const bySource = { activity: 0 };
  if (vals.length < 2) return { rows: rows, errors: errors, bySource: bySource };
  const idx = headerIndex_(vals[0]);
  for (var i = 1; i < vals.length; i++) {
    try {
      const r = vals[i];
      const student = String(r[idx['학생명']] || '').trim();
      if (!student) continue;
      const dateText = normalizeDateValue_(r[idx['수업일/상담일']] || r[idx['상담/테스트일']]);
      const typeRaw = String(r[idx['세부유형']] || r[idx['수업유형']] || r[idx['문서구분']] || '').trim();
      const type = inferTypeFromText_(typeRaw);
      const content = String(r[idx['내용']] || '').trim();
      const sourceKey = 'ACT:' + makeDigest_([
        String(r[idx['기록시간']] || ''),
        student,
        dateText,
        typeRaw,
        content.slice(0, 120)
      ].join('|'));
      rows.push({
        source: 'activity',
        sourceKey: sourceKey,
        student: student,
        type: type,
        state: String(r[idx['처리상태']] || '진행중').trim() || '진행중',
        baseDate: dateText,
        startAt: '',
        endAt: '',
        summary: '[' + (typeRaw || type || '일정') + '] ' + student,
        detail: content,
        confirmNeeded: true,
        calendarEventId: String(r[idx['구글캘린더이벤트ID']] || '').trim(),
        notionPageId: String(r[idx['노션페이지ID']] || '').trim(),
        driveLink: String(r[idx['드라이브링크']] || '').trim(),
        reportLink: String(r[idx['리포트링크']] || '').trim(),
        syncStatus: '대기',
        failStage: '',
        errorLog: '',
        groupId: makeGroupId_(student, dateText, type)
      });
      bySource.activity++;
    } catch (e) {
      errors.push('activity row ' + (i + 1) + ': ' + (e.message || e));
    }
  }
  return { rows: rows, errors: errors, bySource: bySource };
}

function buildCandidatesFromTodo_(ss) {
  const sh = ensureTodoSheet_('');
  const last = sh.getLastRow();
  const rows = [];
  const errors = [];
  const bySource = { todo: 0 };
  if (last < 2) return { rows: rows, errors: errors, bySource: bySource };
  const vals = sh.getRange(2, 1, last - 1, TODO_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    try {
      const r = vals[i];
      const id = String(r[0] || '').trim();
      const text = String(r[2] || '').trim();
      if (!id || !text) continue;
      const dateObj = parseDateLoose_(text);
      const range = extractTimeRangeLoose_(text);
      const student = guessStudentFromText_(text);
      rows.push({
        source: 'todo',
        sourceKey: 'TODO:' + id,
        student: student,
        type: inferTypeFromText_(text),
        state: String(r[3] || '진행중'),
        baseDate: dateObj ? formatDateYmd_(dateObj) : '',
        startAt: range.start || '',
        endAt: range.end || '',
        summary: text.slice(0, 220),
        detail: text,
        confirmNeeded: true,
        calendarEventId: '',
        notionPageId: '',
        driveLink: '',
        reportLink: '',
        syncStatus: '대기',
        failStage: '',
        errorLog: '',
        groupId: makeGroupId_(student, dateObj ? formatDateYmd_(dateObj) : '', inferTypeFromText_(text))
      });
      bySource.todo++;
    } catch (e) {
      errors.push('todo row ' + (i + 2) + ': ' + (e.message || e));
    }
  }
  return { rows: rows, errors: errors, bySource: bySource };
}

function buildCandidatesFromDriveHtml_(options) {
  const rows = [];
  const errors = [];
  const bySource = { drive_html: 0 };
  const includeDrive = !(options && options.includeDriveHtml === false);
  if (!includeDrive) return { rows: rows, errors: errors, bySource: bySource };

  const maxFiles = Number((options && options.maxDriveFiles) || 500);
  const root = DriveApp.getFolderById(getDriveRootId_());
  const files = collectDriveHtmlFilesRecursively_(root, maxFiles, 4);
  for (var i = 0; i < files.length; i++) {
    try {
      const f = files[i];
      const name = String(f.getName() || '');
      const m = name.match(/지필드_(\d{8})_(.+?)_(.+?)_리포트\.html/);
      if (!m) continue;
      const dateText = m[1].slice(0, 4) + '-' + m[1].slice(4, 6) + '-' + m[1].slice(6, 8);
      const student = String(m[2] || '').trim();
      const typeRaw = String(m[3] || '').trim();
      rows.push({
        source: 'drive_html',
        sourceKey: 'HTML:' + f.getId(),
        student: student,
        type: inferTypeFromText_(typeRaw),
        state: '초기동기화',
        baseDate: dateText,
        startAt: '',
        endAt: '',
        summary: '[' + typeRaw + '] ' + student + ' 리포트',
        detail: name,
        confirmNeeded: true,
        calendarEventId: '',
        notionPageId: '',
        driveLink: f.getUrl(),
        reportLink: '',
        syncStatus: '대기',
        failStage: '',
        errorLog: '',
        groupId: makeGroupId_(student, dateText, inferTypeFromText_(typeRaw))
      });
      bySource.drive_html++;
    } catch (e) {
      errors.push('drive_html file index ' + i + ': ' + (e.message || e));
    }
  }
  return { rows: rows, errors: errors, bySource: bySource };
}

function collectDriveHtmlFilesRecursively_(rootFolder, maxFiles, maxDepth) {
  const out = [];
  const queue = [{ folder: rootFolder, depth: 0 }];
  while (queue.length && out.length < maxFiles) {
    const node = queue.shift();
    const files = node.folder.getFiles();
    while (files.hasNext() && out.length < maxFiles) {
      const f = files.next();
      const mime = String(f.getMimeType() || '');
      const nm = String(f.getName() || '');
      if (mime === MimeType.HTML || /\.html$/i.test(nm)) out.push(f);
    }
    if (node.depth >= maxDepth) continue;
    const folders = node.folder.getFolders();
    while (folders.hasNext()) {
      queue.push({ folder: folders.next(), depth: node.depth + 1 });
    }
  }
  return out;
}

function getExistingMasterKeyMap_(masterSheet) {
  const map = {};
  const vals = masterSheet.getDataRange().getValues();
  if (vals.length < 2) return map;
  const idx = headerIndex_(vals[0]);
  for (var i = 1; i < vals.length; i++) {
    const source = String(vals[i][idx['원본출처']] || '').trim();
    const key = String(vals[i][idx['원본키']] || '').trim();
    if (!source || !key) continue;
    map[source + '|' + key] = true;
  }
  return map;
}

function buildMasterRow_(x) {
  const now = new Date();
  return [
    Utilities.getUuid(),
    x.groupId || '',
    x.source || '',
    x.sourceKey || '',
    x.student || '',
    x.type || '',
    x.state || '진행중',
    x.baseDate || '',
    x.startAt || '',
    x.endAt || '',
    x.summary || '',
    x.detail || '',
    x.confirmNeeded === false ? false : true,
    x.calendarEventId || '',
    x.notionPageId || '',
    x.driveLink || '',
    x.reportLink || '',
    x.syncStatus || '대기',
    x.failStage || '',
    x.errorLog || '',
    now,
    now
  ];
}

function masterRowToObject_(row) {
  const obj = {};
  MASTER_HEADERS.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function inferTypeFromText_(text) {
  const t = String(text || '');
  if (/퇴원/.test(t)) return '퇴원';
  if (/결석|휴강/.test(t)) return '결석';
  if (/보강|보충/.test(t)) return '보강';
  if (/상담|테스트|문의/.test(t)) return '상담';
  return '일반수업';
}

function guessStudentFromText_(text) {
  const t = String(text || '').trim();
  const m = t.match(/([가-힣]{2,4})\s*(학생)?/);
  return m ? String(m[1] || '').trim() : '';
}

function parseDateLoose_(text) {
  if (text instanceof Date) return new Date(text.getFullYear(), text.getMonth(), text.getDate());
  const s = String(text || '').trim();
  if (!s) return null;
  let m = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/(20\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const y = new Date().getFullYear();
    return new Date(y, Number(m[1]) - 1, Number(m[2]));
  }
  m = s.match(/(\d{1,2})\.(\d{1,2})/);
  if (m) {
    const y2 = new Date().getFullYear();
    return new Date(y2, Number(m[1]) - 1, Number(m[2]));
  }
  return null;
}

function normalizeDateValue_(v) {
  const d = parseDateLoose_(v);
  return d ? formatDateYmd_(d) : '';
}

function extractTimeRangeLoose_(text) {
  const s = String(text || '');
  let m = s.match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/);
  if (m) return { start: m[1], end: m[2] };
  m = s.match(/(\d{1,2}:\d{2})/);
  if (m) return { start: m[1], end: '' };
  return { start: '', end: '' };
}

function makeDigest_(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(text || ''), Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function makeGroupId_(student, dateText, type) {
  return makeDigest_([String(student || ''), String(dateText || ''), String(type || '')].join('|')).slice(0, 16);
}

function formatDateYmd_(d) {
  return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd');
}

function makeUniqueSheetName_(ss, base) {
  let name = String(base || 'backup').slice(0, 95);
  if (!ss.getSheetByName(name)) return name;
  for (let i = 1; i < 999; i++) {
    const n = (name + '_' + i).slice(0, 99);
    if (!ss.getSheetByName(n)) return n;
  }
  return name.slice(0, 90) + '_' + new Date().getTime();
}
