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
// CODE NAME STOCK DETECTION
// ============================================================

function isCodeNameStockStructure(
    structure
) {

    if (
        !structure ||
        typeof structure !== "object"
    ) {
        return false;
    }

    const fields =
        Array.isArray(
            structure.directFields
        )
            ? structure.directFields.map(
                field =>
                    String(
                        field.field || ""
                    )
            )
            : [];

    return (
        fields.includes("product") &&
        fields.includes("rate") &&
        fields.includes("opening") &&
        fields.includes("purchase") &&
        fields.includes("purchaseReturn") &&
        fields.includes("sales") &&
        fields.includes("salesValue") &&
        fields.includes("closing") &&
        fields.includes("closingValue")
    );

}


// ============================================================
// CODE NAME STOCK CALIBRATION
// ============================================================

function calibrateCodeNameStockColumns(
    structure,
    line
) {

    const text =
        normalizeLine(
            line
        );

    /*
     * This layout has a very specific physical pattern:
     *
     * PRODUCT
     * RATE
     * OPENING
     * PURCHASE
     * PURCHASE FREE
     * PURCHASE RETURN
     * SALES
     * SALES FREE
     * SALES VALUE
     * SALES RETURN
     * EXCESS
     * SHORT
     * CLOSING
     * CLOSING FREE
     * CLOSING VALUE
     *
     * The actual data positions are determined from the
     * numeric tokens in the data row.
     */

    const numericTokens =
        tokenizeLine(
            text
        ).filter(
            token =>
                /^[-+]?\d+(?:\.\d+)?$/.test(
                    token.text
                )
        );


    if (
        numericTokens.length < 10
    ) {
        return calculateBoundaries(
            buildCandidates(
                structure
            ),
            text.length
        );
    }


    //----------------------------------------------------------
    // FIND DIRECT HEADER FIELDS
    //----------------------------------------------------------

    const direct =
        buildDirectColumns(
            structure
        );


    const fieldMap = new Map();


    for (
        const column
        of direct
    ) {

        fieldMap.set(
            column.field,
            column
        );

    }


    //----------------------------------------------------------
    // DATA NUMERIC POSITION MAP
    //
    // The first numeric token is the packing/size value
    // embedded in the product description and is therefore
    // intentionally ignored.
    //
    // The second numeric token is RATE.
    //----------------------------------------------------------

    const values =
        numericTokens.slice(
            1
        );


    /*
     * Expected sample:
     *
     * 141.56   RATE
     * 9        OPENING
     * 0        PURCHASE
     * 1        PURCHASE FREE
     * 0        PURCHASE RETURN
     * 0        SALES
     * 0        SALES FREE
     * 0.00     SALES VALUE
     * 0        SALES RETURN
     * 0        EXCESS
     * 0        SHORT
     * 10       CLOSING
     * 0        CLOSING FREE
     * 1415.60  CLOSING VALUE
     */

    const layout = [

        ["rate", 0],

        ["opening", 1],

        ["purchase", 2],

        ["purchaseFree", 3],

        ["purchaseReturn", 4],

        ["sales", 5],

        ["salesFree", 6],

        ["salesValue", 7],

        ["salesReturn", 8],

        ["excess", 9],

        ["short", 10],

        ["closing", 11],

        ["closingFree", 12],

        ["closingValue", 13]

    ];


    //----------------------------------------------------------
    // PRODUCT
    //----------------------------------------------------------

    const rateToken =
        values[0];


    if (
        !rateToken
    ) {
        return calculateBoundaries(
            buildCandidates(
                structure
            ),
            text.length
        );
    }


    const productColumn =
        fieldMap.get(
            "product"
        );


    const productStart = 0;


    const result = [];


    result.push({

        ...(productColumn || {}),

        field:
            "product",

        dataStart:
            productStart,

        dataEnd:
            rateToken.start,

        dataWidth:
            Math.max(
                0,
                rateToken.start -
                productStart
            )

    });


    //----------------------------------------------------------
    // NUMERIC COLUMNS
    //----------------------------------------------------------

    for (
        const [field, index]
        of layout
    ) {

        const token =
            values[index];


        if (
            !token
        ) {
            continue;
        }


        const original =
            fieldMap.get(
                field
            );


        result.push({

            ...(original || {}),

            field,

            dataStart:
                token.start,

            dataEnd:
                token.end,

            dataWidth:
                token.end -
                token.start

        });

    }


    //----------------------------------------------------------
    // ADD FIELDS THAT ARE NOT PRESENT IN THE HEADER
    //----------------------------------------------------------

    const existingFields =
        new Set(
            result.map(
                column =>
                    column.field
            )
        );


    /*
     * Keep the analyzer's logical field names
     * consistent with the extractor.
     */

    const aliases = [

        ["purchaseFree", "PURCHASE + FREE"],

        ["salesFree", "SALES + FREE"],

        ["closingFree", "CLOSING + FREE"]

    ];


    for (
        const [field, header]
        of aliases
    ) {

        if (
            existingFields.has(
                field
            )
        ) {
            continue;
        }

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
