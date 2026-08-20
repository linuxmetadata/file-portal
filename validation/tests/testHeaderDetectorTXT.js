/**
 * ======================================================
 * TEST TXT HEADER DETECTOR
 * ======================================================
 *
 * Flow:
 *
 * TXT file
 *    ↓
 * txtReader
 *    ↓
 * lines
 *    ↓
 * headerDetectorTXT
 *    ↓
 * header detection
 *
 * ======================================================
 */

"use strict";

const path = require("path");


//======================================================
// TXT READER
//======================================================

const {
    readTXT
} = require("../readers/txtReader");


//======================================================
// TXT HEADER DETECTOR
//======================================================

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");


//======================================================
// FILE
//======================================================

const filePath =
    process.argv[2] ||
    path.join(
        "testData",
        "statements",
        "TXT",
        "sample.txt"
    );


//======================================================
// ABSOLUTE PATH
//======================================================

const absolutePath =
    path.resolve(
        filePath
    );


//======================================================
// START
//======================================================

console.log("");

console.log(
    "Testing TXT Header Detector"
);

console.log(
    "File:",
    absolutePath
);

console.log("");


//======================================================
// READ TXT
//======================================================

let readerResult;

try {

    readerResult =
        readTXT(
            absolutePath
        );

}
catch (error) {

    console.error("");

    console.error(
        "TXT READER ERROR:"
    );

    console.error(
        error.message
    );

    process.exit(1);

}


//======================================================
// CHECK READER
//======================================================

if (
    !readerResult ||
    readerResult.success === false
) {

    console.log("");

    console.log(
        "========== RESULT =========="
    );

    console.log(
        "Success:",
        false
    );

    console.log(
        "Found:",
        false
    );

    console.log(
        "Message:",
        readerResult &&
        readerResult.message
            ? readerResult.message
            : "TXT reader failed."
    );

    console.log(
        "============================"
    );

    process.exit(1);

}


//======================================================
// FIND LINES
//======================================================
//
// txtReader exports:
//
// readTXT
// detectEncoding
// normalizeLineEndings
// splitLines
// detectRowType
// buildRow
//
// We need the actual text lines for
// headerDetectorTXT.
//

let lines = null;


//------------------------------------------------------
// Preferred
//------------------------------------------------------

if (
    Array.isArray(
        readerResult.lines
    )
) {

    lines =
        readerResult.lines;

}


//------------------------------------------------------
// Fallback: rows
//------------------------------------------------------

else if (
    Array.isArray(
        readerResult.rows
    )
) {

    lines =
        readerResult.rows;

}


//------------------------------------------------------
// Fallback: data
//------------------------------------------------------

else if (
    Array.isArray(
        readerResult.data
    )
) {

    lines =
        readerResult.data;

}


//------------------------------------------------------
// Fallback: records
//------------------------------------------------------

else if (
    Array.isArray(
        readerResult.records
    )
) {

    lines =
        readerResult.records;

}


//======================================================
// READER RESULT DEBUG
//======================================================

console.log(
    "========== TXT READER RESULT =========="
);

console.log(
    "Reader Success:",
    readerResult.success
);

console.log(
    "Encoding:",
    readerResult.encoding
);

console.log(
    "Lines Found:",
    Array.isArray(
        lines
    )
        ? lines.length
        : 0
);

console.log(
    "========================================"
);

console.log("");


//======================================================
// SAFETY
//======================================================

if (
    !Array.isArray(
        lines
    )
) {

    console.log(
        "========== RESULT =========="
    );

    console.log(
        "Success:",
        false
    );

    console.log(
        "Found:",
        false
    );

    console.log(
        "Message:",
        "TXT reader did not return an array of lines."
    );

    console.log(
        "============================"
    );

    process.exit(1);

}


//======================================================
// DETECT HEADER
//======================================================

let result;

try {

    result =
        detectTXTHeader(
            lines
        );

}
catch (error) {

    console.error("");

    console.error(
        "TXT HEADER DETECTOR ERROR:"
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);

}


//======================================================
// RESULT
//======================================================

console.log("");

console.log(
    "========== RESULT =========="
);

console.log(
    "Success:",
    result.success
);

console.log(
    "Found:",
    result.found
);

console.log(
    "Detection:",
    result.detection
);

console.log(
    "Confidence:",
    result.confidence
);

console.log(
    "Header Start:",
    result.headerStart
);

console.log(
    "Header End:",
    result.headerEnd
);

console.log(
    "Product Column:",
    result.productColumn
);

console.log(
    "Data Start:",
    result.dataStart
);

console.log(
    "Data Starts At:",
    result.dataStarts
);

console.log(
    "Headerless:",
    result.headerless
);

console.log(
    "Header Text:",
    result.headerText
);

console.log(
    "Headers:",
    result.headers
);

console.log(
    "Message:",
    result.message || ""
);

console.log(
    "============================"
);

console.log("");

console.log(
    "TXT Header Detector test completed."
);
