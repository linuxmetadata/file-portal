const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json",
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1_GC0VcY8QPDCQhu2U3Fhhn1L2knUicMXff7xOrY6-U4";

/* =========================
   GET DATA
========================= */
async function getSheetData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "data!A2:E",
  });

  return res.data.values || [];
}

/* =========================
   UPDATE / INSERT
========================= */
async function updateRow(code, name, type, fileId, sales) {

  const rows = await getSheetData();
  let rowIndex = rows.findIndex(r => r[0] === code);

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "data!A:E",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          code,
          name,
          type === "aws" ? fileId : "",
          type === "sss" ? fileId : "",
          sales || ""
        ]]
      }
    });
  } else {
    const rowNumber = rowIndex + 2;
    let existing = rows[rowIndex];

    let awsFile = existing[2] || "";
    let sssFile = existing[3] || "";

    if (type === "aws") awsFile = fileId;
    if (type === "sss") sssFile = fileId;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `data!A${rowNumber}:E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          code,
          name,
          awsFile,
          sssFile,
          sales || existing[4] || ""
        ]]
      }
    });
  }
}

/* =========================
   DELETE FILE FROM SHEET
========================= */
async function deleteFileFromSheet(code, type) {

  const rows = await getSheetData();
  let rowIndex = rows.findIndex(r => r[0] === code);

  if (rowIndex === -1) return;

  const rowNumber = rowIndex + 2;
  let existing = rows[rowIndex];

  let awsFile = existing[2] || "";
  let sssFile = existing[3] || "";
  let sales = existing[4] || "";

  if (type === "aws") awsFile = "";
  if (type === "sss") sssFile = "";

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `data!A${rowNumber}:E${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        code,
        existing[1],
        awsFile,
        sssFile,
        sales
      ]]
    }
  });
}

module.exports = {
  getSheetData,
  updateRow,
  deleteFileFromSheet
};