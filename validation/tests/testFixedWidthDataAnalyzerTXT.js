const path = require("path");
const fs = require("fs");

const {
    readTXT
} = require("../readers/txtReader");

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");

const {
    scanDataRows
} = require("../analyzers/dataRowScannerTXT");

const {
    analyzeFixedWidthRows
} = require("../analyzers/fixedWidthDataAnalyzerTXT");


const filePath =
    process.argv[2];


if (!filePath) {

    console.error(
        "Please provide TXT file."
    );

    process.exit(1);

}


const absolutePath =
    path.resolve(
        filePath
    );


if (!fs.existsSync(absolutePath)) {

    console.error(
        "File not found:",
        absolutePath
    );

    process.exit(1);

}


const reader =
    readTXT(
        absolutePath
    );


if (!reader.success) {

    console.error(
        "TXT Reader failed."
    );

    process.exit(1);

}


const detection =
    detectTXTHeader(
        reader
    );


if (!detection.success) {

    console.error(
        "TXT Header Detection failed."
    );

    process.exit(1);

}


const scan =
    scanDataRows(
        reader.lines,
        detection.headerEnd,
        {
            maxRows: 20
        }
    );


if (
    !scan.success ||
    !scan.rows.length
) {

    console.error(
        "No data rows found."
    );

    process.exit(1);

}


const result =
    analyzeFixedWidthRows(
        scan.rows
    );


console.log("");

console.log(
    "============================================================"
);

console.log(
    "TXT FIXED WIDTH DATA ANALYZER"
);

console.log(
    "============================================================"
);

console.log(
    "File:",
    absolutePath
);

console.log(
    "Detection:",
    detection.detection
);

console.log(
    "Data Rows:",
    result.rowCount
);

console.log(
    "============================================================"
);


console.log("");

console.log(
    "========== FIRST ROW TOKENS =========="
);

console.table(
    result.rows[0].tokens
);

console.log(
    "======================================"
);


console.log("");

console.log(
    "========== POSITION STATISTICS =========="
);

console.table(
    result.statistics
);

console.log(
    "=========================================="
);


console.log("");

console.log(
    "========== STABLE NUMERIC POSITIONS =========="
);

console.table(
    result.stableNumeric
);

console.log(
    "=============================================="
);