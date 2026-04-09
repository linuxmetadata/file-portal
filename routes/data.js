const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  pdfParse = null;
}

const { uploadToDrive, deleteFromDrive } = require("../services/drive");
const { updateRow, getSheetData, deleteFileFromSheet } = require("../googleSheet");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =========================
   LOAD EXCEL
========================= */
function loadExcel() {
  const filePath = path.join(__dirname, "../data/source.xlsx");

  if (!fs.existsSync(filePath)) return [];

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

/* =========================
   FILE VALIDATION (FINAL FIX)
========================= */
async function validateFile(file) {

  const ext = path.extname(file.originalname).toLowerCase();

  const allowedExt = [
    ".pdf", ".xlsx", ".xls", ".doc", ".docx", ".txt", ".html"
  ];

  // ❌ INVALID FORMAT
  if (!allowedExt.includes(ext)) {
    throw new Error("INVALID FORMAT");
  }

  // ✅ ONLY PDF VALIDATION
  if (ext === ".pdf") {

    if (!pdfParse) {
      throw new Error("INVALID PDF");
    }

    try {
      const buffer = fs.readFileSync(file.path);
      const data = await pdfParse(buffer);

      // ❌ SCANNED PDF
      if (!data.text || data.text.trim().length < 20) {
        throw new Error("INVALID PDF");
      }

    } catch (err) {
      throw new Error("INVALID PDF");
    }
  }
}

/* =========================
   LIST DATA
========================= */
router.get("/list", async (req, res) => {

  try {
    const excelData = loadExcel();

    let sheetRows = [];

    try {
      sheetRows = await getSheetData();
    } catch {
      console.log("Sheet fallback mode");
    }

    const finalData = excelData.map((row, index) => {

      const code = row.Code || row.CODE || "";
      const match = sheetRows.find(r => String(r[0]) === String(code)) || [];

      return {
        id: index,
        division: row.Division || "",
        state: row.STATE || "",
        bmhq: row["BM HQ"] || row.BM_HQ || "",
        code: code,
        name: row["Stockist Name"] || row.Name || "",

        sales: match[4] || "",
        awsFile: match[2] ? `https://drive.google.com/file/d/${match[2]}/view` : null,
        sssFile: match[3] ? `https://drive.google.com/file/d/${match[3]}/view` : null
      };
    });

    res.json(finalData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "FAILED TO LOAD DATA" });
  }
});

/* =========================
   UPLOAD (SAFE + FIXED)
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {

  try {
    const { code, type, sales } = req.body;

    if (!code || !type || !req.file) {
      return res.status(400).json({ error: "UPLOAD FAILED" });
    }

    // ✅ SAFE VALIDATION (PREVENT CRASH)
    try {
      await validateFile(req.file);
    } catch (err) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw err;
    }

    const excelData = loadExcel();
    const rowData = excelData.find(r => String(r.Code || r.CODE) === String(code));

    const state = rowData?.STATE || "General";
    const name = rowData?.["Stockist Name"] || rowData?.Name || "";

    const driveFile = await uploadToDrive(
      req.file.path,
      req.file.originalname,
      type,
      state
    );

    // ✅ CLEAN TEMP FILE
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // ✅ UPDATE SHEET
    await updateRow(code, name, type, driveFile.fileId, sales);

    res.json({ success: true });

  } catch (err) {

    console.error("Upload Error:", err.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (err.message === "INVALID PDF") {
      return res.status(400).json({ error: "INVALID PDF" });
    }

    if (err.message === "INVALID FORMAT") {
      return res.status(400).json({ error: "INVALID FORMAT" });
    }

    return res.status(400).json({ error: "UPLOAD FAILED" });
  }
});

/* =========================
   DELETE
========================= */
router.delete("/delete/:code/:type", async (req, res) => {

  try {
    const { code, type } = req.params;

    const sheetRows = await getSheetData();
    const match = sheetRows.find(r => String(r[0]) === String(code));

    if (match) {
      const fileId = type === "aws" ? match[2] : match[3];

      if (fileId) {
        await deleteFromDrive(fileId);
      }

      await deleteFileFromSheet(code, type);
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DELETE FAILED" });
  }
});

/* =========================
   DOWNLOAD
========================= */
router.get("/download/excel", async (req, res) => {

  const excelData = loadExcel();
  const sheetRows = await getSheetData();

  const finalData = excelData.map(row => {

    const code = row.Code || row.CODE;
    const match = sheetRows.find(r => String(r[0]) === String(code)) || [];

    return {
      ...row,
      Sales: match[4] || "",
      AWS_Status: match[2] ? "Received" : "Pending",
      SSS_Status: match[3] ? "Received" : "Pending"
    };
  });

  const ws = XLSX.utils.json_to_sheet(finalData);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Report");

  const filePath = path.join(__dirname, "../uploads/export.xlsx");
  XLSX.writeFile(wb, filePath);

  res.download(filePath);
});

module.exports = router;