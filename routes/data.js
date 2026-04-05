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
   MEMORY STORAGE
========================= */
let uploadedFiles = [];

/* =========================
   FILE VALIDATION
========================= */
async function validateFile(file) {

  const ext = file.originalname.split(".").pop().toLowerCase();

  const allowed = ["pdf", "xlsx", "xls", "doc", "docx", "txt", "html"];
  const imageTypes = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];

  // ❌ Reject images
  if (imageTypes.includes(ext)) {
    throw new Error("UNSUPPORTED FORMAT");
  }

  // ❌ Reject unknown
  if (!allowed.includes(ext)) {
    throw new Error("UNSUPPORTED FORMAT");
  }

  // ✅ PDF validation
  if (ext === "pdf") {

    // If library missing → treat as invalid
    if (!pdfParse) {
      throw new Error("INVALID PDF");
    }

    try {
      const buffer = fs.readFileSync(file.path);
      const data = await pdfParse(buffer);

      // scanned / blank PDF
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
router.get("/list", (req, res) => {

  const excelData = loadExcel();

  const finalData = excelData.map((row, index) => {

    const code = row.Code || row.CODE || "";
    const match = uploadedFiles.find(f => String(f.Code) === String(code));

    return {
      id: index,
      division: row.Division || "",
      state: row.STATE || "",
      bmhq: row["BM HQ"] || row.BM_HQ || "",
      code: code,
      name: row["Stockist Name"] || row.Name || "",

      sales: match?.sales || "",
      awsFile: match?.awsFile || null,
      sssFile: match?.sssFile || null
    };
  });

  res.json(finalData);
});

/* =========================
   UPLOAD
========================= */
router.post("/upload", upload.single("file"), async (req, res) => {

  try {
    const { code, type, sales } = req.body;

    if (!code || !type || !req.file) {
      return res.status(400).json({ error: "UPLOAD FAILED" });
    }

    // ✅ VALIDATE
    await validateFile(req.file);

    const excelData = loadExcel();
    const rowData = excelData.find(r => String(r.Code || r.CODE) === String(code));
    const state = rowData?.STATE || "General";

    const driveFile = await uploadToDrive(
      req.file.path,
      req.file.originalname,
      type,
      state
    );

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    let record = uploadedFiles.find(r => String(r.Code) === String(code));

    if (!record) {
      record = { Code: code };
      uploadedFiles.push(record);
    }

    // ✅ SAVE SALES CORRECTLY
    if (sales !== undefined) {
      record.sales = sales;
    }

    record[type + "File"] = driveFile.webViewLink;
    record[type + "FileId"] = driveFile.fileId;

    res.json({ success: true });

  } catch (err) {

    console.error("Upload Error:", err.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // ✅ CLEAN ERROR ONLY
    if (err.message === "INVALID PDF") {
      return res.status(400).json({ error: "INVALID PDF" });
    }

    if (err.message === "UNSUPPORTED FORMAT") {
      return res.status(400).json({ error: "UNSUPPORTED FORMAT" });
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

    let record = uploadedFiles.find(r => String(r.Code) === String(code));

    if (record) {

      const fileId = record[type + "FileId"];

      if (fileId) {
        await deleteFromDrive(fileId);
      }

      delete record[type + "File"];
      delete record[type + "FileId"];
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
router.get("/download/excel", (req, res) => {

  const excelData = loadExcel();

  const finalData = excelData.map(row => {

    const code = row.Code || row.CODE;
    const match = uploadedFiles.find(f => String(f.Code) === String(code));

    return {
      ...row,
      Sales: match?.sales || "",
      AWS_Status: match?.awsFile ? "Received" : "Pending",
      SSS_Status: match?.sssFile ? "Received" : "Pending"
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