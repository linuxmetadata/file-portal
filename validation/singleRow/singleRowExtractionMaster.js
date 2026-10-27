/**
 * ============================================================
 * SINGLE ROW STATEMENT EXTRACTION MASTER
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
const crypto = require("crypto");
const pool = require("../../services/postgresPool");

const {
    MASTER_COLUMNS,
    VALUE_COLUMNS,
    MATCH_COLUMNS,
    createEmptyMasterRow
} = require("../../services/masterSchema");

const {
    extractSingleRowData
} = require("./singleRowDataExtractor");

const {
    mapExtractionResult
} = require("./singleRowHeaderMapper");

// ============================================================
// FROZEN MULTI-ROW PIPELINE
// ============================================================
//
// This Master does not reimplement Multi-Row extraction.
// It consumes the already-frozen Multi-Row extractor output.
//
// MULTI_ROW extractor internally uses the frozen Multi-Row
// detector and physical-position mapper.
// ============================================================

const {
    extractMultiRowTXT
} = require("../multiRow/multiRowDataExtractorTXT");

// ============================================================
// FROZEN STATEMENT HEADER IDENTIFIER
// ============================================================
//
// Routing rule:
//   MULTI_ROW -> Multi-Row pipeline
//   anything else (including UNKNOWN) -> Single-Row pipeline
//
// UNKNOWN is intentionally treated as the Single-Row branch.
// ============================================================

const {
    identifyStatementHeader
} = require("../statementHeaderIdentifier");

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
    "Common Adjustment1",
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
// The frozen Multi-Row extractor returns:
//   extraction.mapping.columns
//   extraction.records[]
//   record.__assignedRuns
//
// The existing Master writer expects the Single-Row mapper-style
// contract:
//   mappedRecord.source
//   mappedRecord.common
//   mappedRecord.unidentified
//   mappedRecord.rowNumber
//
// This adapter changes only the shape. It does NOT change the
// frozen Multi-Row detector, mapper, or extractor.
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
        Number(
            column?.physicalStart
        );

    const columnEnd =
        column?.physicalEnd == null
            ? null
            : Number(
                column.physicalEnd
            );

    // Prefer the exact physical assignment produced by the
    // frozen Multi-Row extractor.
    const exact =
        assigned.find(
            run => {

                const runStart =
                    Number(
                        run?.start
                    );

                const runEnd =
                    Number(
                        run?.end
                    );

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

    // Product, pack and other direct canonical fields may already
    // exist on the frozen extractor record.
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

            // Do not let an empty physical assignment erase a
            // valid canonical value already extracted.
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

    // Preserve canonical fields returned by the frozen extractor,
    // even if a special structure did not expose a direct physical
    // mapper column for that field.
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
        "adjustment",
        "adjustment1",
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
        ).length
            ? getRawHeaders(
                extraction
            )
            : (
                Array.isArray(
                    extraction?.mapping?.columns
                )
                    ? extraction.mapping.columns
                        .map(
                            column =>
                                String(
                                    column?.header ?? ""
                                ).trim()
                        )
                        .filter(Boolean)
                    : []
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

        row["Common Adjustment"] =
        safeValue(
            common.adjustment
        );

    row["Common Adjustment1"] =
        safeValue(
            common.adjustment1
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
// SAVE TXT EXTRACTION ROWS TO POSTGRESQL
// ============================================================


async function saveRowsToPostgres(rows, portalData = {}) {
    if (!Array.isArray(rows)) {
        throw new Error("TXT extraction rows must be an array.");
    }

    const uploadCategory = String(
        portalData.uploadCategory ?? "REGULAR"
    ).trim().toUpperCase();

    if (!["REGULAR", "INVALID"].includes(uploadCategory)) {
        throw new Error(
            `Invalid TXT upload category: ${uploadCategory}`
        );
    }

    if (rows.length === 0) {
        return {
            success: true,
            addedRecords: 0,
            skippedDuplicates: 0
        };
    }

    const client = await pool.connect();

    let addedRecords = 0;
    let skippedDuplicates = 0;

    try {
        await client.query("BEGIN");

        await client.query(`
            ALTER TABLE "statement_extraction_master"
            ADD COLUMN IF NOT EXISTS "Common Adjustment1" TEXT
        `);

        await client.query(`
            ALTER TABLE "statement_extraction_master"
            ADD COLUMN IF NOT EXISTS "Common Adjustment1 Value" TEXT
        `);

        await client.query(`
            ALTER TABLE "statement_extraction_master"
            ADD COLUMN IF NOT EXISTS "Upload Category" TEXT
        `);

        for (const row of rows) {
            const sourceFile = String(
                row["Source File"] ?? ""
            ).trim();

            const sourceRow = String(
                row["Source Row"] ?? ""
            ).trim();

            if (!sourceFile || !sourceRow) {
                throw new Error(
                    "Source File and Source Row are required for TXT extraction records."
                );
            }

            const duplicate = await client.query(
                `
                SELECT 1
                FROM "statement_extraction_master"
                WHERE UPPER(TRIM("Source File")) =
                      UPPER(TRIM($1))
                  AND TRIM("Source Row") = TRIM($2)
                  AND COALESCE(
                      UPPER(TRIM("Upload Category")),
                      'REGULAR'
                  ) = $3
                LIMIT 1
                `,
                [sourceFile, sourceRow, uploadCategory]
            );

            if (duplicate.rowCount > 0) {
                skippedDuplicates++;
                continue;
            }

            const metadata = {
                division: String(
                    portalData.division ?? ""
                ).trim(),
                bmHQ: String(
                    portalData.bmHQ ?? ""
                ).trim(),
                code: String(
                    portalData.code ?? ""
                ).trim(),
                stockistName: String(
                    portalData.stockistName ?? ""
                ).trim()
            };

            const normalizedRow = createEmptyMasterRow();

            normalizedRow["Division"] = metadata.division;
            normalizedRow["BM HQ"] = metadata.bmHQ;
            normalizedRow["Code"] = metadata.code;
            normalizedRow["Stockist Name"] =
                metadata.stockistName;

            for (const column of MASTER_COLUMNS) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        row,
                        column
                    )
                ) {
                    normalizedRow[column] = row[column] ?? "";
                }
            }

            normalizedRow["Source Sheet"] = "";

            normalizedRow["Record ID"] = crypto
                .createHash("sha256")
                .update(JSON.stringify({
                    uploadCategory,
                    division: metadata.division.toUpperCase(),
                    code: metadata.code.toUpperCase(),
                    sourceFile: sourceFile
                        .split(/[\\/]/)
                        .pop()
                        .toUpperCase(),
                    sourceRow,
                    statementStructure: String(
                        row["Statement Structure"] ?? ""
                    ).trim().toUpperCase(),
                    rawSourceValues: String(
                        row["Raw Source Values"] ?? ""
                    ).trim(),
                    headerMapping: String(
                        row["Header Mapping"] ?? ""
                    ).trim()
                }))
                .digest("hex");

            normalizedRow["Match Status"] = "PENDING";

            for (const column of VALUE_COLUMNS) {
                normalizedRow[column] = "";
            }

            for (const column of MATCH_COLUMNS.slice(1)) {
                normalizedRow[column] = "";
            }

            const columns = [
                ...MASTER_COLUMNS,
                "Upload Category"
            ];

            const quotedColumns = columns.map(
                column => `"${column.replace(/"/g, '""')}"`
            );

            const placeholders = columns.map(
                (_, index) => `$${index + 1}`
            );

            const values = MASTER_COLUMNS.map(column => {
                const value = normalizedRow[column];

                if (value === null || value === undefined) {
                    return "";
                }

                return typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
            });

            values.push(uploadCategory);

            await client.query(
                `
                INSERT INTO "statement_extraction_master"
                    (${quotedColumns.join(", ")})
                VALUES (${placeholders.join(", ")})
                `,
                values
            );

            addedRecords++;
        }

        await client.query("COMMIT");

        return {
            success: true,
            addedRecords,
            skippedDuplicates
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


// ============================================================
// APPEND TO MASTER
// ============================================================

async function appendToMaster(rows, portalData = {}) {
    const result = await saveRowsToPostgres(rows, portalData);

    return {
        success: true,
        masterFile: null,
        storage: "POSTGRESQL",
        existingRecords: 0,
        addedRecords: result.addedRecords,
        skippedDuplicates: result.skippedDuplicates,
        totalRecords: result.addedRecords,
        columns: rows.length > 0 ? Object.keys(rows[0]) : []
    };
}

// ============================================================
// PROCESS ONE FILE
// ============================================================

async function processSingleRowFile(
    filePath,
    originalName,
    portalData = {}
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
                    {
                        ...extraction,
                        file: originalName || extraction.file
                    },
                    mapped.header
                )
        );

    const result =
    await appendToMaster(
        rows,
        portalData
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

async function processMultiRowFile(
    filePath,
    originalName,
    portalData = {}
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
                "Multi-Row extraction failed.",
            detection:
                extraction?.detection,
            mapping:
                extraction?.mapping
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
                        file: originalName || extraction.file,

                        structure:
                            extraction?.mapping?.diagnostics?.structure ||
                            "MULTI_ROW",

                        mapping:
                            extraction.mapping,

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
    await appendToMaster(
        rows,
        portalData
    );

    return {
        ...result,
        success: true,
        file: filePath,
        pipeline: "MULTI_ROW",
        extractedRecords:
            extraction.records.length,
        detection:
            extraction.detection,
        mapping:
            extraction.mapping
    };
}

async function processFile(filePath, originalName, portalData = {}) {

    if (!filePath) {
        return {
            success: false,
            stage: "IDENTIFICATION",
            message:
                "File path was not supplied."
        };
    }

    // ========================================================
    // STEP 1 — AUTHORITATIVE ROUTING
    // ========================================================
    //
    // The identifier already determines whether a real Multi-Row
    // header was found.
    //
    // MULTI_ROW -> Multi-Row pipeline.
    // UNKNOWN    -> Single-Row pipeline.
    //
    // We intentionally do not ask either extractor to decide the
    // statement family.
    // ========================================================

    const identification =
        identifyStatementHeader(
            filePath
        );

    if (
        identification &&
        identification.statementType ===
            "MULTI_ROW"
    ) {

        return await processMultiRowFile(
    filePath,
    originalName,
    portalData
);
    }

    // ========================================================
    // STEP 2 — SINGLE-ROW BRANCH
    // ========================================================
    //
    // By the agreed project rule, every file that is not identified
    // as Multi-Row goes to the frozen Single-Row pipeline.
    // This includes UNKNOWN.
    // ========================================================

    const result =
    await processSingleRowFile(
        filePath,
        originalName,
        portalData
    );

    return {
        ...result,

        identification:
            identification || {
                statementType: "UNKNOWN"
            }
    };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

    processFile,

    processSingleRowFile,

    processMultiRowFile,

    appendToMaster,

    createMasterRow,

    createMultiRowMappedHeader,

    createMultiRowMappedRecord,

    readExistingMaster,

    MASTER_FILE
};

// ============================================================
// CLI
// ============================================================

if (
    require.main === module
) {
    (async () => {

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
            "STATEMENT EXTRACTION MASTER"
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
            await processFile(
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

            process.exitCode = 1;
        }

        } catch (error) {

        console.error(
            error.stack ||
            error.message
        );

        process.exitCode = 1;
    }
    })();
}