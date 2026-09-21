/**
 * ============================================================
 * TEST ALL TXT STATEMENT STRUCTURES
 * ============================================================
 *
 * Purpose:
 *   - Scan every TXT statement
 *   - Run singleRowDataExtractor
 *   - Group results by detected structure
 *   - Identify failures / unsupported structures
 *
 * IMPORTANT:
 *   - TEST ONLY
 *   - DOES NOT MODIFY ANY EXTRACTOR
 *   - DOES NOT MODIFY STATEMENT FILES
 *   - H009 / H028 / H031 remain untouched
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const {
    extractSingleRowData
} = require("./singleRowDataExtractor");

// ============================================================
// CONFIGURATION
// ============================================================

const TXT_FOLDER =
    path.resolve(
        __dirname,
        "../../testData/statements/TXT"
    );

// ============================================================
// FIND ALL TXT FILES
// ============================================================

function findTxtFiles(folder) {

    if (!fs.existsSync(folder)) {
        throw new Error(
            `TXT folder not found: ${folder}`
        );
    }

    const results = [];

    function walk(currentFolder) {

        const entries =
            fs.readdirSync(
                currentFolder,
                {
                    withFileTypes: true
                }
            );

        for (const entry of entries) {

            const fullPath =
                path.join(
                    currentFolder,
                    entry.name
                );

            if (entry.isDirectory()) {

                walk(fullPath);

                continue;
            }

            if (
                entry.isFile() &&
                /\.txt$/i.test(entry.name)
            ) {

                results.push(fullPath);
            }
        }
    }

    walk(folder);

    return results.sort(
        (a, b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    sensitivity: "base"
                }
            )
    );
}

// ============================================================
// SAFE EXTRACTION
// ============================================================

function testFile(filePath) {

    try {

        const result =
            extractSingleRowData(
                filePath
            );

        return {
            file:
                path.basename(filePath),

            path:
                filePath,

            success:
                result &&
                result.success === true,

            structure:
                result &&
                result.structure
                    ? result.structure
                    : "UNKNOWN",

            dataStart:
                result &&
                result.dataStart !== undefined
                    ? result.dataStart
                    : null,

            recordCount:
                result &&
                Number.isInteger(
                    result.recordCount
                )
                    ? result.recordCount
                    : 0,

            message:
                result &&
                result.message
                    ? result.message
                    : null,

            error:
                result &&
                result.error
                    ? result.error
                    : null
        };

    } catch (error) {

        return {

            file:
                path.basename(filePath),

            path:
                filePath,

            success: false,

            structure:
                "ERROR",

            dataStart:
                null,

            recordCount:
                0,

            message:
                error.message,

            error:
                error.stack ||
                String(error)
        };
    }
}

// ============================================================
// MAIN
// ============================================================

function main() {

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "             ALL TXT STRUCTURE TEST"
    );
    console.log(
        "============================================================"
    );

    console.log(
        `TXT Folder : ${TXT_FOLDER}`
    );

    const files =
        findTxtFiles(
            TXT_FOLDER
        );

    console.log(
        `TXT Files  : ${files.length}`
    );

    console.log(
        "============================================================"
    );

    if (files.length === 0) {

        console.log(
            "No TXT files found."
        );

        return;
    }

    const results = [];

    for (
        let index = 0;
        index < files.length;
        index++
    ) {

        const filePath =
            files[index];

        console.log(
            `\n[${index + 1}/${files.length}] ${path.basename(filePath)}`
        );

        const result =
            testFile(
                filePath
            );

        results.push(result);

        console.log(
            `Structure   : ${result.structure}`
        );

        console.log(
            `Success     : ${result.success}`
        );

        console.log(
            `Data Start  : ${result.dataStart}`
        );

        console.log(
            `Records     : ${result.recordCount}`
        );

        if (result.message) {

            console.log(
                `Message     : ${result.message}`
            );
        }

        if (result.error) {

            console.log(
                `Error       : ${result.error}`
            );
        }
    }

    // ========================================================
    // SUMMARY
    // ========================================================

    const successResults =
        results.filter(
            r => r.success
        );

    const failedResults =
        results.filter(
            r => !r.success
        );

    // ========================================================
    // GROUP BY STRUCTURE
    // ========================================================

    const structureMap =
        new Map();

    for (const result of results) {

        const structure =
            result.structure ||
            "UNKNOWN";

        if (!structureMap.has(structure)) {

            structureMap.set(
                structure,
                {
                    total: 0,
                    success: 0,
                    failed: 0,
                    records: 0
                }
            );
        }

        const item =
            structureMap.get(
                structure
            );

        item.total++;

        if (result.success) {

            item.success++;

        } else {

            item.failed++;
        }

        item.records +=
            result.recordCount || 0;
    }

    // ========================================================
    // STRUCTURE SUMMARY
    // ========================================================

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "                    STRUCTURE SUMMARY"
    );
    console.log(
        "============================================================"
    );

    const structures =
        Array.from(
            structureMap.entries()
        ).sort(
            (a, b) =>
                b[1].total -
                a[1].total
        );

    console.log(
        "STRUCTURE\tFILES\tSUCCESS\tFAILED\tRECORDS"
    );

    console.log(
        "------------------------------------------------------------"
    );

    for (
        const [
            structure,
            stats
        ] of structures
    ) {

        console.log(
            `${structure}\t${stats.total}\t${stats.success}\t${stats.failed}\t${stats.records}`
        );
    }

    // ========================================================
    // FAILED FILES
    // ========================================================

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "                     FAILED FILES"
    );
    console.log(
        "============================================================"
    );

    if (failedResults.length === 0) {

        console.log(
            "NONE"
        );

    } else {

        for (const result of failedResults) {

            console.log("");
            console.log(
                `FILE      : ${result.file}`
            );

            console.log(
                `STRUCTURE : ${result.structure}`
            );

            console.log(
                `MESSAGE   : ${result.message || "-"}`
            );

            console.log(
                `ERROR     : ${result.error || "-"}`
            );
        }
    }

    // ========================================================
    // FINAL SUMMARY
    // ========================================================

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "                       FINAL SUMMARY"
    );
    console.log(
        "============================================================"
    );

    console.log(
        `TOTAL FILES : ${results.length}`
    );

    console.log(
        `SUCCESS      : ${successResults.length}`
    );

    console.log(
        `FAILED       : ${failedResults.length}`
    );

    console.log(
        `STRUCTURES   : ${structures.length}`
    );

    console.log(
        "============================================================"
    );

    // ========================================================
    // RETURN MACHINE-READABLE RESULT
    // ========================================================

    return {
        totalFiles:
            results.length,

        success:
            successResults.length,

        failed:
            failedResults.length,

        structureCount:
            structures.length,

        structures:
            Object.fromEntries(
                structureMap
            ),

        results
    };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    findTxtFiles,
    testFile,
    main
};

// ============================================================
// DIRECT EXECUTION
// ============================================================

if (
    require.main === module
) {

    main();
}