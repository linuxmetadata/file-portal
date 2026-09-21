const path = require("path");

const { readWorkbook } = require("./validation/reader");
const { detectTable } = require("./validation/detectors/detector");
const { extractTable } = require("./validation/extractors/tableExtractor");

const filePath = path.resolve(process.argv[2]);

console.log("==============================================");
console.log("EXCEL EXTRACTION TEST");
console.log("==============================================");
console.log("File:", filePath);
console.log("");

const document = readWorkbook(filePath);

if (!document || !document.success) {
    console.error("READER FAILED");
    console.error(document);
    process.exit(1);
}

console.log("Reader: SUCCESS");

const workbook = document.workbook;

const detection = detectTable(workbook);

console.log("");
console.log("Detection:");
console.log(JSON.stringify(detection, null, 2));

if (!detection || !detection.found) {
    console.error("DETECTION FAILED");
    process.exit(1);
}

const extraction = extractTable(
    workbook,
    detection,
    "",
    filePath
);

console.log("");
console.log("Extraction:");
console.log(JSON.stringify(extraction, null, 2));

console.log("");
console.log("==============================================");
console.log("RESULT");
console.log("==============================================");
console.log("Success:", extraction.success);
console.log("Headers:", extraction.headers?.length || 0);
console.log("Records:", extraction.rows?.length || 0);