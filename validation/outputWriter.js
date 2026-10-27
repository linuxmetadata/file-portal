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


const ExcelJS = require("exceljs");
const pool = require("../services/postgresPool");



const EXTRACTION_COLUMNS = [
    "Source File",
    "Source Row",
    "Statement Structure",
    "Raw Source Values",
    "Header Mapping",
    "Unidentified Headers",
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
    "Common Closing",
    "Common Closing Free",
    "Common Closing Value",
    "Common Total Stock",
    "Common Age"
];



//======================================================
// MAIN OUTPUT WRITER
//======================================================

async function writeExtraction(
    records,
    statementType = "SSS",
    statementName = "",
    uploadCategory = "REGULAR"
) {


        //--------------------------------------------------
    // DATABASE MASTER IDENTIFICATION
    //--------------------------------------------------

    const category = String(uploadCategory || "REGULAR")
        .trim()
        .toUpperCase();

    if (!["REGULAR", "INVALID"].includes(category)) {
        throw new Error(
            `Unsupported upload category: ${category}`
        );
    }

    const type = String(statementType || "SSS")
        .trim()
        .toUpperCase();

    const masterKey = `${category}:${type}`;

    // Database identifier, not a local file path.
    const file = masterKey;


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
    // LOAD EXISTING MASTER FILE FROM POSTGRESQL
    //--------------------------------------------------

    const client = await pool.connect();

    try {
        const result = await client.query(
            `
                SELECT file_data
                FROM portal_master_extraction_files
                WHERE master_key = $1
            `,
            [masterKey]
        );

        if (result.rows.length > 0) {
            const existingBuffer = result.rows[0].file_data;

            if (existingBuffer && existingBuffer.length > 0) {
                await workbook.xlsx.load(existingBuffer);

                existingLoaded = true;

                console.log(
                    "Existing Master Extraction loaded from PostgreSQL:",
                    masterKey
                );
            }
        }
    } catch (error) {
        throw new Error(
            `Failed to load master workbook "${masterKey}" from PostgreSQL: ${error.message}`
        );
    } finally {
        client.release();
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
            "Raw Extraction"
        );


    //--------------------------------------------------
    // CREATE SHEET IF NOT EXISTS
    //--------------------------------------------------

    if (
        !sheet
    ) {

        sheet =
            workbook.addWorksheet(
                "Raw Extraction"
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


        const row = EXTRACTION_COLUMNS.map(col => {
    const sourceHeaders = Array.isArray(record.sourceHeaders)
        ? record.sourceHeaders
        : [];

    const sourceRow = Array.isArray(record.sourceRow)
        ? record.sourceRow
        : [];

    const sourceColumns = Array.isArray(record.sourceColumns)
        ? record.sourceColumns
        : [];

    const rawSourceValues = sourceColumns.length
        ? sourceColumns.map(item =>
            `${item.header ?? ""}: ${item.value ?? ""}`
        ).join(" | ")
        : sourceHeaders.map((header, index) =>
            `${header ?? ""}: ${sourceRow[index] ?? ""}`
        ).join(" | ");

    const values = {
        "Source File": record.sourceFile || finalStockist,
        "Source Row": record.rowNumber ?? record.sourceRowNumber ?? "",
        "Statement Structure": record.statementStructure ?? "",
        "Raw Source Values": rawSourceValues,
        "Header Mapping": record.headerMapping ?? "",
        "Unidentified Headers": record.unidentifiedHeaders ?? "",

        "Common Product": record.product ?? record.PRODUCT ?? "",
        "Common Pack": record.pack ?? record.PACK ?? "",
        "Common Purchase Rate": record.purchaseRate ?? record.PURCHASE_RATE ?? "",
        "Common Rate": record.rate ?? record.RATE ?? record.PRICE ?? "",

        "Common Opening": record.opening ?? record.OPENING ?? "",
        "Common Opening Value": record.openingValue ?? record.OPENING_V ?? "",
        "Common Purchase": record.purchase ?? record.PURCHASE ?? "",
        "Common Purchase Free": record.purchaseFree ?? record.PURCHASE_FREE ?? "",
        "Common Purchase Value": record.purchaseValue ?? record.PURCHASE_V ?? "",
        "Common Purchase Return": record.purchaseReturn ?? record.PURCHASE_RETURN ?? "",
        "Common Purchase Return Free": record.purchaseReturnFree ?? record.PURCHASE_RETURN_FREE ?? "",
        "Common Replacement": record.replacement ?? record.REPL ?? "",
        "Common Sales Replacement": record.salesReplacement ?? record.SALES_REPL ?? "",
        "Common Sales": record.sales ?? record.SALES ?? "",
        "Common Sales Free": record.free ?? record.SALES_FREE ?? "",
        "Common Sales Value": record.salesValue ?? record.SALES_V ?? "",
        "Common Sales Last": record.salesLast ?? record.SALES_LAST ?? "",
        "Common Sales Return": record.salesReturn ?? record.SALES_RETURN ?? "",
        "Common Sales Return Free": record.salesReturnFree ?? record.SALES_RETURN_FREE ?? "",
        "Common TRN IN": record.trnIn ?? record.TRN_IN ?? "",
        "Common TRN OUT": record.trnOut ?? record.TRN_OUT ?? "",
        "Common Credit": record.credit ?? record.CREDIT ?? "",
        "Common Debit": record.debit ?? record.DEBIT ?? "",
        "Common Adjustment": record.adjustment ?? record.ADJUSTMENT ?? "",
        "Common Closing": record.closing ?? record.CLOSING ?? "",
        "Common Closing Free": record.closingFree ?? record.CLOSING_FREE ?? "",
        "Common Closing Value": record.closingValue ?? record.CLOSING_V ?? "",
        "Common Total Stock": record.totalStock ?? record.TOTAL_STOCK ?? "",
        "Common Age": record.age ?? record.AGE ?? ""
    };

    const value = values[col];

    return value === undefined || value === null ? "" : value;
});

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
    // SAVE MASTER FILE TO POSTGRESQL
    //--------------------------------------------------

    const fileBuffer = Buffer.from(
        await workbook.xlsx.writeBuffer()
    );

    const saveClient = await pool.connect();

    try {
        await saveClient.query("BEGIN");

        await saveClient.query(
            `
                INSERT INTO portal_master_extraction_files (
                    master_key,
                    upload_category,
                    statement_type,
                    original_filename,
                    mime_type,
                    file_size_bytes,
                    file_data,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (master_key)
                DO UPDATE SET
                    upload_category = EXCLUDED.upload_category,
                    statement_type = EXCLUDED.statement_type,
                    original_filename = EXCLUDED.original_filename,
                    mime_type = EXCLUDED.mime_type,
                    file_size_bytes = EXCLUDED.file_size_bytes,
                    file_data = EXCLUDED.file_data,
                    updated_at = NOW()
            `,
            [
                masterKey,
                category,
                type,
                "Master_Extraction.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileBuffer.length,
                fileBuffer
            ]
        );

        await saveClient.query("COMMIT");
    } catch (error) {
        await saveClient.query("ROLLBACK");
        throw error;
    } finally {
        saveClient.release();
    }


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