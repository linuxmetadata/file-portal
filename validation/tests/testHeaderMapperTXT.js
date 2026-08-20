/**
 * ======================================================
 * TEST TXT HEADER MAPPER
 * ======================================================
 */

const fs = require("fs");

const {
    readTXT
} = require("../readers/txtReader");

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");

const {
    mapTXTHeader
} = require("../mappers/headerMapperTXT");


//======================================================
// FILE PATH
//======================================================

const filePath =
    process.argv[2];


//======================================================
// SAFETY
//======================================================

if (!filePath) {

    console.error(
        "Please provide TXT file path."
    );

    console.error(
        'Example: node validation/tests/testHeaderMapperTXT.js "testData\\statements\\TXT\\sample.txt"'
    );

    process.exit(1);

}


//======================================================
// FILE CHECK
//======================================================

if (!fs.existsSync(filePath)) {

    console.error(
        "TXT file not found:"
    );

    console.error(
        filePath
    );

    process.exit(1);

}


//======================================================
// START
//======================================================

console.log("");

console.log(
    "Testing TXT Header Mapper"
);

console.log(
    "File:",
    filePath
);

console.log("");


//======================================================
// READ TXT
//======================================================

const readerResult =
    readTXT(
        filePath
    );


//======================================================
// READER FAILURE
//======================================================

if (
    !readerResult ||
    !readerResult.success
) {

    console.error(
        "TXT Reader failed."
    );

    console.error(
        readerResult
    );

    process.exit(1);

}


//======================================================
// HEADER DETECTION
//======================================================

const detection =
    detectTXTHeader(
        readerResult
    );


//======================================================
// DETECTOR FAILURE
//======================================================

if (
    !detection ||
    !detection.success
) {

    console.error(
        "TXT Header Detector failed."
    );

    console.error(
        detection
    );

    process.exit(1);

}


//======================================================
// DISPLAY DETECTION
//======================================================

console.log(
    "========== DETECTION =========="
);

console.log(
    "Detection      :",
    detection.detection
);

console.log(
    "Header Start   :",
    detection.headerStart
);

console.log(
    "Header End     :",
    detection.headerEnd
);

console.log(
    "Product Column :",
    detection.productColumn
);

console.log(
    "Data Starts    :",
    detection.dataStarts
);

console.log(
    "Confidence     :",
    detection.confidence
);

console.log(
    "==============================="
);

console.log("");


//======================================================
// MAP HEADER
//======================================================

const result =
    mapTXTHeader(
        detection
    );


//======================================================
// RESULT
//======================================================

console.log(
    "========== TXT HEADER MAPPER =========="
);

console.log(
    "Success :",
    result.success
);

console.log(
    "Format  :",
    result.format
);

console.log(
    "Message :",
    result.message || ""
);

console.log(
    "========================================"
);

console.log("");


//======================================================
// MAPPING
//======================================================

if (
    result.mapping
) {

    console.log(
        "========== MAPPING =========="
    );

    console.table(
        result.mapping
    );

    console.log(
        "============================="
    );

    console.log("");

}


//======================================================
// POSITIONS
//======================================================

if (
    result.mapping &&
    result.mapping.positions
) {

    console.log(
        "========== FIXED WIDTH POSITIONS =========="
    );

    console.log(
        "Product Position :",
        result.mapping.positions.product
    );

    console.log(
        "Packing Position :",
        result.mapping.positions.packing
    );

    console.log(
        "Opening Position :",
        result.mapping.positions.opening
    );

    console.log(
        "Receipts Position:",
        result.mapping.positions.receipts
    );

    console.log(
        "Sales Position   :",
        result.mapping.positions.sales
    );

    console.log(
        "Closing Position :",
        result.mapping.positions.closing
    );

    console.log(
        "Qty Positions    :",
        result.mapping.positions.qty
    );

    console.log(
        "Value Positions  :",
        result.mapping.positions.value
    );

    console.log(
        "==========================================="
    );

}


//======================================================
// IMPORTANT FIELDS
//======================================================

if (
    result.mapping
) {

    console.log("");

    console.log(
        "========== STANDARD MAP =========="
    );

    console.log(
        "Product          :",
        result.mapping.product
    );

    console.log(
        "Product Desc     :",
        result.mapping.productDescription
    );

    console.log(
        "Product Code     :",
        result.mapping.productCode
    );

    console.log(
        "Opening          :",
        result.mapping.opening
    );

    console.log(
        "Purchase         :",
        result.mapping.purchase
    );

    console.log(
        "Purchase Free    :",
        result.mapping.purchaseFree
    );

    console.log(
        "Purchase Return  :",
        result.mapping.purchaseReturn
    );

    console.log(
        "Sales            :",
        result.mapping.sales
    );

    console.log(
        "Sales Return     :",
        result.mapping.salesReturn
    );

    console.log(
        "Free             :",
        result.mapping.free
    );

    console.log(
        "Replacement      :",
        result.mapping.replacement
    );

    console.log(
        "Closing          :",
        result.mapping.closing
    );

    console.log(
        "Rate             :",
        result.mapping.rate
    );

    console.log(
        "Purchase Value   :",
        result.mapping.purchaseValue
    );

    console.log(
        "Sales Value      :",
        result.mapping.salesValue
    );

    console.log(
        "Closing Value    :",
        result.mapping.closingValue
    );

    console.log(
        "Pack             :",
        result.mapping.pack
    );

    console.log(
        "================================="
    );

}


console.log("");

console.log(
    "TXT Header Mapper test completed."
);