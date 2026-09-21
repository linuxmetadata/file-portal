/**
 * ============================================================
 * GENERIC TXT HEADER STRUCTURE TEST
 * ============================================================
 *
 * Purpose:
 *
 * Test header structure independently of:
 *
 *   - headerMapperTXT
 *   - txtExtractor
 *   - output writer
 *
 * The test reads the real TXT file, detects the header,
 * and sends the detected header rows to the structure analyzer.
 *
 * ============================================================
 */

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


// ============================================================
// FILE
// ============================================================

const filePath =
    process.argv[2];


if (!filePath) {

    console.error(
        "Usage:"
    );

    console.error(
        "node validation/tests/testHeaderStructureGenericTXT.js <TXT_FILE>"
    );

    process.exit(1);

}


const absolutePath =
    path.resolve(
        filePath
    );


if (
    !fs.existsSync(
        absolutePath
    )
) {

    console.error(
        "File not found:",
        absolutePath
    );

    process.exit(1);

}


// ============================================================
// READ
// ============================================================

const reader =
    readTXT(
        absolutePath
    );


if (
    !reader ||
    !reader.success
) {

    console.error(
        "TXT Reader failed."
    );

    console.error(
        reader
    );

    process.exit(1);

}


// ============================================================
// DETECT HEADER
// ============================================================

const detection =
    detectTXTHeader(
        reader
    );


if (
    !detection ||
    !detection.success
) {

    console.error(
        "Header detection failed."
    );

    console.error(
        detection
    );

    process.exit(1);

}


// ============================================================
// HEADER LINES
// ============================================================
//
// Header detector reports line numbers using 1-based
// statement line numbering.
//
// JavaScript arrays are 0-based.
//
// Therefore:
//
// detector line 6 -> reader.lines[5]
// detector line 7 -> reader.lines[6]
//
// IMPORTANT:
// Do not modify the existing header detector.
// This conversion is isolated to this new diagnostic test.
// ============================================================

const headerStart =
    detection.headerStart;

const headerEnd =
    detection.headerEnd;


const headerStartIndex =
    Math.max(
        0,
        headerStart - 1
    );


const headerEndIndex =
    Math.min(
        reader.lines.length,
        headerEnd
    );


const headerLines =
    reader.lines.slice(
        headerStartIndex,
        headerEndIndex
    );


// ============================================================
// DISPLAY
// ============================================================

console.log("");

console.log(
    "============================================================"
);

console.log(
    "GENERIC TXT HEADER STRUCTURE TEST"
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
    "Header Start:",
    headerStart
);

console.log(
    "Header End:",
    headerEnd
);

console.log(
    "Header Rows:",
    headerLines.length
);

console.log(
    "Header Array Index:",
    `${headerStartIndex} to ${headerEndIndex - 1}`
);

console.log(
    "============================================================"
);


// ============================================================
// RAW HEADER
// ============================================================

console.log("");

console.log(
    "========== RAW HEADER =========="
);


headerLines.forEach(
    (
        line,
        index
    ) => {

        console.log(
            `ROW ${index}:`
        );

        console.log(
            line
        );

    }
);


console.log(
    "================================="
);


// ============================================================
// ANALYZE
// ============================================================

const analysis =
    analyzeHeader(
        headerLines
    );


console.log("");

console.log(
    "========== TOKEN ANALYSIS =========="
);

console.dir(
    analysis,
    {
        depth: null
    }
);

console.log(
    "====================================="
);


// ============================================================
// BUILD STRUCTURE
// ============================================================

const structure =
    buildStructure(
        analysis
    );


console.log("");

console.log(
    "========== STRUCTURE =========="
);

console.dir(
    structure,
    {
        depth: null
    }
);

console.log(
    "================================"
);


// ============================================================
// SUMMARY
// ============================================================

console.log("");

console.log(
    "========== SUMMARY =========="
);

console.log(
    "Success:",
    structure.success
);

console.log(
    "Direct Fields:",
    structure.directFields
        ? structure.directFields.length
        : 0
);

console.log(
    "Parent Groups:",
    structure.groups
        ? structure.groups.length
        : 0
);

console.log(
    "Relationships:",
    structure.relationships
        ? structure.relationships.length
        : 0
);

console.log(
    "=============================="
);

console.log("");