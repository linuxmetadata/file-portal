const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const processStatement = require("../validation/processStatement");
const { loadPriceList } = require("../services/priceListLoader");
const { bulkMatch } = require("../matcher/bulkMatcher");
const {
    updateMasterExtraction
} = require("../services/masterExtractionService");

const {
  uploadToDrive,
  deleteFromDrive
} = require("../services/drive");

const {
  updateRow,
  getSheetData,
  deleteFileFromSheet
} = require("../googleSheet");

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});

const uploadLocks = {};

/* =========================
   LOAD EXCEL
========================= */
function loadExcel() {

  const filePath =
    path.join(__dirname, "../data/source.xlsx");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const workbook =
    XLSX.readFile(filePath);

  const sheet =
    workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet);
}

/* =========================
   FILE VALIDATION
========================= */
async function validateFile(file) {

  const ext =
    path.extname(file.originalname).toLowerCase();

  const allowedExt = [
    ".pdf",
    ".xlsx",
    ".xls",
    ".doc",
    ".docx",
    ".txt",
    ".html"
  ];

  /* INVALID FORMAT */
  if (!allowedExt.includes(ext)) {

    throw new Error("INVALID FORMAT");
  }

  /* PDF VALIDATION */
  if (ext === ".pdf") {

    try {

      const buffer =
        fs.readFileSync(file.path);

      const data =
        await pdfParse(buffer);

      const text =
        (data.text || "").trim();

      /* SCANNED PDF */
      if (!text || text.length < 5) {

        throw new Error("Scanned PDF not allowed");
      }

    } catch (err) {

      console.error(
        "PDF VALIDATION ERROR:",
        err
      );

      throw new Error(
        "Scanned PDF not allowed"
      );
    }
  }
}

/* =========================
   VALIDATE BEFORE PREVIEW
========================= */
router.post(
  "/validate",
  upload.single("file"),

  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          error: "NO FILE"
        });
      }

      await validateFile(req.file);

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {

        fs.unlinkSync(req.file.path);
      }

      return res.json({
        success: true
      });

    } catch (err) {

      console.error(
        "VALIDATE ERROR:",
        err
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {

        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        error:
          err.message ||
          "VALIDATION FAILED"
      });
    }
  }
);

/* =========================
   MATCH ROW
========================= */
function matchRow(sheetRows, division, code) {

  return sheetRows.find(r => {

    const sheetDivision =
      String(r[0] || "").trim().toUpperCase();

    const sheetCode =
      String(r[1] || "").trim().toUpperCase();

    const rowDivision =
      String(division || "").trim().toUpperCase();

    const rowCode =
      String(code || "").trim().toUpperCase();

    return (
      sheetDivision === rowDivision &&
      sheetCode === rowCode
    );

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

      sheetRows =
        await getSheetData();

    } catch {

      console.log("Sheet fallback mode");
    }

    const user =
      (req.query.user || "")
        .toLowerCase()
        .trim();

    const role =
      req.query.role;

    const finalData =
      excelData.map((row, index) => {

        const code =
          row.Code ||
          row.CODE ||
          "";

        const match =
          matchRow(
            sheetRows,
            row.Division,
            code
          );

        return {

          id: index,

          division:
            row.Division || "",

          state:
            row.STATE || "",

          bmhq:
            row["BM HQ"] ||
            row.BM_HQ ||
            "",

          code: code,

          name:
            row["Stockist Name"] ||
            row.Name ||
            "",

          bh_id:
            (
              row["BH_ID"] ||
              row["BH ID"] ||
              ""
            ).toString(),

          sm_id:
            (
              row["SM_ID"] ||
              row["SM ID"] ||
              ""
            ).toString(),

          zbm_id:
            (
              row["ZBM_ID"] ||
              row["ZBM ID"] ||
              ""
            ).toString(),

          rbm_id:
            (
              row["RBM_ID"] ||
              row["RBM ID"] ||
              ""
            ).toString(),

          abm_id:
            (
              row["ABM_ID"] ||
              row["ABM ID"] ||
              ""
            ).toString(),

          sales: match[5] || "",

          awsFile: match[3] || "",

          sssFile: match[4] || ""
        }
        });

    let filteredData =
      finalData;

    if (role !== "admin" && user) {

    const userId = String(user)
        .trim()
        .toLowerCase();

    filteredData = finalData.filter(row => {

        return (
            String(row.bh_id || "").trim().toLowerCase() === userId ||
            String(row.sm_id || "").trim().toLowerCase() === userId ||
            String(row.zbm_id || "").trim().toLowerCase() === userId ||
            String(row.rbm_id || "").trim().toLowerCase() === userId ||
            String(row.abm_id || "").trim().toLowerCase() === userId
        );

    });

}

    res.json(filteredData);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "FAILED TO LOAD DATA"
    });
  }
});

/* =========================
   UPLOAD
========================= */
router.post(
  "/upload",
  upload.single("file"),

  async (req, res) => {

    try {

      const {
        division,
        code,
        type,
        sales,
        stockistName
    } = req.body;

    console.log("================================");
    console.log("STOCKIST FROM REQUEST:", stockistName);
    console.log("================================");

      /* INVALID */
      if (
        !code ||
        !type ||
        !req.file
      ) {

        return res.status(400).json({
          error: "UPLOAD FAILED"
        });
      }

      const lockKey =
        `${division}_${code}_${type}`;

      /* DUPLICATE UPLOAD */
      if (uploadLocks[lockKey]) {

        return res.status(429).json({
          error:
            "Upload already in progress"
        });
      }

      uploadLocks[lockKey] = true;

      const excelData =
        loadExcel();

      const rowData =
      excelData.find(r =>

        String(r.Division || "")
            .trim()
            .toUpperCase() ===
        String(division || "")
            .trim()
            .toUpperCase()

        &&

        String(r.Code || r.CODE)
            .trim()
            .toUpperCase() ===
        String(code)
            .trim()
            .toUpperCase()

    );

        const state =
        rowData?.STATE ||
        "General";

      const name =
        rowData?.["Stockist Name"] ||
        rowData?.Name ||
        "";

      /* DRIVE */
      const driveFile =
        await uploadToDrive(
          req.file.path,
          req.file.originalname,
          division,
          state,
          type
        );

/* =====================================
   EXTRACTION (ONLY FOR SSS)
===================================== */

if (type.toUpperCase() === "SSS") {

    try {

        console.log("================================");
        console.log("STARTING SSS EXTRACTION");
        console.log("================================");

        const extraction = await processStatement(
            req.file.path,
            division
        );

        if (!extraction.success) {

            console.log("Extraction Failed");
            console.log(extraction);

        } else {

            console.log("Extraction Successful");
            console.log(
                "Rows Extracted :",
                extraction.data.rows.length
            );

            const priceList = loadPriceList();

            console.log(
                "Price List Loaded :",
                priceList.length
            );

            const matchedRows = bulkMatch(
                extraction.data.rows,
                priceList
            );

            console.log(
                "Matched Products :",
                matchedRows.length
            );

            await updateMasterExtraction(
                matchedRows,
                extraction.data,
                "SSS"
            );

            console.log("Master Extraction Updated");

        }

    } catch (err) {

        console.error("EXTRACTION ERROR:", err);

    }

} else {

    console.log("================================");
    console.log("AWS FILE - EXTRACTION SKIPPED");
    console.log("================================");

}

      const sheetRows =
        await getSheetData();

      const existing =
        matchRow(
          sheetRows,
          division,
          code
        );

      let existingFiles = "";

      if (existing.length) {

        existingFiles =
        type === "aws"
          ? existing[3] || ""
          : existing[4] || "";
      }

      const updatedFiles =
        existingFiles
          ? `${existingFiles},${driveFile.fileId}`
          : driveFile.fileId;

      await updateRow(
        division,
        code,
        name,
        type,
        updatedFiles,
        sales
      );

      delete uploadLocks[lockKey];
      /* TEMP FILE CLEANUP */
    if (
      req.file &&
      fs.existsSync(req.file.path)
    ) {
      fs.unlinkSync(req.file.path);
    }

      return res.json({
        success: true
      });

    } catch (err) {

      console.error(
        "UPLOAD ERROR:",
        err
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {

        fs.unlinkSync(req.file.path);
      }

      if (req.body) {

        const lockKey =
          `${req.body.division}_${req.body.code}_${req.body.type}`;

        delete uploadLocks[lockKey];
      }

      return res.status(400).json({
        error:
          err.message ||
          "UPLOAD FAILED"
      });
    }
  }
);

/* =========================
   DELETE
========================= */
router.delete(
"/delete/:division/:code/:type/:fileId", async (req, res) => {

  try {

    const {
    division,
    code,
    type,
    fileId
} = req.params;

    const sheetRows = await getSheetData();

    const row = matchRow(sheetRows, division, code);

    if (!row.length) {
      return res.status(404).json({
        error: "Record not found"
      });
    }

    const currentFiles = (
      type === "aws"
        ? row[3] || ""
        : row[4] || ""
)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

    const updatedFiles =
      currentFiles.filter(
        id => id !== fileId
      );

    // Delete files from Google Drive
    await deleteFromDrive(fileId); {
      try {
        await deleteFromDrive(fileId);
      } catch (e) {
        console.error("Drive delete failed:", e);
      }
    }

    // Remove file IDs from Google Sheet
    await deleteFileFromSheet(
    division,
    code,
    type,
    updatedFiles.join(",")
);



    return res.json({
      success: true
    });

  } catch (err) {

    console.error("DELETE ERROR:", err);

    return res.status(500).json({
      error: "Delete failed"
    });

  }
});

module.exports = router;