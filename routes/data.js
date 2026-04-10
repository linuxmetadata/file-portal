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

  // ✅ PDF VALIDATION (SAFE MODE)
  if (ext === ".pdf") {

    if (!pdfParse) return;

    try {
      const buffer = fs.readFileSync(file.path);
      const data = await pdfParse(buffer);

      console.log("PDF text length:", data.text ? data.text.length : 0);

      // ✅ DO NOT BLOCK — allow all PDFs
      return;

    } catch (err) {
      console.log("PDF parse failed but allowing upload");
      return; // ✅ allow instead of blocking
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
   UPLOAD (FINAL FIX)
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {

  try {
    const { code, type, sales } = req.body;

    if (!code || !type || !req.file) {
      return res.status(400).json({ error: "UPLOAD FAILED" });
    }

    // 🔒 DOUBLE CLICK PROTECTION
    const lockKey = `${code}_${type}`;
    if (uploadLocks[lockKey]) {
      return res.status(429).json({ error: "Upload already in progress" });
    }
    uploadLocks[lockKey] = true;

    // ❌ DUPLICATE CHECK (sheet level)
    const existingRows = await getSheetData();
    const existing = existingRows.find(r => String(r[0]) === String(code));

    if (existing) {
      const alreadyUploaded = (type === "aws" && existing[2]) || (type === "sss" && existing[3]);

      if (alreadyUploaded) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        delete uploadLocks[lockKey];

        return res.status(400).json({
          error: `${type.toUpperCase()} already uploaded`
        });
      }
    }

    // ✅ SAFE VALIDATION
    try {
      await validateFile(req.file);
    } catch (err) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      delete uploadLocks[lockKey];
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

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    await updateRow(code, name, type, driveFile.fileId, sales);

    delete uploadLocks[lockKey];

    res.json({ success: true });

  } catch (err) {

    console.error("Upload Error:", err.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (req.body) {
      const lockKey = `${req.body.code}_${req.body.type}`;
      delete uploadLocks[lockKey];
    }

    if (err.message === "INVALID FORMAT") {
      return res.status(400).json({ error: "INVALID FORMAT" });
    }

    return res.status(400).json({ error: err.message || "UPLOAD FAILED" });
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