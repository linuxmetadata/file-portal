/**
 * ======================================================
 * TEST TXT EXTRACTOR
 * ======================================================
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
    mapTXTHeader
} = require("../mappers/headerMapperTXT");

const {
    extractTXT
} = require("../extractors/txtExtractor");


//======================================================
// FILE
//======================================================

const filePath =
    process.argv[2];

console.log("");

console.log(
    "Testing TXT Extractor"
);

console.log(
    "File:",
    filePath
);

console.log("");


//======================================================
// SAFETY
//======================================================

if (
    !filePath
) {

    console.error(
        "Please provide TXT file path."
    );

    process.exit(1);

}


//======================================================
// ABSOLUTE PATH
//======================================================

const absolutePath =
    path.resolve(
        filePath
    );


//======================================================
// CHECK
//======================================================

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


//======================================================
// READ TXT
//======================================================

const readerResult =
    readTXT(
        absolutePath
    );

if (
    !readerResult ||
    !readerResult.success
) {

    console.error("");

    console.error(
        "TXT Reader failed:"
    );

    console.error(
        readerResult
    );

    process.exit(1);

}


//======================================================
// LINES
//======================================================

const lines =
    readerResult.lines;


//======================================================
// HEADER DETECTOR
//======================================================

const detection =
    detectTXTHeader(
        readerResult
    );

console.log("");

console.log(
    "========== DETECTION =========="
);

console.log(
    "Success    :",
    detection.success
);

console.log(
    "Found      :",
    detection.found
);

console.log(
    "Detection  :",
    detection.detection
);

console.log(
    "Header Start:",
    detection.headerStart
);

console.log(
    "Header End  :",
    detection.headerEnd
);

console.log(
    "Data Starts :",
    detection.dataStartsAt
);

console.log(
    "================================"
);


//======================================================
// DETECTION SAFETY
//======================================================

if (
    !detection ||
    !detection.success
) {

    console.error("");

    console.error(
        "TXT Header Detection failed."
    );

    process.exit(1);

}


//======================================================
// HEADER MAPPER
//======================================================

const mapperResult =
    mapTXTHeader(
        detection
    );

console.log("");

console.log(
    "========== MAPPING =========="
);

console.log(
    "Success :",
    mapperResult.success
);

console.log(
    "Format  :",
    mapperResult.format
);

console.log(
    "Message :",
    mapperResult.message
);

console.log(
    "=============================="
);


//======================================================
// MAPPING SAFETY
//======================================================

if (
    !mapperResult.success
) {

    console.error("");

    console.error(
        "TXT Header Mapping failed."
    );

    process.exit(1);

}


//======================================================
// EXTRACT
//======================================================

const extraction =
    extractTXT(
        lines,
        detection,
        mapperResult.mapping
    );


//======================================================
// RESULT
//======================================================

console.log("");

console.log(
    "========== EXTRACTION RESULT =========="
);

console.log(
    "Success       :",
    extraction.success
);

console.log(
    "Total Records :",
    extraction.totalRecords
);

console.log(
    "Message       :",
    extraction.message || ""
);

console.log(
    "========================================"
);


//======================================================
// RECORDS
//======================================================

if (
    extraction.success &&
    extraction.records &&
    extraction.records.length
) {

    console.log("");

    console.log(
        "========== FIRST 10 RECORDS =========="
    );

    console.table(
        extraction.records.slice(
            0,
            10
        )
    );

    console.log(
        "======================================="
    );

}


//======================================================
// SAMPLE CHECK
//======================================================

if (
    extraction.records &&
    extraction.records.length > 0
) {

    const first =
        extraction.records[0];

    console.log("");

    console.log(
        "========== FIRST RECORD CHECK =========="
    );

    console.log(
        "Product       :",
        first.product
    );

    console.log(
        "Packing       :",
        first.pack
    );

    console.log(
        "Opening       :",
        first.opening
    );

    console.log(
        "Purchase      :",
        first.purchase
    );

    console.log(
        "Purchase Value:",
        first.purchaseValue
    );

    console.log(
        "Sales         :",
        first.sales
    );

    console.log(
        "Sales Value   :",
        first.salesValue
    );

    console.log(
        "Closing       :",
        first.closing
    );

    console.log(
        "Closing Value :",
        first.closingValue
    );

    console.log(
        "========================================="
    );

}


console.log("");

console.log(
    "TXT Extractor test completed."
);

console.log("");