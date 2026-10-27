/**
 * ============================================================
 * EXCEL EXTRACTION MASTER
 * ============================================================
 *
 * PURPOSE:
 *   Creates the Extraction Master for EXCEL statements only.
 *
 * IMPORTANT:
 *   - This is SEPARATE from the TXT Master Extraction.
 *   - Does NOT use the TXT Single-Row / Multi-Row pipeline.
 *   - Does NOT perform product matching.
 *   - Does NOT perform calculation.
 *   - Does NOT use a price list.
 *
 * DESIGN:
 *   Uses the same Master structure and row-building concept as
 *   singleRowExtractionMaster.js.
 *
 * FLOW:
 *
 *   Excel File
 *       ↓
 *   Excel Reader
 *       ↓
 *   Statement Analyzer
 *       ↓
 *   Excel Extractor
 *       ↓
 *   Excel Extraction Master
 *       ↓
 *   Master_Extraction.xlsx
 *
 * SOURCE DATA:
 *   The ORIGINAL Excel row is read directly from the workbook.
 *   Therefore ALL detected source headers and ALL source values
 *   are preserved in "Raw Source Values".
 *
 * COMMON DATA:
 *   Canonical values returned by validation/extractor.js are
 *   used to populate the Common Master columns.
 *
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

console.log("### EXCEL MASTER FILE CONFIRMATION ###");
console.log("RUNNING FILE :", __filename);
console.log("### END FILE CONFIRMATION ###");


const {
    readDocument
} = require("../readers/documentReader");

const {
    analyzeStatement
} = require("../analyzers/statementAnalyzer");

const {
    extractRows
} = require("../extractor");


// ============================================================
// MASTER FILE
// ============================================================

const MASTER_DIR =
    path.resolve(
        __dirname,
        "../../storage/extraction/WORKING"
    );

const MASTER_FILE =
    path.join(
        MASTER_DIR,
        "Master_Extraction.xlsx"
    );


// ============================================================
// SYSTEM COLUMNS
// ============================================================

const SYSTEM_COLUMNS = [
    "Source File",
    "Source Row",
    "Statement Structure"
];


// ============================================================
// SUPPORT COLUMNS
// ============================================================

const SUPPORT_COLUMNS = [
    "Raw Source Values",
    "Header Mapping",
    "Unidentified Headers"
];


// ============================================================
// COMMON COLUMNS
// ============================================================

const COMMON_COLUMNS = [
    "Common Product",
    "Common Pack",
    "Common Purchase Rate",
    "Common Rate",
    "Common Opening",
    "Common Opening Value",
    "Common Purchase",
    "Common Purchase Free",
    "Common Purchase Value",
    "Common Purchase Return",
    "Common Purchase Return Free",
    "Common Replacement",
    "Common Sales Replacement",
    "Common Sales",
    "Common Sales Free",
    "Common Sales Value",
    "Common Sales Last",
    "Common Sales Return",
    "Common Sales Return Free",
    "Common TRN IN",
    "Common TRN OUT",
    "Common Credit",
    "Common Debit",
    "Common Adjustment",
    "Common Closing",
    "Common Closing Free",
    "Common Closing Value",
    "Common Total Stock",
    "Common Age"
];


// ============================================================
// COMPLETE MASTER SCHEMA
// ============================================================

const MASTER_COLUMNS = [
    ...SYSTEM_COLUMNS,
    ...SUPPORT_COLUMNS,
    ...COMMON_COLUMNS
];


// ============================================================
// SAFE VALUE
// ============================================================

function safeValue(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return value;
}


// ============================================================
// ENSURE MASTER DIRECTORY
// ============================================================

function ensureMasterDirectory() {

    if (
        !fs.existsSync(
            MASTER_DIR
        )
    ) {

        fs.mkdirSync(
            MASTER_DIR,
            {
                recursive: true
            }
        );
    }
}


// ============================================================
// GET WORKSHEET
// ============================================================

function getWorksheet(
    workbook,
    analysis
) {

    if (
        !workbook ||
        !analysis
    ) {
        return null;
    }

    return (
        workbook.Sheets[
            analysis.sheetName
        ] ||
        workbook.Sheets[
            workbook.SheetNames?.[0]
        ] ||
        null
    );
}


// ============================================================
// GET ALL SOURCE ROWS
// ============================================================

function getSourceRows(
    worksheet
) {

    if (!worksheet) {
        return [];
    }

    const rows =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                header: 1,
                blankrows: true,
                defval: ""
            }
        );

        console.log("");
console.log("===== SRI LAKSHMI RAW ROW INSPECTION =====");

for (let i = 0; i < Math.min(rows.length, 15); i++) {
    console.log(
        "RAW ROW",
        i,
        ":",
        JSON.stringify(rows[i])
    );
}

console.log("==========================================");

        console.log(
    "### STAGE 1 DEBUG VERSION 20260913 ###"
);



    // ============================================================
// TEMPORARY STAGE 1 DEBUG
// ============================================================

console.log("");
console.log(
    "===== STAGE 1 RAW EXCEL SOURCE DEBUG ====="
);

console.log(
    "Total Raw Rows :",
    rows.length
);

for (
    let r = 0;
    r < Math.min(rows.length, 15);
    r++
) {

    const row =
        rows[r] || [];

    console.log(
        `RAW ROW ${r} LENGTH :`,
        row.length
    );

    row.forEach(
        (value, c) => {

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {

                console.log(
                    `  COL ${c} :`,
                    JSON.stringify(value)
                );

            }

        }
    );

}

console.log(
    "==========================================="
);

console.log("");

    return rows;
}


// ============================================================
// GET HEADER ROW
// ============================================================

function getHeaderRowIndex(
    analysis
) {

    const headerRow =
        Number(
            analysis?.headerRow
        );

    if (
        Number.isFinite(headerRow) &&
        headerRow > 0
    ) {
        return headerRow - 1;
    }

    return 0;
}


// ============================================================
// GET SOURCE HEADERS
// ============================================================

function getSourceHeaders(
    rows,
    analysis
) {

    const headerIndex =
        getHeaderRowIndex(
            analysis
        );

    const headerRow =
        rows[headerIndex] || [];

    return headerRow.map(
        (header, index) => {

            const text =
                String(
                    header ?? ""
                ).trim();

            return {
                index,
                header:
                    text ||
                    `Column ${index + 1}`
            };
        }
    );
}


// ============================================================
// NORMALIZE HEADER
// ============================================================

function normalizeHeader(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}


// ============================================================
// GET ORIGINAL SOURCE ROW
// ============================================================

function getOriginalSourceRow(
    rows,
    sourceRow
) {

    const excelRow =
        Number(
            sourceRow
        );

    if (
        !Number.isFinite(excelRow) ||
        excelRow < 1
    ) {
        return [];
    }

    return rows[
        excelRow - 1
    ] || [];
}


// ============================================================
// CREATE RAW SOURCE VALUES
// ============================================================
//
// IMPORTANT:
//   ALL source headers are retained.
//
// Example:
//
// {
//     "Product Name": "CASIL SOAP 75GM",
//     "Packing": "75GM",
//     "OP": 33,
//     "OPVal": 3019.83,
//     ...
// }
//
// ============================================================

function createRawSourceValues(
    sourceHeaders,
    sourceRow
) {

    const raw = {};

    for (
        const column
        of sourceHeaders
    ) {

        const index =
            column.index;

        const header =
            column.header;

        raw[header] =
            safeValue(
                sourceRow[index]
            );
    }

    return raw;
}


// ============================================================
// GET MAPPED HEADER INFORMATION
// ============================================================

function getHeaderMapping(
    analysis
) {

    const map =
        analysis?.mapping ||
        {};

    const mapping = [];

    for (
        const key
        of Object.keys(map)
    ) {

        const value =
            map[key];

        if (
            value === null ||
            value === undefined
        ) {
            continue;
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {

            mapping.push(
                `${key} -> column ${value + 1}`
            );

            continue;
        }

        if (
            typeof value === "string"
        ) {

            mapping.push(
                `${key} -> ${value}`
            );

        }

    }

    return mapping.join(
        " | "
    );
}


// ============================================================
// GET HEADER MAP BY SOURCE COLUMN
// ============================================================
//
// Creates:
//
// Product Name -> product
// OP           -> opening
// OPVal        -> openingValue
//
// ============================================================

function createSourceHeaderMapping(
    sourceHeaders,
    analysis
) {

    const map =
        analysis?.mapping ||
        {};

    const result = [];

    for (
        const column
        of sourceHeaders
    ) {

        const sourceHeader =
            column.header;

        const sourceIndex =
            column.index;

        let commonField =
            null;

        for (
            const key
            of Object.keys(map)
        ) {

            const mappedIndex =
                map[key];

            if (
                typeof mappedIndex === "number" &&
                mappedIndex === sourceIndex
            ) {

                commonField =
                    key;

                break;
            }

        }

        result.push({
            sourceHeader,
            sourceColumn:
                sourceIndex + 1,
            commonField
        });
    }

    return result;
}


// ============================================================
// CREATE HEADER MAPPING TEXT
// ============================================================

function createHeaderMappingText(
    sourceHeaders,
    analysis
) {

    const mapping =
        createSourceHeaderMapping(
            sourceHeaders,
            analysis
        );

    return mapping
        .map(
            item => {

                return (
                    `${item.sourceHeader} -> ` +
                    `${item.commonField || "UNIDENTIFIED"}`
                );

            }
        )
        .join(" | ");
}


// ============================================================
// CREATE UNIDENTIFIED HEADERS
// ============================================================

function createUnidentifiedHeaders(
    sourceHeaders,
    analysis
) {

    const mapping =
        createSourceHeaderMapping(
            sourceHeaders,
            analysis
        );

    return mapping
        .filter(
            item =>
                !item.commonField
        )
        .map(
            item =>
                item.sourceHeader
        )
        .filter(Boolean)
        .join(" | ");
}


// ============================================================
// GET COMMON VALUE
// ============================================================

function getCommonValue(
    record,
    ...fields
) {

    if (!record) {
        return "";
    }

    for (
        const field
        of fields
    ) {

        if (
            record[field] !==
                undefined &&
            record[field] !==
                null &&
            record[field] !== ""
        ) {

            return record[field];
        }

    }

    return "";
}


// ============================================================
// CREATE MASTER ROW
// ============================================================
//
// This follows the same concept as the TXT Master:
//
//   Source information
//       +
//   Common mapped information
//
// ============================================================

function createMasterRow(
    record,
    sourceHeaders,
    sourceRow,
    analysis,
    filePath
) {

    const row = {};

    // ----------------------------------------------------------
    // SYSTEM
    // ----------------------------------------------------------

    row["Source File"] =
        path.basename(
            filePath
        );

    row["Source Row"] =
        safeValue(
            record?.rowNumber
        );

    row["Statement Structure"] =
        safeValue(
            analysis?.structure ||
            analysis?.specialFormat ||
            "SINGLE_ROW"
        );


    // ----------------------------------------------------------
    // RAW SOURCE VALUES
    // ----------------------------------------------------------

    const rawSourceValues =
        createRawSourceValues(
            sourceHeaders,
            sourceRow
        );

    row["Raw Source Values"] =
        JSON.stringify(
            rawSourceValues
        );


    // ----------------------------------------------------------
    // HEADER MAPPING
    // ----------------------------------------------------------

    row["Header Mapping"] =
        createHeaderMappingText(
            sourceHeaders,
            analysis
        );


    // ----------------------------------------------------------
    // UNIDENTIFIED HEADERS
    // ----------------------------------------------------------

    row["Unidentified Headers"] =
        createUnidentifiedHeaders(
            sourceHeaders,
            analysis
        );


    // ----------------------------------------------------------
    // COMMON PRODUCT
    // ----------------------------------------------------------

    row["Common Product"] =
        safeValue(
            getCommonValue(
                record,
                "product",
                "productDescription"
            )
        );


    // ----------------------------------------------------------
    // COMMON PACK
    // ----------------------------------------------------------

    row["Common Pack"] =
        safeValue(
            getCommonValue(
                record,
                "pack"
            )
        );


    // ----------------------------------------------------------
    // COMMON PURCHASE RATE
    // ----------------------------------------------------------

    row["Common Purchase Rate"] =
        safeValue(
            getCommonValue(
                record,
                "purchaseRate"
            )
        );


    // ----------------------------------------------------------
    // COMMON RATE
    // ----------------------------------------------------------

    row["Common Rate"] =
        safeValue(
            getCommonValue(
                record,
                "rate",
                "price",
                "unitRate"
            )
        );


    // ----------------------------------------------------------
    // OPENING
    // ----------------------------------------------------------

    row["Common Opening"] =
        safeValue(
            getCommonValue(
                record,
                "opening",
                "Op.Bal. Qty.",
                "Op Bal Qty",
                "OPSTK"
            )
        );

    row["Common Opening Value"] =
        safeValue(
            getCommonValue(
                record,
                "openingValue"
            )
        );


    // ----------------------------------------------------------
    // PURCHASE
    // ----------------------------------------------------------

    row["Common Purchase"] =
        safeValue(
            getCommonValue(
                record,
                "purchase",
                "Receipt Qty.",
                "Receipt Qty",
                "Recevied Qty"
            )
        );

    row["Common Purchase Free"] =
        safeValue(
            getCommonValue(
                record,
                "purchaseFree",
                "purchaseFreeQty",
                "PFree"
            )
        );

    row["Common Purchase Value"] =
        safeValue(
            getCommonValue(
                record,
                "purchaseValue"
            )
        );

    row["Common Purchase Return"] =
        safeValue(
            getCommonValue(
                record,
                "purchaseReturn",
                "PurRet"
            )
        );

    row["Common Purchase Return Free"] =
        safeValue(
            getCommonValue(
                record,
                "purchaseReturnFree",
                "purchaseReturnFreeQty",
                "SPur Ret"
            )
        );


    // ----------------------------------------------------------
    // REPLACEMENT
    // ----------------------------------------------------------

    row["Common Replacement"] =
        safeValue(
            getCommonValue(
                record,
                "replacement",
                "Repl"
            )
        );

    // ----------------------------------------------------------
    // SALES REPLACEMENT
    // ----------------------------------------------------------

    row["Common Sales Replacement"] =
        safeValue(
            getCommonValue(
                record,
                "salesReplacement",
                "Sl Repl"
            )
        );

    // ----------------------------------------------------------
    // SALES
    // ----------------------------------------------------------

    row["Common Sales"] =
        safeValue(
            getCommonValue(
                record,
                "sales",
                "Issue Qty.",
                "Issue Qty",
                "SALEQUANTITY"
            )
        );

    row["Common Sales Free"] =
        safeValue(
            getCommonValue(
                record,
                "salesFree",
                "salesFreeQty",
                "free",
                "Free Qty Qty",
                "FREE QTY QTY",
                "FREEQTYQTY",
                "SFree"
            )
        );

    row["Common Sales Value"] =
        safeValue(
            getCommonValue(
                record,
                "salesValue"
            )
        );

    row["Common Sales Last"] =
        safeValue(
            getCommonValue(
                record,
                "salesLast"
            )
        );

    row["Common Sales Return"] =
        safeValue(
            getCommonValue(
                record,
                "salesReturn",
                "SRetun"
            )
        );

    row["Common Sales Return Free"] =
        safeValue(
            getCommonValue(
                record,
                "salesReturnFree",
                "salesReturnFreeQty"
            )
        );

// ----------------------------------------------------------
    // Adjustment
    // ----------------------------------------------------------

    row["Common TRN IN"] =
        safeValue(
            getCommonValue(
                record,
                "trnInQty",
                "Br I",
                "br i"
            )
        );

    row["Common TRN OUT"] =
        safeValue(
            getCommonValue(
                record,
                "trnOutQty",
                "Br R",
                "br r"
            )
        );

    row["Common Credit"] =
        safeValue(
            getCommonValue(
                record,
                "cr",
                "Cr",
                "credit",
                "Credit",   
                "CREDIT",
                "CR"

            )
        );

    row["Common Debit"] =
        safeValue(
            getCommonValue(
                record,
                "Dr",
                "Debit",
                "dr",
                "debit",
                "db",
                "DEBIT",
                "DB"
            )
        );

    row["Common Adjustment"] =
        safeValue(
            getCommonValue(
                record,
                "Adjustment",
                "adjustment",
                "adj",
                "adjQty",
                "Other",
                "OTHER",
                "OTHERS",
                "Others"
            )
        );

    // ----------------------------------------------------------
    // CLOSING
    // ----------------------------------------------------------

    row["Common Closing"] =
        safeValue(
            getCommonValue(
                record,
                "closing",
                "Cl.Stock As On",
                "CurStk",
                "TotalStock"
            )
        );

    row["Common Closing Free"] =
        safeValue(
            getCommonValue(
                record,
                "closingFree"
            )
        );

    row["Common Closing Value"] =
        safeValue(
            getCommonValue(
                record,
                "closingValue"
            )
        );


    // ----------------------------------------------------------
    // TOTAL STOCK
    // ----------------------------------------------------------

    row["Common Total Stock"] =
        safeValue(
            getCommonValue(
                record,
                "totalStock"
            )
        );


    // ----------------------------------------------------------
    // AGE
    // ----------------------------------------------------------

    row["Common Age"] =
        safeValue(
            getCommonValue(
                record,
                "age"
            )
        );


    return row;
}


// ============================================================
// READ EXISTING MASTER
// ============================================================

function readExistingMaster() {

    if (
        !fs.existsSync(
            MASTER_FILE
        )
    ) {

        return {
            rows: [],
            headers: []
        };
    }

    const workbook =
        XLSX.readFile(
            MASTER_FILE
        );

    if (
        !workbook.SheetNames ||
        !workbook.SheetNames.length
    ) {

        return {
            rows: [],
            headers: []
        };
    }

    const sheet =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];

    const rawRows =
        XLSX.utils.sheet_to_json(
            sheet,
            {
                defval: ""
            }
        );

    // ----------------------------------------------------------
    // IMPORTANT:
    // The existing Master workbook may have been created by an
    // older version containing source-specific physical columns.
    //
    // Never carry those columns forward.
    // Rebuild every existing row using ONLY MASTER_COLUMNS.
    // This keeps the Master schema frozen and prevents legacy
    // columns such as DIVISION, MONTH, STOCKIST, etc. from
    // returning to the workbook.
    // ----------------------------------------------------------

    const rows =
        rawRows.map(
            rawRow => {

                const cleanRow = {};

                for (
                    const header
                    of MASTER_COLUMNS
                ) {

                    cleanRow[header] =
                        safeValue(
                            rawRow?.[header]
                        );

                }

                return cleanRow;

            }
        );

    return {
        rows,
        headers:
            MASTER_COLUMNS
    };
}


// ============================================================
// RECORD KEY
// ============================================================

function recordKey(
    row
) {

    return [

        String(
            row["Source File"] ??
            ""
        )
            .trim()
            .toUpperCase(),

        String(
            row.__sourceSheetName ??
            ""
        )
            .trim()
            .toUpperCase(),

        String(
            row["Source Row"] ??
            ""
        )
            .trim()

    ].join(
        "::"
    );
}


// ============================================================
// APPEND TO MASTER
// ============================================================

function appendToMaster(
    rows
) {

    ensureMasterDirectory();

    const existing =
        readExistingMaster();

    const existingRows =
        existing.rows || [];

    const existingKeys =
        new Set(
            existingRows.map(
                recordKey
            )
        );

    const addedRows = [];

    for (
        const row
        of rows
    ) {

        const key =
            recordKey(
                row
            );

        if (
            existingKeys.has(
                key
            )
        ) {
            continue;
        }

        existingKeys.add(
            key
        );

        addedRows.push(
            row
        );
    }

    // ----------------------------------------------------------
    // FIXED MASTER SCHEMA
    // ----------------------------------------------------------
    //
    // Rebuild both existing and new rows from the frozen schema.
    // This is intentionally defensive: no source-specific field
    // can become a physical Master column.
    // ----------------------------------------------------------

    const allRows =
        existingRows
            .concat(addedRows)
            .map(
                rawRow => {

                    const cleanRow = {};

                    for (
                        const header
                        of MASTER_COLUMNS
                    ) {

                        cleanRow[header] =
                            safeValue(
                                rawRow?.[header]
                            );

                    }

                    return cleanRow;

                }
            );

    const worksheet =
        XLSX.utils.json_to_sheet(
            allRows,
            {
                header:
                    MASTER_COLUMNS
            }
        );


    // ----------------------------------------------------------
    // COLUMN WIDTHS
    // ----------------------------------------------------------

    worksheet["!cols"] =
        MASTER_COLUMNS.map(
            header => {

                if (
                    header ===
                    "Source File"
                ) {

                    return {
                        wch: 45
                    };
                }

                if (
                    header ===
                    "Raw Source Values"
                ) {

                    return {
                        wch: 90
                    };
                }

                if (
                    header ===
                    "Header Mapping"
                ) {

                    return {
                        wch: 100
                    };
                }

                if (
                    header ===
                    "Unidentified Headers"
                ) {

                    return {
                        wch: 50
                    };
                }

                if (
                    header ===
                    "Common Product"
                ) {

                    return {
                        wch: 40
                    };
                }

                return {
                    wch: 18
                };

            }
        );


    // ----------------------------------------------------------
    // WORKBOOK
    // ----------------------------------------------------------

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Raw Extraction"
    );


    // ----------------------------------------------------------
    // WRITE
    // ----------------------------------------------------------

    XLSX.writeFile(
        workbook,
        MASTER_FILE
    );


    return {

        success: true,

        masterFile:
            MASTER_FILE,

        existingRecords:
            existingRows.length,

        addedRecords:
            addedRows.length,

        skippedDuplicates:
            rows.length -
            addedRows.length,

        totalRecords:
            allRows.length,

        columns:
            MASTER_COLUMNS

    };
}


// ============================================================
// PROCESS EXCEL FILE
// ============================================================

async function processExcelFile(
    filePath
) {

    try {

        if (!filePath) {

            return {
                success: false,
                stage: "INPUT",
                message:
                    "Excel file path was not supplied."
            };
        }


        const absolutePath =
            path.resolve(
                filePath
            );


        if (
            !fs.existsSync(
                absolutePath
            )
        ) {

            return {
                success: false,
                stage: "INPUT",
                message:
                    `File not found: ${absolutePath}`
            };
        }


        // ------------------------------------------------------
        // FILE TYPE
        // ------------------------------------------------------

        const extension =
            path.extname(
                absolutePath
            )
                .toLowerCase();


        if (
    ![
        ".xlsx",
        ".xls",
        ".xlsm",
        ".csv"
    ].includes(extension)
) {

            return {
                success: false,
                stage: "INPUT",
                message:
                    `Unsupported Excel format: ${extension}`
            };
        }


        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "EXCEL EXTRACTION MASTER"
        );
        console.log(
            "============================================================"
        );
        console.log(
            `Source : ${absolutePath}`
        );
        console.log(
            `Master : ${MASTER_FILE}`
        );
        console.log("");


        // ------------------------------------------------------
        // STEP 1 — READ EXCEL
        // ------------------------------------------------------

        const document =
            await readDocument(
                absolutePath
            );


        if (
            !document ||
            !document.success ||
            !document.workbook
        ) {

            return {
                success: false,
                stage: "READER",
                message:
                    document?.message ||
                    "Excel workbook could not be read."
            };
        }


        const workbook =
            document.workbook;


        // ------------------------------------------------------
        // STEP 2 — PROCESS ALL SHEETS
        // ------------------------------------------------------

        const sheetNames =
            Array.isArray(
                workbook.SheetNames
            )
                ? workbook.SheetNames
                : [];


        console.log("");
        console.log(
            "========== MULTI-SHEET PROCESSING =========="
        );
        console.log(
            "Total Sheets :",
            sheetNames.length
        );
        console.log(
            "Sheets       :",
            sheetNames
        );
        console.log(
            "============================================"
        );


        const processedSheets = [];

        const skippedSheets = [];

        const masterRows = [];


        // ------------------------------------------------------
        // PROCESS EACH SHEET
        // ------------------------------------------------------

        for (
            const sheetName
            of sheetNames
        ) {

            console.log("");
            console.log(
                "------------------------------------------------------------"
            );
            console.log(
                `PROCESSING SHEET : ${sheetName}`
            );
            console.log(
                "------------------------------------------------------------"
            );


            const worksheet =
                workbook.Sheets[
                    sheetName
                ];


            // --------------------------------------------------
            // EMPTY / MISSING SHEET
            // --------------------------------------------------

            if (!worksheet) {

                console.log(
                    `SKIP SHEET : ${sheetName} - worksheet not found`
                );

                skippedSheets.push({
                    sheetName,
                    reason:
                        "Worksheet not found."
                });

                continue;
            }


            console.log("");
console.log("### CALLING getSourceRows ###");
console.log("CURRENT SHEET :", sheetName);
console.log("WORKSHEET EXISTS :", !!worksheet);

            const sourceRows =
                getSourceRows(
                    worksheet
                );


            // --------------------------------------------------
            // CHECK WHETHER SHEET HAS ANY DATA
            // --------------------------------------------------

            const hasData =
                sourceRows.some(
                    row =>
                        Array.isArray(row) &&
                        row.some(
                            value =>
                                String(
                                    value ?? ""
                                ).trim() !== ""
                        )
                );


            if (!hasData) {

                console.log(
                    `SKIP SHEET : ${sheetName} - empty sheet`
                );

                skippedSheets.push({
                    sheetName,
                    reason:
                        "Sheet contains no data."
                });

                continue;
            }


            // --------------------------------------------------
            // CREATE SHEET-SCOPED WORKBOOK
            // --------------------------------------------------
            //
            // IMPORTANT:
            // Existing analyzer and extractor are NOT changed.
            //
            // We give them a workbook containing ONLY the
            // current sheet.
            //
            // Therefore:
            //
            // STATMENT 1 -> analyzer sees STATMENT 1 only
            // STATMENT 2 -> analyzer sees STATMENT 2 only
            // Sheet3     -> skipped above
            //
            // Existing mapping/extraction logic remains intact.
            // --------------------------------------------------

            const sheetWorkbook = {
                SheetNames: [
                    sheetName
                ],
                Sheets: {
                    [sheetName]:
                        worksheet
                }
            };


            
            // --------------------------------------------------
            // ANALYZE CURRENT SHEET
            // --------------------------------------------------

            const analysis =
                analyzeStatement(
                    sheetWorkbook
                );


            // --------------------------------------------------
            // NO VALID HEADER / DATA
            // --------------------------------------------------

            if (
                !analysis ||
                !analysis.success
            ) {

                console.log(
                    `SKIP SHEET : ${sheetName}`
                );

                console.log(
                    "Reason     :",
                    analysis?.message ||
                    "No valid statement structure found."
                );


                skippedSheets.push({
                    sheetName,
                    reason:
                        analysis?.message ||
                        "No valid statement structure found."
                });

                continue;
            }


            console.log(
                "Sheet        :",
                analysis.sheetName
            );

            console.log(
                "Header Row   :",
                analysis.headerRow
            );

            console.log(
                "First Data   :",
                analysis.firstDataRow
            );

            console.log(
                "Last Data    :",
                analysis.lastDataRow
            );

            console.log("");


            // --------------------------------------------------
            // EXTRACT
            // --------------------------------------------------

            console.log("");
            console.log(
                "===== MAPPING BEFORE EXTRACTOR ====="
            );

            console.table(
                analysis.mapping
            );

            console.log(
                "===================================="
            );


            const extraction =
                extractRows(
                    sheetWorkbook,
                    analysis
                );


            if (
                !extraction ||
                !extraction.success
            ) {

                return {
                    success: false,
                    stage: "EXTRACTION",
                    message:
                        extraction?.message ||
                        `Excel extraction failed for sheet: ${sheetName}`,
                    sheetName,
                    analysis,
                    extraction
                };
            }


            const records =
                extraction.records || [];


            console.log("");
            console.log(
                `Excel Records Extracted [${sheetName}] :`,
                records.length
            );


            // --------------------------------------------------
            // SOURCE HEADERS
            // --------------------------------------------------

            const sourceHeaders =
                getSourceHeaders(
                    sourceRows,
                    analysis
                );


            console.log(
                "Source Headers          :",
                sourceHeaders.length
            );


            // --------------------------------------------------
            // BUILD MASTER ROWS
            // --------------------------------------------------

            for (
                const record
                of records
            ) {

                const sourceRow =
                    getOriginalSourceRow(
                        sourceRows,
                        record.rowNumber
                    );


                const masterRow =
                    createMasterRow(
                        record,
                        sourceHeaders,
                        sourceRow,
                        analysis,
                        absolutePath
                    );


                // ------------------------------------------------
                // INTERNAL SHEET METADATA
                // ------------------------------------------------
                //
                // This is NOT a Master column.
                // It exists only during this execution so that
                // records from different sheets can be identified
                // internally if duplicate handling is extended.
                //
                // The existing frozen Master schema will remove
                // this property before writing the workbook.
                // ------------------------------------------------

                masterRow.__sourceSheetName =
                    sheetName;


                masterRows.push(
                    masterRow
                );

            }


            // --------------------------------------------------
            // SHEET SUCCESS
            // --------------------------------------------------

            processedSheets.push({
                sheetName,
                headerRow:
                    analysis.headerRow,
                firstDataRow:
                    analysis.firstDataRow,
                lastDataRow:
                    analysis.lastDataRow,
                extractedRecords:
                    records.length
            });


            console.log("");
            console.log(
                `SHEET SUCCESS : ${sheetName}`
            );

        }


        // ------------------------------------------------------
        // NO VALID SHEETS
        // ------------------------------------------------------

        if (
            processedSheets.length === 0
        ) {

            return {
                success: false,
                stage: "ANALYSIS",
                message:
                    "No valid statement sheets found.",
                processedSheets,
                skippedSheets
            };
        }


        // ------------------------------------------------------
        // STEP 3 — WRITE MASTER
        // ------------------------------------------------------

        const result =
            appendToMaster(
                masterRows
            );


        // ------------------------------------------------------
        // TOTAL EXTRACTED RECORDS
        // ------------------------------------------------------

        const totalExtractedRecords =
            processedSheets.reduce(
                (
                    total,
                    sheet
                ) =>
                    total +
                    Number(
                        sheet.extractedRecords || 0
                    ),
                0
            );


        // ------------------------------------------------------
        // SUMMARY
        // ------------------------------------------------------

        console.log("");
        console.log(
            "========== EXCEL MASTER SUMMARY =========="
        );

        console.log(
            "Sheets Processed :",
            processedSheets.length
        );

        console.log(
            "Sheets Skipped   :",
            skippedSheets.length
        );

        console.log(
            "Extracted Records:",
            totalExtractedRecords
        );

        console.log(
            "Master Rows Input:",
            masterRows.length
        );

        console.log(
            "Added Records    :",
            result.addedRecords
        );

        console.log(
            "Skipped Duplicates:",
            result.skippedDuplicates
        );

        console.log(
            "Total Master Rows:",
            result.totalRecords
        );

        console.log(
            "Master File      :",
            result.masterFile
        );

        console.log(
            "=========================================="
        );


        // ------------------------------------------------------
        // FINAL RESULT
        // ------------------------------------------------------

        const firstProcessedSheet =
            processedSheets[0];


        return {

            success: true,

            pipeline:
                "EXCEL_EXTRACTION_MASTER",

            file:
                absolutePath,

            // Preserve the existing single-sheet style
            // fields using the first successfully processed
            // sheet.

            sheetName:
                firstProcessedSheet.sheetName,

            headerRow:
                firstProcessedSheet.headerRow,

            firstDataRow:
                firstProcessedSheet.firstDataRow,

            lastDataRow:
                firstProcessedSheet.lastDataRow,

            extractedRecords:
                totalExtractedRecords,

            // Additional multi-sheet information.

            processedSheets,

            skippedSheets,

            ...result

        };


    } catch (error) {

        console.error(
            "Excel Extraction Master Error:",
            error.stack ||
            error.message
        );


        return {

            success: false,

            stage:
                "EXCEL_EXTRACTION_MASTER",

            message:
                error.message,

            error:
                error.stack ||
                error.message

        };

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    processExcelFile,

    createMasterRow,

    createRawSourceValues,

    createHeaderMappingText,

    createUnidentifiedHeaders,

    appendToMaster,

    readExistingMaster,

    MASTER_FILE,

    MASTER_COLUMNS

};


// ============================================================
// CLI
// ============================================================

if (
    require.main === module
) {

    const filePath =
        process.argv[2];


    if (!filePath) {

        console.error(
            'Usage: node validation\\excel\\excelExtractionMaster.js "path\\file.xlsx"'
        );

        process.exit(1);
    }


    processExcelFile(
        filePath
    )
        .then(
            result => {

                console.log("");

                console.log(
                    JSON.stringify(
                        result,
                        null,
                        2
                    )
                );


                if (
                    !result.success
                ) {

                    process.exit(1);
                }

            }
        )
        .catch(
            error => {

                console.error(
                    error.stack ||
                    error.message
                );

                process.exit(1);

            }
        );

}