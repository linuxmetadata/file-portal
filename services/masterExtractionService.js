const { writeExtraction } = require("../validation/outputWriter");

async function updateMasterExtraction(
    matchedRows,
    extractionData,
    statementType
) {

    const result = await writeExtraction(
        {
            ...extractionData,
            rows: matchedRows
        },
        statementType
    );

    console.log("================================");
    console.log("MASTER EXTRACTION UPDATED");
    console.log(result.file);
    console.log("================================");

    return result;
}

module.exports = {
    updateMasterExtraction
};