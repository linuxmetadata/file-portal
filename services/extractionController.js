const path = require("path");
const fs = require("fs");

const processStatement = require("../validation/processStatement");
const { matchProducts } = require("../matcher/bulkMatcher");
const outputWriter = require("../validation/outputWriter");

async function startExtraction(uploadInfo) {
    console.log("========================================");
    console.log("EXTRACTION STARTED");
    console.log("========================================");

    try {

        console.log("File :", uploadInfo.originalName);
        console.log("Type :", uploadInfo.type);
        console.log("Code :", uploadInfo.code);

        //--------------------------------------------------
        // STEP 1 : Extract Statement
        //--------------------------------------------------

        const extractionResult = await processStatement(
            uploadInfo.localFile
        );

        if (!extractionResult.success) {
            throw new Error(extractionResult.message);
        }

        console.log("Extraction Completed");

        //--------------------------------------------------
        // STEP 2 : Product Matching
        //--------------------------------------------------

        const matchedRows = await matchProducts(
            extractionResult.rows
        );

        console.log("Matching Completed");

        //--------------------------------------------------
        // STEP 3 : Update Master Extraction
        //--------------------------------------------------

        await outputWriter.writeExtraction({
            division: uploadInfo.division,
            statementType: uploadInfo.type,
            fileName: uploadInfo.originalName,
            uploadTime: new Date(),
            rows: matchedRows
        });

        console.log("Master Extraction Updated");

        console.log("========================================");
        console.log("EXTRACTION COMPLETED");
        console.log("========================================");

    } catch (err) {

        console.error("Extraction Failed");
        console.error(err);

    } finally {

        if (fs.existsSync(uploadInfo.localFile)) {
            fs.unlinkSync(uploadInfo.localFile);
        }

    }
}

module.exports = {
    startExtraction
};