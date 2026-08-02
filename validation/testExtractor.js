const { getExcelFiles } = require("./reader");
const { detectWorkbook } = require("./detector");
const { extractTable } = require("./tableExtractor");

// Read all Excel files
const files = getExcelFiles();

if (files.length === 0) {
    console.log("No Excel files found.");
    process.exit();
}

// Test first 10 files
const total = Math.min(files.length, 10);

for (let i = 0; i < total; i++) {

    const file = files[i];

    console.log("\n========================================");
    console.log(`FILE ${i + 1} OF ${total}`);
    console.log("========================================");

    console.log("Division :", file.division);
    console.log("File     :", file.fileName);

    const detection = detectWorkbook(file.workbook);

    console.log("Detection :", detection.found ? "SUCCESS" : "FAILED");

    if (!detection.found) {
        console.log("Reason : Table not detected");
        continue;
    }

    const table = extractTable(file, detection);

    console.log("Sheet          :", table.sheetName);
    console.log("Header Row     :", table.headerRow);
    console.log("Product Column :", table.productColumn);
    console.log("Headers Found  :", table.headers.length);
    console.log("Rows Extracted :", table.rows.length);
}