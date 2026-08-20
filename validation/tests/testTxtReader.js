const path = require("path");

const {
    readTXT
} = require("../readers/txtReader");

const filePath =
    process.argv[2];

if (!filePath) {

    console.error(
        "Usage:"
    );

    console.error(
        "node validation/tests/testTxtReader.js <TXT_FILE>"
    );

    process.exit(1);

}

const absolutePath =
    path.resolve(
        filePath
    );

console.log("");
console.log(
    "Testing TXT Reader"
);
console.log(
    "File:",
    absolutePath
);
console.log("");

const result =
    readTXT(
        absolutePath
    );

console.log("");
console.log(
    "========== RESULT =========="
);

console.log(
    "Success:",
    result.success
);

console.log(
    "Encoding:",
    result.encoding
);

console.log(
    "Total Lines:",
    result.totalLines
);

console.log(
    "Non-Blank Lines:",
    result.nonBlankLines
);

console.log(
    "TAB Lines:",
    result.tabLines
);

console.log(
    "Spaced Lines:",
    result.spacedLines
);

if (!result.success) {

    console.log(
        "Message:",
        result.message
    );

    process.exit(1);

}

console.log("");
console.log(
    "========== FIRST 10 ROWS =========="
);

console.table(
    result.rows
        .slice(0, 10)
        .map(row => ({

            lineNumber:
                row.lineNumber,

            type:
                row.type,

            text:
                row.text.substring(
                    0,
                    150
                ),

            cells:
                row.cells.length

        }))
);

console.log("");
console.log(
    "TXT Reader test completed."
);