/**
 * ======================================================
 * EXCEL READER
 * ======================================================
 *
 * Reads Excel workbooks safely.
 *
 * Supports:
 *   XLSX
 *   XLS
 *   XLSM
 *
 * Handles:
 *   - Absolute paths
 *   - Relative paths
 *   - Paths relative to project root
 *
 * Returns:
 *
 * {
 *     success,
 *     workbook,
 *     message
 * }
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");


//======================================================
// RESOLVE FILE PATH
//======================================================

function resolveFilePath(filePath) {

    if (!filePath) {

        return null;

    }


    //--------------------------------------------------
    // Already absolute
    //--------------------------------------------------

    if (path.isAbsolute(filePath)) {

        return path.normalize(filePath);

    }


    //--------------------------------------------------
    // First try current working directory
    //--------------------------------------------------

    const cwdPath =
        path.resolve(
            process.cwd(),
            filePath
        );


    if (fs.existsSync(cwdPath)) {

        return cwdPath;

    }


    //--------------------------------------------------
    // Try project root
    //
    // validation/readers
    //       ↑
    //       |
    // project root = ../../
    //--------------------------------------------------

    const projectRootPath =
        path.resolve(
            __dirname,
            "..",
            "..",
            filePath
        );


    if (fs.existsSync(projectRootPath)) {

        return projectRootPath;

    }


    //--------------------------------------------------
    // Return the cwd-resolved path for diagnostics
    //--------------------------------------------------

    return cwdPath;

}


//======================================================
// READ WORKBOOK
//======================================================

function readWorkbook(filePath) {

    try {

        //--------------------------------------------------
        // Validate input
        //--------------------------------------------------

        if (!filePath) {

            return {

                success: false,

                workbook: null,

                message:
                    "Excel file path was not provided."

            };

        }


        //--------------------------------------------------
        // Resolve path
        //--------------------------------------------------

        const resolvedPath =
            resolveFilePath(filePath);


        console.log("");

        console.log(
            "========== EXCEL READER =========="
        );

        console.log(
            "Input Path    :",
            filePath
        );

        console.log(
            "Resolved Path :",
            resolvedPath
        );

        console.log(
            "Working Dir   :",
            process.cwd()
        );


        //--------------------------------------------------
        // File exists
        //--------------------------------------------------

        if (
            !resolvedPath ||
            !fs.existsSync(resolvedPath)
        ) {

            console.log(
                "File Exists   : NO"
            );

            console.log(
                "================================="
            );


            return {

                success: false,

                workbook: null,

                message:
                    `Excel file not found: ${resolvedPath}`

            };

        }


        console.log(
            "File Exists   : YES"
        );


        //--------------------------------------------------
        // Extension
        //--------------------------------------------------

        const ext =
            path.extname(
                resolvedPath
            ).toLowerCase();


        console.log(
            "Extension     :",
            ext
        );


        if (

            ext !== ".xlsx" &&

            ext !== ".xls" &&

            ext !== ".xlsm"

        ) {

            console.log(
                "================================="
            );


            return {

                success: false,

                workbook: null,

                message:
                    `Unsupported Excel format: ${ext}`

            };

        }


        //--------------------------------------------------
        // Read workbook
        //--------------------------------------------------

        let workbook;


        try {

            workbook =
                XLSX.readFile(

                    resolvedPath,

                    {

                        cellDates: true,

                        cellFormula: false,

                        cellNF: false,

                        cellHTML: false,

                        cellText: true

                    }

                );

        } catch (error) {

            console.log(
                "Excel Read Error:",
                error.message
            );

            console.log(
                "================================="
            );


            return {

                success: false,

                workbook: null,

                message:
                    `Unable to read Excel file: ${error.message}`

            };

        }


        //--------------------------------------------------
        // Workbook validation
        //--------------------------------------------------

        if (

            !workbook ||

            !Array.isArray(
                workbook.SheetNames
            ) ||

            workbook.SheetNames.length === 0

        ) {

            console.log(
                "Workbook      : INVALID"
            );

            console.log(
                "================================="
            );


            return {

                success: false,

                workbook: null,

                message:
                    "Workbook contains no worksheets."

            };

        }


        //--------------------------------------------------
        // Success
        //--------------------------------------------------

        console.log(
            "Workbook      : OK"
        );

        console.log(
            "Sheets        :",
            workbook.SheetNames
        );

        console.log(
            "================================="
        );


        return {

            success: true,

            workbook,

            message:
                "Workbook loaded."

        };

    }

    catch (error) {

        console.log("");

        console.log(
            "EXCEL READER ERROR:",
            error.message
        );


        return {

            success: false,

            workbook: null,

            message:
                error.message

        };

    }

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    readWorkbook

};