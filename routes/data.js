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

// 🔒 Prevent double upload (memory lock)
const uploadLocks = {};

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
   FILE VALIDATION (UNCHANGED)
========================= */
async function validateFile(file) {

  const ext = path.extname(file.originalname).toLowerCase();

  const allowedExt = [
    ".pdf", ".xlsx", ".xls", ".doc", ".docx", ".txt", ".html"
  ];

  if (!allowedExt.includes(ext)) {
    throw new Error("INVALID FORMAT");
  }

  if (ext === ".pdf") {

    if (!pdfParse) {
      throw new Error("INVALID PDF");
    }

    try {
      const buffer = fs.readFileSync(file.path);
      const data = await pdfParse(buffer);

      const textLength = data.text ? data.text.trim().length : 0;

      if (textLength < 20) {
        throw new Error("INVALID PDF");
      }

    } catch (err) {
      throw new Error("INVALID PDF");
    }
  }
}

/* =========================
   VALIDATE BEFORE PREVIEW
========================= */
router.post("/validate", upload.single("file"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "NO FILE" });
    }

    await validateFile(req.file);

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.json({ success: true });

  } catch (err) {

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(400).json({ error: err.message });
  }
});

/* =========================
   LIST DATA (FIXED)
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

      /* ✅ FIXED MATCH LOGIC */
      const match = sheetRows.find(r => {
        const sheetCode = String(r[0] || "").replace(/\s/g, "").toLowerCase();
        const rowCode = String(code || "").replace(/\s/g, "").toLowerCase();
        return sheetCode === rowCode;
      }) || [];

      return {
        id: index,
        division: row.Division || "",
        state: row.STATE || "",
        bmhq: row["BM HQ"] || row.BM_HQ || "",
        code: code,
        name: row["Stockist Name"] || row.Name || "",

        sales: match[4] || "",

        awsFile: match[2] || "",
        sssFile: match[3] || ""
      };
    });

    res.json(finalData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "FAILED TO LOAD DATA" });
  }
});

/* =========================
   UPLOAD (UNCHANGED)
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {

  try {
    const { code, type, sales } = req.body;

    if (!code || !type || !req.file) {
      return res.status(400).json({ error: "UPLOAD FAILED" });
    }

    const lockKey = `${code}_${type}`;
    if (uploadLocks[lockKey]) {
      return res.status(429).json({ error: "Upload already in progress" });
    }
    uploadLocks[lockKey] = true;

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

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const sheetRows = await getSheetData();
    const existing = sheetRows.find(r => String(r[0]) === String(code));

    let existingFiles = "";

    if (existing) {
      existingFiles = type === "aws" ? existing[2] || "" : existing[3] || "";
    }

    const updatedFiles = existingFiles
      ? `${existingFiles},${driveFile.fileId}`
      : driveFile.fileId;

    await updateRow(code, name, type, updatedFiles, sales);

    delete uploadLocks[lockKey];

    res.json({ success: true });

  } catch (err) {

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (req.body) {
      const lockKey = `${req.body.code}_${req.body.type}`;
      delete uploadLocks[lockKey];
    }

    return res.status(400).json({ error: "UPLOAD FAILED" });
  }
});

module.exports = router;