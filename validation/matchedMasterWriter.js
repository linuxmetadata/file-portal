/**
 * MATCHED MASTER WRITER
 *
 * Creates a separate workbook containing the existing
 * product-matching and calculation results.
 *
 * Does not modify the existing Master_Extraction.xlsx.
 */

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const pool = require("../services/postgresPool");
const {
    QUANTITY_VALUE_PAIRS
} = require("../services/masterSchema");


const STORAGE = path.join(
    __dirname,
    "..",
    "storage",
    "extraction"
);

const MATCHED_MASTER_COLUMNS = [
    "Division",
    "State",
    "HQ",
    "Code",
    "Stockist Name",
    "Extracted Product",
    "Matched Product",
    "Mismatch Remark",
    "PTS",

    // Use the existing master schema's quantity/value headers.
    ...QUANTITY_VALUE_PAIRS.flat()
];

async function writeMatchedMaster(
    records,
    statementType = "SSS",
    uploadCategory = "REGULAR"
) {
    if (!Array.isArray(records)) {
        throw new Error(
            "Matched master records must be an array."
        );
    }

    const type = String(statementType || "SSS")
        .trim()
        .toUpperCase();

    const category = String(uploadCategory || "REGULAR")
    .trim()
    .toUpperCase();

if (!["REGULAR", "INVALID"].includes(category)) {
    throw new Error(
        `Unsupported upload category: ${category}`
    );
}

const folder = category === "INVALID"
    ? path.join(STORAGE, "INVALID", type)
    : path.join(STORAGE, type);

    fs.mkdirSync(folder, {
        recursive: true
    });

    const outputFile = path.join(
        folder,
        "Matched_Master_Extraction.xlsx"
    );

    const workbook = new ExcelJS.Workbook();

    // Preserve existing rows in the separate matched master.
    if (fs.existsSync(outputFile)) {
        await workbook.xlsx.readFile(outputFile);
    }

    let worksheet = workbook.getWorksheet(
        "Matched_Master"
    );

    if (!worksheet) {
        worksheet = workbook.addWorksheet(
            "Matched_Master"
        );
    }

    // Create the header only when the sheet is empty.
    if (worksheet.rowCount === 0) {
        worksheet.addRow(MATCHED_MASTER_COLUMNS);

        worksheet.getRow(1).font = {
            bold: true
        };

        worksheet.getRow(1).alignment = {
            vertical: "middle",
            wrapText: true
        };

        worksheet.views = [{
            state: "frozen",
            ySplit: 1
        }];

        worksheet.autoFilter = {
            from: {
                row: 1,
                column: 1
            },
            to: {
                row: 1,
                column: MATCHED_MASTER_COLUMNS.length
            }
        };
    } else {
        // Do not silently append data to an incompatible workbook.
        const existingHeaders = worksheet
            .getRow(1)
            .values
            .slice(1)
            .map(value => String(value ?? ""));

        if (
            existingHeaders.join("\u001f") !==
            MATCHED_MASTER_COLUMNS.join("\u001f")
        ) {
            throw new Error(
                "Matched master headers do not match the expected schema."
            );
        }
    }

    // Append the current statement's matched product records.
    for (const record of records) {
        worksheet.addRow(
            MATCHED_MASTER_COLUMNS.map(
                column => record[column] ?? ""
            )
        );
    }

    MATCHED_MASTER_COLUMNS.forEach(
        (column, index) => {
            worksheet.getColumn(index + 1).width =
                Math.min(
                    Math.max(column.length + 2, 14),
                    30
                );
        }
    );

    
await workbook.xlsx.writeFile(outputFile);

// Store the separate Matched Master workbook in PostgreSQL.
console.log("[MATCHED MASTER DB] Starting PostgreSQL save...");
console.log("[MATCHED MASTER DB] Key:", `${category}:${type}`);
const masterKey = `${category}:${type}`;
const fileBuffer = await fs.promises.readFile(outputFile);

await pool.query(
    `
    INSERT INTO portal_matched_master_extraction_files (
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
        path.basename(outputFile),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileBuffer.length,
        fileBuffer
    ]
);

return {
    success: true,
    file: outputFile,
    appendedRecords: records.length,
    databaseMasterKey: masterKey
};

}

module.exports = {
    writeMatchedMaster,
    MATCHED_MASTER_COLUMNS
};