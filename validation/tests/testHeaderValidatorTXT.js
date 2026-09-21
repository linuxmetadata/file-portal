const fs = require("fs");
const path = require("path");

const {
    readTXT
} = require("../readers/txtReader");

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");

const {
    analyzeHeader,
    buildStructure
} = require("../analyzers/headerStructureAnalyzerTXT");

const {
    validateHeaderStructure
} = require("../validators/headerStructureValidatorTXT");


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
        "Reader failed."
    );

    process.exit(1);

}


const detection =
    detectTXTHeader(
        reader
    );


if (!detection.success) {

    console.error(
        "Header detection failed."
    );

    process.exit(1);

}


const headerStartIndex =
    Math.max(
        0,
        detection.headerStart - 1
    );


const headerEndIndex =
    Math.min(
        reader.lines.length,
        detection.headerEnd
    );


const headerLines =
    reader.lines.slice(
        headerStartIndex,
        headerEndIndex
    );


const analysis =
    analyzeHeader(
        headerLines
    );


const structure =
    buildStructure(
        analysis
    );


const validation =
    validateHeaderStructure(
        structure
    );


console.log("");

console.log(
    "============================================================"
);

console.log(
    "TXT HEADER VALIDATION"
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
    "Status:",
    validation.status
);

console.log(
    "Success:",
    validation.success
);

console.log("");

console.log(
    "SUMMARY"
);

console.dir(
    validation.summary,
    {
        depth: null
    }
);

console.log("");

console.log(
    "FIELDS"
);

console.dir(
    validation.fields,
    {
        depth: null
    }
);

console.log("");

console.log(
    "ISSUES"
);

console.dir(
    validation.issues,
    {
        depth: null
    }
);

console.log("");

console.log(
    "============================================================"
);