/**
 * ======================================================
 * DOCUMENT READER
 * ======================================================
 *
 * Reads any supported statement format.
 *
 * Supports:
 *  - XLSX
 *  - XLS
 *  - XLSM
 *  - CSV
 *  - TXT
 *  - HTML
 *  - HTM
 *  - PDF
 */

const path = require("path");
const { getReader } = require("./readerFactory");

const supportedFormats = [

    ".xlsx",
    ".xls",
    ".xlsm",
    ".csv",
    ".txt",
    ".html",
    ".htm",
    ".pdf"

];

async function readDocument(filePath) {

    const extension = path.extname(filePath).toLowerCase();

    //------------------------------------------
    // Supported Extension
    //------------------------------------------

    if (!supportedFormats.includes(extension)) {

        return {

            success: false,

            message: `Unsupported file format : ${extension}`

        };

    }

    //------------------------------------------
    // Reader
    //------------------------------------------

    const reader = getReader(extension);

    if (!reader) {

        return {

            success: false,

            message: `No reader available for ${extension}`

        };

    }

    //------------------------------------------
    // Read Document
    //------------------------------------------

    const result = await Promise.resolve(

        reader(filePath)

    );

    //------------------------------------------
    // New Reader Format
    //------------------------------------------

    if (

        result &&

        typeof result === "object" &&

        "success" in result

    ) {

        if (!result.success) {

            return {

                success: false,

                message: result.message

            };

        }

        return {

            success: true,

            type: extension,

            workbook: result.workbook

        };

    }

    //------------------------------------------
    // Legacy Reader Support
    //------------------------------------------

    if (!result) {

        return {

            success: false,

            message: "Unable to read document."

        };

    }

    return {

        success: true,

        type: extension,

        workbook: result

    };

}

module.exports = {

    readDocument

};