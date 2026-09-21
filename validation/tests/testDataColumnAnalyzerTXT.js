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
    analyzeDataColumns,
    getColumnMap
} = require("../analyzers/dataColumnAnalyzerTXT");


// ============================================================
// FILE
// ============================================================

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


// ============================================================
// READ TXT
// ============================================================

const reader =
    readTXT(
        absolutePath
    );


if (!reader || !reader.success) {

    console.error(
        "Reader failed."
    );

    process.exit(1);

}


// ============================================================
// HEADER DETECTION
// ============================================================

const detection =
    detectTXTHeader(
        reader
    );


if (!detection || !detection.success) {

    console.error(
        "Header detection failed."
    );

    process.exit(1);

}


// ============================================================
// HEADER LINES
// ============================================================

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


// ============================================================
// HEADER STRUCTURE
// ============================================================

const analysis =
    analyzeHeader(
        headerLines
    );


const structure =
    buildStructure(
        analysis
    );


if (
    !structure ||
    !structure.success
) {

    console.error(
        "Header structure analysis failed."
    );

    console.dir(
        structure,
        {
            depth: null
        }
    );

    process.exit(1);

}


// ============================================================
// DATA ROW HELPERS
// ============================================================

function isSeparatorLine(line) {

    const text =
        String(
            line || ""
        ).trim();

    if (!text) {

        return true;

    }

    return /^[-=_]{5,}$/.test(
        text
    );

}


function looksLikeTotalRow(line) {

    const text =
        String(
            line || ""
        )
        .trim()
        .toUpperCase();


    if (!text) {

        return false;

    }


    return (
        text.includes("GRAND TOTAL") ||
        text === "TOTAL" ||
        text.startsWith("TOTAL ")
    );

}


function looksLikeSectionHeader(line) {

    const text =
        String(
            line || ""
        ).trim();


    if (!text) {

        return false;

    }


    /*
     * A section header normally contains text but
     * no useful numeric data.
     */

    const numbers =
        text.match(
            /[-+]?\d+(?:\.\d+)?/g
        );


    if (
        numbers &&
        numbers.length > 0
    ) {

        return false;

    }


    /*
     * Company / section names such as:
     *
     * LINUX LABORATORIES PVT LTD
     *
     * should not become sample data rows.
     */

    return (
        /^[A-Za-z][A-Za-z .&'-]{2,}$/.test(
            text
        )
    );

}


function looksLikeDataRow(line) {

    const text =
        String(
            line || ""
        );


    if (!text.trim()) {

        return false;

    }


    if (
        isSeparatorLine(
            text
        )
    ) {

        return false;

    }


    if (
        looksLikeTotalRow(
            text
        )
    ) {

        return false;

    }


    if (
        looksLikeSectionHeader(
            text
        )
    ) {

        return false;

    }


    /*
     * A real statement row should contain
     * numeric content somewhere after the
     * product description.
     */

    const numericMatches =
        text.match(
            /[-+]?\d+(?:\.\d+)?/g
        );


    if (
        !numericMatches ||
        numericMatches.length === 0
    ) {

        return false;

    }


    return true;

}


// ============================================================
// FIND FIRST ACTUAL DATA ROW
// ============================================================

const dataStartIndex =
    Math.max(
        0,
        (detection.dataStarts ?? detection.dataStart ?? 1) - 1
    );


let sampleLine =
    "";

let sampleDataIndex =
    -1;


for (
    let i = dataStartIndex;
    i < reader.lines.length;
    i++
) {

    const line =
        String(
            reader.lines[i] || ""
        );


    if (
        !looksLikeDataRow(
            line
        )
    ) {

        continue;

    }


    sampleLine =
        line;

    sampleDataIndex =
        i;

    break;

}


// ============================================================
// SAFETY
// ============================================================

if (
    sampleDataIndex === -1
) {

    console.error("");

    console.error(
        "No actual data row found."
    );

    console.error(
        "Data start index:",
        dataStartIndex
    );

    console.error(
        "Detector dataStartsAt:",
        detection.dataStartsAt
    );

    process.exit(1);

}


// ============================================================
// ANALYZE DATA COLUMNS
// ============================================================

const result =
    analyzeDataColumns(
        structure,
        sampleLine
    );


// ============================================================
// OUTPUT
// ============================================================

console.log("");

console.log(
    "============================================================"
);

console.log(
    "TXT DATA COLUMN ANALYZER"
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
    detection.headerStart
);

console.log(
    "Header End:",
    detection.headerEnd
);

console.log(
    "Data Starts:",
    detection.dataStartsAt
);

console.log(
    "Sample Data Index:",
    sampleDataIndex
);

console.log(
    "Sample Data Line:"
);

console.log(
    sampleLine
);

console.log("");

console.log(
    "COLUMN MAP"
);

console.table(
    getColumnMap(
        result
    )
);

console.log("");

console.log(
    "FULL RESULT"
);

console.dir(
    result,
    {
        depth: null
    }
);

console.log(
    "============================================================"
);