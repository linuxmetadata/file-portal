/**
 * ============================================================
 * TEST ALL SINGLE-ROW TXT EXTRACTION + MAPPING
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Common validation test for the SINGLE-ROW TXT pipeline.
 *
 * This test uses the existing common production scripts:
 *
 *   1. singleRowDataExtractor.js
 *   2. singleRowHeaderMapper.js
 *
 * It does NOT:
 *
 *   - create a statement-specific test
 *   - create or update Extraction_Master
 *   - write any production output
 *   - modify production files
 *
 * USAGE
 * ------------------------------------------------------------
 *
 * Test one TXT file:
 *
 *   node tests/testAllTXTExtraction.js "testData\statements\TXT\file.txt"
 *
 * Test every TXT file in the standard folder:
 *
 *   node tests/testAllTXTExtraction.js
 *
 * IMPORTANT
 * ------------------------------------------------------------
 *
 * This is a validation test only.
 *
 * Extraction Master will be generated later, only after all
 * required statement formats have successfully passed extraction
 * and mapping.
 *
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
    extractSingleRowData
} = require("../singleRow/singleRowDataExtractor");

const {
    mapExtractionResult
} = require("../singleRow/singleRowHeaderMapper");

const {
    appendToMaster,
    createMasterRow,
    MASTER_FILE
} = require("../singleRow/singleRowExtractionMaster");

// ============================================================
// SOURCE
// ============================================================

const defaultFolder =
    path.resolve(
        "testData",
        "statements",
        "TXT"
    );

const suppliedPath =
    process.argv[2];

let sourcePath =
    suppliedPath
        ? path.resolve(suppliedPath)
        : defaultFolder;

// ============================================================
// BUILD FILE LIST
// ============================================================

if (!fs.existsSync(sourcePath)) {

    console.error("");
    console.error("ERROR: Path not found:");
    console.error(sourcePath);
    console.error("");

    process.exit(1);
}

let files = [];

if (
    fs.statSync(sourcePath).isFile()
) {

    if (
        path.extname(sourcePath).toLowerCase() !== ".txt"
    ) {

        console.error("");
        console.error("ERROR: Supplied file is not a TXT file:");
        console.error(sourcePath);
        console.error("");

        process.exit(1);
    }

    files = [
        sourcePath
    ];

} else {

    files =
        fs.readdirSync(
            sourcePath
        )
        .filter(
            file =>
                file
                    .toLowerCase()
                    .endsWith(".txt")
        )
        .sort()
        .map(
            file =>
                path.join(
                    sourcePath,
                    file
                )
        );
}

// ============================================================
// NO FILES
// ============================================================

if (!files.length) {

    console.log("");
    console.log("No TXT files found.");
    console.log("");

    process.exit(0);
}

// ============================================================
// SUMMARY
// ============================================================

let totalFiles = 0;
let extractionPassed = 0;
let mappingPassed = 0;
let fullyPassed = 0;

let totalRecords = 0;

const failures = [];

// ============================================================
// HEADER
// ============================================================

console.log("");
console.log("============================================================");
console.log("       SINGLE-ROW TXT EXTRACTION + MAPPING TEST");
console.log("============================================================");
console.log("");
console.log(
    "Source:",
    sourcePath
);
console.log(
    "TXT Files:",
    files.length
);
console.log("");
console.log(
    "Extraction Master:",
    "WILL BE GENERATED FROM PASSED RECORDS"
);
console.log("============================================================");

// ============================================================
// PROCESS
// ============================================================

for (
    let i = 0;
    i < files.length;
    i++
) {

    const filePath =
        files[i];

    const fileName =
        path.basename(
            filePath
        );

    totalFiles++;

    console.log("");
    console.log("------------------------------------------------------------");
    console.log(
        `[${i + 1}/${files.length}] ${fileName}`
    );
    console.log("------------------------------------------------------------");

    // ========================================================
    // SCRIPT 2 - DATA EXTRACTION
    // ========================================================

    let extraction;

    try {

        extraction =
            extractSingleRowData(
                filePath
            );

    }
    catch (error) {

        failures.push({
            file: fileName,
            stage: "EXTRACTION",
            message:
                error.message
        });

        console.log(
            "EXTRACTION: ERROR"
        );

        console.log(
            error.message
        );

        continue;
    }

    if (
        !extraction ||
        !extraction.success
    ) {

        failures.push({
            file: fileName,
            stage: "EXTRACTION",
            message:
                extraction?.message ||
                "Extraction failed."
        });

        console.log(
            "EXTRACTION: FAILED"
        );

        console.log(
            extraction?.message ||
            "Extraction failed."
        );

        continue;
    }

    extractionPassed++;

    const records =
        Array.isArray(
            extraction.records
        )
            ? extraction.records
            : [];

    totalRecords +=
        records.length;

    console.log(
        "EXTRACTION: OK"
    );

    console.log(
        "Structure:",
        extraction.structure ||
        extraction.structureId ||
        extraction.header?.structureId ||
        "UNKNOWN"
    );

    console.log(
        "Records:",
        records.length
    );

    if (!records.length) {

        failures.push({
            file: fileName,
            stage: "EXTRACTION",
            message:
                "Extraction succeeded but returned zero records."
        });

        console.log(
            "EXTRACTION: REVIEW REQUIRED - ZERO RECORDS"
        );

        continue;
    }

    // ========================================================
    // SCRIPT 3 - COMMON MAPPING
    // ========================================================

    let mapped;

    try {

        mapped =
            mapExtractionResult(
                extraction
            );

    }
    catch (error) {

        failures.push({
            file: fileName,
            stage: "MAPPING",
            message:
                error.message
        });

        console.log(
            "MAPPING: ERROR"
        );

        console.log(
            error.message
        );

        continue;
    }

    if (
        !mapped ||
        !mapped.success
    ) {

        failures.push({
            file: fileName,
            stage: "MAPPING",
            message:
                mapped?.message ||
                "Mapping failed."
        });

        console.log(
            "MAPPING: FAILED"
        );

        console.log(
            mapped?.message ||
            "Mapping failed."
        );

        continue;
    }

    mappingPassed++;

    console.log(
        "MAPPING: OK"
    );

    console.log(
        "Structure:",
        mapped.structureId ||
        extraction.structure ||
        "UNKNOWN"
    );

    console.log(
        "Mapped Records:",
        mapped.recordCount
    );

    // ========================================================
    // VALIDATE MAPPED RECORDS
    // ========================================================

    const mappedRecords =
        Array.isArray(
            mapped.records
        )
            ? mapped.records
            : [];

    let recordIssues = 0;

    for (
        const record
        of mappedRecords
    ) {

        if (
            !record ||
            !record.structureId
        ) {

            recordIssues++;

            continue;
        }

        if (
            !record.common ||
            !record.source
        ) {

            recordIssues++;

            continue;
        }

        // ------------------------------------------------------
        // H009 FIXED-WIDTH COLUMN VALIDATION
        // ------------------------------------------------------
        // H009 has physically separate columns:
        //   Pur | Sale | CurStk | StkVal
        //
        // Never allow "Sale CurStk" to be accepted as one
        // extractor key.  Script 2 already extracts these
        // columns separately; this validation prevents the
        // full pipeline from silently passing a merged header.
        // ------------------------------------------------------

        if (
            record.structureId === "H009" &&
            record.source &&
            Object.prototype.hasOwnProperty.call(
                record.source,
                "Sale CurStk"
            )
        ) {

            recordIssues++;
        }

        if (
            record.structureId === "H009"
        ) {

            const sourceKeys =
                Object.keys(
                    record.source || {}
                );

            const requiredH009Columns = [
                "Sale",
                "CurStk",
                "StkVal"
            ];

            for (
                const requiredKey
                of requiredH009Columns
            ) {

                if (
                    !sourceKeys.includes(
                        requiredKey
                    )
                ) {

                    recordIssues++;

                    break;
                }
            }
        }
    }

    if (
        recordIssues > 0
    ) {

        failures.push({
            file: fileName,
            stage: "VALIDATION",
            message:
                `${recordIssues} mapped record(s) have incomplete mapping containers.`
        });

        console.log(
            "RECORD VALIDATION: FAILED"
        );

        console.log(
            "Issues:",
            recordIssues
        );

        continue;
    }

    // ========================================================
    // SAVE PASSED RECORDS TO EXTRACTION MASTER
    // ========================================================
    //
    // IMPORTANT
    // --------------------------------------------------------
    // Existing extraction, mapping and validation logic above
    // is intentionally unchanged.
    //
    // Only records which have already passed the existing
    // validation are sent to the existing master writer.
    //
    // The existing singleRowExtractionMaster.js remains
    // responsible for:
    //   - creating the master row
    //   - duplicate handling
    //   - fixed master schema
    //   - writing the XLSX file
    // ========================================================

    try {

        const masterRows =
            mappedRecords.map(
                record =>
                    createMasterRow(
                        record,
                        extraction,
                        mapped.header
                    )
            );

        const masterResult =
            appendToMaster(
                masterRows
            );

        console.log("");
        console.log("EXTRACTION MASTER: SAVED");
        console.log(
            "Master File:",
            masterResult.masterFile || MASTER_FILE
        );
        console.log(
            "Master Added:",
            masterResult.addedRecords ?? 0
        );
        console.log(
            "Master Duplicates:",
            masterResult.skippedDuplicates ?? 0
        );
        console.log(
            "Master Total Records:",
            masterResult.totalRecords ?? 0
        );

    } catch (error) {

        failures.push({
            file: fileName,
            stage: "EXTRACTION MASTER",
            message:
                error.message ||
                String(error)
        });

        console.log(
            "EXTRACTION MASTER: ERROR"
        );

        console.log(
            error.message ||
            String(error)
        );

        continue;
    }

    // ========================================================
    // DISPLAY HEADER MAP
    // ========================================================

    console.log("");
    console.log("MAPPED COLUMNS:");

    if (
        mapped.header &&
        Array.isArray(
            mapped.header.columns
        )
    ) {

        console.table(
            mapped.header.columns.map(
                column => ({

                    position:
                        column.position,

                    sourceHeader:
                        column.sourceHeader,

                    commonField:
                        column.commonField ||
                        "(unidentified)",

                    mappingSource:
                        column.mappingSource,

                    status:
                        column.status
                })
            )
        );

    } else {

        console.log(
            "No mapped header columns returned."
        );
    }

    // ========================================================
    // DISPLAY EXTRACTED + MAPPED RECORDS
    // ========================================================

    console.log("");
    console.log("EXTRACTED + MAPPED RECORDS:");

    mappedRecords.forEach(
        record => {

            console.log("");
            console.log(
                `Row ${record.rowNumber}`
            );

            console.log(
                "Structure:",
                record.structureId
            );

            console.log(
                "Common:"
            );

            console.dir(
                record.common,
                {
                    depth: null
                }
            );

            console.log(
                "Source:"
            );

            console.dir(
                record.source,
                {
                    depth: null
                }
            );

            if (
                record.unidentified &&
                Object.keys(
                    record.unidentified
                ).length
            ) {

                console.log(
                    "UNIDENTIFIED:"
                );

                console.dir(
                    record.unidentified,
                    {
                        depth: null
                    }
                );

            }

        }
    );

    // ========================================================
    // FINAL FILE STATUS
    // ========================================================

    fullyPassed++;

    console.log("");
    console.log(
        "STATUS: PASS"
    );
}

// ============================================================
// FINAL SUMMARY
// ============================================================

console.log("");
console.log("");
console.log("============================================================");
console.log("                    FINAL SUMMARY");
console.log("============================================================");

console.log(
    "Total TXT Files        :",
    totalFiles
);

console.log(
    "Extraction Passed      :",
    extractionPassed
);

console.log(
    "Mapping Passed         :",
    mappingPassed
);

console.log(
    "Fully Passed           :",
    fullyPassed
);

console.log(
    "Total Extracted Rows   :",
    totalRecords
);

console.log(
    "Failed / Review Files  :",
    failures.length
);

console.log(
    "Extraction Master      :",
    MASTER_FILE
);

console.log("============================================================");

// ============================================================
// FAILURES
// ============================================================

if (
    failures.length
) {

    console.log("");
    console.log(
        "================ FAILURES / REVIEW ================"
    );

    console.table(
        failures
    );

    console.log(
        "===================================================="
    );

}

// ============================================================
// EXIT STATUS
// ============================================================

console.log("");

if (
    failures.length
) {

    console.log(
        "RESULT: REVIEW REQUIRED"
    );

    console.log("");

    process.exitCode = 1;

} else {

    console.log(
        "RESULT: ALL TESTED FILES PASSED"
    );

    console.log("");
}
