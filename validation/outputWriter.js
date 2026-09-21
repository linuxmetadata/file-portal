/**
 * ======================================================
 * OUTPUT WRITER
 * ======================================================
 *
 * Writes the final Extraction Master.
 *
 * One Product = One Excel Row
 *
 * Output:
 *
 * storage/extraction/<StatementType>/Master_Extraction.xlsx
 *
 * IMPORTANT:
 *
 * - Only ONE Master_Extraction.xlsx is maintained.
 * - Existing records are preserved.
 * - New records are appended.
 * - STOCKIST is taken from the statement filename.
 * - Statement filename is passed by processEngine.js.
 *
 */


const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");


//======================================================
// STORAGE
//======================================================

const STORAGE = path.join(
    __dirname,
    "..",
    "storage",
    "extraction"
);


//======================================================
// EXTRACTION COLUMNS
//======================================================

const EXTRACTION_COLUMNS = [

    "DIVISION",
    "MONTH",
    "ZONE",
    "STATE",
    "HQ",
    "ABMHQ",
    "RBMHQ",
    "STKCODE",
    "STOCKIST",

    "SKUNAME",

    "BRAND_GRP",
    "PRDCODE",

    "PRICE",

    "PRE_MTH_C",
    "PRE_MTH_V",

    "OPENING_Q",
    "OPENING_V",

    "PURCHASE_Q",
    "PURCHASE_V",

    "PUR_FREE",
    "PUR_FREE_V",

    "P_RET_QTY",
    "P_RET_VAL",

    "SALES_Q",
    "SALES_V",

    "SAL_RET_Q",
    "SAL_RET_V",

    "FREE",
    "FREE_V",

    "REPL",
    "REPL_V",

    "CLOSING_Q",
    "CLOSING_V"

];


//======================================================
// MAIN OUTPUT WRITER
//======================================================

async function writeExtraction(
    records,
    statementType = "SSS",
    statementName = ""
) {


    //--------------------------------------------------
    // OUTPUT FOLDER
    //--------------------------------------------------

    const folder = path.join(
        STORAGE,
        statementType
    );


    fs.mkdirSync(
        folder,
        {
            recursive: true
        }
    );


    //--------------------------------------------------
    // ALWAYS USE ONE MASTER FILE
    //--------------------------------------------------

    const file = path.join(
        folder,
        "Master_Extraction.xlsx"
    );


    //--------------------------------------------------
    // VALIDATE RECORDS
    //--------------------------------------------------

    if (
        !Array.isArray(records) ||
        records.length === 0
    ) {

        return {

            success: true,

            totalRecords: 0,

            file,

            outputFile: file

        };

    }


    //--------------------------------------------------
    // CLEAN STATEMENT NAME
    //--------------------------------------------------
    //
    // processEngine sends:
    //
    // INTEGRA_SRIVAARI_PHARMA_TN1020_SSS_1
    //
    // We use this exact value as STOCKIST.
    //
    //--------------------------------------------------

    const finalStockist =
        String(statementName || "")
            .trim();


    //--------------------------------------------------
    // CREATE WORKBOOK
    //--------------------------------------------------

    const workbook =
        new ExcelJS.Workbook();


    let existingLoaded = false;


    //--------------------------------------------------
    // LOAD EXISTING MASTER FILE
    //--------------------------------------------------

    if (
        fs.existsSync(file)
    ) {

        try {

            const stat =
                fs.statSync(file);


            // -----------------------------------------
            // Ignore empty workbook
            // -----------------------------------------

            if (
                stat.size > 0
            ) {

                await workbook.xlsx.readFile(
                    file
                );

                existingLoaded = true;


                console.log(
                    "Existing Master Extraction loaded :",
                    file
                );

            }

            else {

                console.log(
                    "Existing extraction file is empty. Creating a new one."
                );

            }

        }

        catch (error) {

            console.log(
                "Corrupted extraction workbook detected."
            );

            console.log(
                "Creating a new workbook."
            );


            try {

                fs.unlinkSync(
                    file
                );

            }

            catch (removeError) {

                // Ignore remove error

            }

        }

    }


    //--------------------------------------------------
    // WORKBOOK CREATOR
    //--------------------------------------------------

    if (
        !existingLoaded
    ) {

        workbook.creator =
            "Statement Portal";

        workbook.created =
            new Date();

    }


    //--------------------------------------------------
    // GET / CREATE SHEET
    //--------------------------------------------------

    let sheet =
        workbook.getWorksheet(
            "Extracted_Data"
        );


    //--------------------------------------------------
    // CREATE SHEET IF NOT EXISTS
    //--------------------------------------------------

    if (
        !sheet
    ) {

        sheet =
            workbook.addWorksheet(
                "Extracted_Data"
            );


        //------------------------------------------------
        // HEADER
        //------------------------------------------------

        sheet.addRow(
            EXTRACTION_COLUMNS
        );


        sheet.getRow(1).font = {

            bold: true

        };

    }


    //--------------------------------------------------
    // APPEND RECORDS
    //--------------------------------------------------

    for (
        const record of records
    ) {


        const row =
            EXTRACTION_COLUMNS.map(
                col => {


                    //------------------------------------------------
                    // IMPORTANT CHANGE
                    //
                    // STOCKIST = STATEMENT FILE NAME
                    //
                    //------------------------------------------------

                    if (
                        col === "STOCKIST" &&
                        finalStockist
                    ) {

                        return finalStockist;

                    }


                    //------------------------------------------------
                    // ALL OTHER COLUMNS
                    //
                    // EXISTING BEHAVIOUR PRESERVED
                    //------------------------------------------------

                    const value =
                        record[col];


                    return (
                        value === undefined ||
                        value === null
                    )
                        ? ""
                        : value;

                }
            );


        //------------------------------------------------
        // ADD ROW
        //------------------------------------------------

        sheet.addRow(
            row
        );

    }


    //--------------------------------------------------
    // COLUMN WIDTH
    //--------------------------------------------------

    sheet.columns.forEach(
        column => {

            column.width = 18;

        }
    );


    //--------------------------------------------------
    // SAVE MASTER FILE
    //--------------------------------------------------

    await workbook.xlsx.writeFile(
        file
    );


    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    return {

        success: true,

        totalRecords:
            records.length,

        file,

        outputFile:
            file,

        stockist:
            finalStockist

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    writeExtraction,

    EXTRACTION_COLUMNS

};