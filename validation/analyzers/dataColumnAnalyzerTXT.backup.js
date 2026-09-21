/**
 * ============================================================
 * TXT DATA COLUMN ANALYZER
 * ============================================================
 *
 * Diagnostic-only module.
 *
 * Converts validated header structure into physical column
 * spans that can later be used by a fallback extractor.
 *
 * IMPORTANT:
 * This does NOT modify:
 *
 *   - headerMapperTXT.js
 *   - txtExtractor.js
 *   - headerDetectorTXT.js
 *   - fieldAliasesTXT.js
 *
 * ============================================================
 */


// ============================================================
// NORMALIZE
// ============================================================

function normalizeLine(line) {

    return String(
        line || ""
    );

}


// ============================================================
// TOKENIZE WITH PHYSICAL POSITIONS
// ============================================================

function tokenizeLine(line) {

    const text =
        normalizeLine(
            line
        );

    const tokens = [];

    let start = null;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const isSpace =
            /\s/.test(
                text[i]
            );


        if (!isSpace) {

            if (
                start === null
            ) {

                start = i;

            }

            continue;

        }


        if (
            start !== null
        ) {

            tokens.push({

                text:
                    text.slice(
                        start,
                        i
                    ),

                start,

                end:
                    i,

                center:
                    (
                        start +
                        i -
                        1
                    ) / 2

            });


            start = null;

        }

    }


    if (
        start !== null
    ) {

        tokens.push({

            text:
                text.slice(
                    start
                ),

            start,

            end:
                text.length,

            center:
                (
                    start +
                    text.length -
                    1
                ) / 2

        });

    }


    return tokens;

}


// ============================================================
// DIRECT FIELD COLUMNS
// ============================================================

function buildDirectColumns(
    structure
) {

    const result = [];


    for (
        const field
        of structure.directFields || []
    ) {

        result.push({

            field:
                field.field,

            header:
                field.text,

            headerStart:
                field.start,

            headerEnd:
                field.end,

            headerCenter:
                (
                    field.start +
                    field.end
                ) / 2,

            source:
                "DIRECT_HEADER"

        });

    }


    return result;

}


// ============================================================
// GROUP COLUMNS
// ============================================================

function buildGroupColumns(
    structure
) {

    const result = [];


    for (
        const relationship
        of structure.relationships || []
    ) {

        if (
            relationship.status !==
            "MATCHED"
        ) {

            continue;

        }


        if (
            !relationship.logicalField
        ) {

            continue;

        }


        result.push({

            field:
                relationship.logicalField,

            parent:
                relationship.parentText,

            parentField:
                relationship.parentField,

            child:
                relationship.childText,

            childType:
                relationship.childType,

            childPosition:
                relationship.childPosition,

            childCenter:
                relationship.childCenter,

            groupLeft:
                relationship.groupLeft,

            groupRight:
                relationship.groupRight,

            source:
                "GROUP_CHILD"

        });

    }


    return result;

}


// ============================================================
// COMBINE CANDIDATES
// ============================================================

function buildCandidates(
    structure
) {

    const direct =
        buildDirectColumns(
            structure
        );


    const grouped =
        buildGroupColumns(
            structure
        );


    return [

        ...direct,

        ...grouped

    ];

}


// ============================================================
// SORT PHYSICALLY
// ============================================================

function sortCandidates(
    candidates
) {

    return [
        ...candidates
    ].sort(
        (
            a,
            b
        ) => {

            const aPosition =
                a.childPosition !==
                undefined
                    ? a.childPosition
                    : a.headerStart;


            const bPosition =
                b.childPosition !==
                undefined
                    ? b.childPosition
                    : b.headerStart;


            return (
                aPosition -
                bPosition
            );

        }
    );

}


// ============================================================
// FIND NEIGHBOUR BOUNDARIES
// ============================================================

function calculateBoundaries(
    candidates,
    lineLength
) {

    const sorted =
        sortCandidates(
            candidates
        );


    const result = [];


    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {

        const current =
            sorted[i];

        const previous =
            sorted[i - 1];

        const next =
            sorted[i + 1];


        const position =
            current.childPosition !==
            undefined
                ? current.childPosition
                : current.headerStart;


        let left;


        let right;


        if (
            previous
        ) {

            const previousPosition =
                previous.childPosition !==
                undefined
                    ? previous.childPosition
                    : previous.headerStart;


            left =
                Math.floor(
                    (
                        previousPosition +
                        position
                    ) / 2
                );

        }
        else {

            left = 0;

        }


        if (
            next
        ) {

            const nextPosition =
                next.childPosition !==
                undefined
                    ? next.childPosition
                    : next.headerStart;


            right =
                Math.floor(
                    (
                        position +
                        nextPosition
                    ) / 2
                );

        }
        else {

            right =
                lineLength;

        }


        result.push({

            ...current,

            dataStart:
                left,

            dataEnd:
                right,

            dataWidth:
                Math.max(
                    0,
                    right -
                    left
                )

        });

    }


    return result;

}


// ============================================================
// ANALYZE DATA COLUMNS
// ============================================================

function analyzeDataColumns(
    structure,
    sampleLine
) {

    if (
        !structure ||
        typeof structure !==
            "object"
    ) {

        return {

            success: false,

            message:
                "Invalid structure."

        };

    }


    const line =
        normalizeLine(
            sampleLine
        );


    const lineLength =
        line.length;


    const tokens =
        tokenizeLine(
            line
        );


    const candidates =
        buildCandidates(
            structure
        );


    const columns =
    isCodeNameStockStructure(structure)
        ? calibrateCodeNameStockColumns(
              structure,
              line
          )
        : calculateBoundaries(
              candidates,
              lineLength
          );


    return {

        success: true,

        lineLength,

        tokens,

        candidateCount:
            candidates.length,

        columns

    };

}


// ============================================================
// DISPLAYABLE COLUMN MAP
// ============================================================

function getColumnMap(
    analysis
) {

    if (
        !analysis ||
        !Array.isArray(
            analysis.columns
        )
    ) {

        return [];

    }


    return analysis.columns.map(
        column => ({

            field:
                column.field,

            header:
                column.header,

            parent:
                column.parent,

            child:
                column.child,

            start:
                column.dataStart,

            end:
                column.dataEnd,

            width:
                column.dataWidth,

            source:
                column.source

        })
    );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    tokenizeLine,

    buildDirectColumns,

    buildGroupColumns,

    buildCandidates,

    sortCandidates,

    calculateBoundaries,

    analyzeDataColumns,

    getColumnMap

};