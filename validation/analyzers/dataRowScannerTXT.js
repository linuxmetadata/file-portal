/**
 * ============================================================
 * TXT DATA ROW SCANNER
 * ============================================================
 *
 * Purpose:
 *
 * Find actual statement data rows after the detected header.
 *
 * This module does NOT:
 *
 *   - map fields
 *   - extract values
 *   - modify existing mapper
 *   - modify existing extractor
 *
 * It only identifies representative data rows.
 *
 * ============================================================
 */


// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_MAX_ROWS = 20;


// ============================================================
// NORMALIZE
// ============================================================

function normalizeLine(line) {

    return String(
        line || ""
    );

}


// ============================================================
// BLANK CHECK
// ============================================================

function isBlankLine(line) {

    return (
        normalizeLine(
            line
        ).trim() === ""
    );

}


// ============================================================
// SEPARATOR CHECK
// ============================================================

function isSeparatorLine(line) {

    const text =
        normalizeLine(
            line
        ).trim();


    if (!text) {

        return false;

    }


    return (
        /^[-=_]{5,}$/.test(
            text
        )
    );

}


// ============================================================
// PAGE / SECTION NOISE
// ============================================================

function isNoiseLine(line) {

    const text =
        normalizeLine(
            line
        ).trim();


    if (!text) {

        return true;

    }


    if (
        isSeparatorLine(
            text
        )
    ) {

        return true;

    }


    // Common page markers.
    if (
        /^page\s*(no\.?|number)?\s*[:\-]?\s*\d+/i.test(
            text
        )
    ) {

        return true;

    }


    // Common repeated report headings.
    if (
        /^page\s+\d+/i.test(
            text
        )
    ) {

        return true;

    }


    return false;

}


// ============================================================
// COMPANY / SECTION HEADER HEURISTICS
// ============================================================

function looksLikeSectionHeader(line) {

    const text =
        normalizeLine(
            line
        ).trim();


    if (!text) {

        return false;

    }


    /*
     * Section/company lines usually:
     *
     * - contain mostly letters
     * - have no meaningful numeric values
     * - are relatively short
     * - do not contain many separated numeric tokens
     */

    const numericMatches =
        text.match(
            /[-+]?\d+(?:\.\d+)?/g
        ) || [];


    const alphaMatches =
        text.match(
            /[A-Za-z]/g
        ) || [];


    const alphaCount =
        alphaMatches.length;


    const numericCount =
        numericMatches.length;


    if (
        alphaCount > 5 &&
        numericCount === 0 &&
        text.length < 80
    ) {

        return true;

    }


    return false;

}


// ============================================================
// NUMERIC TOKEN COUNT
// ============================================================

function countNumericTokens(line) {

    const text =
        normalizeLine(
            line
        );


    const matches =
        text.match(
            /[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g
        );


    return matches
        ? matches.length
        : 0;

}


// ============================================================
// DATA ROW SCORE
// ============================================================

function scoreDataRow(line) {

    const text =
        normalizeLine(
            line
        );


    const trimmed =
        text.trim();

    // ============================================================
// TOTAL / SUMMARY ROWS
// ============================================================

if (
    /^(GRAND\s+TOTAL|TOTAL|SUB\s*TOTAL|SUBTOTAL)\b/i.test(
        trimmed
    )
) {

    return {

        score: 0,

        reason:
            "TOTAL_ROW"

    };

}


// Numeric-only summary rows.
// Example:
// 98614.88    118672.03    74027.36

const numericOnly =
    trimmed
        .replace(
            /[-+]?\d+(?:\.\d+)?/g,
            ""
        )
        .trim();


if (
    numericOnly === ""
) {

    return {

        score: 0,

        reason:
            "NUMERIC_SUMMARY"

    };

}


    if (!trimmed) {

        return {

            score: 0,

            reason:
                "BLANK"

        };

    }


    if (
        isSeparatorLine(
            trimmed
        )
    ) {

        return {

            score: 0,

            reason:
                "SEPARATOR"

        };

    }


    if (
        looksLikeSectionHeader(
            trimmed
        )
    ) {

        return {

            score: 1,

            reason:
                "SECTION_HEADER"

        };

    }


    const numericCount =
        countNumericTokens(
            text
        );


    const length =
        text.length;


    let score = 0;


    /*
     * Product statements normally contain
     * several numeric values after a textual
     * product description.
     */

    if (
        numericCount >= 2
    ) {

        score += 5;

    }
    else if (
        numericCount === 1
    ) {

        score += 2;

    }


    if (
        length >= 20
    ) {

        score += 1;

    }


    if (
        /[A-Za-z]/.test(
            text
        )
    ) {

        score += 1;

    }


    /*
     * A line containing several separated
     * numeric values is strong evidence of
     * a data record.
     */

    if (
        numericCount >= 4
    ) {

        score += 3;

    }


    return {

        score,

        reason:
            score >= 6
                ? "DATA_CANDIDATE"
                : "WEAK_CANDIDATE",

        numericCount

    };

}


// ============================================================
// SCAN DATA ROWS
// ============================================================

function scanDataRows(
    lines,
    headerEnd,
    options = {}
) {

    if (
        !Array.isArray(
            lines
        )
    ) {

        return {

            success: false,

            message:
                "Lines must be an array.",

            rows: []

        };

    }


    const maxRows =
        Number.isInteger(
            options.maxRows
        )
            ? options.maxRows
            : DEFAULT_MAX_ROWS;


    /*
     * Detector line numbers are 1-based.
     *
     * Start immediately after headerEnd.
     */

    const startIndex =
        Math.max(
            0,
            Number(
                headerEnd || 0
            )
        );


    const candidates = [];


    for (
        let i = startIndex;
        i < lines.length;
        i++
    ) {

        const line =
            normalizeLine(
                lines[i]
            );


        if (
            isNoiseLine(
                line
            )
        ) {

            continue;

        }


        const score =
            scoreDataRow(
                line
            );


        candidates.push({

            index:
                i,

            lineNumber:
                i + 1,

            text:
                line,

            ...score

        });


        if (
            candidates.filter(
                row =>
                    row.reason ===
                    "DATA_CANDIDATE"
            ).length >= maxRows
        ) {

            break;

        }

    }


    const dataRows =
        candidates.filter(
            row =>
                row.reason ===
                "DATA_CANDIDATE"
        );


    return {

        success: true,

        startIndex,

        scanned:
            candidates.length,

        totalRows:
            dataRows.length,

        rows:
            dataRows,

        candidates

    };

}


// ============================================================
// GET TEXT ONLY
// ============================================================

function getDataRowLines(
    result
) {

    if (
        !result ||
        !Array.isArray(
            result.rows
        )
    ) {

        return [];

    }


    return result.rows.map(
        row =>
            row.text
    );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    normalizeLine,

    isBlankLine,

    isSeparatorLine,

    isNoiseLine,

    looksLikeSectionHeader,

    countNumericTokens,

    scoreDataRow,

    scanDataRows,

    getDataRowLines

};