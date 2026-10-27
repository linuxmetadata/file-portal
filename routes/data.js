const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { ZipArchive } = require("archiver");
const pool = require("../services/postgresPool");

const {
  uploadToDrive,
  deleteFromDrive
} = require("../services/drive");


const {
  updateRow,
  getSheetData,
  deleteFileFromSheet
} = require("../googleSheet");

const {
  runStatementExtraction
} = require("../services/statementExtractionRouter");

const {
  processStatement: processNormalizedStatement
} = require("../validation/processEngine");

const { bulkMatch } = require("../matcher/bulkMatcher");

const {
  runTxtProductMatching
} = require("../validation/txtProductMatcher");

const { loadPriceList } = require("../services/priceListLoader");

const {
  updateMasterExtraction
} = require("../services/masterExtractionService");

const router = express.Router();
console.log("REPORTS ROUTE CHECK:", __filename);


const {
  listPortalStockists,
  getStockist,
  updateStockistSales
} = require("../services/postgresPortalRepository");

const {
  storeUploadedFile,
  listUploadedFiles,
  getUploadedFile,
  deleteUploadedFile
} = require("../services/portalFileStorage");



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
    ".html",
    ".csv"
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


router.get("/list", verifyToken, async (req, res) => {
    try {
        const user = String(req.user.sub || "")
            .trim()
            .toLowerCase();

        const role = String(req.user.role || "")
            .trim()
            .toLowerCase();

        const finalData = await listPortalStockists({
            user,
            role
        });

        return res.json(finalData);

    } catch (err) {
        console.error("POSTGRES LIST ERROR:", err.message);

        return res.status(500).json({
            error: "FAILED TO LOAD DATA"
        });
    }
});


/* =========================
   UPLOAD
========================= */
router.post(
  "/upload",
  verifyToken,
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
    !division ||
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
      await validateFile(req.file);


const rowData = await getStockist(division, code);

if (!rowData) {
    throw new Error(
        "Stockist not found in PostgreSQL roster."
    );
}

const state = rowData.state || "General";


const existingFiles = await listUploadedFiles({
    division,
    code,
    type
});

const statementType = String(type).trim().toUpperCase();

const stockistNameForFile = String(
    rowData.stockist_name || stockistName || code
)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const safeCode = String(code)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");

const originalExtension = path.extname(
    req.file.originalname || req.file.path
);

const nextCount = existingFiles.length + 1;

const storedFilename =
    `${statementType}_${safeCode}_${stockistNameForFile}_${nextCount}${originalExtension}`;


storedFile = await storeUploadedFile({
    filePath: req.file.path,
    originalFilename: storedFilename,
    division,
    code,
    type,
    state,
    uploadedBy: req.body.uploadedBy || "",
    mimeType: req.file.mimetype || "application/octet-stream"
});

console.log(
    "FILE STORED IN POSTGRESQL:",
    storedFile.file_id
);


/* =====================================
   EXTRACTION (ONLY FOR SSS)
===================================== */

if (type.toUpperCase() === "SSS") {

    try {

        console.log("================================");
        console.log("STARTING SSS EXTRACTION");
        console.log("================================");

        
const extraction = await runStatementExtraction(
    req.file.path,
    req.file.originalname,
    "REGULAR",
    {
        division,
        code: rowData.code || code,
        bmHQ: rowData.bm_hq || "",
        stockistName: rowData.stockist_name || stockistName || ""
    }
);


        if (!extraction.success) {

            console.log("Extraction Failed");
            console.log(extraction);

        } else {

            console.log("Extraction Successful");
            console.log(
    "Rows Extracted :",
    extraction.extractedRecords
);

            const uploadedExtension = path.extname(
                req.file.originalname || req.file.path
            ).toLowerCase();

            
if (uploadedExtension === ".txt") {
    console.log(
        "TXT EXTRACTION: Starting product matching."
    );

    const txtMatchResult = await runTxtProductMatching({
        sourceFileName: path.basename(
            req.file.originalname || req.file.path
        ),
        masterFile: extraction.outputMaster,
        portalData: {
            DIVISION: division,
            STATE: rowData.state || state || "",
            HQ: rowData.bm_hq || "",
            ABMHQ: rowData.abm_hq || "",
            RBMHQ: rowData.rbm_hq || "",
            STKCODE: rowData.code || code,
            STOCKIST:
                rowData.stockist_name ||
                stockistName ||
                ""
        }
    });

    console.log(
        "TXT PRODUCT MATCHING COMPLETED",
        {
            sourceFileName: txtMatchResult.sourceFileName,
            totalProducts: txtMatchResult.totalProducts,
            matchedProducts: txtMatchResult.matchedProducts,
            unmatchedProducts: txtMatchResult.unmatchedProducts,
            outputFile: txtMatchResult.file
        }
    );
} else {



                        // ==========================================
            // NORMALIZED SSS PROCESSING
            // ==========================================

            const priceListDirectory = path.join(
                __dirname,
                "..",
                "priceLists"
            );

            const priceListFiles = fs.readdirSync(
                priceListDirectory
            ).filter(file => /\.(xlsx|xls)$/i.test(file));

            if (priceListFiles.length !== 1) {
                throw new Error(
                    `Expected exactly one price list; found ${priceListFiles.length}.`
                );
            }

            const priceFile = path.join(
                priceListDirectory,
                priceListFiles[0]
            );

            // Preserve the original filename for the output STOCKIST field.
            const normalizedTempDir = fs.mkdtempSync(
                path.join(
                    path.dirname(req.file.path),
                    "normalized-"
                )
            );

            try {
                const normalizedFilename = path.basename(
                    req.file.originalname || req.file.path
                );

                const normalizedInputPath = path.join(
                    normalizedTempDir,
                    normalizedFilename
                );

                fs.copyFileSync(
                    req.file.path,
                    normalizedInputPath
                );

                const normalizedResult =
    await processNormalizedStatement({
        statementFile: normalizedInputPath,
        priceFile,
        statementType: "SSS",
        

        portalData: {
    DIVISION: division,
    STATE: rowData.state || state || "",
    HQ: rowData.bm_hq || "",
    ABMHQ: rowData.abm_hq || "",
    RBMHQ: rowData.rbm_hq || "",
    STKCODE: rowData.code || code,
    STOCKIST:
        rowData.stockist_name ||
        stockistName ||
        ""
}
    });

                if (!normalizedResult.success) {
                    console.error(
                        "NORMALIZED SSS PROCESSING FAILED:",
                        normalizedResult.message ||
                        normalizedResult.reason ||
                        normalizedResult
                    );
                } else {
                    console.log(
                        "NORMALIZED SSS MASTER UPDATED:",
                        normalizedResult.outputFile
                    );

                    console.log(
                        "Normalized Products:",
                        normalizedResult.totalProducts
                    );

                    console.log(
                        "Matched Products:",
                        normalizedResult.matchedProducts
                    );

                    console.log(
                        "Unmatched Products:",
                        normalizedResult.unmatchedProducts
                    );
                }
            } finally {
                fs.rmSync(normalizedTempDir, {
                    recursive: true,
                    force: true
                });
            }
          } // END: non-TXT normalized processing

        }

    } catch (err) {

        console.error("EXTRACTION ERROR:", err);

    }

} else {

    console.log("================================");
    console.log("AWS FILE - EXTRACTION SKIPPED");
    console.log("================================");

}

      if (String(sales ?? "").trim() !== "") {
    const updatedStockist = await updateStockistSales(
        division,
        code,
        sales
    );

    if (!updatedStockist) {
        throw new Error(
            "Unable to update stockist Sales in PostgreSQL."
        );
    }
}


      delete uploadLocks[lockKey];
      /* TEMP FILE CLEANUP */
    if (
      req.file &&
      fs.existsSync(req.file.path)
    ) {
      fs.unlinkSync(req.file.path);
    }

      return res.json({
    success: true,
    fileId: String(storedFile.file_id),
    fileName: storedFile.original_filename
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

      if (storedFile) {
    try {
        await deleteUploadedFile({
            fileId: storedFile.file_id,
            division: req.body.division,
            code: req.body.code,
            type: req.body.type
        });

        console.log(
            "POSTGRES UPLOAD ROLLBACK:",
            storedFile.file_id
        );

    } catch (cleanupError) {
        console.error(
            "POSTGRES FILE CLEANUP ERROR:",
            cleanupError.message
        );
    }
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


/* ======================================================
   INVALID SSS UPLOAD
   - Bypasses validateFile() only for this route.
   - Stores files under upload_category = INVALID.
   - Uses separate INVALID extraction outputs.
   - Does not modify the existing /upload route.
====================================================== */

router.post(
    "/invalid-upload",
    verifyToken,
    upload.single("file"),
    async (req, res) => {
        let storedFile = null;
        let lockKey = "";

        try {
            const {
                division,
                code,
                type,
                stockistName
            } = req.body;

            // This route currently supports SSS only.
            if (
                !division ||
                !code ||
                String(type || "").trim().toUpperCase() !== "SSS" ||
                !req.file
            ) {
                return res.status(400).json({
                    error: "Division, Code, SSS type, and file are required."
                });
            }

            // Preserve the existing user hierarchy restrictions.
            const user = String(req.user.sub || "")
                .trim()
                .toLowerCase();

            const role = String(req.user.role || "")
                .trim()
                .toLowerCase();

            const allowedStockists = await listPortalStockists({
                user,
                role
            });

            const authorizedStockist = allowedStockists.some(row =>
                String(row.division || "").trim().toUpperCase() ===
                    String(division).trim().toUpperCase() &&
                String(row.code || "").trim().toUpperCase() ===
                    String(code).trim().toUpperCase()
            );

            if (!authorizedStockist) {
                return res.status(403).json({
                    error: "STOCKIST ACCESS DENIED"
                });
            }

            const rowData = await getStockist(division, code);

            if (!rowData) {
                throw new Error(
                    "Stockist not found in PostgreSQL roster."
                );
            }

            lockKey = `INVALID_${division}_${code}_SSS`;

            if (uploadLocks[lockKey]) {
                return res.status(429).json({
                    error: "Invalid upload already in progress."
                });
            }

            uploadLocks[lockKey] = true;

            const state = rowData.state || "General";

            // Count INVALID files only; do not mix regular numbering.
            const existingFiles = await listUploadedFiles({
                division,
                code,
                type: "SSS",
                uploadCategory: "INVALID"
            });

            const stockistNameForFile = String(
                rowData.stockist_name || stockistName || code
            )
                .trim()
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
                .replace(/\s+/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_+|_+$/g, "");

            const safeCode = String(code)
                .trim()
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
                .replace(/\s+/g, "_");

            const originalExtension = path.extname(
                req.file.originalname || req.file.path
            );

            const nextCount = existingFiles.length + 1;

            const storedFilename =
                `SSS_${safeCode}_${stockistNameForFile}_INVALID_${nextCount}${originalExtension}`;

            storedFile = await storeUploadedFile({
                filePath: req.file.path,
                originalFilename: storedFilename,
                division,
                code,
                type: "SSS",
                state,
                uploadedBy: req.body.uploadedBy || user,
                mimeType: req.file.mimetype || "application/octet-stream",
                uploadCategory: "INVALID"
            });

            console.log(
                "INVALID SSS FILE STORED:",
                storedFile.file_id
            );

            // Reuse the existing SSS extraction router.
            const extraction = await runStatementExtraction(
    req.file.path,
    req.file.originalname,
    "INVALID",
    {
        division,
        code: rowData.code || code,
        bmHQ: rowData.bm_hq || "",
        stockistName: rowData.stockist_name || stockistName || ""
    }
);

            if (!extraction.success) {
                console.error(
                    "INVALID SSS EXTRACTION FAILED:",
                    extraction
                );

                return res.json({
                    success: true,
                    fileId: String(storedFile.file_id),
                    fileName: storedFile.original_filename,
                    uploadCategory: "INVALID",
                    extractionSuccess: false,
                    extractionMessage:
                        extraction.message || extraction.reason ||
                        "Upload stored, but extraction did not succeed."
                });
            }

            const uploadedExtension = path.extname(
                req.file.originalname || req.file.path
            ).toLowerCase();

            if (uploadedExtension === ".txt") {
                const txtMatchResult = await runTxtProductMatching({
                    sourceFileName: path.basename(
                        req.file.originalname || req.file.path
                    ),
                    masterFile: extraction.outputMaster,
                    uploadCategory: "INVALID",
                    portalData: {
                        DIVISION: division,
                        STATE: rowData.state || state || "",
                        HQ: rowData.bm_hq || "",
                        ABMHQ: rowData.abm_hq || "",
                        RBMHQ: rowData.rbm_hq || "",
                        STKCODE: rowData.code || code,
                        STOCKIST:
                            rowData.stockist_name ||
                            stockistName ||
                            ""
                    }
                });

                console.log(
                    "INVALID TXT PRODUCT MATCHING COMPLETED:",
                    txtMatchResult.file
                );
            } else {
                const priceListDirectory = path.join(
                    __dirname,
                    "..",
                    "priceLists"
                );

                const priceListFiles = fs.readdirSync(
                    priceListDirectory
                ).filter(file => /\.(xlsx|xls)$/i.test(file));

                if (priceListFiles.length !== 1) {
                    throw new Error(
                        `Expected exactly one price list; found ${priceListFiles.length}.`
                    );
                }

                const priceFile = path.join(
                    priceListDirectory,
                    priceListFiles[0]
                );

                const normalizedTempDir = fs.mkdtempSync(
                    path.join(
                        path.dirname(req.file.path),
                        "invalid-normalized-"
                    )
                );

                try {
                    const normalizedFilename = path.basename(
                        req.file.originalname || req.file.path
                    );

                    const normalizedInputPath = path.join(
                        normalizedTempDir,
                        normalizedFilename
                    );

                    fs.copyFileSync(
                        req.file.path,
                        normalizedInputPath
                    );

                    const normalizedResult =
                        await processNormalizedStatement({
                            statementFile: normalizedInputPath,
                            priceFile,
                            statementType: "SSS",
                            uploadCategory: "INVALID",
                            
                            portalData: {
                                DIVISION: division,
                                STATE: rowData.state || state || "",
                                HQ: rowData.bm_hq || "",
                                ABMHQ: rowData.abm_hq || "",
                                RBMHQ: rowData.rbm_hq || "",
                                STKCODE: rowData.code || code,
                                STOCKIST:
                                    rowData.stockist_name ||
                                    stockistName ||
                                    ""
                            }
                        });

                    if (!normalizedResult.success) {
                        console.error(
                            "INVALID NORMALIZED SSS PROCESSING FAILED:",
                            normalizedResult.message ||
                            normalizedResult.reason ||
                            normalizedResult
                        );
                    }
                } finally {
                    fs.rmSync(normalizedTempDir, {
                        recursive: true,
                        force: true
                    });
                }
            }

            return res.json({
                success: true,
                fileId: String(storedFile.file_id),
                fileName: storedFile.original_filename,
                uploadCategory: "INVALID",
                extractionSuccess: true
            });
        } catch (err) {
            console.error("INVALID SSS UPLOAD ERROR:", err);

            // Remove the stored database record if processing throws.
            if (storedFile) {
                try {
                    await deleteUploadedFile({
                        fileId: storedFile.file_id,
                        division: req.body.division,
                        code: req.body.code,
                        type: "SSS"
                    });
                } catch (cleanupError) {
                    console.error(
                        "INVALID UPLOAD ROLLBACK ERROR:",
                        cleanupError.message
                    );
                }
            }

            return res.status(400).json({
                error: err.message || "INVALID SSS UPLOAD FAILED"
            });
        } finally {
            if (lockKey) {
                delete uploadLocks[lockKey];
            }

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }
        }
    }
);

/* =========================================
   LIST INVALID SSS STATEMENTS
========================================= */

router.get(
    "/invalid-list",
    verifyToken,
    async (req, res) => {
        try {
            const user = String(req.user.sub || "")
                .trim()
                .toLowerCase();

            const role = String(req.user.role || "")
                .trim()
                .toLowerCase();

            // Keep the existing stockist hierarchy restrictions.
            const allowedStockists = await listPortalStockists({
                user,
                role
            });

            // Retrieve INVALID SSS uploads only.
            const files = await listUploadedFiles({
                type: "SSS",
                uploadCategory: "INVALID"
            });

            const allowedKeys = new Set(
                allowedStockists.map(row =>
                    `${String(row.division || "").trim().toUpperCase()}|${String(row.code || "").trim().toUpperCase()}`
                )
            );

            const result = files
                .filter(file =>
                    allowedKeys.has(
                        `${String(file.division || "").trim().toUpperCase()}|${String(file.code || "").trim().toUpperCase()}`
                    )
                )
                .map(file => {
                    const stockist = allowedStockists.find(row =>
                        String(row.division || "").trim().toUpperCase() ===
                            String(file.division || "").trim().toUpperCase() &&
                        String(row.code || "").trim().toUpperCase() ===
                            String(file.code || "").trim().toUpperCase()
                    );

                    return {
                        file_id: String(file.file_id),
                        division: file.division || "",
                        state: file.state || stockist?.state || "",
                        bmhq: stockist?.bm_hq || "",
                        code: file.code || "",
                        stockist_name: stockist?.stockist_name || "",
                        statement_type: file.statement_type || "SSS",
                        original_filename: file.original_filename || "",
                        uploaded_at: file.uploaded_at || null,
                        status: "INVALID"
                    };
                });

            return res.json(result);

        } catch (err) {
            console.error(
                "INVALID SSS LIST ERROR:",
                err.message
            );

            return res.status(500).json({
                error: "FAILED TO LOAD INVALID SSS STATEMENTS"
            });
        }
    }
);

/* =========================
   DOWNLOAD / VIEW — POSTGRESQL
========================= */
router.get("/file/:fileId", verifyToken, async (req, res) => {
    try {
        const file = await getUploadedFile(req.params.fileId);

        if (!file) {
            return res.status(404).json({
                error: "FILE NOT FOUND"
            });
        }

        // Admins may access all files.
        const role = String(req.user.role || "")
            .trim()
            .toLowerCase();

        // Regular users must belong to the stockist's hierarchy.
        if (role !== "admin") {
            const userId = String(req.user.sub || "")
                .trim()
                .toLowerCase();

            const stockist = await getStockist(
                file.division,
                file.code
            );

            if (!stockist) {
                return res.status(404).json({
                    error: "STOCKIST NOT FOUND"
                });
            }

            const hierarchyIds = [
                stockist.bh_id,
                stockist.sm_id,
                stockist.zbm_id,
                stockist.rbm_id,
                stockist.abm_id
            ].map(value =>
                String(value || "").trim().toLowerCase()
            );

            if (!userId || !hierarchyIds.includes(userId)) {
                return res.status(403).json({
                    error: "FILE ACCESS DENIED"
                });
            }
        }

        const filename = String(
            file.original_filename || "statement"
        );

        const safeFilename = filename
            .replace(/[\r\n"]/g, "_")
            .replace(/[^\x20-\x7E]/g, "_");

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
        );

        res.setHeader("X-Content-Type-Options", "nosniff");

        return res.send(file.file_data);

    } catch (err) {
        console.error("POSTGRES FILE DOWNLOAD ERROR:", err.message);

        if (
            err.message &&
            /invalid.*file.*id/i.test(err.message)
        ) {
            return res.status(400).json({
                error: "INVALID FILE ID"
            });
        }

        return res.status(500).json({
            error: "FAILED TO RETRIEVE FILE"
        });
    }
});

/* =========================
   DELETE — POSTGRESQL
========================= */
router.delete(
    "/delete/:division/:code/:type/:fileId",
    verifyToken,
    (req, res, next) => {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                error: "ADMIN ACCESS REQUIRED"
            });
        }

        next();
    },
    async (req, res) => {
        try {
            const {
                division,
                code,
                type,
                fileId
            } = req.params;

            if (!division || !code || !type || !fileId) {
                return res.status(400).json({
                    error: "Division, Code, Type, and File ID are required."
                });
            }

            const deletedFile = await deleteUploadedFile({
                fileId,
                division,
                code,
                type
            });

            if (!deletedFile) {
                return res.status(404).json({
                    error: "File not found for this stockist and statement type."
                });
            }

            return res.json({
                success: true,
                fileId: String(deletedFile.file_id)
            });

        } catch (err) {
            console.error(
                "POSTGRES DELETE ERROR:",
                err.message
            );

            return res.status(400).json({
                error: err.message || "Delete failed."
            });
        }
    }
);

/* =========================================================
   ADMIN REPORTS ROUTES
   Additive only — existing routes remain unchanged
   ========================================================= */

function reportsAdminOnly(req, res, next) {
  const role = String(req.user?.role || "").trim().toLowerCase();

  if (role !== "admin") {
    return res.status(403).json({
      error: "ADMIN ACCESS REQUIRED"
    });
  }

  next();
}


/* DELETE ALL EXTRACTION MASTERS */
router.delete(
  "/reports/masters",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const normalizedResult = await client.query(`
        DELETE FROM portal_master_extraction_files
        RETURNING master_key
      `);

      const matchedResult = await client.query(`
        DELETE FROM portal_matched_master_extraction_files
        RETURNING master_key
      `);

      await client.query("COMMIT");

      return res.json({
        success: true,
        deletedCount:
          normalizedResult.rowCount + matchedResult.rowCount,
        normalizedDeletedCount: normalizedResult.rowCount,
        matchedDeletedCount: matchedResult.rowCount,
        message: "Extraction masters deleted successfully."
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("DELETE ALL MASTERS ERROR:", err.message);

      return res.status(500).json({
        error: "FAILED TO DELETE EXTRACTION MASTERS"
      });
    } finally {
      client.release();
    }
  }
);

/* DELETE ALL UPLOADED STATEMENTS */
router.delete(
  "/reports/statements",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    try {
      const result = await pool.query(`
        DELETE FROM portal_uploaded_files
        RETURNING file_id
      `);

      return res.json({
        success: true,
        deletedCount: result.rowCount,
        message: "Uploaded statements deleted successfully."
      });
    } catch (err) {
      console.error("DELETE ALL STATEMENTS ERROR:", err.message);

      return res.status(500).json({
        error: "FAILED TO DELETE UPLOADED STATEMENTS"
      });
    }
  }
);


function reportsSafeFilename(value, fallback = "statement") {
  const name = path.basename(
    String(value || fallback).replace(/\\/g, "/")
  );

  if (!name || name === "." || name === "..") {
    return fallback;
  }

  return name;
}

/* 1. List uploaded statements */
router.get(
  "/reports/files",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    try {
      const files = await listUploadedFiles();

      const result = files.map((file) => ({
        file_id: String(file.file_id),
        division: file.division || "",
        code: file.code || "",
        statement_type: file.statement_type || "",
        original_filename: file.original_filename || "",
        mime_type:
          file.mime_type || "application/octet-stream",
        file_size_bytes: file.file_size_bytes || 0,
        state: file.state || "",
        uploaded_by: file.uploaded_by || "",
        uploaded_at: file.uploaded_at || null
      }));

      return res.json(result);
    } catch (err) {
      console.error("REPORTS FILE LIST ERROR:", err.message);

      return res.status(500).json({
        error: "FAILED TO LOAD REPORTS FILES"
      });
    }
  }
);

/* 2. Download one statement */
router.get(
  "/reports/download/:fileId",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    try {
      const file = await getUploadedFile(req.params.fileId);

      if (!file) {
        return res.status(404).json({
          error: "STATEMENT NOT FOUND"
        });
      }

      const filename = reportsSafeFilename(
        file.original_filename
      ).replace(/["\r\n]/g, "_");

      res.setHeader(
        "Content-Type",
        file.mime_type || "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      return res.send(file.file_data);
    } catch (err) {
      console.error(
        "REPORTS SINGLE DOWNLOAD ERROR:",
        err.message
      );

      const invalidId = /valid file ID/i.test(err.message);

      return res.status(invalidId ? 400 : 500).json({
        error: invalidId
          ? "INVALID FILE ID"
          : "FAILED TO DOWNLOAD STATEMENT"
      });
    }
  }
);

/* 3. Download selected statements as one ZIP */
router.post(
  "/reports/download-zip",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    const rawIds = req.body?.fileIds;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({
        error: "SELECT AT LEAST ONE STATEMENT"
      });
    }

    if (rawIds.length > 500) {
      return res.status(400).json({
        error: "SELECT NO MORE THAN 500 STATEMENTS PER ZIP"
      });
    }

    const ids = [
      ...new Set(rawIds.map((id) => String(id).trim()))
    ];

    if (ids.some((id) => !/^[1-9]\d*$/.test(id))) {
      return res.status(400).json({
        error: "INVALID FILE ID IN SELECTION"
      });
    }

    try {
      const files = [];

      for (const id of ids) {
        const file = await getUploadedFile(id);

        if (!file) {
          return res.status(404).json({
            error: `STATEMENT NOT FOUND: ${id}`
          });
        }

        files.push(file);
      }

      const archive = new ZipArchive({
    zlib: { level: 6 }
});

      archive.on("error", (err) => {
        console.error("REPORTS ZIP ERROR:", err.message);

        if (!res.headersSent) {
          res.status(500).json({
            error: "FAILED TO CREATE ZIP"
          });
        } else {
          res.destroy(err);
        }
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Selected_Statements.zip"'
      );

      archive.pipe(res);

      const usedNames = new Map();

      for (const file of files) {
        const original = reportsSafeFilename(
          file.original_filename,
          `statement_${file.file_id}`
        );

        const archiveName = [
          String(file.statement_type || "STATEMENT").toUpperCase(),
          file.division || "",
          file.code || "",
          original
        ]
          .filter(Boolean)
          .join("_")
          .replace(/[\\/:*?"<>|\r\n]/g, "_");

        const count = (usedNames.get(archiveName) || 0) + 1;
        usedNames.set(archiveName, count);

        const uniqueName =
          count === 1
            ? archiveName
            : `${count}_${archiveName}`;

        archive.append(file.file_data, {
          name: uniqueName
        });
      }

      await archive.finalize();
    } catch (err) {
      console.error(
    "REPORTS ZIP PREPARATION ERROR:",
    err.stack || err
);

      if (!res.headersSent) {
        return res.status(500).json({
          error: "FAILED TO PREPARE ZIP DOWNLOAD"
        });
      }

      res.destroy(err);
    }
  }
);


/* 3A. Download ALL regular statements as a folder-structured ZIP */
router.get(
  "/reports/download-all-regular-zip",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    await downloadAllStatementsZip(req, res, "REGULAR");
  }
);

/* 3B. Download ALL invalid statements as a folder-structured ZIP */
router.get(
  "/reports/download-all-invalid-zip",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    await downloadAllStatementsZip(req, res, "INVALID");
  }
);

/* Shared ZIP creation for the two new all-download endpoints */
async function downloadAllStatementsZip(req, res, category) {
  try {
    const files = await listUploadedFiles({
      uploadCategory: category
    });

    if (!files.length) {
      return res.status(404).json({
        error: `NO ${category} STATEMENTS FOUND`
      });
    }

    const archive = new ZipArchive({
      zlib: { level: 6 }
    });

    archive.on("error", (err) => {
      console.error(`${category} ALL-STATEMENTS ZIP ERROR:`, err.message);

      if (!res.headersSent) {
        res.status(500).json({
          error: "FAILED TO CREATE ZIP"
        });
      } else {
        res.destroy(err);
      }
    });

    const rootFolder = category === "INVALID"
      ? "ALL Division Invalid Statements"
      : "ALL Division Statements";

    const zipFilename = category === "INVALID"
      ? "ALL Division Invalid Statements.zip"
      : "ALL Division Statements.zip";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFilename}"`
    );

    archive.pipe(res);

    const usedNames = new Map();

    function safeFolderName(value, fallback) {
      const cleaned = String(value || fallback)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "");

      return cleaned || fallback;
    }

    for (const item of files) {
      // Fetch the complete file, including its stored binary data.
      const file = await getUploadedFile(item.file_id);

      if (!file || !file.file_data) {
        console.warn(
          `${category} ZIP: skipping missing file ${item.file_id}`
        );
        continue;
      }

      const division = safeFolderName(file.division, "Unknown Division");
      const state = safeFolderName(file.state, "Unknown State");
      const type = safeFolderName(
        String(file.statement_type || "UNKNOWN").toUpperCase(),
        "UNKNOWN"
      );

      const originalFilename = reportsSafeFilename(
        file.original_filename,
        `statement_${file.file_id}`
      );

      const folderPath = [
        rootFolder,
        division,
        state,
        type
      ].join("/");

      const basePath = `${folderPath}/${originalFilename}`;
      const count = (usedNames.get(basePath) || 0) + 1;
      usedNames.set(basePath, count);

      const lastDot = originalFilename.lastIndexOf(".");
      const filename = count === 1
        ? originalFilename
        : lastDot > 0
          ? `${originalFilename.slice(0, lastDot)}_${count}${originalFilename.slice(lastDot)}`
          : `${originalFilename}_${count}`;

      archive.append(file.file_data, {
        name: count === 1 ? basePath : `${folderPath}/${filename}`
      });
    }

    await archive.finalize();
  } catch (err) {
    console.error(
      "ALL-STATEMENTS ZIP PREPARATION ERROR:",
      err.stack || err
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error: "FAILED TO PREPARE ZIP DOWNLOAD"
      });
    }

    res.destroy(err);
  }
}

/* 4. Approved master downloads */
const REPORT_MASTER_FILES = Object.freeze({
  excel: {
    table: "portal_master_extraction_files",
    masterKey: "REGULAR:SSS",
    filename: "EXCEL_Master_Extraction.xlsx"
  },

  "excel-invalid": {
    table: "portal_master_extraction_files",
    masterKey: "INVALID:SSS",
    filename: "INVALID_EXCEL_Master_Extraction.xlsx"
  },

  txt: {
    table: "portal_master_extraction_files",
    masterKey: "REGULAR:TXT",
    filename: "TXT_Master_Extraction.xlsx"
  },

  "txt-invalid": {
    table: "portal_master_extraction_files",
    masterKey: "INVALID:TXT",
    filename: "INVALID_TXT_Master_Extraction.xlsx"
  },

  
  "sss-matched": {
    table: "portal_matched_master_extraction_files",
    masterKey: "REGULAR:SSS",
    filename: "SSS_Matched_Master_Extraction.xlsx"
  },

  "sss-matched-invalid": {
    table: "portal_matched_master_extraction_files",
    masterKey: "INVALID:SSS",
    filename: "INVALID_SSS_Matched_Master_Extraction.xlsx"
  }

});


router.get(
  "/reports/master/:masterKey",
  verifyToken,
  reportsAdminOnly,
  async (req, res) => {
    const master = REPORT_MASTER_FILES[req.params.masterKey];

    if (!master) {
      return res.status(404).json({
        error: "UNKNOWN MASTER DOWNLOAD"
      });
    }

    try {
      if (master.table) {
        const result = await pool.query(
          `
            SELECT file_data, original_filename, mime_type
            FROM ${master.table}
            WHERE master_key = $1
            LIMIT 1
          `,
          [master.masterKey]
        );

        if (!result.rows.length || !result.rows[0].file_data) {
          return res.status(404).json({
            error: `MASTER FILE NOT FOUND: ${master.masterKey}`
          });
        }

        const file = result.rows[0];
        const filename = reportsSafeFilename(
          master.filename || file.original_filename,
          "Master_Extraction.xlsx"
        );

        res.setHeader(
          "Content-Type",
          file.mime_type ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        return res.send(file.file_data);
      }

      if (!fs.existsSync(master.filePath)) {
        return res.status(404).json({
          error: "MASTER FILE NOT FOUND"
        });
      }

      return res.download(
        master.filePath,
        path.basename(master.filePath),
        (err) => {
          if (err) {
            console.error(
              "REPORTS MASTER DOWNLOAD ERROR:",
              err.message
            );
          }
        }
      );
    } catch (err) {
      console.error("REPORTS MASTER DOWNLOAD ERROR:", err.message);

      if (!res.headersSent) {
        return res.status(500).json({
          error: "FAILED TO DOWNLOAD MASTER FILE"
        });
      }
    }
  }
);


module.exports = router;