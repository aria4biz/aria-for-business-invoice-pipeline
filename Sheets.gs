/**
 * Sheets.gs: small helpers for reading/writing tabs by header name.
 */

function ctl_() {
  const id = PropertiesService.getScriptProperties().getProperty('CONTROL_SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function out_() {
  const id = getConfig_().OUTPUT_SPREADSHEET_ID;
  if (!id) throw new Error('OUTPUT_SPREADSHEET_ID is empty — run Setup.');
  return SpreadsheetApp.openById(id);
}

function sheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '" — run Setup.');
  return sh;
}

function ensureTab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const actual = headers_(sh);
  if (actual.join('|') !== headers.join('|')) throw new Error('Header mismatch in ' + name + '. Use a new workbook for demo v2.');
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

/** Returns [{row: <sheet row number>, data: {Header: value}}] */
function readTable_(sh) {
  const values = sh.getDataRange().getValues();
  const h = values.shift().map(String);
  return values.map((r, i) => {
    const data = {};
    h.forEach((k, j) => { data[k] = r[j]; });
    // Displayed link text is not the underlying URL; rebuild only from our saved Drive file ID.
    if (data['File ID'] && Object.prototype.hasOwnProperty.call(data, 'File Link'))
      data['File Link'] = sourceUrl_(data['File ID']);
    return { row: i + 2, data: data };
  });
}

/** Treat untrusted extracted strings as literal text, never as sheet formulas. */
function cellValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' && /^[=+@\-\t\r]/.test(value)) return "'" + value;
  return value;
}

function sourceUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + encodeURIComponent(String(fileId)) + '/view';
}

function linkCell_(sh, row, obj) {
  const index = headers_(sh).indexOf('File Link');
  if (index < 0 || !obj['File ID']) return;
  const rich = SpreadsheetApp.newRichTextValue().setText('View original invoice')
    .setLinkUrl(sourceUrl_(obj['File ID'])).build();
  sh.getRange(row, index + 1).setRichTextValue(rich);
}

function appendObj_(sh, obj) {
  const h = headers_(sh), row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, h.length).setValues([h.map(k => cellValue_(obj[k]))]);
  linkCell_(sh, row, obj);
  return row;
}

function appendObjs_(sh, objs) {
  if (!objs.length) return;
  const h = headers_(sh), row = sh.getLastRow() + 1;
  sh.getRange(row, 1, objs.length, h.length).setValues(objs.map(o => h.map(k => cellValue_(o[k]))));
  objs.forEach((obj, i) => linkCell_(sh, row + i, obj));
}

function updateRow_(sh, row, obj) {
  const h = headers_(sh), range = sh.getRange(row, 1, 1, h.length), vals = range.getValues()[0];
  Object.keys(obj).forEach(k => {
    const index = h.indexOf(k);
    if (index < 0) throw new Error('Unknown column "' + k + '" in ' + sh.getName());
    vals[index] = obj[k];
  });
  const updated = h.indexOf('Updated At');
  if (updated >= 0) vals[updated] = new Date();
  range.setValues([vals.map(cellValue_)]);
  const fileIndex = h.indexOf('File ID');
  if (fileIndex >= 0) linkCell_(sh, row, { 'File ID': vals[fileIndex] });
}

function upsertObj_(sh, header, value, obj) {
  const hits = readTable_(sh).filter(r => String(r.data[header]) === String(value));
  if (hits.length > 1) throw new Error('Duplicate internal row key in ' + sh.getName() + ': ' + value);
  if (hits.length) updateRow_(sh, hits[0].row, obj);
  else appendObj_(sh, obj);
}



function findRowBy_(sh, header, value) {
  const hit = readTable_(sh).filter(r => String(r.data[header]) === String(value))[0];
  return hit || null;
}

function setListValidation_(sh, header, list) {
  const col = headers_(sh).indexOf(header) + 1;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(rule);
}

function setCheckbox_(sh, header) {
  const col = headers_(sh).indexOf(header) + 1;
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
  // Data validation ONLY: do not reset existing true/false values or populate empty rows.
  sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(rule);
}



function logException_(fileInfo, issueType, details) {
  const sh = sheet_(ctl_(), TABS.EXCEPTIONS);
  const open = fileInfo['File ID'] ? readTable_(sh).find(r =>
    r.data['File ID'] === fileInfo['File ID'] && r.data.Resolved !== true) : null;
  const fields = {
    'File Name': fileInfo['File Name'] || fileInfo.Subject || '',
    'File Link': fileInfo['File Link'] || '', 'File ID': fileInfo['File ID'] || '',
    'Issue Type': issueType, 'Details': details, 'Action': '', 'Resolved': false
  };
  if (open) updateRow_(sh, open.row, fields);
  else appendObj_(sh, Object.assign({
    'Exception ID': 'EX-' + Utilities.getUuid(), 'Created At': new Date(), 'Resolver Notes': ''
  }, fields));
}

function closeExceptions_(fileId, note) {
  const sh = sheet_(ctl_(), TABS.EXCEPTIONS);
  readTable_(sh).filter(r => r.data['File ID'] === fileId && r.data.Resolved !== true)
    .forEach(r => updateRow_(sh, r.row, {
      'Resolved': true, 'Action': '',
      'Resolver Notes': [r.data['Resolver Notes'], note].filter(String).join(' | ')
    }));
}



/** Raw extraction is retained in Drive; its reference is stored before output writes. */
function storeJson_(obj, fileName) {
  const folder = DriveApp.getFolderById(getConfig_().DRIVE_FOLDER_ID);
  const name = fileName + '.extraction.' + Utilities.getUuid() + '.json';
  const file = folder.createFile(name, JSON.stringify(obj), 'application/json');
  return 'drive:' + file.getId();
}



function loadJson_(cell) {
  const s = String(cell || '');
  if (!s) return null;
  if (s.indexOf('drive:') === 0) return JSON.parse(DriveApp.getFileById(s.slice(6)).getBlob().getDataAsString());
  return JSON.parse(s);
}
