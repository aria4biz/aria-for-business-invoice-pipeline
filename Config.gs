/**
 * Invoice Pipeline — Gmail → Drive → Gemini → Sheets
 * DEMO REVISION v2 — use only in a new, private demo workbook.
 * Config.gs: tab names, headers, defaults, setup and menu.
 *
 * Bind this script to the CONTROL spreadsheet (Extensions → Apps Script).
 * Put your Gemini API key in Project Settings → Script Properties as GEMINI_API_KEY.
 */

const TABS = {
  CONFIG: 'Config',
  MAPPING: 'Mapping',
  STATUS: 'Status',
  EXCEPTIONS: 'Exceptions',
  INVOICES: 'Invoices',     // lives in the OUTPUT spreadsheet
  LINES: 'Line Items',
  QUOTES: 'Quotes',
  QUOTE_LINES: 'Quote Lines',
};

const HEADERS = {
  CONFIG: ['Key', 'Value', 'Description'],
  MAPPING: ['Match Text', 'Match On', 'Canonical Vendor', 'GL Code', 'Default Currency', 'Extraction Notes', 'Active'],
  STATUS: ['File ID', 'File Name', 'File Link', 'Message ID', 'Sender', 'Subject', 'Received At', 'Hash',
           'State', 'Attempts', 'Last Error', 'Invoice Key', 'Extracted JSON', 'Updated At', 'Next Attempt At', 'API Calls', 'Force Extraction'],
  EXCEPTIONS: ['Exception ID', 'Created At', 'File Name', 'File Link', 'File ID', 'Issue Type', 'Details',
               'Action', 'Resolved', 'Resolver Notes'],
  INVOICES: ['Invoice Key', 'Document Type', 'Vendor (Extracted)', 'Vendor (Canonical)', 'GL Code', 'Invoice Number',
             'Invoice Date', 'Due Date', 'PO Number', 'Currency', 'Subtotal', 'Tax', 'Total', 'Line Count',
             'Confidence', 'Sender', 'File Link', 'File ID', 'Processed At',
             'Shipping', 'Discount', 'Other Adjustments', 'Amount Due', 'Review Status'],
  LINES: ['Invoice Key', 'Line #', 'Description', 'Quantity', 'Unit Price', 'Amount', 'Tax',
          'File ID', 'File Link', 'Line Key'],
};

HEADERS.QUOTES = HEADERS.INVOICES.map(h => h.replace('Invoice', 'Quote').replace('Due Date', 'Valid Until'));
HEADERS.QUOTE_LINES = HEADERS.LINES.map(h => h.replace('Invoice', 'Quote'));

// [key, default value, description]
const DEFAULT_CONFIG = [
  ['GMAIL_LABEL_TODO', 'invoices/to-process', 'Gmail label your filter applies to incoming invoice emails'],
  ['GMAIL_LABEL_DONE', 'invoices/done', 'Label applied after attachments are saved'],
  ['DRIVE_FOLDER_ID', '', 'Folder for saved PDFs (auto-created by Setup)'],
  ['OUTPUT_SPREADSHEET_ID', '', 'Spreadsheet with Invoices + Line Items tabs (auto-created by Setup)'],
  ['GEMINI_MODEL', '', 'REQUIRED before extraction: a PDF/structured-output model available in your API project'],
  ['INTAKE_THREAD_LIMIT', '50', 'Max email threads read per intake run'],
  ['EXTRACT_BATCH_SIZE', '3', 'Max PDFs processed per extraction run (6-min Apps Script limit)'],
  ['MAX_ATTEMPTS', '3', 'API/processing failures before a file is marked FAILED'],
  ['TOTAL_TOLERANCE', '0.02', 'Allowed rounding difference when checking totals'],
  ['MIN_CONFIDENCE', '0', 'Optional warning threshold; model self-confidence is not measured accuracy'],
  ['REQUIRE_VENDOR_MAPPING', 'TRUE', 'TRUE = vendors not in Mapping go to Exceptions'],
  ['ACCEPTED_DOC_TYPES', 'invoice,bill,quote', 'Other document types go to Exceptions'],
  ['API_TIMEOUT_SECONDS', '60', 'Maximum duration of one HTTP attempt; retries occur on later runs'],
  ['EMAIL_SUBJECT_CONTAINS', 'Aria Invoice Demo', 'Additional intake restriction; use your demo subject phrase'],
  ['GLOBAL_INSTRUCTIONS', '', 'Extra extraction instructions sent to Gemini for every file'],
];

const EXCEPTION_ACTIONS = ['REVALIDATE', 'RETRY', 'IGNORE'];
const MAX_RUNTIME_MS = 4.5 * 60 * 1000;
const MIN_START_REMAINING_MS = 90 * 1000;
const MAX_INLINE_BYTES = 10 * 1024 * 1024; // keep request under Gemini's inline size limit

/** Menu in the control spreadsheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Invoice Pipeline')
    .addItem('1. Setup', 'setup')
    .addItem('2. Install trigger (every 5 minutes)', 'installTriggers')
    .addSeparator()
    .addItem('Run pipeline now', 'runPipeline')
    .addItem('Run intake now (Gmail → Drive)', 'runIntake')
    .addItem('Run extraction now (Drive → Sheets)', 'runExtraction')
    .addItem('Apply exception actions', 'runExceptionActions')
    .addSeparator()
    .addItem('Remove triggers', 'removeTriggers')
    .addToUi();
}

/** One-time setup: tabs, labels, Drive folder, output spreadsheet. Safe to re-run. */
function setup() {
  withPipelineLock_(function() { setupCore_(); });
}

function setupCore_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('CONTROL_SS_ID', ss.getId());

  const cfgSheet = ensureTab_(ss, TABS.CONFIG, HEADERS.CONFIG);
  if (cfgSheet.getLastRow() < 2) {
    cfgSheet.getRange(2, 1, DEFAULT_CONFIG.length, 3).setValues(DEFAULT_CONFIG);
    cfgSheet.autoResizeColumns(1, 3);
  }

  const mapping = ensureTab_(ss, TABS.MAPPING, HEADERS.MAPPING);
  if (mapping.getLastRow() < 2) {
    mapping.appendRow(['acme', 'VENDOR_NAME', 'Acme Supplies Inc.', '6100-Office Supplies', 'USD',
                       'Acme puts the PO number in the top-right box labelled "Ref".', true]);
  }
  setListValidation_(mapping, 'Match On', ['SENDER', 'VENDOR_NAME']);
  setCheckbox_(mapping, 'Active');

  ensureTab_(ss, TABS.STATUS, HEADERS.STATUS);
  const ex = ensureTab_(ss, TABS.EXCEPTIONS, HEADERS.EXCEPTIONS);
  setListValidation_(ex, 'Action', EXCEPTION_ACTIONS);
  setCheckbox_(ex, 'Resolved');

  const starter = ss.getSheetByName('Sheet1');
  if (starter && starter.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(starter);

  const cfg = getConfig_(true);
  const parents = DriveApp.getFileById(ss.getId()).getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  if (!cfg.DRIVE_FOLDER_ID) {
    const folder = parent.createFolder('Invoice Pipeline - PDFs');
    setConfig_('DRIVE_FOLDER_ID', folder.getId());
  }
  if (!cfg.OUTPUT_SPREADSHEET_ID) {
    const out = SpreadsheetApp.create('Invoice Pipeline - Output');
    DriveApp.getFileById(out.getId()).moveTo(parent);
    setConfig_('OUTPUT_SPREADSHEET_ID', out.getId());
  }

  const output = out_();
  ['INVOICES', 'LINES', 'QUOTES', 'QUOTE_LINES'].forEach(k => ensureTab_(output, TABS[k], HEADERS[k]));
  const defaultTab = output.getSheetByName('Sheet1');
  if (defaultTab && defaultTab.getLastRow() === 0 && output.getSheets().length > 1) output.deleteSheet(defaultTab);

  getOrCreateLabel_(cfg.GMAIL_LABEL_TODO);
  getOrCreateLabel_(cfg.GMAIL_LABEL_DONE);

  const hasKey = !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\n' +
    (hasKey ? '' : '⚠ Add GEMINI_API_KEY in Project Settings → Script Properties.\n') +
    '• Create a Gmail filter that applies the label "' + cfg.GMAIL_LABEL_TODO + '".\n' +
    '• Add vendors to the Mapping tab.\n' +
    '• Set GEMINI_MODEL in Config to a model available in your API project.\n' +
    '• Test one synthetic PDF manually before installing the scheduled trigger.');
}

/** One schedule avoids competing intake/extraction locks. Run under one trigger owner. */
function installTriggers() {
  withPipelineLock_(function() {
    const cfg = getConfig_(true);
    assertExtractionConfig_(cfg);
    removeTriggers();
    ScriptApp.newTrigger('runPipeline').timeBased().everyMinutes(5).create();
    ctl_().toast('One trigger installed: intake first, then extraction, every 5 minutes.');
  });
}

function removeTriggers() {
  const ours = ['runPipeline', 'runIntake', 'runExtraction'];
  ScriptApp.getProjectTriggers().filter(t => ours.indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function withPipelineLock_(fn) {
  const deadline = Date.now() + MAX_RUNTIME_MS; // includes time spent acquiring lock
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { console.log('Pipeline already running; this invocation skipped.'); return; }
  try { return fn(deadline); } finally { lock.releaseLock(); }
}

function runPipeline() {
  return withPipelineLock_(function(deadline) {
    const cfg = getConfig_(true);
    runIntakeCore_(cfg, deadline);
    runExtractionCore_(cfg, deadline);
  });
}

function assertExtractionConfig_(cfg) {
  if (!String(cfg.GEMINI_MODEL || '').trim()) throw new Error('Set GEMINI_MODEL in Config before extraction.');
  if (!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'))
    throw new Error('Add GEMINI_API_KEY in Script Properties. Do not place it in a sheet.');
  const timeout = Number(cfg.API_TIMEOUT_SECONDS);
  if (!Number.isFinite(timeout) || timeout < 10 || timeout > 120)
    throw new Error('API_TIMEOUT_SECONDS must be between 10 and 120.');
}

// ---------- config helpers ----------

let CONFIG_CACHE_ = null;

function getConfig_(refresh) {
  if (CONFIG_CACHE_ && !refresh) return CONFIG_CACHE_;
  const cfg = {};
  DEFAULT_CONFIG.forEach(r => { cfg[r[0]] = r[1]; });
  const values = sheet_(ctl_(), TABS.CONFIG).getDataRange().getValues().slice(1);
  values.forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = String(r[1]).trim(); });
  CONFIG_CACHE_ = cfg;
  return cfg;
}

function setConfig_(key, value) {
  const sh = sheet_(ctl_(), TABS.CONFIG);
  const keys = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => r[0]);
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(value);
  else sh.appendRow([key, value, '']);
  CONFIG_CACHE_ = null;
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
