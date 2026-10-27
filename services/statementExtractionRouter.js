
const fs = require("fs");
const path = require("path");

const ExcelJS = require("exceljs");
const pool = require("./postgresPool");


const {
    processExcelFile,
    MASTER_FILE: EXCEL_MASTER_FILE
} = require("../validation/excel/excelExtractionMaster");

const {
    processFile,
    MASTER_FILE: TXT_MASTER_FILE
} = require("../validation/singleRow/singleRowExtractionMaster");

if (
    path.resolve(EXCEL_MASTER_FILE) !==
    path.resolve(TXT_MASTER_FILE)
) {
    throw new Error(
        "Excel and TXT masters do not use the same shared working path."
    );
}

const SHARED_MASTER_FILE = path.resolve(EXCEL_MASTER_FILE);

// Existing REGULAR extraction outputs — unchanged.
const EXCEL_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/EXCEL/Master_Extraction.xlsx"
);

const TXT_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/TXT/Master_Extraction.xlsx"
);

// New INVALID extraction outputs — separate from REGULAR.
const INVALID_EXCEL_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/INVALID/EXCEL/Master_Extraction.xlsx"
);

const INVALID_TXT_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/INVALID/TXT/Master_Extraction.xlsx"
);

// Serialize jobs because both existing masters use one working file.
let extractionQueue = Promise.resolve();

function runExclusive(task) {
    const result = extractionQueue.then(task, task);

    extractionQueue = result.catch(() => {});

    return result;
}


async function saveTxtExtractionWorkbook(category) {
    const normalizedCategory = String(category || "REGULAR")
        .trim()
        .toUpperCase();

    if (!["REGULAR", "INVALID"].includes(normalizedCategory)) {
        throw new Error(
            `Unsupported TXT workbook category: ${normalizedCategory}`
        );
    }

    const masterKey = `${normalizedCategory}:TXT`;
    const workbook = new ExcelJS.Workbook();
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

        if (result.rows.length > 0 && result.rows[0].file_data) {
            await workbook.xlsx.load(result.rows[0].file_data);
        }

        let sheet = workbook.getWorksheet("Raw Extraction");

        if (!sheet) {
            sheet = workbook.addWorksheet("Raw Extraction");

            const columns = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'statement_extraction_master'
                ORDER BY ordinal_position
            `);

            sheet.addRow(columns.rows.map(row => row.column_name));
            sheet.getRow(1).font = { bold: true };
        }

        const records = await client.query(
            `
            SELECT *
            FROM "statement_extraction_master"
            WHERE UPPER(TRIM(COALESCE("Upload Category", ''))) = $1
            ORDER BY "Source File", "Source Row"
            `,
            [normalizedCategory]
        );

        const headers = sheet.getRow(1).values.slice(1);
        const existingIds = new Set();

        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
            const idIndex = headers.indexOf("Record ID");

            if (idIndex >= 0) {
                const recordId = sheet.getRow(rowNumber).getCell(idIndex + 1).value;

                if (recordId !== null && recordId !== undefined && recordId !== "") {
                    existingIds.add(String(recordId));
                }
            }
        }

        for (const record of records.rows) {
            const recordId = String(record["Record ID"] ?? "");

            if (!recordId || existingIds.has(recordId)) {
                continue;
            }

            sheet.addRow(
                headers.map(header => record[header] ?? "")
            );

            existingIds.add(recordId);
        }

        const fileBuffer = Buffer.from(
            await workbook.xlsx.writeBuffer()
        );

        await client.query("BEGIN");

        await client.query(
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
            VALUES ($1, $2, 'TXT', $3, $4, $5, $6, NOW())
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
                normalizedCategory,
                `${normalizedCategory}_TXT_Master_Extraction.xlsx`,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileBuffer.length,
                fileBuffer
            ]
        );

        await client.query("COMMIT");

        return {
            masterKey,
            totalRecords: sheet.rowCount - 1
        };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {}

        throw error;
    } finally {
        client.release();
    }
}


async function runStatementExtraction(
    filePath,
    originalName,
    category = "REGULAR",
    portalData = {}
) {
    const normalizedCategory = String(category || "REGULAR")
        .trim()
        .toUpperCase();

    if (!["REGULAR", "INVALID"].includes(normalizedCategory)) {
        throw new Error(
            `Unsupported extraction category: ${normalizedCategory}`
        );
    }

    const extension = path.extname(
        originalName || filePath
    ).toLowerCase();

    let outputFile;
    let processor;

    if (extension === ".xlsx" || extension === ".xls") {
        outputFile = normalizedCategory === "INVALID"
            ? INVALID_EXCEL_OUTPUT_FILE
            : EXCEL_OUTPUT_FILE;

        processor = () => {
            const inputExtension = path.extname(
                originalName || filePath
            ).toLowerCase();

            if (!inputExtension) {
                throw new Error(
                    `Cannot determine Excel extension. Original name: ${originalName || "(missing)"}, file path: ${filePath || "(missing)"}`
                );
            }

            const extractionInput = path.extname(filePath)
                ? filePath
                : `${filePath}${inputExtension}`;

            if (extractionInput !== filePath) {
                fs.copyFileSync(filePath, extractionInput);
            }

            return processExcelFile(extractionInput);
        };
    } else if (extension === ".txt") {
    outputFile = TXT_OUTPUT_FILE;
    processor = () => processFile(
    filePath,
    originalName,
    {
        ...portalData,
        uploadCategory: normalizedCategory
    }
);
} else {
        return {
            success: false,
            skipped: true,
            message: `No extraction master configured for ${extension || "files without an extension"}.`
        };
    }

    
if (extension === ".txt") {
    const result = await processor();

    if (!result || !result.success) {
        return {
            ...(result || {}),
            success: false,
            outputMaster: `${normalizedCategory}:TXT`
        };
    }

    const workbookResult = await saveTxtExtractionWorkbook(
        normalizedCategory
    );

    return {
        ...result,
        success: true,
        outputMaster: workbookResult.masterKey,
        workbookRecords: workbookResult.totalRecords,
        category: normalizedCategory,
        sourceFileName: path.basename(result.file || filePath)
    };
}


    return runExclusive(async () => {
        let previousSharedMaster = null;
        let sharedMasterExisted = false;

        try {
            fs.mkdirSync(path.dirname(outputFile), {
                recursive: true
            });

            fs.mkdirSync(path.dirname(SHARED_MASTER_FILE), {
                recursive: true
            });

            // Preserve whatever was at the shared working path.
            if (fs.existsSync(SHARED_MASTER_FILE)) {
                sharedMasterExisted = true;
                previousSharedMaster = fs.readFileSync(
                    SHARED_MASTER_FILE
                );
            }

            // Load only the selected category's existing master.
            if (fs.existsSync(outputFile)) {
                fs.copyFileSync(
                    outputFile,
                    SHARED_MASTER_FILE
                );
            } else if (fs.existsSync(SHARED_MASTER_FILE)) {
                fs.unlinkSync(SHARED_MASTER_FILE);
            }

            const result = await processor();

            if (!result || !result.success) {
                return {
                    ...(result || {}),
                    success: false,
                    outputMaster: outputFile
                };
            }

            if (!fs.existsSync(SHARED_MASTER_FILE)) {
                throw new Error(
                    "Extraction reported success, but the master file was not created."
                );
            }

            // Save results only to the selected category's master.
            fs.copyFileSync(
                SHARED_MASTER_FILE,
                outputFile
            );

            return {
                ...result,
                success: true,
                outputMaster: outputFile,
                category: normalizedCategory,
                sourceFileName: path.basename(
                    result.file || filePath
                )
            };
        } finally {
            // Restore the shared working file to its previous state.
            if (sharedMasterExisted) {
                fs.mkdirSync(
                    path.dirname(SHARED_MASTER_FILE),
                    { recursive: true }
                );

                fs.writeFileSync(
                    SHARED_MASTER_FILE,
                    previousSharedMaster
                );
            } else if (fs.existsSync(SHARED_MASTER_FILE)) {
                fs.unlinkSync(SHARED_MASTER_FILE);
            }
        }
    });
}

module.exports = {
    runStatementExtraction,
    EXCEL_OUTPUT_FILE,
    TXT_OUTPUT_FILE,
    INVALID_EXCEL_OUTPUT_FILE,
    INVALID_TXT_OUTPUT_FILE
};
