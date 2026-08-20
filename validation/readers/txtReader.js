/**
 * ======================================================
 * TXT READER
 * ======================================================
 *
 * Responsibility:
 *
 *   Read TXT statement files and return their raw
 *   structure for the TXT validation pipeline.
 *
 * IMPORTANT:
 *
 *   This module DOES NOT:
 *
 *   - detect headers
 *   - detect products
 *   - detect columns
 *   - map business fields
 *   - extract records
 *
 * Those responsibilities belong to the next stages.
 *
 * Supported:
 *
 *   - Normal TXT
 *   - Tab-separated TXT
 *   - Fixed-width TXT
 *   - Multi-line TXT
 *   - Different encodings where detectable
 *
 * Output:
 *
 * {
 *     success: true,
 *     filePath,
 *     encoding,
 *     lines,
 *     rows
 * }
 *
 * ======================================================
 */

const fs = require("fs");

//======================================================
// ENCODING DETECTION
//======================================================

function detectEncoding(buffer) {

    if (!Buffer.isBuffer(buffer)) {

        return "utf8";

    }

    //--------------------------------------------------
    // UTF-8 BOM
    //--------------------------------------------------

    if (
        buffer.length >= 3 &&
        buffer[0] === 0xEF &&
        buffer[1] === 0xBB &&
        buffer[2] === 0xBF
    ) {

        return "utf8";

    }

    //--------------------------------------------------
    // UTF-16 LE BOM
    //--------------------------------------------------

    if (
        buffer.length >= 2 &&
        buffer[0] === 0xFF &&
        buffer[1] === 0xFE
    ) {

        return "utf16le";

    }

    //--------------------------------------------------
    // UTF-16 BE BOM
    //--------------------------------------------------

    if (
        buffer.length >= 2 &&
        buffer[0] === 0xFE &&
        buffer[1] === 0xFF
    ) {

        /*
         * Node.js does not directly provide a
         * "utf16be" decoder through Buffer.toString().
         *
         * We therefore handle this separately in
         * decodeBuffer().
         */

        return "utf16be";

    }

    //--------------------------------------------------
    // Default
    //--------------------------------------------------

    return "utf8";

}


//======================================================
// REMOVE BOM
//======================================================

function removeBom(text) {

    if (!text) {

        return "";

    }

    return String(text)
        .replace(/^\uFEFF/, "");

}


//======================================================
// DECODE BUFFER
//======================================================

function decodeBuffer(
    buffer,
    encoding
) {

    if (!Buffer.isBuffer(buffer)) {

        throw new TypeError(
            "TXT reader expected a Buffer."
        );

    }

    //--------------------------------------------------
    // UTF-16 BE
    //--------------------------------------------------

    if (
        encoding === "utf16be"
    ) {

        const swapped =
            Buffer.alloc(
                buffer.length
            );

        for (
            let i = 0;
            i + 1 < buffer.length;
            i += 2
        ) {

            swapped[i] =
                buffer[i + 1];

            swapped[i + 1] =
                buffer[i];

        }

        return removeBom(
            swapped.toString("utf16le")
        );

    }

    //--------------------------------------------------
    // Normal encoding
    //--------------------------------------------------

    return removeBom(
        buffer.toString(
            encoding
        )
    );

}


//======================================================
// NORMALIZE LINE ENDINGS
//======================================================

function normalizeLineEndings(text) {

    return String(text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");

}


//======================================================
// SPLIT LINES
//======================================================

function splitLines(text) {

    return normalizeLineEndings(text)
        .split("\n");

}


//======================================================
// DETECT ROW TYPE
//======================================================

function detectRowType(line) {

    if (
        line === null ||
        line === undefined
    ) {

        return "blank";

    }

    const text =
        String(line);

    if (
        text.trim() === ""
    ) {

        return "blank";

    }

    //--------------------------------------------------
    // TAB separated
    //--------------------------------------------------

    if (
        text.includes("\t")
    ) {

        return "tab";

    }

    //--------------------------------------------------
    // Multiple spaces
    //
    // Do NOT automatically classify every line with
    // spaces as fixed-width because normal product names
    // also contain spaces.
    //--------------------------------------------------

    if (
        / {2,}/.test(text)
    ) {

        return "fixed-width-or-spaced";

    }

    //--------------------------------------------------
    // Normal text
    //--------------------------------------------------

    return "text";

}


//======================================================
// BUILD ROW OBJECT
//======================================================

function buildRow(
    line,
    lineNumber
) {

    const text =
        String(line ?? "");

    const type =
        detectRowType(text);

    let cells;

    //--------------------------------------------------
    // TAB-SEPARATED
    //--------------------------------------------------

    if (
        type === "tab"
    ) {

        cells =
            text
                .split("\t")
                .map(
                    value =>
                        String(value ?? "")
                            .trim()
                );

    }

    //--------------------------------------------------
    // Other TXT structures
    //--------------------------------------------------
    //
    // IMPORTANT:
    //
    // Do NOT split fixed-width rows by spaces here.
    //
    // The TXT header detector will determine the actual
    // fixed-width structure later.
    //

    else {

        cells = [
            text
        ];

    }

    return {

        lineNumber,

        text,

        type,

        cells

    };

}


//======================================================
// READ TXT
//======================================================

function readTXT(
    filePath
) {

    //--------------------------------------------------
    // VALIDATE PATH
    //--------------------------------------------------

    if (
        !filePath ||
        typeof filePath !== "string"
    ) {

        return {

            success: false,

            message:
                "TXT file path is required.",

            filePath: null,

            encoding: null,

            text: "",

            lines: [],

            rows: []

        };

    }

    //--------------------------------------------------
    // CHECK FILE
    //--------------------------------------------------

    if (
        !fs.existsSync(filePath)
    ) {

        return {

            success: false,

            message:
                `TXT file not found: ${filePath}`,

            filePath,

            encoding: null,

            text: "",

            lines: [],

            rows: []

        };

    }

    //--------------------------------------------------
    // READ BUFFER
    //--------------------------------------------------

    let buffer;

    try {

        buffer =
            fs.readFileSync(
                filePath
            );

    } catch (error) {

        return {

            success: false,

            message:
                `Unable to read TXT file: ${error.message}`,

            filePath,

            encoding: null,

            text: "",

            lines: [],

            rows: []

        };

    }

    //--------------------------------------------------
    // EMPTY FILE
    //--------------------------------------------------

    if (
        buffer.length === 0
    ) {

        return {

            success: false,

            message:
                "TXT file is empty.",

            filePath,

            encoding: "utf8",

            text: "",

            lines: [],

            rows: []

        };

    }

    //--------------------------------------------------
    // ENCODING
    //--------------------------------------------------

    const encoding =
        detectEncoding(
            buffer
        );

    //--------------------------------------------------
    // DECODE
    //--------------------------------------------------

    let text;

    try {

        text =
            decodeBuffer(
                buffer,
                encoding
            );

    } catch (error) {

        return {

            success: false,

            message:
                `Unable to decode TXT file: ${error.message}`,

            filePath,

            encoding,

            text: "",

            lines: [],

            rows: []

        };

    }

    //--------------------------------------------------
    // LINES
    //--------------------------------------------------

    const lines =
        splitLines(
            text
        );

    //--------------------------------------------------
    // ROWS
    //--------------------------------------------------

    const rows =
        lines.map(
            (line, index) =>
                buildRow(
                    line,
                    index + 1
                )
        );

    //--------------------------------------------------
    // SUMMARY
    //--------------------------------------------------

    const nonBlankLines =
        rows.filter(
            row =>
                row.type !== "blank"
        ).length;

    const tabLines =
        rows.filter(
            row =>
                row.type === "tab"
        ).length;

    const spacedLines =
        rows.filter(
            row =>
                row.type ===
                "fixed-width-or-spaced"
        ).length;

    //--------------------------------------------------
    // DEBUG
    //--------------------------------------------------

    console.log("");

    console.log(
        "========== TXT READER =========="
    );

    console.log(
        "File       :",
        filePath
    );

    console.log(
        "Encoding   :",
        encoding
    );

    console.log(
        "Total Lines:",
        lines.length
    );

    console.log(
        "Non-Blank  :",
        nonBlankLines
    );

    console.log(
        "TAB Lines  :",
        tabLines
    );

    console.log(
        "Spaced     :",
        spacedLines
    );

    console.log(
        "================================"
    );

    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    return {

        success: true,

        filePath,

        encoding,

        text,

        lines,

        rows,

        totalLines:
            lines.length,

        nonBlankLines,

        tabLines,

        spacedLines

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    readTXT,

    // Export these for isolated testing.
    detectEncoding,
    normalizeLineEndings,
    splitLines,
    detectRowType,
    buildRow

};