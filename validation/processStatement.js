const { readDocument } = require("./readers/documentReader");
const { detectTable } = require("./detector");
const { extractTable } = require("./tableExtractor");

async function processStatement(filePath, division = "") {
    try {

        // Step 1 - Read workbook
        const document = readDocument(filePath);

if (!document.success) {

    return {
        success: false,
        stage: "reader",
        reason: document.message
    };

}

const workbook = document.workbook;

        // Step 2 - Detect table
        const detection = detectTable(workbook);

        if (!detection || !detection.found) {
            return {
                success: false,
                stage: "detector",
                reason: "Header not detected"
            };
        }

        // Step 3 - Extract table
        const extraction = extractTable(
            workbook,
            detection,
            division,
            filePath
        );

        if (!extraction || !extraction.success) {
            return {
                success: false,
                stage: "extractor",
                reason: "Table extraction failed"
            };
        }

        return {
            success: true,
            stage: "completed",
            data: extraction
        };

    } catch (err) {

        return {
            success: false,
            stage: "exception",
            reason: err.message
        };

    }
}

module.exports = processStatement;