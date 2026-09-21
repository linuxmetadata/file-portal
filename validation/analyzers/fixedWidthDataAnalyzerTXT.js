/**
 * ============================================================
 * FIXED WIDTH DATA ANALYZER - TXT
 * ============================================================
 *
 * Diagnostic-only module.
 *
 * Purpose:
 *   Analyze confirmed data rows and identify stable physical
 *   column positions.
 *
 * This module does NOT:
 *   - map business fields
 *   - modify headerMapperTXT.js
 *   - modify txtExtractor.js
 *   - modify headerDetectorTXT.js
 *
 * ============================================================
 */


// ============================================================
// NORMALIZE
// ============================================================

function normalizeLine(line) {

    return String(line || "");

}


// ============================================================
// FIND NON-SPACE SPANS
// ============================================================

function findNonSpaceSpans(line) {

    const text =
        normalizeLine(line);

    const spans = [];

    let start = null;

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const nonSpace =
            !/\s/.test(text[i]);

        if (
            nonSpace &&
            start === null
        ) {

            start = i;

        }

        if (
            !nonSpace &&
            start !== null
        ) {

            spans.push({

                start,

                end: i,

                text:
                    text.slice(
                        start,
                        i
                    )

            });

            start = null;

        }

    }

    if (
        start !== null
    ) {

        spans.push({

            start,

            end:
                text.length,

            text:
                text.slice(
                    start
                )

        });

    }

    return spans;

}


// ============================================================
// CLASSIFY TOKEN
// ============================================================

function classifyToken(text) {

    const value =
        String(
            text || ""
        ).trim();


    if (!value) {

        return "EMPTY";

    }


    if (
        /^[-+]?\d+(?:\.\d+)?$/.test(
            value
        )
    ) {

        if (
            value.includes(".")
        ) {

            return "NUMBER_DECIMAL";

        }

        return "NUMBER_INTEGER";

    }


    if (
        /^[-+]?\d+\.\d+$/.test(
            value
        )
    ) {

        return "NUMBER_DECIMAL";

    }


    return "TEXT";

}


// ============================================================
// ANALYZE ROW
// ============================================================

function analyzeRow(
    line
) {

    const spans =
        findNonSpaceSpans(
            line
        );


    return spans.map(
        (span, index) => ({

            index,

            start:
                span.start,

            end:
                span.end,

            width:
                span.end -
                span.start,

            text:
                span.text,

            type:
                classifyToken(
                    span.text
                )

        })
    );

}


// ============================================================
// ANALYZE ALL ROWS
// ============================================================

function analyzeRows(
    rows
) {

    return rows.map(
        row => ({

            lineNumber:
                row.lineNumber,

            text:
                row.text,

            tokens:
                analyzeRow(
                    row.text
                )

        })
    );

}


// ============================================================
// TOKEN POSITION STATISTICS
// ============================================================

function buildPositionStatistics(
    analyzedRows
) {

    const tokenPositions = new Map();


    for (
        const row
        of analyzedRows
    ) {

        for (
            const token
            of row.tokens
        ) {

            if (
                !tokenPositions.has(
                    token.index
                )
            ) {

                tokenPositions.set(
                    token.index,
                    []
                );

            }


            tokenPositions
                .get(
                    token.index
                )
                .push(
                    token
                );

        }

    }


    const result = [];


    for (
        const [
            index,
            tokens
        ]
        of tokenPositions.entries()
    ) {

        const starts =
            tokens.map(
                token =>
                    token.start
            );

        const ends =
            tokens.map(
                token =>
                    token.end
            );

        const widths =
            tokens.map(
                token =>
                    token.width
            );


        const minStart =
            Math.min(
                ...starts
            );

        const maxStart =
            Math.max(
                ...starts
            );

        const minEnd =
            Math.min(
                ...ends
            );

        const maxEnd =
            Math.max(
                ...ends
            );

        const minWidth =
            Math.min(
                ...widths
            );

        const maxWidth =
            Math.max(
                ...widths
            );


        const typeCounts = {};


        for (
            const token
            of tokens
        ) {

            typeCounts[token.type] =
                (
                    typeCounts[token.type] ||
                    0
                ) + 1;

        }


        result.push({

            tokenIndex:
                index,

            occurrences:
                tokens.length,

            minStart,

            maxStart,

            minEnd,

            maxEnd,

            minWidth,

            maxWidth,

            startStable:
                minStart === maxStart,

            endStable:
                minEnd === maxEnd,

            typeCounts

        });

    }


    return result;

}


// ============================================================
// FIND STABLE NUMERIC POSITIONS
// ============================================================

function findStableNumericPositions(
    analyzedRows
) {

    const positions = new Map();


    for (
        const row
        of analyzedRows
    ) {

        for (
            const token
            of row.tokens
        ) {

            if (
                token.type !==
                    "NUMBER_INTEGER" &&
                token.type !==
                    "NUMBER_DECIMAL"
            ) {

                continue;

            }


            const key =
                `${token.start}:${token.end}`;


            if (
                !positions.has(
                    key
                )
            ) {

                positions.set(
                    key,
                    {

                        start:
                            token.start,

                        end:
                            token.end,

                        width:
                            token.width,

                        occurrences:
                            0,

                        types: {}

                    }

                );

            }


            const item =
                positions.get(
                    key
                );


            item.occurrences++;


            item.types[
                token.type
            ] =
                (
                    item.types[
                        token.type
                    ] || 0
                ) + 1;

        }

    }


    return Array.from(
        positions.values()
    ).sort(
        (
            a,
            b
        ) =>
            a.start -
            b.start
    );

}


// ============================================================
// BUILD PHYSICAL COLUMN CANDIDATES
// ============================================================

function buildColumnCandidates(
    analyzedRows
) {

    const statistics =
        buildPositionStatistics(
            analyzedRows
        );


    const stableNumeric =
        findStableNumericPositions(
            analyzedRows
        );


    return {

        statistics,

        stableNumeric

    };

}


// ============================================================
// MAIN
// ============================================================

function analyzeFixedWidthRows(
    rows
) {

    if (
        !Array.isArray(
            rows
        )
    ) {

        return {

            success: false,

            message:
                "Rows must be an array.",

            rows: [],

            statistics: [],

            stableNumeric: []

        };

    }


    const analyzedRows =
        analyzeRows(
            rows
        );


    const candidates =
        buildColumnCandidates(
            analyzedRows
        );


    return {

        success: true,

        rowCount:
            analyzedRows.length,

        rows:
            analyzedRows,

        statistics:
            candidates.statistics,

        stableNumeric:
            candidates.stableNumeric

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    findNonSpaceSpans,

    classifyToken,

    analyzeRow,

    analyzeRows,

    buildPositionStatistics,

    findStableNumericPositions,

    buildColumnCandidates,

    analyzeFixedWidthRows

};