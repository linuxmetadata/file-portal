const fs = require("fs");
const path = require("path");

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

const EXCEL_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/EXCEL/Master_Extraction.xlsx"
);

const TXT_OUTPUT_FILE = path.resolve(
    __dirname,
    "../storage/extraction/TXT/Master_Extraction.xlsx"
);

// Serialize jobs because both existing masters use one working file.
let extractionQueue = Promise.resolve();

function runExclusive(task) {
    const result = extractionQueue.then(task, task);

    extractionQueue = result.catch(() => {});

    return result;
}

async function runStatementExtraction(filePath, originalName) {
    const extension = path.extname(
        originalName || filePath
    ).toLowerCase();

    let outputFile;
    let processor;

    if (extension === ".xlsx" || extension === ".xls") {
    outputFile = EXCEL_OUTPUT_FILE;

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
        processor = () => processFile(filePath);
    } else {
        return {
            success: false,
            skipped: true,
            message: `No extraction master configured for ${extension || "files without an extension"}.`
        };
    }

    return runExclusive(async () => {
        let previousSharedMaster = null;
        let sharedMasterExisted = false;

        try {
            fs.mkdirSync(path.dirname(outputFile), {
                recursive: true
            });

            // Preserve whatever was at the shared working path.
            if (fs.existsSync(SHARED_MASTER_FILE)) {
                sharedMasterExisted = true;
                previousSharedMaster = fs.readFileSync(
                    SHARED_MASTER_FILE
                );
            }

            // Load only this pipeline's existing master.
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

            // Save this pipeline's master separately.
            fs.copyFileSync(
                SHARED_MASTER_FILE,
                outputFile
            );


            return {
                ...result,
                success: true,
                outputMaster: outputFile,
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
    TXT_OUTPUT_FILE
};