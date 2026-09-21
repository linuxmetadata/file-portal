/**
 * ============================================================
 * RUN ALL SINGLE-ROW STATEMENTS
 * ============================================================
 *
 * Uses the already verified single-row pipeline:
 *
 *   Header Extractor
 *        ↓
 *   Data Extractor
 *        ↓
 *   Header Mapper
 *        ↓
 *   Raw Extraction Master
 *
 * IMPORTANT
 * ----------
 * This runner processes ONLY the files explicitly listed in
 * SINGLE_ROW_FILES below.
 *
 * It does NOT scan the entire TXT folder.
 * It does NOT process multi-row statements.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const {
    processFile
} = require("./singleRowExtractionMaster");

// ============================================================
// ROOT
// ============================================================

const ROOT =
    path.resolve(
        __dirname,
        "../.."
    );

// ============================================================
// TEST DATA DIRECTORY
// ============================================================

const TXT_DIR =
    path.join(
        ROOT,
        "testData",
        "statements",
        "TXT"
    );

// ============================================================
// SINGLE-ROW FILE LIST
// ============================================================
//
// PUT ONLY THE FILES ALREADY IDENTIFIED AS SINGLE-ROW HERE.
//
// Do NOT add multi-row files.
//
// ============================================================

const SINGLE_ROW_FILES = [

    "DERMASCIENCE_KANAKADURGA_DRUGS_TEL084_SSS_1.txt",
    "DERMASCIENCE_MEENAKSHY_MEDICAL_AGENCIES_KER337_SSS_1.TXT",
    "DERMASCIENCE_OM_DISTRIBUTORS_PUN149_SSS_1.txt",
    "DERMASCIENCE_S_V_PHARMA_DISTRIBUTORS_AP280_SSS_1.Txt",
    "DERMASCIENCE_SENTHIL_PHARMA_TN845_SSS_1.txt",
    "DERMASCIENCE_SHUBHAM_AGENCIES_PUN160_SSS_1.TXT",
    "DERMASCIENCE_USPHARMA_KER009_SSS_1.txt",
    "DERMASCIENCE_VASU_MEDICAL_ENTERPRIESES_AP340_SSS_1.txt",

    "IMPERIA_BALAMANIKANTA_MEDICAL__GENERAL_AGENCIES_AP365_SSS_1.txt",
    "IMPERIA_CHELLAS_PHARMA_DISTRIBUTOR_TN03_SSS_1.TXT",
    "IMPERIA_FRIENDS_PHARMA_AGENCY_TN966_SSS_1.TXT",
    "IMPERIA_OM_DISTRIBUTORS_PUN149_SSS_1.txt",
    "IMPERIA_PADMA_PHARMA_AGENCIES_TN028_SSS_1.TXT",
    "IMPERIA_PURUSHOTHAM_MEDICAL_AGENCIES_AP234_SSS_1.TXT",
    "IMPERIA_RADHAKRISHNA_PHARMA_AP332_SSS_1.Txt",
    "IMPERIA_ROSHCHEMS_PHARMACEUTICALS_AP207_SSS_1.txt",
    "IMPERIA_SENTHIL_PHARMA_TN845_SSS_1.txt",
    "IMPERIA_VENKATA_SURENDERA_MEDICALS_AP291_SSS_1.txt",

    "INFINA_OM_DISTRIBUTORS_PUN149_SSS_1.txt",
    "INFINA_PADMA_PHARMA_AGENCIES_TN028_SSS_1.TXT",
    "INFINA_PURUSHOTHAM_MEDICAL_AGENCIES_AP234_SSS_1.TXT",
    "INFINA_ROSHCHEMS_PHARMACEUTICALS_AP207_SSS_1.txt",
    "INFINA_VENKATA_SURENDERA_MEDICALS_AP291_SSS_1.txt",

    "INTEGRA_BALAMANIKANTA_MEDICAL__GENERAL_AGENCIES_AP365_SSS_1.txt",
    "INTEGRA_CHELLAS_PHARMA_DISTRIBUTOR_TN03_SSS_1.txt",
    "INTEGRA_FRIENDS_PHARMA_AGENCY_TN966_SSS_1.TXT",
    "INTEGRA_OM_DISTRIBUTORS_PUN149_SSS_1.txt",
    "INTEGRA_PADMA_PHARMA_AGENCIES_TN028_SSS_1.txt",
    "INTEGRA_PALANIAPPA_MEDICAL_AGENCIES_TN368_SSS_1.TXT",
    "INTEGRA_ROSHCHEMS_PHARMACEUTICALS_AP207_SSS_1.txt",
    "INTEGRA_SANDEEP_PHARMA_AP333_SSS_1.txt",
    "INTEGRA_SENTHIL_PHARMA_TN845_SSS_1.txt",

    "META_HOSUR_SENTHIL_PHARMA_DISTRIBUTORS_TN944_SSS_1.TXT",
    "META_ROSHCHEMS_PHARMACEUTICALS_AP207_SSS_1.txt",

    "NUTRIMAX_CHELLAS_PHARMA_DISTRIBUTOR_TN03_SSS_1.TXT",
    "NUTRIMAX_PADMA_PHARMA_AGENCIES_TN028_SSS_1.TXT",
    "NUTRIMAX_SENTHIL_PHARMA_TN845_SSS_1.txt"
];

// ============================================================
// RESULT ARRAYS
// ============================================================

const processed = [];
const failed = [];
const skipped = [];

// ============================================================
// PROCESS ONE FILE
// ============================================================

function processSingleFile(
    fileName,
    index
) {

    const filePath =
        path.join(
            TXT_DIR,
            fileName
        );

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        `FILE ${index + 1} OF ${SINGLE_ROW_FILES.length}`
    );

    console.log(
        "============================================================"
    );

    console.log(
        `File : ${fileName}`
    );

    // --------------------------------------------------------
    // FILE EXISTS
    // --------------------------------------------------------

    if (
        !fs.existsSync(
            filePath
        )
    ) {

        console.log(
            "STATUS : FILE NOT FOUND"
        );

        failed.push({

            file:
                fileName,

            stage:
                "FILE",

            message:
                `File not found: ${filePath}`
        });

        return;
    }

    // --------------------------------------------------------
    // PROCESS
    // --------------------------------------------------------

    try {

        const result =
            processFile(
                filePath
            );

        if (
            result &&
            result.success
        ) {

            console.log(
                "STATUS : SUCCESS"
            );

            console.log(
                `Extracted : ${
                    result.extractedRecords ?? 0
                }`
            );

            console.log(
                `Added     : ${
                    result.addedRecords ?? 0
                }`
            );

            console.log(
                `Duplicates: ${
                    result.skippedDuplicates ?? 0
                }`
            );

            processed.push({

                file:
                    fileName,

                extractedRecords:
                    result.extractedRecords ?? 0,

                addedRecords:
                    result.addedRecords ?? 0,

                skippedDuplicates:
                    result.skippedDuplicates ?? 0,

                totalRecords:
                    result.totalRecords ?? 0
            });

        } else {

            console.log(
                "STATUS : FAILED"
            );

            failed.push({

                file:
                    fileName,

                stage:
                    result?.stage ||
                    "PROCESS",

                message:
                    result?.message ||
                    "Unknown processing error."
            });
        }

    } catch (
        error
    ) {

        console.log(
            "STATUS : ERROR"
        );

        failed.push({

            file:
                fileName,

            stage:
                "EXCEPTION",

            message:
                error.message ||
                String(error)
        });
    }
}

// ============================================================
// MAIN
// ============================================================

function main() {

    console.log(
        "============================================================"
    );

    console.log(
        "SINGLE ROW BATCH EXTRACTION"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `TXT Directory : ${TXT_DIR}`
    );

    console.log(
        `Files Listed  : ${SINGLE_ROW_FILES.length}`
    );

    console.log("");

    if (
        SINGLE_ROW_FILES.length === 0
    ) {

        console.log(
            "No single-row files configured."
        );

        return;
    }

    // --------------------------------------------------------
    // PROCESS ONLY LISTED FILES
    // --------------------------------------------------------

    SINGLE_ROW_FILES.forEach(
        processSingleFile
    );

    // --------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------

    const totalExtracted =
        processed.reduce(
            (
                total,
                item
            ) =>
                total +
                item.extractedRecords,
            0
        );

    const totalAdded =
        processed.reduce(
            (
                total,
                item
            ) =>
                total +
                item.addedRecords,
            0
        );

    const totalDuplicates =
        processed.reduce(
            (
                total,
                item
            ) =>
                total +
                item.skippedDuplicates,
            0
        );

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "BATCH SUMMARY"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `Files configured : ${SINGLE_ROW_FILES.length}`
    );

    console.log(
        `Successful       : ${processed.length}`
    );

    console.log(
        `Failed           : ${failed.length}`
    );

    console.log(
        `Extracted records: ${totalExtracted}`
    );

    console.log(
        `Added records    : ${totalAdded}`
    );

    console.log(
        `Duplicates       : ${totalDuplicates}`
    );

    // --------------------------------------------------------
    // SUCCESS FILES
    // --------------------------------------------------------

    if (
        processed.length
    ) {

        console.log("");
        console.log(
            "SUCCESSFUL FILES"
        );

        processed.forEach(
            item => {

                console.log(
                    `✓ ${item.file} | extracted=${item.extractedRecords} | added=${item.addedRecords} | duplicates=${item.skippedDuplicates}`
                );
            }
        );
    }

    // --------------------------------------------------------
    // FAILED FILES
    // --------------------------------------------------------

    if (
        failed.length
    ) {

        console.log("");
        console.log(
            "FAILED FILES"
        );

        failed.forEach(
            item => {

                console.log(
                    `✗ ${item.file} | ${item.stage} | ${item.message}`
                );
            }
        );
    }

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "BATCH COMPLETE"
    );

    console.log(
        "============================================================"
    );
}

// ============================================================
// RUN
// ============================================================

if (
    require.main === module
) {

    main();
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

    SINGLE_ROW_FILES,

    processSingleFile,

    main
};