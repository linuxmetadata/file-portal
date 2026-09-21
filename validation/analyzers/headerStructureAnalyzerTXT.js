/**
 * ============================================================
 * TXT HEADER STRUCTURE ANALYZER
 * ============================================================
 *
 * Step 2D
 *
 * Responsibilities:
 *
 *   1. Physical header tokenization
 *   2. Alias resolution
 *   3. Compound header resolution
 *   4. Child-type detection
 *   5. Parent-group construction
 *   6. Parent/child inference using physical centers
 *   7. Ambiguous annotation protection
 *
 * IMPORTANT:
 *
 * This module is NOT connected to the production mapper yet.
 *
 * ============================================================
 */

const {
    normalizeHeader,
    resolveAlias
} = require("./fieldAliasesTXT");


// ============================================================
// PHYSICAL TOKENIZER
// ============================================================

function tokenizePhysical(line) {

    const text =
        String(line || "");

    const tokens = [];

    let start = null;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];


        if (!/\s/.test(char)) {

            if (start === null) {
                start = i;
            }

            continue;
        }


        if (start !== null) {

            const raw =
                text.slice(
                    start,
                    i
                );


            tokens.push({

                raw,

                text:
                    normalizeHeader(
                        raw
                    ),

                start,

                end:
                    i - 1,

                length:
                    i - start,

                center:
                    (start + (i - 1)) / 2

            });


            start = null;

        }

    }


    if (start !== null) {

        const raw =
            text.slice(
                start
            );


        tokens.push({

            raw,

            text:
                normalizeHeader(
                    raw
                ),

            start,

            end:
                text.length - 1,

            length:
                text.length - start,

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
// CHILD TYPE
// ============================================================

function detectChildType(text) {

    const normalized =
        normalizeHeader(
            text
        );


    if (
        normalized === "QTY" ||
        normalized === "QUANTITY" ||
        normalized === "UNIT" ||
        normalized === "UNITS"
    ) {

        return "quantity";

    }


    if (
        normalized === "FREE" ||
        normalized === "FREE QTY" ||
        normalized === "FREE QUANTITY"
    ) {

        return "free";

    }


    if (
        normalized === "VALUE" ||
        normalized === "VAL" ||
        normalized === "AMOUNT" ||
        normalized === "AMT"
    ) {

        return "value";

    }


    if (
        normalized === "RATE" ||
        normalized === "PRICE"
    ) {

        return "rate";

    }


    return null;
}


// ============================================================
// COMPOUND FIELDS
// ============================================================

const COMPOUND_FIELDS = {

    "PRODUCT NAME":
        "product",

    "ITEM NAME":
        "product",

    "MEDICINE NAME":
        "product",

    "PRODUCT CODE":
        "productCode",

    "ITEM CODE":
        "productCode",

    "PACKING SIZE":
        "pack",

    "PACK SIZE":
        "pack",

    "OPENING VALUE":
        "openingValue",

    "OP VALUE":
        "openingValue",

    "OPSTOCK VALUE":
        "openingValue",

    "OPENING AMOUNT":
        "openingValue",

    "PURCHASE VALUE":
        "purchaseValue",

    "PUR VALUE":
        "purchaseValue",

    "PURCHASE AMOUNT":
        "purchaseValue",

    "SALES VALUE":
        "salesValue",

    "SALE VALUE":
        "salesValue",

    "SALES AMOUNT":
        "salesValue",

    "S VALUE":
        "salesValue",

    "CLOSING VALUE":
        "closingValue",

    "CL VALUE":
        "closingValue",

    "CLSTOCK VALUE":
        "closingValue",

    "CLOSING AMOUNT":
        "closingValue",

    "CLOSING STOCK VALUE":
        "closingValue"

};


// ============================================================
// AMBIGUOUS SHORT TOKENS
// ============================================================
//
// These are intentionally NOT rejected globally.
//
// They require structural evidence before becoming fields.
//
// ============================================================

const AMBIGUOUS_SHORT_TOKENS = new Set([

    "IN",
    "OUT",
    "ON",
    "TO",
    "BY",
    "OF",
    "NO",
    "ST"

]);


// ============================================================
// RESOLVE COMPOUND
// ============================================================

function resolveCompoundField(
    first,
    second
) {

    const a =
        normalizeHeader(
            first
        );

    const b =
        normalizeHeader(
            second
        );


    if (
        !a ||
        !b
    ) {

        return null;

    }


    const combined =
        `${a} ${b}`.trim();


    return (
        COMPOUND_FIELDS[
            combined
        ] ||
        null
    );

}


// ============================================================
// IS AMBIGUOUS
// ============================================================

function isAmbiguousShortToken(
    token
) {

    if (!token) {
        return false;
    }


    const text =
        normalizeHeader(
            token.text
        );


    return (
        AMBIGUOUS_SHORT_TOKENS.has(
            text
        )
    );

}


// ============================================================
// ANALYZE ONE ROW
// ============================================================

function analyzeRow(
    line,
    rowIndex
) {

    const tokens =
        tokenizePhysical(
            line
        );


    const result = [];

    let i = 0;


    while (
        i < tokens.length
    ) {

        const current =
            tokens[i];

        const next =
            tokens[i + 1];


        // ----------------------------------------------------
        // COMPOUND HEADER
        // ----------------------------------------------------

        if (next) {

            const compoundField =
                resolveCompoundField(
                    current.text,
                    next.text
                );


            if (compoundField) {

                result.push({

                    row:
                        rowIndex,

                    raw:
                        `${current.raw} ${next.raw}`,

                    text:
                        `${current.text} ${next.text}`,

                    start:
                        current.start,

                    end:
                        next.end,

                    length:
                        next.end -
                        current.start +
                        1,

                    center:
                        (
                            current.start +
                            next.end
                        ) / 2,

                    field:
                        compoundField,

                    childType:
                        null,

                    compound:
                        true,

                    ambiguous:
                        false,

                    parts: [
                        current.text,
                        next.text
                    ]

                });


                i += 2;

                continue;

            }

        }


        // ----------------------------------------------------
        // NORMAL TOKEN
        // ----------------------------------------------------

        const ambiguous =
            isAmbiguousShortToken(
                current
            );


        result.push({

            row:
                rowIndex,

            raw:
                current.raw,

            text:
                current.text,

            start:
                current.start,

            end:
                current.end,

            length:
                current.length,

            center:
                current.center,

            field:
                ambiguous
                    ? null
                    : resolveAlias(
                        current.text
                    ),

            childType:
                detectChildType(
                    current.text
                ),

            compound:
                false,

            ambiguous,

            parts: [
                current.text
            ]

        });


        i++;

    }


    return result;
}


// ============================================================
// HEADER ANALYSIS
// ============================================================

function analyzeHeader(
    headerLines
) {

    if (
        !Array.isArray(
            headerLines
        )
    ) {

        return {

            success: false,

            message:
                "Header analyzer expected an array of lines.",

            rows: [],

            columns: []

        };

    }


    const rows = [];

    const columns = [];


    for (
        let rowIndex = 0;
        rowIndex < headerLines.length;
        rowIndex++
    ) {

        const raw =
            String(
                headerLines[rowIndex] ||
                ""
            );


        const analyzed =
            analyzeRow(
                raw,
                rowIndex
            );


        rows.push({

            row:
                rowIndex,

            raw,

            tokens:
                analyzed

        });


        columns.push(
            ...analyzed
        );

    }


    return {

        success: true,

        rows,

        columns,

        rowCount:
            rows.length,

        columnCount:
            columns.length

    };

}


// ============================================================
// PARENT FIELD CAPABILITY
// ============================================================

function canHaveChild(
    field
) {

    return [

        "opening",
        "purchase",
        "sales",
        "closing"

    ].includes(
        field
    );

}


// ============================================================
// LOGICAL CHILD FIELD
// ============================================================

function makeLogicalChildField(
    parentField,
    childType
) {

    if (
        !parentField ||
        !childType
    ) {

        return null;

    }


    if (
        childType === "quantity"
    ) {

        return parentField;

    }


    if (
        childType === "free"
    ) {

        return `${parentField}Free`;

    }


    if (
        childType === "value"
    ) {

        return `${parentField}Value`;

    }


    if (
        childType === "rate"
    ) {

        return `${parentField}Rate`;

    }


    return null;

}


// ============================================================
// BUILD PARENT GROUPS
// ============================================================
//
// Parent groups are constructed from the first header row.
//
// Each parent gets a physical center.
//
// The midpoint between neighboring parent centers is used as
// the boundary.
//
// This prevents centered labels such as:
//
//       ClStock
//      Qty Free
//
// from being incorrectly assigned to the previous parent.
//
// ============================================================

function buildParentGroups(
    parentRow
) {

    if (
        !parentRow ||
        !Array.isArray(
            parentRow.tokens
        )
    ) {

        return [];

    }


    const parents =
        parentRow.tokens
            .filter(
                token =>
                    token.field &&
                    !token.childType &&
                    !token.ambiguous &&
                    canHaveChild(
                        token.field
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.center -
                    b.center
            );


    const groups = [];


    for (
        let i = 0;
        i < parents.length;
        i++
    ) {

        const parent =
            parents[i];

        const previous =
            parents[i - 1];

        const next =
            parents[i + 1];


        let leftBoundary;

        let rightBoundary;


        // ----------------------------------------------------
        // LEFT BOUNDARY
        // ----------------------------------------------------

        if (previous) {

            leftBoundary =
                (
                    previous.center +
                    parent.center
                ) / 2;

        }
        else {

            leftBoundary =
                -Infinity;

        }


        // ----------------------------------------------------
        // RIGHT BOUNDARY
        // ----------------------------------------------------

        if (next) {

            rightBoundary =
                (
                    parent.center +
                    next.center
                ) / 2;

        }
        else {

            rightBoundary =
                Infinity;

        }


        groups.push({

            parentText:
                parent.text,

            parentField:
                parent.field,

            parentStart:
                parent.start,

            parentEnd:
                parent.end,

            parentCenter:
                parent.center,

            leftBoundary,

            rightBoundary,

            children: []

        });

    }


    return groups;

}


// ============================================================
// FIND PARENT GROUP
// ============================================================

function findParentGroup(
    child,
    groups
) {

    if (
        !child ||
        !Array.isArray(
            groups
        ) ||
        !groups.length
    ) {

        return null;

    }


    // --------------------------------------------------------
    // First: boundary test
    // --------------------------------------------------------

    const inside =
        groups.filter(
            group =>
                child.center >=
                    group.leftBoundary &&
                child.center <
                    group.rightBoundary
        );


    if (
        inside.length === 1
    ) {

        return inside[0];

    }


    // --------------------------------------------------------
    // Fallback: nearest center
    // --------------------------------------------------------

    let nearest =
        null;

    let nearestDistance =
        Infinity;


    for (
        const group
        of groups
    ) {

        const distance =
            Math.abs(
                child.center -
                group.parentCenter
            );


        if (
            distance <
            nearestDistance
        ) {

            nearestDistance =
                distance;

            nearest =
                group;

        }

    }


    return nearest;

}


// ============================================================
// INFER PARENT / CHILD
// ============================================================

function inferParentChild(
    analysis
) {

    if (
        !analysis ||
        !Array.isArray(
            analysis.rows
        )
    ) {

        return {

            success: false,

            message:
                "Invalid header analysis.",

            groups: [],

            relationships: []

        };

    }


    if (
        analysis.rows.length < 2
    ) {

        return {

            success: true,

            groups: [],

            relationships: [],

            message:
                "No multi-row header available."

        };

    }


    const parentRow =
        analysis.rows[0];


    const childRows =
        analysis.rows.slice(
            1
        );


    const groups =
        buildParentGroups(
            parentRow
        );


    const relationships = [];


    for (
        const row
        of childRows
    ) {

        for (
            const child
            of row.tokens
        ) {

            if (
                !child.childType
            ) {

                continue;

            }


            const group =
                findParentGroup(
                    child,
                    groups
                );


            if (!group) {

                relationships.push({

                    row:
                        row.row,

                    childText:
                        child.text,

                    childType:
                        child.childType,

                    childPosition:
                        child.start,

                    parent:
                        null,

                    logicalField:
                        null,

                    confidence:
                        0,

                    status:
                        "UNMATCHED"

                });

                continue;

            }


            const logicalField =
                makeLogicalChildField(
                    group.parentField,
                    child.childType
                );


            relationships.push({

                row:
                    row.row,

                childText:
                    child.text,

                childType:
                    child.childType,

                childPosition:
                    child.start,

                childCenter:
                    child.center,

                parentText:
                    group.parentText,

                parentField:
                    group.parentField,

                parentPosition:
                    group.parentStart,

                parentCenter:
                    group.parentCenter,

                groupLeft:
                    group.leftBoundary,

                groupRight:
                    group.rightBoundary,

                logicalField,

                confidence:
                    logicalField
                        ? 100
                        : 0,

                status:
                    logicalField
                        ? "MATCHED"
                        : "UNMATCHED"

            });


            group.children.push(
                child
            );

        }

    }


    return {

        success: true,

        groups,

        relationships

    };

}


// ============================================================
// BUILD COMPLETE STRUCTURE
// ============================================================

function buildStructure(
    analysis
) {

    const relationshipResult =
        inferParentChild(
            analysis
        );


    const directFields = [];


    if (
        analysis &&
        Array.isArray(
            analysis.rows
        )
    ) {

        for (
            const row
            of analysis.rows
        ) {

            for (
                const token
                of row.tokens
            ) {

                if (
                    token.field &&
                    !token.childType &&
                    !token.ambiguous
                ) {

                    directFields.push({

                        row:
                            token.row,

                        text:
                            token.text,

                        field:
                            token.field,

                        start:
                            token.start,

                        end:
                            token.end,

                        compound:
                            token.compound,

                        source:
                            "DIRECT"

                    });

                }

            }

        }

    }


    return {

        success:
            relationshipResult.success,

        directFields,

        groups:
            relationshipResult.groups,

        relationships:
            relationshipResult.relationships

    };

}


// ============================================================
// FIND FIELD CANDIDATES
// ============================================================

function findFieldCandidates(
    analysis,
    field
) {

    if (
        !analysis ||
        !Array.isArray(
            analysis.columns
        )
    ) {

        return [];

    }


    return analysis.columns.filter(
        column =>
            column.field === field
    );

}


// ============================================================
// FIND CHILD CANDIDATES
// ============================================================

function findChildCandidates(
    analysis,
    childType
) {

    if (
        !analysis ||
        !Array.isArray(
            analysis.columns
        )
    ) {

        return [];

    }


    return analysis.columns.filter(
        column =>
            column.childType === childType
    );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    tokenizePhysical,

    detectChildType,

    resolveCompoundField,

    isAmbiguousShortToken,

    analyzeRow,

    analyzeHeader,

    canHaveChild,

    makeLogicalChildField,

    buildParentGroups,

    findParentGroup,

    inferParentChild,

    buildStructure,

    findFieldCandidates,

    findChildCandidates

};