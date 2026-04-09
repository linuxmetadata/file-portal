const { google } = require("googleapis");

// ✅ SAFE AUTH (WON’T BREAK EXISTING SYSTEM)
let auth;

try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
    console.log("✅ Using ENV service account");
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: "service-account.json",
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
    console.log("⚠️ Using local service-account.json");
  }
} catch (err) {
  console.error("❌ Auth Error:", err.message);
}

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1_GC0VcY8QPDCQhu2U3Fhhn1L2knUicMXff7xOrY6-U4";
const SHEET_NAME = "data";

/* ========================= */
async function getSheetData() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:E`,
    });

    return res.data.values || [];

  } catch (err) {
    console.error("❌ Sheet Read Error:", err.message);
    return [];
  }
}

/* ========================= */
async function updateRow(code, name, type, fileId, sales) {

  try {
    const rows = await getSheetData();
    let rowIndex = rows.findIndex(r => String(r[0]) === String(code));

    if (rowIndex === -1) {

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:E`,
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

      console.log("✅ New row added:", code);

    } else {

      const rowNumber = rowIndex + 2;
      let existing = rows[rowIndex];

      let awsFile = existing[2] || "";
      let sssFile = existing[3] || "";

      if (type === "aws") awsFile = fileId;
      if (type === "sss") sssFile = fileId;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:E${rowNumber}`,
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

      console.log("✅ Row updated:", code);
    }

  } catch (err) {
    console.error("❌ Sheet Update Error:", err.message);
  }
}

/* ========================= */
async function deleteFileFromSheet(code, type) {

  try {
    const rows = await getSheetData();
    let rowIndex = rows.findIndex(r => String(r[0]) === String(code));

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
      range: `${SHEET_NAME}!A${rowNumber}:E${rowNumber}`,
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

    console.log("🗑️ Sheet updated after delete:", code);

  } catch (err) {
    console.error("❌ Sheet Delete Error:", err.message);
  }
}

/* ========================= */
async function syncExcelToSheet(excelData) {

  try {
    const existing = await getSheetData();
    const existingCodes = new Set(existing.map(r => String(r[0])));

    const newRows = [];

    for (const row of excelData) {
      const code = String(row.Code || row.CODE);
      const name = row["Stockist Name"] || row.Name || "";

      if (!existingCodes.has(code)) {
        newRows.push([code, name, "", "", ""]);
      }
    }

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:E`,
        valueInputOption: "RAW",
        requestBody: {
          values: newRows
        }
      });

      console.log(`✅ Synced ${newRows.length} rows`);
    }

  } catch (err) {
    console.error("❌ Sync Error:", err.message);
  }
}

module.exports = {
  getSheetData,
  updateRow,
  deleteFileFromSheet,
  syncExcelToSheet
};