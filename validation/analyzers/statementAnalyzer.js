/**
 * ======================================================
 * STATEMENT ANALYZER
 * ======================================================
 *
 * Responsibilities
 *
 * ------------------------------------------------------
 * 1. Detect Header Row
 * 2. Map Available Columns
 * 3. Detect Actual Product Column
 * 4. Detect Data Range
 * 5. Synchronize Mapping With Detected Structure
 *
 * NOTE
 * ------------------------------------------------------
 * Only PRODUCT is mandatory.
 * All other columns are optional.
 */

const { findHeaderRow } = require("../detectors/headerDetector");
const { mapHeaders } = require("../mappers/extractionMapper");
const { findDataRange } = require("../detectors/dataRangeDetector");

function analyzeStatement(workbook) {

    //--------------------------------------------------
    // STEP 1 : HEADER DETECTION
    //--------------------------------------------------

    const header = findHeaderRow(workbook);

    if (!header || !header.found) {

        return {

            success: false,

            message: "Header row not found."

        };

    }

    //--------------------------------------------------
    // STEP 2 : HEADER MAPPING
    //--------------------------------------------------

    const headerRow =
        header.headers ||
        header.row ||
        [];

    const columnResult =
        mapHeaders(headerRow);

    console.log("");

    console.log(
        "===== COLUMN MAPPING ====="
    );

    console.table(
        columnResult.mapping
    );

    console.log(
        "=========================="
    );

    //--------------------------------------------------
// PRODUCT VALIDATION + STRUCTURAL FALLBACK
//--------------------------------------------------

//--------------------------------------------------
// If normal header mapping failed because the
// product header was not recognized, do NOT stop
// immediately.
//
// findHeaderRow() may already have detected the
// actual product column structurally.
//
// Example:
//
// Sheet2:
// Column 1 = LINUX META
// Data rows = TRIEXER, VYSOV, etc.
//
// header.productColumn = 1
// mapHeaders() product = null
//
// In this situation use the structural detection.
//--------------------------------------------------

if (
    (
        columnResult.mapping.product === null ||
        columnResult.mapping.product === undefined
    ) &&
    header.productColumn !== null &&
    header.productColumn !== undefined &&
    Number(header.productColumn) >= 0
) {

    console.log("");

    console.log(
        "===== PRODUCT COLUMN FALLBACK ====="
    );

    console.log(
        "Mapped Product Column   :",
        columnResult.mapping.product
    );

    console.log(
        "Detected Product Column :",
        header.productColumn
    );

    columnResult.mapping.product =
        Number(header.productColumn);

    console.log(
        "Final Product Column    :",
        columnResult.mapping.product
    );

    console.log(
        "===================================="
    );

}

//--------------------------------------------------
// NOW CHECK WHETHER MAPPING IS USABLE
//--------------------------------------------------
//
// Do this AFTER the structural fallback.
//--------------------------------------------------

if (!columnResult.success) {

    // Normal mapper failed, but if PRODUCT has now
    // been recovered structurally, continue.
    if (
        columnResult.mapping.product === null ||
        columnResult.mapping.product === undefined ||
        Number(columnResult.mapping.product) < 0
    ) {

        return {

            success: false,

            message:
                columnResult.message ||
                "Product column not found.",

            mapping:
                columnResult.mapping,

            headers:
                columnResult.headers

        };

    }

}

//--------------------------------------------------
// FINAL PRODUCT VALIDATION
//--------------------------------------------------

if (
    columnResult.mapping.product === null ||
    columnResult.mapping.product === undefined ||
    Number(columnResult.mapping.product) < 0
) {

    return {

        success: false,

        message:
            "Mandatory PRODUCT column not found.",

        mapping:
            columnResult.mapping,

        headers:
            columnResult.headers

    };

}

    //--------------------------------------------------
    // STEP 3 : DATA RANGE
    //--------------------------------------------------

    const range =
        findDataRange(

            workbook,

            header,

            columnResult.mapping

        );

    console.log("");

    console.log(
        "===== DATA RANGE ====="
    );

    console.table(range);

    console.log(
        "======================"
    );

    //--------------------------------------------------
    // RANGE VALIDATION
    //--------------------------------------------------

    if (
        !range ||
        !range.success
    ) {

        return {

            success: false,

            message:
                range?.message ||
                "Unable to detect data range.",

            mapping:
                columnResult.mapping,

            headers:
                columnResult.headers

        };

    }

    //--------------------------------------------------
    // CRITICAL FIX
    //
    // dataRangeDetector may discover that the actual
    // product column is different from the header-mapped
    // product column.
    //
    // Example:
    //
    // Header says:
    // Item -> column 2
    //
    // Actual data:
    // Product -> column 1
    //
    // The extractor MUST use the detected column.
    //--------------------------------------------------

    if (
        range.productColumn !== null &&
        range.productColumn !== undefined &&
        Number(range.productColumn) >= 0
    ) {

        console.log("");

        console.log(
            "===== PRODUCT COLUMN SYNC ====="
        );

        console.log(
            "Header Mapping Product :",
            columnResult.mapping.product
        );

        console.log(
            "Detected Data Product  :",
            range.productColumn
        );

        columnResult.mapping.product =
            Number(range.productColumn);

        console.log(
            "Final Product Column   :",
            columnResult.mapping.product
        );

        console.log(
            "================================"
        );

    }

    //--------------------------------------------------
    // FINAL VALIDATION
    //--------------------------------------------------

    if (
        columnResult.mapping.product === null ||
        columnResult.mapping.product === undefined ||
        Number(columnResult.mapping.product) < 0
    ) {

        return {

            success: false,

            message:
                "Product column could not be finalized.",

            mapping:
                columnResult.mapping,

            headers:
                columnResult.headers

        };

    }

    //--------------------------------------------------
    // DATA RANGE VALIDATION
    //--------------------------------------------------

    if (
        !Number.isInteger(
            Number(range.firstDataRow)
        ) ||
        Number(range.firstDataRow) < 1
    ) {

        return {

            success: false,

            message:
                "Invalid first data row detected.",

            mapping:
                columnResult.mapping,

            headers:
                columnResult.headers

        };

    }

    if (
        !Number.isInteger(
            Number(range.lastDataRow)
        ) ||
        Number(range.lastDataRow) <
            Number(range.firstDataRow)
    ) {

        return {

            success: false,

            message:
                "Invalid last data row detected.",

            mapping:
                columnResult.mapping,

            headers:
                columnResult.headers

        };

    }

    //--------------------------------------------------
    // FINAL MAPPING
    //--------------------------------------------------

    console.log("");

    console.log(
        "===== FINAL EXTRACTOR MAP ====="
    );

    console.table(
        columnResult.mapping
    );

    console.log(
        "==============================="
    );

    //--------------------------------------------------
    // FINAL RESULT
    //--------------------------------------------------

    return {

        success: true,

        sheetName:
            header.sheetName,

        sheet:
            header.sheet,

        headerRow:
            header.headerRow,

        firstDataRow:
            range.firstDataRow,

        lastDataRow:
            range.lastDataRow,

        totalRows:
            range.totalRows,

        mapping:
            columnResult.mapping,

        headers:
            columnResult.headers,

        productColumn:
            columnResult.mapping.product,

        // Preserve the structural format detected by headerDetector.
        specialFormat:
            header.specialFormat || null,

        // Preserve detector metadata for downstream modules.
        detection:
            header.detection || null,

        confidence:
            header.confidence ?? null

    };

}

module.exports = {

    analyzeStatement

};