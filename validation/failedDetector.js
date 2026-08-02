const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const { getExcelFiles } = require("./reader");
const { detectWorkbook } = require("./detector");

function exportFailedDetections() {

    const files = getExcelFiles();

    const output = [];

    for (const file of files) {

        const result = detectWorkbook(file.workbook);

        if (result.found) continue;

        for (const sheetName of file.workbook.SheetNames) {

            const sheet = file.workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: ""
            });

            for (let r = 0; r < Math.min(rows.length, 50); r++) {

    const record = {
        File: file.fileName,
        Division: file.division,
        Sheet: sheetName,

        // Detector Information
        Detected: result.found,
        Score: result.score || 0,
        HeaderRow: result.headerRow ?? "",
        ProductColumn: result.productColumn ?? "",
        ProductHeader: result.productHeader ?? "",

        // Current Excel Row
        Row: r + 1
    };

    for (let c = 0; c < 25; c++) {
        record[`Col_${c + 1}`] = rows[r]?.[c] ?? "";
    }

    output.push(record);
}

        }

    }

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.json_to_sheet(output);

    XLSX.utils.book_append_sheet(wb, ws, "Failed Formats");

    const outFile = path.join(__dirname, "Failed_Detections.xlsx");

    XLSX.writeFile(wb, outFile);

    console.log("Created:", outFile);

}

exportFailedDetections();