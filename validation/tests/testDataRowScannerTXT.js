const fs = require("fs");
const path = require("path");

const {
    readTXT
} = require("../readers/txtReader");

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");

const {
    scanDataRows
} = require("../analyzers/dataRowScannerTXT");


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


const result =
    scanDataRows(
        reader.lines,
        detection.headerEnd,
        {
            maxRows: 20
        }
    );


console.log("");

console.log(
    "============================================================"
);

console.log(
    "TXT DATA ROW SCANNER"
);

console.log(
    "============================================================"
);

console.log(
    "File:",
    absolutePath
);

console.log(
    "Header End:",
    detection.headerEnd
);

console.log(
    "Scan Start Index:",
    result.startIndex
);

console.log(
    "Rows Found:",
    result.totalRows
);

console.log(
    "============================================================"
);

console.log("");

console.log(
    "========== DATA ROWS =========="
);

result.rows.forEach(
    row => {

        console.log(
            `${row.lineNumber}: ${row.text}`
        );

    }
);

console.log(
    "==============================="
);

console.log("");

console.log(
    "========== CANDIDATE DETAILS =========="
);

console.table(
    result.candidates
);

console.log(
    "========================================"
);