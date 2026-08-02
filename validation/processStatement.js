const { readWorkbook } = require("./reader");
const { detectTable } = require("./detector");
const { extractTable } = require("./tableExtractor");

async function processStatement(filePath, division = "") {
    try {

        // Step 1 - Read workbook
        const workbook = readWorkbook(filePath);

        if (!workbook) {
            return {
                success: false,
                stage: "reader",
                reason: "Unable to read workbook"
            };
        }

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