/**
 * RESUME GATE — LEAD COLLECTOR
 * Google Apps Script bound to a Google Sheet.
 * Free, no third party, and the data stays in your Drive.
 *
 * Setup lives in backend/README.md.
 */

// Optional: get an email the moment someone downloads.
const NOTIFY_EMAIL = 'raswanthcb@gmail.com';   // set to '' to disable
const SHEET_NAME   = 'Leads';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    sheet.appendRow([
      new Date(),
      data.name        || '',
      data.company     || '',
      data.email       || '',
      data.phone       || '',
      data.referrer    || '',
      data.page        || '',
      data.submittedAt || ''
    ]);

    if (NOTIFY_EMAIL) notify_(data);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return json_({ ok: true, service: 'resume-gate', time: new Date().toISOString() });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Name', 'Company', 'Email', 'Phone', 'Referrer', 'Page', 'Submitted At']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify_(data) {
  const subject = 'Resume downloaded — ' + (data.name || 'unknown') +
                  ' (' + (data.company || 'no company') + ')';
  const body =
    'Name:     ' + (data.name    || '-') + '\n' +
    'Company:  ' + (data.company || '-') + '\n' +
    'Email:    ' + (data.email   || '-') + '\n' +
    'Phone:    ' + (data.phone   || '-') + '\n' +
    'Referrer: ' + (data.referrer|| '-') + '\n' +
    'Time:     ' + (data.submittedAt || new Date().toISOString()) + '\n';

  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: subject, body: body });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
