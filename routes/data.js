const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");


const { uploadToDrive, deleteFromDrive } = require("../services/drive");
const { updateRow, getSheetData, deleteFileFromSheet } = require("../googleSheet");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

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
   FILE VALIDATION
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
    if (!pdfParse) throw new Error("INVALID PDF");

    try {
      const buffer = fs.readFileSync(file.path);
      await pdfParse(buffer);
    } catch {
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
   MATCH ROW
========================= */
function matchRow(sheetRows, code) {
  return sheetRows.find(r => {
    const sheetCode = String(r[0] || "").trim().toUpperCase();
    const rowCode = String(code || "").trim().toUpperCase();
    return sheetCode === rowCode;
  }) || [];
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

    const user = (req.query.user || "").toLowerCase().trim();
    const role = req.query.role;

    const finalData = excelData.map((row, index) => {

      const code = row.Code || row.CODE || "";
      const match = matchRow(sheetRows, code);

      return {
        id: index,
        division: row.Division || "",
        state: row.STATE || "",
        bmhq: row["BM HQ"] || row.BM_HQ || "",
        code: code,
        name: row["Stockist Name"] || row.Name || "",

        bh_id: (row["BH_ID"] || row["BH ID"] || "").toString(),
        sm_id: (row["SM_ID"] || row["SM ID"] || "").toString(),
        zbm_id: (row["ZBM_ID"] || row["ZBM ID"] || "").toString(),
        rbm_id: (row["RBM_ID"] || row["RBM ID"] || "").toString(),
        abm_id: (row["ABM_ID"] || row["ABM ID"] || "").toString(),

        sales: match[4] || "",
        awsFile: match[2] || "",
        sssFile: match[3] || ""
      };
    });

    let filteredData = finalData;

    if (role !== "admin" && user) {
      const temp = finalData.filter(row =>
        (row.bh_id || "").toLowerCase().includes(user) ||
        (row.sm_id || "").toLowerCase().includes(user) ||
        (row.zbm_id || "").toLowerCase().includes(user) ||
        (row.rbm_id || "").toLowerCase().includes(user) ||
        (row.abm_id || "").toLowerCase().includes(user) ||
        (row.bmhq || "").toLowerCase().includes(user)
      );

      filteredData = temp.length > 0 ? temp : finalData;
    }

    res.json(filteredData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "FAILED TO LOAD DATA" });
  }
});

/* =========================
   UPLOAD
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {

  try {
    const { code, type, sales } = req.body;

    // ✅ FIXED (NO err HERE)
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
    const existing = matchRow(sheetRows, code);

    let existingFiles = "";

    if (existing.length) {
      existingFiles = type === "aws" ? existing[2] || "" : existing[3] || "";
    }

    const updatedFiles = existingFiles
      ? `${existingFiles},${driveFile.fileId}`
      : driveFile.fileId;

    await updateRow(code, name, type, updatedFiles, sales);

    delete uploadLocks[lockKey];

    res.json({ success: true });

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (req.body) {
      const lockKey = `${req.body.code}_${req.body.type}`;
      delete uploadLocks[lockKey];
    }

    return res.status(400).json({ error: err.message || "UPLOAD FAILED" });
  }
});

module.exports = router;