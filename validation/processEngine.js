/**
 * ======================================================
 * PROCESS ENGINE
 * ======================================================
 *
 * Complete Statement Processing Pipeline
 *
 * Portal
 *    ↓
 * Reader
 *    ↓
 * Document Validation
 *    ↓
 * Statement Analyzer
 *    ↓
 * Extractor
 *    ↓
 * Product Matcher
 *    ↓
 * Calculation Engine
 *    ↓
 * Portal Data Merger
 *    ↓
 * Output Writer
 *
 * IMPORTANT
 * ---------
 * A single invalid statement must not crash the batch.
 * Invalid / unreadable statements return:
 *
 *     success: false
 *     skipped: true
 *
 * Actual processing errors return:
 *
 *     success: false
 *     skipped: false
 */

const path = require("path");
const XLSX = require("xlsx");

//======================================================
// SINGLE COLUMN ERP STATEMENT NORMALIZER
// ADDITIONAL FALLBACK ONLY
// Existing multi-column statements are NOT affected.
//======================================================

//======================================================
// SINGLE COLUMN ERP STATEMENT NORMALIZER
// ADDITIONAL FALLBACK ONLY
//
// Supports fixed-width / single-column ERP statements
// such as:
//
// ITEM DESCRIPTION
// OPENING QTY / VALUE
// RECEIPT QTY / VALUE
// ISSUE QTY / VALUE
// CLOSING QTY / VALUE
// DUMP QTY
//
// Existing multi-column statements are NOT affected.
//======================================================

function normalizeSingleColumnERPStatement(workbook) {

    if (
        !workbook ||
        !Array.isArray(workbook.SheetNames)
    ) {
        return false;
    }


    for (const sheetName of workbook.SheetNames) {

        const sheet =
            workbook.Sheets[sheetName];

        if (
            !sheet ||
            !sheet["!ref"]
        ) {
            continue;
        }


        const rows =
            XLSX.utils.sheet_to_json(
                sheet,
                {
                    header: 1,
                    blankrows: false,
                    defval: ""
                }
            );


        //--------------------------------------------------
        // FIND ERP HEADER
        //--------------------------------------------------

        let headerIndex = -1;

        for (
            let i = 0;
            i < rows.length;
            i++
        ) {

            const text =
                String(
                    rows[i]?.[0] || ""
                )
                    .replace(/\s+/g, " ")
                    .trim()
                    .toUpperCase();


            //--------------------------------------------------
            // Bajrang / Linux ERP format
            //--------------------------------------------------

            if (
                text.includes("ITEM DESCRIPTION") &&
                text.includes("OPENING") &&
                text.includes("RECEIPT") &&
                text.includes("ISSUE") &&
                text.includes("CLOSING")
            ) {

                headerIndex = i;

                break;
            }
        }


        //--------------------------------------------------
        // Not this format
        //--------------------------------------------------

        if (headerIndex === -1) {
            continue;
        }


        console.log("");
        console.log(
            "===== SINGLE COLUMN ERP FORMAT DETECTED ====="
        );

        console.log(
            "Sheet      :",
            sheetName
        );

        console.log(
            "Header Row :",
            headerIndex + 1
        );


        //--------------------------------------------------
        // NORMALIZED TABLE
        //
        // Keep CODE column because the existing analyzer /
        // extractor understands product description together
        // with movement columns.
        //
        // CODE will remain blank for this ERP format.
        //--------------------------------------------------

        const normalizedRows = [];


        //--------------------------------------------------
        // Keep rows before header
        //--------------------------------------------------

        for (
            let i = 0;
            i < headerIndex;
            i++
        ) {

            normalizedRows.push([
                rows[i]?.[0] || ""
            ]);
        }


        //--------------------------------------------------
        // NORMALIZED HEADER
        //--------------------------------------------------

        normalizedRows.push([
            "CODE",
            "ITEM DESCRIPTION",
            "PACKING",
            "OPENING",
            "RECEIPT",
            "ISSUE",
            "CLOSING"
        ]);


        //--------------------------------------------------
        // PRODUCT ROWS
        //--------------------------------------------------

        let productCount = 0;


        for (
            let i = headerIndex + 1;
            i < rows.length;
            i++
        ) {

            const raw =
                String(
                    rows[i]?.[0] || ""
                ).trim();


            //--------------------------------------------------
            // Empty row
            //--------------------------------------------------

            if (!raw) {

                normalizedRows.push([]);

                continue;
            }


            const upper =
                raw.toUpperCase();


            //--------------------------------------------------
            // Footer / separator
            //--------------------------------------------------

            if (
                upper.startsWith("TOTAL") ||
                upper.startsWith("GRAND TOTAL") ||
                upper.startsWith("SUB TOTAL") ||
                upper.startsWith("PREPARED") ||
                upper.startsWith("AUTHORISED") ||
                upper.startsWith("AUTHORIZED") ||
                upper.startsWith("COMPUTER GENERATED") ||
                /^[-\s]+$/.test(raw)
            ) {

                normalizedRows.push([
                    raw
                ]);

                continue;
            }


            //--------------------------------------------------
            // Ignore company heading after header
            //--------------------------------------------------

            if (
                upper === "LINUX LAB PVT LTD"
            ) {

                normalizedRows.push([
                    raw
                ]);

                continue;
            }


            //--------------------------------------------------
            // Split fixed-width row
            //--------------------------------------------------

            const parts =
                raw
                    .split(/\s+/)
                    .filter(Boolean);


            //--------------------------------------------------
            // Bajrang format requires at least:
            //
            // description
            // packing
            // opening qty
            // opening value
            // receipt qty
            // receipt value
            // issue qty
            // issue value
            // closing qty
            // closing value
            // dump qty
            //
            // = 11 tokens minimum
            //--------------------------------------------------

            if (
                parts.length < 8
            ) {

                normalizedRows.push([
                    raw
                ]);

                continue;
            }


            //--------------------------------------------------
            // LAST 9 MOVEMENT TOKENS
            //
            // Example:
            //
            // 10 964.10 - 0.00 - 0.00 10 964.10 10
            //
            // Actually we only need the QTY columns:
            //
            // opening qty
            // receipt qty
            // issue qty
            // closing qty
            //
            // The value columns are ignored.
            //--------------------------------------------------

            const movementStart =
                parts.length - 9;


            if (
                movementStart < 1
            ) {

                normalizedRows.push([
                    raw
                ]);

                continue;
            }


            //--------------------------------------------------
            // Description + packing
            //--------------------------------------------------

            let descriptionParts =
                parts.slice(
                    0,
                    movementStart
                );


            let packing = "";


            //--------------------------------------------------
            // Detect packing
            //
            // Examples:
            // 1*10TAB
            // 1*10
            // 1*15
            // 10TAB
            //--------------------------------------------------

            if (
                descriptionParts.length > 1 &&
                /^\d+\s*[*xX/]\s*\d+(?:[A-Za-z]*)?$/
                    .test(
                        descriptionParts[
                            descriptionParts.length - 1
                        ]
                    )
            ) {

                packing =
                    descriptionParts.pop();
            }


            const description =
                descriptionParts
                    .join(" ")
                    .trim();


            //--------------------------------------------------
            // Must have product description
            //--------------------------------------------------

            if (
                !description
            ) {

                normalizedRows.push([
                    raw
                ]);

                continue;
            }


            //--------------------------------------------------
            // Movement positions
            //
            // parts:
            //
            // [ ... description ...,
            //   openingQty,
            //   openingValue,
            //   receiptQty,
            //   receiptValue,
            //   issueQty,
            //   issueValue,
            //   closingQty,
            //   closingValue,
            //   dumpQty ]
            //--------------------------------------------------

            const opening =
                parts[movementStart];

            const receipt =
                parts[movementStart + 2];

            const issue =
                parts[movementStart + 4];

            const closing =
                parts[movementStart + 6];


            //--------------------------------------------------
            // Normalize "-"
            //--------------------------------------------------

            const normalizeQty =
                value => {

                    if (
                        value === undefined ||
                        value === null ||
                        value === "" ||
                        value === "-"
                    ) {
                        return 0;
                    }

                    return value;
                };


            //--------------------------------------------------
            // Add normalized product
            //
            // CODE = blank
            // ITEM DESCRIPTION = actual product
            //--------------------------------------------------

            normalizedRows.push([
                "",
                description,
                packing,
                normalizeQty(opening),
                normalizeQty(receipt),
                normalizeQty(issue),
                normalizeQty(closing)
            ]);


            productCount++;
        }


        //--------------------------------------------------
        // Replace sheet ONLY if products were found
        //--------------------------------------------------

        if (
            productCount > 0
        ) {

            workbook.Sheets[sheetName] =
                XLSX.utils.aoa_to_sheet(
                    normalizedRows
                );


            console.log(
                "Products Detected :",
                productCount
            );

            console.log(
                "✓ Single-column ERP sheet normalized"
            );

            console.log(
                "============================================"
            );


            return true;
        }
    }


    return false;
}

const {
    readDocument
} = require("./readers/documentReader");

const { analyzeStatement } = require("./analyzers/statementAnalyzer");

const {
    extractRows
} = require("./extractor");

const {
    loadPriceList
} = require("../matcher/priceLoader");

const {
    buildPriceIndex
} = require("../matcher/priceIndex");

const {
    matchProduct
} = require("../matcher");

const {
    calculate
} = require("./calculationEngine");

const {
    mergePortalData
} = require("./portalDataMerger");

const {
    writeExtraction
} = require("./outputWriter");


//======================================================
// DOCUMENT CONTENT VALIDATION
//======================================================

function validateDocumentContent(workbook) {

    if (!workbook) {

        return {

            valid: false,

            reason:
                "DOCUMENT_EMPTY",

            message:
                "Document workbook is empty."

        };

    }


    if (
        !Array.isArray(workbook.SheetNames) ||
        workbook.SheetNames.length === 0
    ) {

        return {

            valid: false,

            reason:
                "NO_SHEETS",

            message:
                "Document contains no worksheets."

        };

    }


    let totalNonEmptyCells = 0;

let hasMultiColumnData = false;

//--------------------------------------------------
// SINGLE COLUMN DATA
//
// Some valid ERP statements store the complete
// fixed-width product row in ONE Excel cell.
//
// Do NOT reject these files here.
// The Statement Analyzer will decide whether
// the content is actually a valid statement.
//--------------------------------------------------

let hasSingleColumnData = false;
let singleColumnRows = 0;

    //--------------------------------------------------
    // Scan all worksheets
    //--------------------------------------------------

    for (
        const sheetName of workbook.SheetNames
    ) {

        const sheet =
            workbook.Sheets[sheetName];


        if (!sheet)
            continue;


        const range =
            sheet["!ref"];


        if (!range)
            continue;


        const rows =
            XLSX.utils.sheet_to_json(

                sheet,

                {

                    header: 1,

                    blankrows: false,

                    defval: ""

                }

            );


   for (
    const row of rows
) {

    const values =
        row
            .map(value =>
                String(value || "")
                    .trim()
            )
            .filter(Boolean);


    totalNonEmptyCells +=
        values.length;


    //--------------------------------------------------
    // MULTI-COLUMN DATA
    //
    // Existing logic remains unchanged.
    //--------------------------------------------------

    if (
        values.length >= 2
    ) {

        hasMultiColumnData = true;

    }


    //--------------------------------------------------
    // SINGLE-COLUMN DATA
    //
    // A valid fixed-width ERP statement can have
    // the complete product row inside one cell.
    //
    // Example:
    //
    // RDL 100MG TAB  1*10TAB  10  964.10  - ...
    //
    // Do NOT reject it as NO_TABULAR_DATA.
    //--------------------------------------------------

    if (
        values.length === 1 &&
        String(values[0]).trim().length >= 3
    ) {

        singleColumnRows++;

    }

}

    }

    //--------------------------------------------------
// SINGLE COLUMN ERP FALLBACK
//--------------------------------------------------
//
// IMPORTANT:
// Do not change the existing multi-column logic.
// This only runs when the existing check fails.
//--------------------------------------------------

if (!hasMultiColumnData) {

    const normalizedERP =
        normalizeSingleColumnERPStatement(workbook);

    if (normalizedERP) {

        hasMultiColumnData = true;

        console.log("");

        console.log(
            "✓ Single-column ERP statement normalized"
        );

    }

}

    //--------------------------------------------------
    // Empty workbook
    //--------------------------------------------------

    if (
        totalNonEmptyCells === 0
    ) {

        return {

            valid: false,

            reason:
                "EMPTY_DOCUMENT",

            message:
                "INVALID STATEMENT: File contains no usable data."

        };

    }


    //--------------------------------------------------
    // Single-cell note / rejection file
    //--------------------------------------------------

    if (
    !hasMultiColumnData &&
    singleColumnRows === 0
) {

    return {

        valid: false,

        reason:
            "NO_TABULAR_DATA",

        message:
            "INVALID STATEMENT: File contains no usable tabular data."

    };

}


    return {

        valid: true,

        reason: null,

        message: null

    };

}


//======================================================
// SAFE FAILURE RESULT
//======================================================

function buildFailureResult({

    statementFile,

    start,

    reason,

    message,

    skipped = false

}) {

    return {

        success: false,

        skipped,

        reason,

        statement:
            path.basename(statementFile),

        totalProducts: 0,

        matchedProducts: 0,

        unmatchedProducts: 0,

        outputFile: null,

        unmatchedList: [],

        message,

        processingTime:

            (
                (Date.now() - start) / 1000
            ).toFixed(2) + " sec"

    };

}


//======================================================
// PROCESS STATEMENT
//======================================================

async function processStatement(options) {

    const {

        statementFile,

        priceFile,

        portalData = {},

        statementType = "SSS"

    } = options;


    const start =
        Date.now();


    console.log("");

    console.log(
        "================================================"
    );

    console.log(
        "START :",
        path.basename(statementFile)
    );

    console.log(
        "================================================"
    );


    //--------------------------------------------------
    // Validate input path
    //--------------------------------------------------

    if (!statementFile) {

        return buildFailureResult({

            statementFile:
                statementFile || "UNKNOWN",

            start,

            reason:
                "STATEMENT_FILE_MISSING",

            message:
                "Statement file path was not provided.",

            skipped: true

        });

    }


    //--------------------------------------------------
    // STEP 1 : READ DOCUMENT
    //--------------------------------------------------

    let document;


    try {

        document =
            await readDocument(
                statementFile
            );

    } catch (error) {

        console.log(
            "✗ Document Read Failed"
        );

        console.error(
            error.message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "DOCUMENT_READ_ERROR",

            message:
                error.message,

            skipped: true

        });

    }


    console.log(
        "✓ Document Read"
    );


    if (
        !document ||
        !document.success
    ) {

        const message =
            document?.message ||
            "Unable to read document.";


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "DOCUMENT_READ_FAILED",

            message,

            skipped: true

        });

    }


    //--------------------------------------------------
    // STEP 1A : DOCUMENT CONTENT VALIDATION
    //--------------------------------------------------

    const contentValidation =
        validateDocumentContent(
            document.workbook
        );


    if (
        !contentValidation.valid
    ) {

        console.log("");

        console.log(
            "SKIPPED INVALID DOCUMENT"
        );

        console.log(
            "Reason :",
            contentValidation.reason
        );

        console.log(
            "Message:",
            contentValidation.message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                contentValidation.reason,

            message:
                contentValidation.message,

            skipped: true

        });

    }


    //--------------------------------------------------
    // STEP 2 : ANALYZE STATEMENT
    //--------------------------------------------------

    let analysis;


    try {

        analysis =
            analyzeStatement(
                document.workbook
            );

    } catch (error) {

        console.log("");

        console.log(
            "STATEMENT ANALYZER FAILED"
        );

        console.log(
            "File :",
            path.basename(statementFile)
        );

        console.error(
            error.message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "ANALYZER_ERROR",

            message:
                error.message,

            skipped: false

        });

    }


    if (
        !analysis ||
        !analysis.success
    ) {

        const message =
            analysis?.message ||
            "Statement analysis failed.";


        //--------------------------------------------------
        // Header not found is a skipped statement,
        // not a crash.
        //--------------------------------------------------

        const isHeaderProblem =
            message
                .toLowerCase()
                .includes("header row not found") ||

            message
                .toLowerCase()
                .includes("product column not found");


        console.log("");

        console.log(
            isHeaderProblem
                ? "SKIPPED STATEMENT"
                : "STATEMENT ANALYSIS FAILED"
        );

        console.log(
            "Reason :",
            message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                isHeaderProblem
                    ? "HEADER_NOT_FOUND"
                    : "ANALYSIS_FAILED",

            message,

            skipped:
                isHeaderProblem

        });

    }


    console.log(
        "✓ Statement Analyzed"
    );


    //--------------------------------------------------
    // STEP 3 : EXTRACT ROWS
    //--------------------------------------------------

    let extraction;


    try {

        extraction =
            extractRows(

                document.workbook,

                analysis

            );

    } catch (error) {

        console.log("");

        console.log(
            "EXTRACTOR FAILED"
        );

        console.log(
            "File :",
            path.basename(statementFile)
        );

        console.error(
            error.message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "EXTRACTION_ERROR",

            message:
                error.message,

            skipped: false

        });

    }


    if (
        !extraction ||
        !extraction.success
    ) {

        const message =
            extraction?.message ||
            "Unable to extract rows.";


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "EXTRACTION_FAILED",

            message,

            skipped: false

        });

    }


    console.log(
        "✓ Rows Extracted :",
        extraction.records.length
    );


    //--------------------------------------------------
    // No records
    //--------------------------------------------------

    if (
        extraction.records.length === 0
    ) {

        console.log("");

        console.log(
            "SKIPPED : NO PRODUCT RECORDS"
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "NO_PRODUCT_RECORDS",

            message:
                "No product records were extracted from the statement.",

            skipped: true

        });

    }


    //--------------------------------------------------
    // STEP 4 : LOAD PRICE LIST
    //--------------------------------------------------

    let priceIndex;


    try {

        const {
            priceIndex:
                suppliedPriceIndex = null

        } = options;


        if (
            suppliedPriceIndex
        ) {

            priceIndex =
                suppliedPriceIndex;

        } else {

            const priceData =
                loadPriceList(
                    priceFile
                );


            if (
                !priceData ||
                !priceData.priceList
            ) {

                throw new Error(
                    "Price list could not be loaded."
                );

            }


            priceIndex =
                buildPriceIndex(
                    priceData.priceList
                );

        }

    } catch (error) {

        console.log("");

        console.log(
            "PRICE LIST FAILED"
        );

        console.log(
            "File :",
            path.basename(statementFile)
        );

        console.error(
            error.message
        );


        return buildFailureResult({

            statementFile,

            start,

            reason:
                "PRICE_LIST_ERROR",

            message:
                error.message,

            skipped: false

        });

    }


    //--------------------------------------------------
    // STEP 5 : BUILD RECORDS
    //--------------------------------------------------

    const finalRecords = [];

    const unmatchedProducts = [];


    let matched = 0;

    let unmatched = 0;


    for (
        const row of extraction.records
    ) {

        let product;

        let calculated;

        let finalRecord;


        //--------------------------------------------------
        // Match Product
        //--------------------------------------------------

        try {

            product =
                matchProduct(

                    row.product,

                    priceIndex

                );

        } catch (error) {

            console.log("");

            console.log(
                "================================"
            );

            console.log(
                "MATCH PRODUCT FAILED"
            );

            console.log(
                "================================"
            );

            console.log(
                "File    :",
                path.basename(statementFile)
            );

            console.log(
                "Product :",
                row.product
            );

            console.error(
                error.message
            );


            throw error;

        }


        if (
            product &&
            product.matched
        ) {

            matched++;

        } else {

            unmatched++;


            unmatchedProducts.push({

                statement:
                    path.basename(
                        statementFile
                    ),

                sheet:
                    analysis.sheetName,

                row:
                    row.rowNumber || "",

                product:
                    row.product,

                timestamp:
                    new Date().toISOString()

            });

        }


        //--------------------------------------------------
        // Calculation
        //--------------------------------------------------

        try {

            calculated =
                calculate(

                    row,

                    product?.product || {}

                );

        } catch (error) {

            console.log("");

            console.log(
                "================================"
            );

            console.log(
                "CALCULATION FAILED"
            );

            console.log(
                "================================"
            );

            console.log(
                "File    :",
                path.basename(statementFile)
            );

            console.log(
                "Product :",
                row.product
            );

            console.error(
                error.message
            );


            throw error;

        }


        //--------------------------------------------------
        // Portal Merge
        //--------------------------------------------------

        try {

            finalRecord =
                mergePortalData(

                    calculated,

                    portalData

                );

        } catch (error) {

            console.log("");

            console.log(
                "================================"
            );

            console.log(
                "PORTAL MERGE FAILED"
            );

            console.log(
                "================================"
            );

            console.log(
                "File    :",
                path.basename(statementFile)
            );

            console.log(
                "Product :",
                row.product
            );

            console.error(
                error.message
            );


            throw error;

        }


        finalRecords.push(
            finalRecord
        );

    }


    //--------------------------------------------------
    // STEP 6 : WRITE OUTPUT
    //--------------------------------------------------

    console.log("");

    console.log(
        "ENTERING OUTPUT WRITER"
    );


    let output;


    try {

        output =
            await writeExtraction(

                finalRecords,

                statementType,

                path.basename(
                    statementFile,
                    path.extname(statementFile)
                )

            );


        console.log(
            "OUTPUT WRITER COMPLETED"
        );

    } catch (error) {

        console.log("");

        console.log(
            "================================"
        );

        console.log(
            "OUTPUT WRITER FAILED"
        );

        console.log(
            "================================"
        );

        console.log(
            "File :",
            path.basename(statementFile)
        );

        console.error(
            error.message
        );


        throw error;

    }


    //--------------------------------------------------
    // SUMMARY
    //--------------------------------------------------

    return {

        success: true,

        skipped: false,

        reason: null,

        statement:
            path.basename(
                statementFile
            ),

        totalProducts:
            finalRecords.length,

        matchedProducts:
            matched,

        unmatchedProducts:
            unmatched,

        outputFile:
            output.file,

        unmatchedList:
            unmatchedProducts,

        processingTime:

            (
                (Date.now() - start) / 1000
            ).toFixed(2) + " sec"

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    processStatement

};