/**
 * Google Apps Script — paste into the project bound to YOUR spreadsheet:
 * Google Sheet → Extensions → Apps Script → new project → paste → Save.
 *
 * Deploy: Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone (even anonymous)
 * Copy the deployment URL → Vercel: APPS_SCRIPT_URL
 *
 * doGet — condition rotation: 1→with_explanation, 2→without_explanation, 3→no_suggestion, then repeat.
 * (Vercel /api/next-condition calls this URL with GET for the counter.)
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var p = PropertiesService.getScriptProperties();
    var c = parseInt(p.getProperty("assignCounter") || "0", 10);
    c += 1;
    p.setProperty("assignCounter", String(c));
    var groups = [
      "with_explanation",
      "without_explanation",
      "no_suggestion",
    ];
    var g = groups[(c - 1) % 3];
    return jsonOut({ group: g, seq: c });
  } catch (err) {
    return jsonOut({ group: null, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var raw = e.postData ? e.postData.contents : "";
    if (!raw) {
      return jsonOut({ ok: false, error: "empty body" });
    }
    var rows = Utilities.parseCsv(raw);
    if (rows.length === 0) {
      return jsonOut({ ok: true });
    }
    var last = sheet.getLastRow();
    var start = last === 0 ? 0 : 1;
    for (var i = start; i < rows.length; i++) {
      sheet.appendRow(rows[i]);
    }
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
