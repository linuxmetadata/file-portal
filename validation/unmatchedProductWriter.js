/**
 * ======================================================
 * UNMATCHED PRODUCT WRITER
 * ======================================================
 *
 * Writes all unmatched products into Excel.
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

async function writeUnmatchedProducts(unmatchedProducts = []) {

    //--------------------------------------------------
    // Nothing to write
    //--------------------------------------------------

    if (!unmatchedProducts.length) {

        return {

            success: true,

            file: null,

            total: 0

        };

    }

    //--------------------------------------------------
    // Output Folder
    //--------------------------------------------------

    const outputFolder = path.join(

        process.cwd(),

        "storage",

        "unmatched"

    );

    fs.mkdirSync(outputFolder, {

        recursive: true

    });

    //--------------------------------------------------
    // Workbook
    //--------------------------------------------------

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.json_to_sheet(

        unmatchedProducts

    );

    XLSX.utils.book_append_sheet(

        workbook,

        worksheet,

        "Unmatched Products"

    );

    //--------------------------------------------------
    // Output File
    //--------------------------------------------------

    const outputFile = path.join(

        outputFolder,

        "Unmatched_Products.xlsx"

    );

    XLSX.writeFile(

        workbook,

        outputFile

    );

    //--------------------------------------------------
    // Result
    //--------------------------------------------------

    return {

        success: true,

        file: outputFile,

        total: unmatchedProducts.length

    };

}

module.exports = {

    writeUnmatchedProducts

};