/**
 * ============================================================
 * STATEMENT EXTRACTION MASTER
 * ============================================================
 *
 * SCRIPT 4
 *
 * RAW SOURCE COLUMNS + COMMON MAPPING
 *
 * IMPORTANT:
 *   Script 4 does NOT re-extract the TXT file.
 *   It uses Script 2 + Script 3 output.
 *
 * RAW SOURCE VALUES come from:
 *     mappedRecord.source
 *
 * COMMON VALUES come from:
 *     mappedRecord.common
 *
 * This keeps the original statement data intact.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const {
    extractSingleRowData
} = require("./singleRowDataExtractor");

const {
    mapExtractionResult
} = require("./singleRowHeaderMapper");

// Existing Multi-Row pipeline. This Master only consumes its output.
// The Multi-Row detector/mapper/extractor themselves are not modified.
const {
    extractMultiRowTXT
} = require("../multiRow/multiRowDataExtractorTXT");

// ============================================================
// MASTER FILE
// ============================================================

const MASTER_DIR =
    path.resolve(
        __dirname,
        "../../storage/extraction/SSS"
    );

const MASTER_FILE =
    path.join(
        MASTER_DIR,
        "Master_Extraction.xlsx"
    );

// ============================================================
// FIXED COMMON COLUMNS
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
    "Common Sales",
    "Common Sales Free",
    "Common Sales Value",
    "Common Sales Last",
    "Common Sales Return",
    "Common Sales Return Free",
    "Common Closing",
    "Common Closing Free",
    "Common Closing Value",
    "Common Total Stock",
    "Common Age"
];

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
// GET RAW HEADERS
// ============================================================

function getRawHeaders(
    extraction
) {

    if (
        !extraction ||
        !extraction.header ||
        !Array.isArray(
            extraction.header.columns
        )
    ) {
        return [];
    }

    return extraction.header.columns
        .map(
            column =>
                String(
                    column.header ?? ""
                ).trim()
        )
        .filter(
            Boolean
        );
}

// ============================================================
// GET RAW SOURCE VALUE
// ============================================================
//
// IMPORTANT:
//
// Script 3 creates:
//
// mappedRecord.source = {
//     "Product Name": {
//         value: "ACNESTAL FASH WASH",
//         rawValue: "ACNESTAL FASH WASH",
//         ...
//     },
//     "Packing": {
//         value: "100ML",
//         rawValue: "100ML",
//         ...
//     }
// }
//
// Therefore Script 4 must read:
//
// mappedRecord.source[header].value
//
// NOT:
//
// record.values[header]
//
// ============================================================

function getRawSourceValue(
    mappedRecord,
    header
) {

    const source =
        mappedRecord.source || {};

    const entry =
        source[header];

    if (
        !entry
    ) {
        return "";
    }

    return safeValue(
        entry.value
    );
}

// ============================================================
// GET RAW TEXT VALUE
// ============================================================

function getRawTextValue(
    mappedRecord,
    header
) {

    const source =
        mappedRecord.source || {};

    const entry =
        source[header];

    if (
        !entry
    ) {
        return "";
    }

    return safeValue(
        entry.rawValue
    );
}

// ============================================================
// CREATE RAW SOURCE OBJECT
// ============================================================

function createRawSourceObject(
    mappedRecord,
    rawHeaders
) {

    const raw = {};

    for (
        const header
        of rawHeaders
    ) {

        raw[header] =
            getRawSourceValue(
                mappedRecord,
                header
            );
    }

    return raw;
}

// ============================================================
// CREATE RAW TEXT OBJECT
// ============================================================

function createRawTextObject(
    mappedRecord,
    rawHeaders
) {

    const rawText = {};

    for (
        const header
        of rawHeaders
    ) {

        rawText[header] =
            getRawTextValue(
                mappedRecord,
                header
            );
    }

    return rawText;
}

// ============================================================
// CREATE HEADER MAPPING TEXT
// ============================================================

function createMappingText(
    mappedHeader
) {

    if (
        !mappedHeader ||
        !Array.isArray(
            mappedHeader.columns
        )
    ) {
        return "";
    }

    return mappedHeader.columns
        .map(
            column =>
                `${column.sourceHeader} -> ${
                    column.commonField ||
                    "UNIDENTIFIED"
                }`
        )
        .join(" | ");
}

// ============================================================
// MULTI-ROW -> MASTER ADAPTER
// ============================================================
//
// The existing createMasterRow() expects the Script-3 style shape:
//
//   mappedRecord.source
//   mappedRecord.common
//   mappedRecord.unidentified
//   mappedRecord.rowNumber
//
// Multi-Row Script 3 already returns:
//
//   extraction.mapping.columns
//   extraction.records[]
//   record.__assignedRuns
//
// This adapter converts that existing output into the same Master
// contract without changing the Multi-Row extractor or mapper.
// ============================================================

function createMultiRowMappedHeader(extraction) {
    const columns =
        extraction?.mapping?.columns;

    if (!Array.isArray(columns)) {
        return {
            success: true,
            structure:
                extraction?.mapping?.diagnostics?.structure ||
                "MULTI_ROW",
            columns: []
        };
    }

    return {
        success: true,
        structure:
            extraction?.mapping?.diagnostics?.structure ||
            "MULTI_ROW",
        columns: columns.map(
            column => ({
                sourceHeader:
                    String(
                        column?.header ?? ""
                    ).trim(),
                commonField:
                    column?.commonField || null,
                physicalStart:
                    column?.physicalStart,
                physicalEnd:
                    column?.physicalEnd
            })
        )
    };
}

function getMultiRowAssignedValue(
    record,
    column
) {
    const assigned =
        Array.isArray(record?.__assignedRuns)
            ? record.__assignedRuns
            : [];

    const columnStart =
        Number(column?.physicalStart);

    const columnEnd =
        column?.physicalEnd == null
            ? null
            : Number(column.physicalEnd);

    // Prefer the exact physical assignment produced by Step 3.
    const exact =
        assigned.find(
            run => {
                const runStart =
                    Number(run?.start);

                const runEnd =
                    Number(run?.end);

                if (
                    !Number.isFinite(runStart) ||
                    !Number.isFinite(runEnd) ||
                    !Number.isFinite(columnStart)
                ) {
                    return false;
                }

                if (
                    columnEnd != null &&
                    Number.isFinite(columnEnd)
                ) {
                    return (
                        runStart >= columnStart &&
                        runEnd <= columnEnd
                    );
                }

                return (
                    runStart >= columnStart
                );
            }
        );

    if (exact) {
        return safeValue(
            exact.raw
        );
    }

    // Product/Pack and other direct fields are already present
    // on the extracted record.
    const field =
        column?.commonField;

    if (
        field &&
        record &&
        record[field] !== undefined
    ) {
        return safeValue(
            record[field]
        );
    }

    return "";
}

function createMultiRowMappedRecord(
    record,
    extraction
) {
    const mappingColumns =
        Array.isArray(
            extraction?.mapping?.columns
        )
            ? extraction.mapping.columns
            : [];

    const source = {};
    const common = {};
    const unidentified = {};

    for (
        const column of mappingColumns
    ) {
        const header =
            String(
                column?.header ?? ""
            ).trim();

        if (!header) {
            continue;
        }

        const value =
            getMultiRowAssignedValue(
                record,
                column
            );

        source[header] = {
            value,
            rawValue: value,
            extractorKey: header,
            position:
                column?.position,
            normalizedHeader:
                column?.normalizedHeader,
            commonField:
                column?.commonField || null,
            physicalStart:
                column?.physicalStart,
            physicalEnd:
                column?.physicalEnd
        };

        if (
            column?.commonField
        ) {
            const field =
                column.commonField;

            // Do not allow an unidentified/blank physical run to
            // erase a valid value already extracted for the field.
            if (
                common[field] === undefined ||
                common[field] === ""
            ) {
                common[field] =
                    safeValue(
                        record?.[field] !== undefined
                            ? record[field]
                            : value
                    );
            }
        } else {
            unidentified[header] =
                value;
        }
    }

    // Preserve any canonical fields returned by the existing
    // Multi-Row extractor even when a special structure did not
    // expose a direct mapper column for that field.
    const canonicalFields = [
        "product",
        "pack",
        "purchaseRate",
        "rate",
        "price",
        "opening",
        "openingValue",
        "purchase",
        "purchaseFree",
        "purchaseFreeQty",
        "purchaseValue",
        "purchaseReturn",
        "purchaseReturnFree",
        "purchaseReturnFreeQty",
        "replacement",
        "sales",
        "salesFree",
        "salesFreeQty",
        "salesValue",
        "salesLast",
        "salesReturn",
        "salesReturnFree",
        "salesReturnFreeQty",
        "closing",
        "closingFree",
        "closingValue",
        "totalStock",
        "unitRate",
        "age"
    ];

    for (
        const field of canonicalFields
    ) {
        if (
            record?.[field] !== undefined &&
            (
                common[field] === undefined ||
                common[field] === ""
            )
        ) {
            common[field] =
                safeValue(
                    record[field]
                );
        }
    }

    return {
        source,
        common,
        unidentified,
        rowNumber:
            record?.__sourceRow,
        structure:
            extraction?.mapping?.diagnostics?.structure ||
            "MULTI_ROW"
    };
}

// ============================================================
// CREATE MASTER ROW
// ============================================================

function createMasterRow(
    mappedRecord,
    extraction,
    mappedHeader
) {

    const rawHeaders =
        getRawHeaders(
            extraction
        );

    const raw =
        createRawSourceObject(
            mappedRecord,
            rawHeaders
        );

    const rawText =
        createRawTextObject(
            mappedRecord,
            rawHeaders
        );

    const common =
        mappedRecord.common || {};

    const unidentified =
        mappedRecord.unidentified || {};

    const row = {};

    // --------------------------------------------------------
    // SYSTEM
    // --------------------------------------------------------

    row["Source File"] =
        path.basename(
            extraction.file
        );

    row["Source Row"] =
        safeValue(
            mappedRecord.rowNumber
        );

    row["Statement Structure"] =
        safeValue(
            extraction.structure ||
            mappedRecord.structure ||
            mappedHeader?.structure ||
            "SINGLE_ROW"
        );

    // --------------------------------------------------------
    // IMPORTANT:
    // Raw source headers are NOT added as physical master columns.
    //
    // They are preserved inside:
    //   - Raw Source Values
    //   - Header Mapping
    //   - Unidentified Headers
    //
    // This keeps the master schema fixed across all structures.
    // --------------------------------------------------------

    // --------------------------------------------------------
    // RAW ORIGINAL VALUES
    // --------------------------------------------------------

    row["Raw Source Values"] =
        JSON.stringify(
            rawText
        );

    // --------------------------------------------------------
    // COMMON MAPPING
    // --------------------------------------------------------

    row["Common Product"] =
        safeValue(
            common.product
        );

    row["Common Pack"] =
        safeValue(
            common.pack
        );

    row["Common Purchase Rate"] =
        safeValue(
            common.purchaseRate
        );

    row["Common Rate"] =
        safeValue(
            common.rate ??
            common.price ??
            common.unitRate
        );

    row["Common Opening"] =
        safeValue(
            common.opening
        );

    row["Common Opening Value"] =
        safeValue(
            common.openingValue
        );

    row["Common Purchase"] =
        safeValue(
            common.purchase
        );

    row["Common Purchase Free"] =
        safeValue(
            common.purchaseFree ??
            common.purchaseFreeQty
        );

    row["Common Purchase Value"] =
        safeValue(
            common.purchaseValue
        );

    row["Common Purchase Return"] =
        safeValue(
            common.purchaseReturn
        );

    row["Common Purchase Return Free"] =
        safeValue(
            common.purchaseReturnFree ??
            common.purchaseReturnFreeQty
        );

    row["Common Replacement"] =
        safeValue(
            common.replacement
        );

    row["Common Sales"] =
        safeValue(
            common.sales
        );

    row["Common Sales Free"] =
        safeValue(
            common.salesFree ??
            common.salesFreeQty
        );

    row["Common Sales Value"] =
        safeValue(
            common.salesValue
        );

    row["Common Sales Last"] =
        safeValue(
            common.salesLast
        );

    row["Common Sales Return"] =
        safeValue(
            common.salesReturn
        );

    row["Common Sales Return Free"] =
        safeValue(
            common.salesReturnFree ??
            common.salesReturnFreeQty
        );

    row["Common Closing"] =
        safeValue(
            common.closing
        );

    row["Common Closing Free"] =
        safeValue(
            common.closingFree
        );

    row["Common Closing Value"] =
        safeValue(
            common.closingValue
        );

    row["Common Total Stock"] =
        safeValue(
            common.totalStock
        );

    row["Common Unit Rate"] =
        safeValue(
            common.unitRate
        );

    row["Common Age"] =
        safeValue(
            common.age
        );

    // --------------------------------------------------------
    // HEADER MAPPING
    // --------------------------------------------------------

    row["Header Mapping"] =
        createMappingText(
            mappedHeader
        );

    // --------------------------------------------------------
    // UNIDENTIFIED
    // --------------------------------------------------------

    row["Unidentified Headers"] =
        Object.keys(
            unidentified
        ).join(" | ");

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

    const rows =
        XLSX.utils.sheet_to_json(
            sheet,
            {
                defval: ""
            }
        );

    const range =
        XLSX.utils.decode_range(
            sheet["!ref"] ||
            "A1:A1"
        );

    const headers = [];

    for (
        let column =
            range.s.c;

        column <= range.e.c;

        column++
    ) {

        const cell =
            sheet[
                XLSX.utils.encode_cell({
                    r: range.s.r,
                    c: column
                })
            ];

        if (
            cell &&
            cell.v !== undefined
        ) {

            headers.push(
                String(cell.v)
            );
        }
    }

    return {
        rows,
        headers
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
            row["Source Row"] ??
            ""
        )
            .trim()

    ].join("::");
}

// ============================================================
// HEADER KEY
// ============================================================

function headerKey(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toUpperCase();
}

// ============================================================
// MERGE HEADERS
// ============================================================
//
// Existing headers are preserved.
// New source headers are added.
// Nothing is discarded.
// ============================================================

function mergeHeaders(
    existingHeaders,
    newHeaders
) {

    const result = [];

    const seen =
        new Set();

    function add(
        header
    ) {

        const key =
            headerKey(
                header
            );

        if (!key) {
            return;
        }

        if (
            seen.has(key)
        ) {
            return;
        }

        seen.add(key);

        result.push(
            header
        );
    }

    for (
        const header
        of existingHeaders
    ) {
        add(header);
    }

    for (
        const header
        of newHeaders
    ) {
        add(header);
    }

    return result;
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

    const existingHeaders =
        existing.headers || [];

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
            existingKeys.has(key)
        ) {
            continue;
        }

        existingKeys.add(key);

        addedRows.push(
            row
        );
    }

    const allRows =
        existingRows.concat(
            addedRows
        );

    // --------------------------------------------------------
    // FIXED MASTER SCHEMA
    // --------------------------------------------------------
    //
    // Source-specific headers such as PACKG, C.STOCK, Pr.Sale,
    // DAY, etc. must never become new physical Excel columns.
    // They remain available in the support columns.
    //
    // Existing legacy source-header columns are intentionally
    // excluded when rebuilding the workbook so the master remains
    // stable across structures.
    // --------------------------------------------------------

    const MASTER_COLUMNS = [
        ...SYSTEM_COLUMNS,
        ...SUPPORT_COLUMNS,
        ...COMMON_COLUMNS
    ];

    const headers = MASTER_COLUMNS;

    const worksheet =
        XLSX.utils.json_to_sheet(
            allRows,
            {
                header: headers
            }
        );

    worksheet["!cols"] =
        headers.map(
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
                        wch: 40
                    };
                }

                if (
                    header ===
                    "Product Name"
                ) {
                    return {
                        wch: 35
                    };
                }

                return {
                    wch: 18
                };
            }
        );

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Raw Extraction"
    );

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
            headers
    };
}

// ============================================================
// PROCESS ONE FILE
// ============================================================

function processSingleRowFile(
    filePath
) {
    const extraction =
        extractSingleRowData(
            filePath
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
                "Single-Row extraction failed."
        };
    }

    const mapped =
        mapExtractionResult(
            extraction
        );

    if (
        !mapped ||
        !mapped.success
    ) {
        return {
            success: false,
            stage: "MAPPING",
            message:
                mapped?.message ||
                "Single-Row mapping failed."
        };
    }

    const rows =
        mapped.records.map(
            record =>
                createMasterRow(
                    record,
                    extraction,
                    mapped.header
                )
        );

    const result =
        appendToMaster(
            rows
        );

    return {
        ...result,
        success: true,
        file: filePath,
        pipeline: "SINGLE_ROW",
        extractedRecords:
            mapped.records.length
    };
}

function processMultiRowFile(
    filePath
) {
    const extraction =
        extractMultiRowTXT(
            filePath
        );

    if (
        !extraction ||
        !extraction.success
    ) {
        return {
            success: false,
            stage:
                extraction?.stage ||
                "MULTI_ROW_EXTRACTION",
            message:
                extraction?.message ||
                "Multi-Row extraction failed."
        };
    }

    const mappedHeader =
        createMultiRowMappedHeader(
            extraction
        );

    const rows =
        extraction.records.map(
            record => {
                const mappedRecord =
                    createMultiRowMappedRecord(
                        record,
                        extraction
                    );

                return createMasterRow(
                    mappedRecord,
                    {
                        file:
                            extraction.file,
                        structure:
                            extraction?.mapping?.diagnostics?.structure ||
                            "MULTI_ROW",
                        header: {
                            columns:
                                extraction.mapping.columns
                        }
                    },
                    mappedHeader
                );
            }
        );

    const result =
        appendToMaster(
            rows
        );

    return {
        ...result,
        success: true,
        file: filePath,
        pipeline: "MULTI_ROW",
        extractedRecords:
            extraction.records.length
    };
}

function processFile(
    filePath
) {
    // IMPORTANT:
    // Try the existing Single-Row pipeline first.
    // This preserves the already-tested Single-Row behavior.
    const singleRowResult =
        processSingleRowFile(
            filePath
        );

    if (
        singleRowResult.success
    ) {
        return singleRowResult;
    }

    // If Single-Row cannot process the statement, use the
    // existing Multi-Row pipeline. No extractor logic is duplicated.
    return processMultiRowFile(
        filePath
    );
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

    processFile,

    appendToMaster,

    createMasterRow,

    readExistingMaster,

    MASTER_FILE
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
            "Usage:"
        );

        console.error(
            'node validation\\singleRow\\singleRowExtractionMaster.js "path\\file.txt"'
        );

        process.exit(1);
    }

    try {

        const absolutePath =
            path.resolve(
                filePath
            );

        if (
            !fs.existsSync(
                absolutePath
            )
        ) {

            throw new Error(
                `File not found: ${absolutePath}`
            );
        }

        console.log(
            "============================================================"
        );

        console.log(
            "SINGLE ROW RAW EXTRACTION MASTER"
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

        const result =
            processFile(
                absolutePath
            );

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

    } catch (error) {

        console.error(
            error.stack ||
            error.message
        );

        process.exit(1);
    }
}