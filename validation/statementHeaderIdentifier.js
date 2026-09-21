/**
 * ============================================================
 * STATEMENT HEADER IDENTIFIER
 * ============================================================
 *
 * Purpose:
 *   Identify whether a TXT statement belongs to the
 *   SINGLE_ROW or MULTI_ROW extraction pipeline.
 *
 * IMPORTANT:
 *   This file ONLY identifies the statement type.
 *   It does NOT extract product data.
 *   It does NOT map numeric values.
 *   It does NOT write to the Master workbook.
 *
 * Routing authority:
 *   MULTI_ROW  -> multiRow/multiRowHeaderDetectorTXT.js
 *   SINGLE_ROW -> Single-Row identification in this file
 *
 * The existing extractors/mappers are not modified by this file.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

// ============================================================
// AUTHORITATIVE MULTI-ROW DETECTOR
// ============================================================
//
// MULTI_ROW is decided ONLY by:
// validation/multiRow/multiRowHeaderDetectorTXT.js
//
// Do not classify a statement as MULTI_ROW from header words alone.
// A genuine multi-row header must be found by the detector.
// ============================================================

const multiRowDetectorPath = path.join(
    __dirname,
    "multiRow",
    "multiRowHeaderDetectorTXT.js"
);

let multiRowDetector = null;

try {
    multiRowDetector = require(multiRowDetectorPath);
} catch (error) {
    multiRowDetector = null;
}

// ============================================================
// TEXT READER
// ============================================================

function readTxtFile(filePath) {
    const buffer = fs.readFileSync(filePath);

    const encodings = [
        "utf16le",
        "utf8",
        "latin1"
    ];

    let bestText = "";
    let bestScore = -Infinity;
    let bestEncoding = "utf8";

    for (const encoding of encodings) {
        let text;

        try {
            text = buffer.toString(encoding);
        } catch {
            continue;
        }

        const replacementCount =
            (text.match(/\uFFFD/g) || []).length;

        const tabCount =
            (text.match(/\t/g) || []).length;

        const lineCount =
            text.split(/\r?\n/).length;

        const score =
            (tabCount * 10) +
            Math.min(lineCount, 500) -
            (replacementCount * 100);

        if (score > bestScore) {
            bestScore = score;
            bestText = text;
            bestEncoding = encoding;
        }
    }

    return {
        text: bestText,
        encoding: bestEncoding
    };
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeHeader(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[\u00A0]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function compactHeader(value) {
    return normalizeHeader(value)
        .replace(/[^A-Z0-9]/g, "");
}

// ============================================================
// SINGLE-ROW IDENTIFICATION
// ============================================================
//
// H015 is a fixed/tab-separated header row.
// We identify it from the presence of its distinctive header
// fields on ONE physical line.
//
// Do not identify from numeric-looking product values.
// ============================================================

const SINGLE_ROW_H015_REQUIRED = [
    "DIVISON",
    "ITEM CODE",
    "ITEM NAME",
    "PACKSIZE",
    "P. RATE",
    "PTR",
    "OPENING",
    "OPENING VALUE",
    "PUR. QTY",
    "PUR. FQTY",
    "PUR. VALUE",
    "PUR. RET. QTY",
    "SALE QTY",
    "SALE FQTY",
    "SALE VALUE",
    "CLOSING"
];

function scoreH015Line(line) {
    const normalized = normalizeHeader(line);

    if (!normalized) {
        return 0;
    }

    let score = 0;

    for (
        const header of SINGLE_ROW_H015_REQUIRED
    ) {
        if (
            normalized.includes(
                normalizeHeader(header)
            )
        ) {
            score += 1;
        }
    }

    // H015 is normally TAB separated.
    if (line.includes("\t")) {
        score += 3;
    }

    // A strong H015 header has many columns.
    const tabColumns =
        line.includes("\t")
            ? line.split("\t").length
            : 0;

    if (tabColumns >= 20) {
        score += 5;
    }

    return score;
}

// ============================================================
// MULTI-ROW IDENTIFICATION
// ============================================================
//
// IMPORTANT:
// This file does NOT independently score H012, STOCK & SALE,
// or other Multi-Row patterns.
//
// The authoritative detector is:
//   validation/multiRow/multiRowHeaderDetectorTXT.js
//
// Only detector.success === true can produce MULTI_ROW.
// ============================================================

function detectMultiRow(filePath) {
    if (
        !multiRowDetector ||
        typeof multiRowDetector.detectMultiRowTXTHeader !== "function"
    ) {
        return {
            success: false,
            unavailable: true,
            reason:
                "Authoritative Multi-Row TXT header detector could not be loaded."
        };
    }

    try {
        return multiRowDetector.detectMultiRowTXTHeader(filePath);
    } catch (error) {
        return {
            success: false,
            error: true,
            reason:
                "Authoritative Multi-Row TXT header detector failed.",
            errorMessage:
                error && error.message
                    ? error.message
                    : String(error)
        };
    }
}


// // IDENTIFIER
// ============================================================

function identifyStatementHeader(filePath) {

    if (!filePath) {
        return {
            success: false,
            statementType: "UNKNOWN",
            structureId: null,
            confidence: 0,
            reason: "File path was not supplied."
        };
    }

    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        return {
            success: false,
            statementType: "UNKNOWN",
            structureId: null,
            confidence: 0,
            reason: `File not found: ${absolutePath}`
        };
    }

    // ========================================================
    // STEP 1 — MULTI_ROW AUTHORITY
    // ========================================================
    //
    // The Multi-Row detector is the ONLY authority for
    // deciding MULTI_ROW.
    //
    // If it succeeds, immediately route to MULTI_ROW.
    // No other Multi-Row scoring is performed.
    // ========================================================

    const multiDetection =
        detectMultiRow(absolutePath);

    if (
        multiDetection &&
        multiDetection.success === true
    ) {
        return {
            success: true,
            statementType: "MULTI_ROW",

            structureId:
                multiDetection.format ||
                "MULTI_ROW_FIXED_WIDTH",

            // The detector currently reports a block score in
            // its CLI. For the routing identifier, a successful
            // verified detector result is treated as 100%.
            confidence: 100,

            encoding:
                multiDetection.encoding,

            headerStart:
                Number.isInteger(multiDetection.headerStart)
                    ? multiDetection.headerStart + 1
                    : undefined,

            headerEnd:
                Number.isInteger(multiDetection.headerEnd)
                    ? multiDetection.headerEnd + 1
                    : undefined,

            dataStartsAt:
                Number.isInteger(multiDetection.dataStartsAt)
                    ? multiDetection.dataStartsAt + 1
                    : undefined,

            reason:
                "Verified MULTI_ROW by the authoritative multiRowHeaderDetectorTXT.js.",

            multiRowDetection:
                multiDetection
        };
    }

    // ========================================================
    // STEP 2 — MULTI_ROW NOT FOUND
    // ========================================================
    //
    // Do NOT fall back to the old H012 / STOCK & SALE logic.
    //
    // Only the Single-Row detector below is allowed to classify
    // a file as SINGLE_ROW.
    // ========================================================

    const {
        text,
        encoding
    } = readTxtFile(absolutePath);

    const lines =
        text
            .split(/\r?\n/)
            .map(line => line.trimEnd());

    // --------------------------------------------------------
    // Score Single Row candidates line-by-line.
    // --------------------------------------------------------

    let bestSingleScore = 0;
    let bestSingleLine = -1;

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {
        const score =
            scoreH015Line(lines[i]);

        if (
            score > bestSingleScore
        ) {
            bestSingleScore = score;
            bestSingleLine = i;
        }
    }

    const singleConfidence =
        bestSingleScore > 0
            ? Math.min(
                100,
                Math.round(
                    (
                        bestSingleScore /
                        SINGLE_ROW_H015_REQUIRED.length
                    ) * 100
                )
            )
            : 0;

    const SINGLE_MIN_SCORE = 12;

    const singleValid =
        bestSingleScore >=
        SINGLE_MIN_SCORE;

    if (singleValid) {
        return {
            success: true,
            statementType: "SINGLE_ROW",
            structureId: "H015",
            confidence: singleConfidence,
            encoding,
            headerLine:
                bestSingleLine + 1,
            reason:
                "Verified H015 single-row header pattern after the authoritative Multi-Row detector returned NOT FOUND."
        };
    }

    // ========================================================
    // STEP 3 — UNKNOWN
    // ========================================================

    return {
        success: false,
        statementType: "UNKNOWN",
        structureId: null,
        confidence: singleConfidence,
        encoding,
        reason:
            "Authoritative Multi-Row detector did not find a Multi-Row header, and no confident H015 Single-Row header was found."
    };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    identifyStatementHeader,
    detectMultiRow
};

// ============================================================
// CLI TEST
// ============================================================

if (require.main === module) {
    const filePath =
        process.argv[2];

    if (!filePath) {
        console.error(
            "Usage: node validation\\statementHeaderIdentifier.js \"path\\file.txt\""
        );
        process.exit(1);
    }

    const result =
        identifyStatementHeader(
            path.resolve(filePath)
        );

    console.log(
        "============================================================"
    );
    console.log(
        "STATEMENT HEADER IDENTIFIER"
    );
    console.log(
        "============================================================"
    );
    console.log(
        `File          : ${path.resolve(filePath)}`
    );
    console.log(
        `Statement Type: ${result.statementType}`
    );
    console.log(
        `Structure     : ${result.structureId || "UNKNOWN"}`
    );
    console.log(
        `Confidence    : ${result.confidence}%`
    );

    if (result.headerLine) {
        console.log(
            `Header Line   : ${result.headerLine}`
        );
    }

    if (Number.isInteger(result.headerStart)) {
        console.log(
            `Header Start  : ${result.headerStart}`
        );
    }

    if (Number.isInteger(result.headerEnd)) {
        console.log(
            `Header End    : ${result.headerEnd}`
        );
    }

    if (Number.isInteger(result.dataStartsAt)) {
        console.log(
            `Data Starts   : ${result.dataStartsAt}`
        );
    }

    if (result.encoding) {
        console.log(
            `Encoding      : ${result.encoding}`
        );
    }

    console.log(
        `Reason        : ${result.reason}`
    );
    console.log(
        "============================================================"
    );

    process.exit(
        result.success ? 0 : 2
    );
}
