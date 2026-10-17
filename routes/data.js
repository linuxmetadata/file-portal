const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

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

const { loadPriceList } = require("../services/priceListLoader");

const {
  updateMasterExtraction
} = require("../services/masterExtractionService");

const router = express.Router();


const {
  listPortalStockists,
  getStockist,
  updateStockistSales
} = require("../services/postgresPortalRepository");

const {
  storeUploadedFile,
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

storedFile = await storeUploadedFile({
    filePath: req.file.path,
    originalFilename: req.file.originalname,
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
    req.file.originalname
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
                            MONTH: "",
                            ZONE: "",
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
module.exports = router;