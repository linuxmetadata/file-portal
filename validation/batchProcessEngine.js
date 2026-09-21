/**
 * ======================================================
 * BATCH PROCESS ENGINE
 * ======================================================
 *
 * Processes every supported statement
 * inside a folder and all subfolders.
 *
 * Optimized Version
 * -----------------
 * • Price List loaded once
 * • Price Index built once
 * • Reused for every statement
 * • One unmatched report generated
 */

const fs = require("fs");
const path = require("path");

const { processStatement } = require("./processEngine");
const { writeUnmatchedProducts } = require("./unmatchedProductWriter");

const { loadPriceList } = require("../matcher/priceLoader");
const { buildPriceIndex } = require("../matcher/priceIndex");

const VALID_EXTENSIONS = [
    ".xlsx",
    ".xls",
    ".xlsm",
    ".pdf",
    ".csv",
    ".txt"
];

/**
 * Recursively collect all supported files
 */
function getFiles(folder) {

    let files = [];

    const items = fs.readdirSync(folder, {
        withFileTypes: true
    });

    for (const item of items) {

        const fullPath = path.join(folder, item.name);

        if (item.isDirectory()) {

            files.push(...getFiles(fullPath));

        } else {

            const ext = path.extname(item.name).toLowerCase();

            if (VALID_EXTENSIONS.includes(ext)) {

                files.push(fullPath);

            }

        }

    }

    return files;

}

async function processFolder(options) {

    const {

        statementFolder,
        priceFile,
        portalData = {},
        statementType = "SSS"

    } = options;

    if (!fs.existsSync(statementFolder)) {

        throw new Error("Statement folder not found.");

    }

    //--------------------------------------------------
    // Collect Files
    //--------------------------------------------------

    const files = getFiles(statementFolder);

    //--------------------------------------------------
    // Load Price List Once
    //--------------------------------------------------

    console.log("");
    console.log("======================================");
    console.log("LOADING PRICE LIST");
    console.log("======================================");

    const { priceList } = loadPriceList(priceFile);

    console.log("Products :", priceList.length);

    //--------------------------------------------------
    // Build Price Index Once
    //--------------------------------------------------

    console.log("");
    console.log("======================================");
    console.log("BUILDING PRICE INDEX");
    console.log("======================================");

    const priceIndex = buildPriceIndex(priceList);

    console.log("Price Index Ready");

    //--------------------------------------------------
    // Summary
    //--------------------------------------------------

    const summary = {

        totalFiles: files.length,

        processed: 0,

        failed: 0,

        results: []

    };

    //--------------------------------------------------
    // Master Unmatched List
    //--------------------------------------------------

    const allUnmatchedProducts = [];

    //--------------------------------------------------
    // Process Files
    //--------------------------------------------------

    for (const file of files) {

        console.log("");
        console.log("======================================");
        console.log("PROCESSING :", path.basename(file));
        console.log("======================================");

        try {

            const result = await processStatement({

                statementFile: file,

                priceFile,

                priceIndex,

                portalData,

                statementType

            });

            if (

                Array.isArray(result.unmatchedList) &&
                result.unmatchedList.length

            ) {

                allUnmatchedProducts.push(

                    ...result.unmatchedList

                );

            }

            summary.processed++;

            summary.results.push({

                file,

                success: true,

                result

            });

        }

        catch (error) {

            summary.failed++;

            summary.results.push({

                file,

                success: false,

                message: error.message

            });

            console.log("");
            console.log("FAILED :", path.basename(file));
            console.log(error.message);

        }

    }

    //--------------------------------------------------
    // Write Unmatched Products Once
    //--------------------------------------------------

    console.log("");
    console.log("======================================");
    console.log("WRITING UNMATCHED PRODUCTS");
    console.log("======================================");

    const unmatchedResult = await writeUnmatchedProducts(

        allUnmatchedProducts

    );

    summary.unmatchedFile = unmatchedResult.file;

    summary.totalUnmatchedProducts = unmatchedResult.total;

    console.log("Total Unmatched :", unmatchedResult.total);

    if (unmatchedResult.file) {

        console.log("File :", unmatchedResult.file);

    }

    return summary;

}

module.exports = {

    processFolder

};