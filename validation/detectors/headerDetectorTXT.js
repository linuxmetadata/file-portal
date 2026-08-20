/**
 * ============================================================
 * TXT HEADER DETECTOR
 * ============================================================
 *
 * ONE universal detector for TXT files.
 *
 * Supports:
 *
 * 1. Normal single-row headers
 * 2. Multi-row headers
 * 3. Fixed-width headers
 * 4. Stock/Sales headers
 * 5. Medicine headers
 * 6. Product Name / Packing / OP / Receipts / Sales / Closing
 * 7. MEDICINE NAME / PACK / O.B / PURC / TOTAL / SALES / CL.ST
 * 8. Headerless fixed-width statements
 * 9. Repeated headers on multiple pages
 * 10. Other TXT header structures
 *
 * IMPORTANT:
 *
 * This detector does NOT create separate detectors for:
 *
 *     Panikulam
 *     Integra
 *     Infina
 *     Dermanex
 *     Senthil
 *
 * Instead it detects the actual header structure and returns
 * a common logical representation.
 *
 * ============================================================
 */

"use strict";


// ============================================================
// CONSTANTS
// ============================================================

const SEPARATOR_REGEX =
    /^[-=_]{5,}$/;

const PAGE_REGEX =
    /\bPAGE\s*[-:]?\s*\d+/i;

const FOOTER_WORDS = [

    "TOTAL",
    "GRAND TOTAL",
    "SUB TOTAL",
    "SUBTOTAL",
    "NET TOTAL",
    "NET VALUE",
    "NET AMOUNT",
    "PREPARED",
    "PREPARED BY",
    "AUTHORISED",
    "AUTHORIZED",
    "COMPUTER GENERATED",
    "POWERED BY",
    "REPLACEMENT VALUE",
    "FREE PRODUCT VALUE"

];


// ============================================================
// NORMALIZE
// ============================================================

function normalizeText(value) {

    return String(
        value == null
            ? ""
            : value
    )
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\f/g, "")
    .replace(/\s+/g, " ")
    .trim();

}


// ============================================================
// NORMALIZE HEADER TOKEN
// ============================================================

function normalizeHeader(value) {

    return normalizeText(value)

        .toUpperCase()

        .replace(/[<>{}\[\]()]/g, " ")

        .replace(/[-_./]+/g, " ")

        .replace(/\s+/g, " ")

        .trim();

}


// ============================================================
// HEADER TOKEN TEST
// ============================================================

function containsAny(
    text,
    words
) {

    const upper =
        normalizeHeader(text);

    return words.some(
        word =>
            upper.includes(
                normalizeHeader(word)
            )
    );

}


// ============================================================
// SEPARATOR
// ============================================================

function isSeparatorLine(
    line
) {

    const text =
        String(
            line == null
                ? ""
                : line
        ).trim();

    if (!text) {
        return false;
    }

    return SEPARATOR_REGEX.test(
        text
    );

}


// ============================================================
// PAGE LINE
// ============================================================

function isPageLine(
    line
) {

    const text =
        normalizeText(line);

    return PAGE_REGEX.test(
        text
    );

}


// ============================================================
// FOOTER
// ============================================================

function isFooterLine(
    line
) {

    const text =
        normalizeHeader(line);

    if (!text) {
        return false;
    }

    return FOOTER_WORDS.some(
        word => {

            const normalized =
                normalizeHeader(word);

            return (

                text === normalized ||

                text.startsWith(
                    normalized + " "
                ) ||

                text.startsWith(
                    normalized + ":"
                )

            );

        }
    );

}


// ============================================================
// PRODUCT WORDS
// ============================================================

function looksLikeProductHeader(
    text
) {

    return containsAny(
        text,
        [

            "PRODUCT",
            "PRODUCT NAME",
            "PRODUCT DESCRIPTION",
            "ITEM",
            "ITEM NAME",
            "ITEM DESCRIPTION",
            "MEDICINE",
            "MEDICINE NAME",
            "PARTICULARS",
            "DESCRIPTION",
            "NAME"

        ]
    );

}


// ============================================================
// PACKING
// ============================================================

function looksLikePackingHeader(
    text
) {

    return containsAny(
        text,
        [

            "PACK",
            "PACKING",
            "PKG",
            "PACKING SIZE"

        ]
    );

}


// ============================================================
// OPENING
// ============================================================

function looksLikeOpeningHeader(
    text
) {

    return (

        /\bO\.?\s*B\.?\b/i.test(text) ||

        /\bOP\b/i.test(text) ||

        /\bOPENING\b/i.test(text) ||

        /\bOPEN\b/i.test(text)

    );

}


// ============================================================
// PURCHASE
// ============================================================

function looksLikePurchaseHeader(
    text
) {

    return containsAny(
        text,
        [

            "PURC",
            "PURCHASE",
            "PURCHASE QTY",
            "RECEIPT",
            "RECEIPTS",
            "RECEIPT QTY",
            "RECEIPTS QTY"

        ]
    );

}


// ============================================================
// SALES
// ============================================================

function looksLikeSalesHeader(
    text
) {

    return containsAny(
        text,
        [

            "SALES",
            "SALE",
            "L_SLE",
            "L SLE",
            "SALES QTY",
            "SALES VALUE",
            "SAL"

        ]
    );

}


// ============================================================
// CLOSING
// ============================================================

function looksLikeClosingHeader(
    text
) {

    return (

        /\bCL\.?\s*ST\b/i.test(text) ||

        /\bCLST\b/i.test(
            normalizeHeader(text)
        ) ||

        /\bCLOSING\b/i.test(text) ||

        /\bCLOSE\b/i.test(text)

    );

}


// ============================================================
// VALUE
// ============================================================

function looksLikeValueHeader(
    text
) {

    return containsAny(
        text,
        [

            "VALUE",
            "VAL",
            "SAL.VAL",
            "SAL VAL",
            "CLST.VAL",
            "CLST VAL"

        ]
    );

}


// ============================================================
// QTY
// ============================================================

function looksLikeQtyHeader(
    text
) {

    return containsAny(
        text,
        [

            "QTY",
            "QUANTITY"

        ]
    );

}


// ============================================================
// ADJUSTMENT
// ============================================================

function looksLikeAdjustmentHeader(
    text
) {

    return containsAny(
        text,
        [

            "ADJ",
            "ADJUSTMENT"

        ]
    );

}


// ============================================================
// MOVEMENT HEADER SCORE
// ============================================================

function movementScore(
    text
) {

    let score = 0;

    if (
        looksLikeProductHeader(text)
    ) {
        score += 80;
    }

    if (
        looksLikePackingHeader(text)
    ) {
        score += 50;
    }

    if (
        looksLikeOpeningHeader(text)
    ) {
        score += 80;
    }

    if (
        looksLikePurchaseHeader(text)
    ) {
        score += 80;
    }

    if (
        looksLikeSalesHeader(text)
    ) {
        score += 80;
    }

    if (
        looksLikeClosingHeader(text)
    ) {
        score += 80;
    }

    if (
        looksLikeValueHeader(text)
    ) {
        score += 40;
    }

    if (
        looksLikeQtyHeader(text)
    ) {
        score += 40;
    }

    if (
        looksLikeAdjustmentHeader(text)
    ) {
        score += 30;
    }

    return score;

}


// ============================================================
// HEADER CANDIDATE
// ============================================================

function isHeaderCandidate(
    line
) {

    const text =
        normalizeText(line);

    if (!text) {
        return false;
    }

    if (
        isSeparatorLine(text)
    ) {
        return false;
    }

    if (
        isPageLine(text)
    ) {
        return false;
    }

    if (
        isFooterLine(text)
    ) {
        return false;
    }

    const score =
        movementScore(text);

    return score >= 80;

}


// ============================================================
// HEADER TYPE
// ============================================================

function classifyHeader(
    lines
) {

    const text =
        lines
            .map(normalizeText)
            .join(" ");

    const upper =
        normalizeHeader(text);

    //--------------------------------------------------------
    // MEDICINE
    //--------------------------------------------------------

    if (

        /\bMEDICINE\s+NAME\b/.test(
            upper
        )

        &&

        /\bPACK\b/.test(
            upper
        )

        &&

        /\bO\s+B\b/.test(
            upper
        )

        &&

        /\bPURC\b/.test(
            upper
        )

        &&

        /\bTOTAL\b/.test(
            upper
        )

        &&

        /\bSALES\b/.test(
            upper
        )

        &&

        /\bCL\s*ST\b/.test(
            upper
        )

    ) {

        return {

            detection:
                "MEDICINE_STOCK_SALES",

            confidence:
                950

        };

    }


    //--------------------------------------------------------
    // PRODUCT NAME FIXED WIDTH
    //--------------------------------------------------------

    if (

        /\bPRODUCT\s+NAME\b/.test(
            upper
        )

        &&

        /\bPACKING\b/.test(
            upper
        )

        &&

        /\bOP\b/.test(
            upper
        )

        &&

        /\bRECEIPTS\b/.test(
            upper
        )

        &&

        /\bSALES\b/.test(
            upper
        )

        &&

        /\bCLOSING\b/.test(
            upper
        )

    ) {

        return {

            detection:
                "FIXED_WIDTH_PRODUCT_NAME",

            confidence:
                950

        };

    }


    //--------------------------------------------------------
    // PARTICULARS / PKG
    //--------------------------------------------------------

    if (

        /\bPARTICULARS\b/.test(
            upper
        )

        &&

        /\bPKG\b/.test(
            upper
        )

        &&

        /\bOP\b/.test(
            upper
        )

        &&

        /\bPR\b/.test(
            upper
        )

        &&

        /\bCL\b/.test(
            upper
        )

    ) {

        return {

            detection:
                "FIXED_WIDTH_PARTICULARS",

            confidence:
                900

        };

    }


    //--------------------------------------------------------
    // GENERIC STOCK SALES
    //--------------------------------------------------------

    const score =
        movementScore(text);

    if (
        score >= 300
    ) {

        return {

            detection:
                "STOCK_SALES",

            confidence:
                Math.min(
                    850,
                    score
                )

        };

    }


    //--------------------------------------------------------
    // GENERIC HEADER
    //--------------------------------------------------------

    if (
        score >= 150
    ) {

        return {

            detection:
                "GENERIC_STOCK_HEADER",

            confidence:
                score

        };

    }


    return null;

}


// ============================================================
// FIND PRODUCT COLUMN
// ============================================================

function findProductColumn(
    headerLines
) {

    const text =
        headerLines
            .map(normalizeHeader)
            .join(" ");

    //--------------------------------------------------------
    // Most common case
    //--------------------------------------------------------

    if (
        /\bMEDICINE\s+NAME\b/.test(
            text
        )
    ) {

        return 0;

    }

    if (
        /\bPRODUCT\s+NAME\b/.test(
            text
        )
    ) {

        return 0;

    }

    if (
        /\bPARTICULARS\b/.test(
            text
        )
    ) {

        return 0;

    }

    if (
        /\bITEM\b/.test(
            text
        )
    ) {

        return 0;

    }

    if (
        /\bDESCRIPTION\b/.test(
            text
        )
    ) {

        return 0;

    }

    return 0;

}


// ============================================================
// FIND FIXED WIDTH POSITIONS
// ============================================================

function findKeywordPosition(
    lines,
    patterns
) {

    for (
        const line of lines
    ) {

        const raw =
            String(
                line == null
                    ? ""
                    : line
            );

        for (
            const pattern of patterns
        ) {

            const match =
                raw.match(pattern);

            if (
                match &&
                match.index !== undefined
            ) {

                return match.index;

            }

        }

    }

    return null;

}


// ============================================================
// FIXED WIDTH MAPPING
// ============================================================

function detectFixedWidthPositions(
    headerLines,
    detection
) {

    const result = {

        product:
            0,

        productDescription:
            0,

        productCode:
            null,

        packing:
            null,

        opening:
            null,

        purchase:
            null,

        purchaseValue:
            null,

        sales:
            null,

        salesValue:
            null,

        closing:
            null,

        closingValue:
            null,

        adjustment:
            null

    };


    //--------------------------------------------------------
    // Product
    //--------------------------------------------------------

    result.product =
        findKeywordPosition(
            headerLines,
            [

                /PRODUCT\s+NAME/i,
                /MEDICINE\s+NAME/i,
                /PARTICULARS/i,
                /ITEM\s+NAME/i,
                /ITEM\s+DESCRIPTION/i

            ]
        );

    if (
        result.product === null
    ) {

        result.product = 0;

    }

    result.productDescription =
        result.product;


    //--------------------------------------------------------
    // Packing
    //--------------------------------------------------------

    result.packing =
        findKeywordPosition(
            headerLines,
            [

                /\bPACKING\b/i,
                /\bPACK\b/i,
                /\bPKG\b/i

            ]
        );


    //--------------------------------------------------------
    // Opening
    //--------------------------------------------------------

    result.opening =
        findKeywordPosition(
            headerLines,
            [

                /\bO\.?\s*B\.?\b/i,
                /\bOP\b/i,
                /\bOPENING\b/i

            ]
        );


    //--------------------------------------------------------
    // Purchase / Receipts
    //--------------------------------------------------------

    result.purchase =
        findKeywordPosition(
            headerLines,
            [

                /\bPURC\b/i,
                /\bPURCHASE\b/i,
                /\bRECEIPTS\b/i,
                /\bRECEIPT\b/i

            ]
        );


    //--------------------------------------------------------
    // Sales
    //--------------------------------------------------------

    result.sales =
        findKeywordPosition(
            headerLines,
            [

                /\bSALES\b/i,
                /\bSALE\b/i

            ]
        );


    //--------------------------------------------------------
    // Adjustment
    //--------------------------------------------------------

    result.adjustment =
        findKeywordPosition(
            headerLines,
            [

                /\bADJ\b/i,
                /\bADJUSTMENT\b/i

            ]
        );


    //--------------------------------------------------------
    // Closing
    //--------------------------------------------------------

    result.closing =
        findKeywordPosition(
            headerLines,
            [

                /\bCL\.?\s*ST\b/i,
                /\bCLST\b/i,
                /\bCLOSING\b/i

            ]
        );


    //--------------------------------------------------------
    // Value positions
    //
    // We deliberately use the logical ordering of the
    // fixed-width stock statement instead of treating every
    // VALUE word as a separate header.
    //--------------------------------------------------------

    const valuePositions = [];


    for (
        const line of headerLines
    ) {

        const raw =
            String(
                line == null
                    ? ""
                    : line
            );

        const regex =
            /\b(?:VALUE|VAL)\b/gi;

        let match;

        while (
            (match =
                regex.exec(raw))
        ) {

            valuePositions.push(
                match.index
            );

        }

    }


    //--------------------------------------------------------
    // SAL.VAL / CLST.VAL
    //--------------------------------------------------------

    const salesValue =
        findKeywordPosition(
            headerLines,
            [

                /SAL\.?\s*VAL/i,
                /SALES\s+VALUE/i

            ]
        );

    const closingValue =
        findKeywordPosition(
            headerLines,
            [

                /CLST\.?\s*VAL/i,
                /CL\.?\s*ST\.?\s*VAL/i,
                /CLOSING\s+VALUE/i

            ]
        );


    if (
        salesValue !== null
    ) {

        result.salesValue =
            salesValue;

    }


    if (
        closingValue !== null
    ) {

        result.closingValue =
            closingValue;

    }


    //--------------------------------------------------------
    // PRODUCT NAME + OP + RECEIPTS + SALES + CLOSING
    //
    // For two-row fixed width headers the value columns are
    // normally positioned after their corresponding QTY.
    //
    // We infer them from the second header row.
    //--------------------------------------------------------

    if (

        detection ===
            "FIXED_WIDTH_PRODUCT_NAME"

    ) {

        const combined =
            headerLines.join("\n");


        //----------------------------------------------------
        // Known structure from sample:
        //
        // Product Name               Packing       OP
        // <---Receipts---> <----Sales---->
        // <---Closing---->
        //
        // Qty    Qty     Value
        // Qty     Value
        // Qty      Value
        //----------------------------------------------------

        if (
            result.opening === null
        ) {

            result.opening = 41;

        }

        if (
            result.packing === null
        ) {

            result.packing = 27;

        }

        if (
            result.purchase === null
        ) {

            result.purchase = 48;

        }

        if (
            result.sales === null
        ) {

            result.sales = 67;

        }

        if (
            result.closing === null
        ) {

            result.closing = 83;

        }

        if (
            result.purchaseValue === null
        ) {

            result.purchaseValue = 55;

        }

        if (
            result.salesValue === null
        ) {

            result.salesValue = 74;

        }

        if (
            result.closingValue === null
        ) {

            result.closingValue = 90;

        }

    }


    //--------------------------------------------------------
    // MEDICINE FORMAT
    //
    // MEDICINE NAME PACK O.B PURC TOTAL L_SLE ADJ SALES
    // SAL.VAL CL.ST CLST.VAL
    //--------------------------------------------------------

    if (

        detection ===
            "MEDICINE_STOCK_SALES"

    ) {

        if (
            result.packing === null
        ) {

            result.packing =
                findKeywordPosition(
                    headerLines,
                    [/\bPACK\b/i]
                );

        }

        if (
            result.opening === null
        ) {

            result.opening =
                findKeywordPosition(
                    headerLines,
                    [/\bO\.?\s*B\.?\b/i]
                );

        }

        if (
            result.purchase === null
        ) {

            result.purchase =
                findKeywordPosition(
                    headerLines,
                    [/\bPURC\b/i]
                );

        }

        if (
            result.sales === null
        ) {

            result.sales =
                findKeywordPosition(
                    headerLines,
                    [/\bSALES\b/i]
                );

        }

        if (
            result.closing === null
        ) {

            result.closing =
                findKeywordPosition(
                    headerLines,
                    [/\bCL\.?\s*ST\b/i]
                );

        }

    }


    return result;

}


// ============================================================
// FIND HEADER BLOCK
// ============================================================

function findHeaderBlock(
    lines
) {

    const candidates = [];


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            normalizeText(
                lines[i]
            );

        if (!line) {
            continue;
        }

        if (
            !isHeaderCandidate(
                line
            )
        ) {

            continue;

        }


        //----------------------------------------------------
        // Candidate
        //----------------------------------------------------

        const block = [

            line

        ];


        //----------------------------------------------------
        // Include following header-like line
        //----------------------------------------------------

        for (
            let j = i + 1;
            j < Math.min(
                lines.length,
                i + 4
            );
            j++
        ) {

            const next =
                normalizeText(
                    lines[j]
                );

            if (!next) {
                continue;
            }

            if (
                isSeparatorLine(
                    next
                )
            ) {

                continue;

            }

            if (
                isPageLine(
                    next
                )
            ) {

                break;

            }

            if (
                isFooterLine(
                    next
                )
            ) {

                break;

            }


            const nextScore =
                movementScore(
                    next
                );


            //------------------------------------------------
            // QTY / VALUE continuation
            //------------------------------------------------

            if (

                looksLikeQtyHeader(
                    next
                )

                ||

                looksLikeValueHeader(
                    next
                )

                ||

                nextScore >= 40

            ) {

                block.push(
                    next
                );

            }
            else {

                break;

            }

        }


        const classification =
            classifyHeader(
                block
            );


        if (
            classification
        ) {

            candidates.push({

                headerStart:
                    i + 1,

                headerEnd:
                    i +
                    block.length,

                headerLines:
                    block,

                detection:
                    classification.detection,

                confidence:
                    classification.confidence

            });

        }

    }


    //--------------------------------------------------------
    // Best candidate
    //--------------------------------------------------------

    if (
        !candidates.length
    ) {

        return null;

    }


    candidates.sort(
        (
            a,
            b
        ) => {

            if (
                b.confidence !==
                a.confidence
            ) {

                return (
                    b.confidence -
                    a.confidence
                );

            }

            return (
                a.headerStart -
                b.headerStart
            );

        }
    );


    return candidates[0];

}


// ============================================================
// HEADERLESS DETECTION
// ============================================================

function detectHeaderless(
    lines
) {

    //--------------------------------------------------------
    // Find a separator followed by product-looking data.
    //--------------------------------------------------------

    for (
        let i = 0;
        i < lines.length - 1;
        i++
    ) {

        if (
            !isSeparatorLine(
                lines[i]
            )
        ) {

            continue;

        }


        const next =
            normalizeText(
                lines[i + 1]
            );


        if (!next) {
            continue;
        }


        //----------------------------------------------------
        // Product data normally contains:
        //
        // text + numeric values
        //----------------------------------------------------

        const hasText =
            /[A-Za-z]/.test(
                next
            );

        const hasNumeric =
            /(?:\d|\-\-\-)/.test(
                next
            );


        if (
            hasText &&
            hasNumeric
        ) {

            return {

                headerStart:
                    i + 1,

                headerEnd:
                    i + 1,

                dataStart:
                    i + 2,

                detection:
                    "HEADERLESS_FIXED_WIDTH",

                confidence:
                    500,

                headerLines: []

            };

        }

    }


    return null;

}


// ============================================================
// FIND DATA START
// ============================================================

function findDataStart(
    lines,
    headerEnd
) {

    //--------------------------------------------------------
    // Start after header.
    //--------------------------------------------------------

    for (
        let i = headerEnd;
        i < lines.length;
        i++
    ) {

        const line =
            normalizeText(
                lines[i]
            );

        if (!line) {
            continue;
        }

        if (
            isSeparatorLine(
                line
            )
        ) {

            continue;

        }

        if (
            isPageLine(
                line
            )
        ) {

            continue;

        }

        if (
            isHeaderCandidate(
                line
            )
        ) {

            continue;

        }

        if (
            isFooterLine(
                line
            )
        ) {

            continue;

        }

        return i + 1;

    }


    return null;

}


// ============================================================
// UNIVERSAL DETECTOR
// ============================================================

function detectTXTHeader(
    input
) {

    //--------------------------------------------------------
    // ACCEPT:
    //
    // 1. Array of lines
    // 2. txtReader result.lines
    // 3. txtReader result.rows
    // 4. txtReader result.data
    // 5. txtReader result.records
    //
    //--------------------------------------------------------

    let lines = null;


    if (
        Array.isArray(
            input
        )
    ) {

        lines =
            input;

    }

    else if (
        input &&
        Array.isArray(
            input.lines
        )
    ) {

        lines =
            input.lines;

    }

    else if (
        input &&
        Array.isArray(
            input.rows
        )
    ) {

        lines =
            input.rows;

    }

    else if (
        input &&
        Array.isArray(
            input.data
        )
    ) {

        lines =
            input.data;

    }

    else if (
        input &&
        Array.isArray(
            input.records
        )
    ) {

        lines =
            input.records;

    }


    //--------------------------------------------------------
    // SAFETY
    //--------------------------------------------------------

    if (
        !Array.isArray(
            lines
        )
    ) {

        return {

            success:
                false,

            found:
                false,

            detection:
                null,

            confidence:
                0,

            headerStart:
                null,

            headerEnd:
                null,

            productColumn:
                null,

            dataStart:
                null,

            dataStarts:
                null,

            headerless:
                false,

            headerText:
                "",

            headers:
                [],

            headerLines:
                [],

            positions:
                null,

            message:
                "TXT detector expected an array of lines."

        };

    }


    //--------------------------------------------------------
    // Convert all values to strings
    //--------------------------------------------------------

    lines =
        lines.map(
            value => {

                if (
                    typeof value ===
                    "object" &&

                    value !== null
                ) {

                    if (
                        value.text !==
                        undefined
                    ) {

                        return String(
                            value.text
                        );

                    }

                    if (
                        value.raw !==
                        undefined
                    ) {

                        return String(
                            value.raw
                        );

                    }

                }

                return String(
                    value == null
                        ? ""
                        : value
                );

            }
        );


    //--------------------------------------------------------
    // DEBUG
    //--------------------------------------------------------

    console.log("");

    console.log(
        "========== TXT HEADER DETECTOR =========="
    );


    //--------------------------------------------------------
    // Find normal header
    //--------------------------------------------------------

    const header =
        findHeaderBlock(
            lines
        );


    //--------------------------------------------------------
    // Headerless fallback
    //--------------------------------------------------------

    if (
        !header
    ) {

        const headerless =
            detectHeaderless(
                lines
            );


        if (
            headerless
        ) {

            console.log(
                "Detection      :",
                headerless.detection
            );

            console.log(
                "Header Start   :",
                headerless.headerStart
            );

            console.log(
                "Header End     :",
                headerless.headerEnd
            );

            console.log(
                "Product Column :",
                0
            );

            console.log(
                "Data Starts    :",
                headerless.dataStart
            );

            console.log(
                "Confidence     :",
                headerless.confidence
            );

            console.log(
                "=========================================="
            );


            return {

                success:
                    true,

                found:
                    true,

                detection:
                    headerless.detection,

                confidence:
                    headerless.confidence,

                headerStart:
                    headerless.headerStart,

                headerEnd:
                    headerless.headerEnd,

                productColumn:
                    0,

                dataStart:
                    headerless.dataStart,

                dataStarts:
                    headerless.dataStart,

                headerless:
                    true,

                headerText:
                    "",

                headers:
                    [],

                headerLines:
                    [],

                positions:
                    detectFixedWidthPositions(
                        [],
                        headerless.detection
                    ),

                message:
                    ""

            };

        }


        //----------------------------------------------------
        // Nothing found
        //----------------------------------------------------

        console.log(
            "No TXT header detected."
        );

        console.log(
            "=========================================="
        );


        return {

            success:
                true,

            found:
                false,

            detection:
                null,

            confidence:
                0,

            headerStart:
                null,

            headerEnd:
                null,

            productColumn:
                null,

            dataStart:
                null,

            dataStarts:
                null,

            headerless:
                false,

            headerText:
                "",

            headers:
                [],

            headerLines:
                [],

            positions:
                null,

            message:
                "TXT header not detected."

        };

    }


    //--------------------------------------------------------
    // Product column
    //--------------------------------------------------------

    const productColumn =
        findProductColumn(
            header.headerLines
        );


    //--------------------------------------------------------
    // Data start
    //--------------------------------------------------------

    const dataStart =
        findDataStart(
            lines,
            header.headerEnd
        );


    //--------------------------------------------------------
    // Positions
    //--------------------------------------------------------

    const positions =
        detectFixedWidthPositions(
            header.headerLines,
            header.detection
        );


    //--------------------------------------------------------
    // Header text
    //--------------------------------------------------------

    const headerText =
        header.headerLines
            .join(" ")
            .trim();


    //--------------------------------------------------------
    // Output
    //--------------------------------------------------------

    console.log(
        "Detection      :",
        header.detection
    );

    console.log(
        "Header Start   :",
        header.headerStart
    );

    console.log(
        "Header End     :",
        header.headerEnd
    );

    console.log(
        "Product Column :",
        productColumn
    );

    console.log(
        "Data Starts    :",
        dataStart
    );

    console.log(
        "Confidence     :",
        header.confidence
    );

    console.log(
        "Header Lines   :"
    );


    header.headerLines.forEach(
        (
            line,
            index
        ) => {

            console.log(

                `${header.headerStart + index}: ${line}`

            );

        }
    );


    console.log(
        "=========================================="
    );


    return {

        success:
            true,

        found:
            true,

        detection:
            header.detection,

        confidence:
            header.confidence,

        headerStart:
            header.headerStart,

        headerEnd:
            header.headerEnd,

        productColumn:
            productColumn,

        dataStart:
            dataStart,

        dataStarts:
            dataStart,

        headerless:
            false,

        headerText:
            headerText,

        headers:
            header.headerLines,

        headerLines:
            header.headerLines,

        positions:
            positions,

        message:
            ""

    };

}


// ============================================================
// ALIAS
// ============================================================

const detectHeader =
    detectTXTHeader;


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    detectTXTHeader,

    detectHeader,

    normalizeText,

    normalizeHeader,

    isSeparatorLine,

    isHeaderCandidate,

    classifyHeader,

    findProductColumn,

    detectFixedWidthPositions

};