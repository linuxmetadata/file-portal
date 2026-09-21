/**
 * ======================================================
 * FIXED WIDTH LAYOUT DETECTOR
 * ======================================================
 *
 * Detects logical columns inside a single fixed-width
 * text line.
 *
 * Example:
 *
 * PRODUCT NAME        PACKG   OPENING   PUR   SALES   CLOSING
 *
 * The physical worksheet may contain everything in:
 *
 * row[0]
 *
 * Therefore normal Excel column mapping cannot be used.
 *
 * This module detects the character positions of the
 * logical columns and allows the extractor to read
 * product rows using the same positions.
 * ======================================================
 */

// ======================================================
// NORMALIZE HEADER TEXT
// ======================================================

function normalize(value) {

    return String(value ?? "")
        .toUpperCase()
        .replace(/\r?\n/g, " ")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


// ======================================================
// HEADER ALIASES
// ======================================================

const FIELD_ALIASES = {

    product: [

        "PRODUCT NAME",
        "PRODUCTNAME",
        "PRODUCT DESCRIPTION",
        "PRODUCT DESC",
        "ITEM NAME",
        "ITEMNAME",
        "ITEM DESCRIPTION",
        "ITEM DESC",
        "DESCRIPTION",
        "PARTICULARS",
        "PARTICULAR",
        "MEDICINE",
        "DRUG"

    ],

    opening: [

        "OPENING STOCK",
        "OPENING",
        "OPEN STOCK",
        "OPENING QTY",
        "OPEN QTY",
        "OP STOCK",
        "OP STK",
        "OP QTY",
        "OPQTY",
        "OSTOCK",
        "O STK",
        "O STOCK"

    ],

    purchase: [

        "PURCHASE",
        "PURCHASES",
        "PURCHASE QTY",
        "PUR QTY",
        "PURQTY",
        "PUR",
        "RECEIPT",
        "RECEIPTS",
        "RCPT",
        "RCVD",
        "RECEIVED",
        "INWARD"

    ],

    purchaseReturn: [

        "PURCHASE RETURN",
        "PURCHASE RET",
        "PUR RET",
        "PUR RETN",
        "P RETURN",
        "P RET"

    ],

    sales: [

        "SALES",
        "SALE",
        "SALES QTY",
        "SALE QTY",
        "S QTY",
        "SQTY",
        "ISSUE",
        "ISSUED",
        "OUTWARD"

    ],

    salesReturn: [

        "SALES RETURN",
        "SALE RETURN",
        "SALES RET",
        "SALE RET",
        "SAL RET",
        "S RET",
        "SRETUR"

    ],

    free: [

        "FREE",
        "FREE QTY",
        "BONUS",
        "SCHEME",
        "FQTY",
        "FREEQTY"

    ],

    replacement: [

        "REPLACEMENT",
        "REPL",
        "REPLACE",
        "RPL QTY",
        "RPLQTY"

    ],

    closing: [

        "CLOSING STOCK",
        "CLOSING",
        "CLOSE STOCK",
        "CLOSE",
        "CLOSING QTY",
        "CL STOCK",
        "CL STK",
        "CLSTK",
        "CL QTY",
        "STOCK",
        "BALANCE",
        "BAL"

    ],

    rate: [

        "RATE",
        "PRICE",
        "PTR",
        "PTS",
        "MRP",
        "P RATE",
        "PRATE"

    ],

    value: [

        "VALUE",
        "VAL",
        "AMOUNT",
        "SALES VALUE",
        "SALE VALUE",
        "CLOSING VALUE",
        "CL VALUE",
        "CL VAL",
        "SAL VAL"

    ],

    pack: [

        "PACKING",
        "PACK",
        "PACKG",
        "PACKSIZE",
        "PACK SIZE"

    ],

    code: [

        "CODE",
        "ITEM CODE",
        "ITEMCODE",
        "PRODUCT CODE",
        "PRODUCTCODE",
        "PRODUCT NO",
        "PRODUCTNO",
        "ITEM NO",
        "ITEMNO"

    ]

};


// ======================================================
// COMPACT
// ======================================================

function compact(value) {

    return normalize(value)
        .replace(/[^A-Z0-9]/g, "");

}


// ======================================================
// FIND ALIAS
// ======================================================

function aliasMatches(text, alias) {

    const normalizedText =
        normalize(text);

    const normalizedAlias =
        normalize(alias);

    if (!normalizedText || !normalizedAlias)
        return false;

    if (
        normalizedText === normalizedAlias
    ) {
        return true;
    }

    if (
        compact(normalizedText) ===
        compact(normalizedAlias)
    ) {
        return true;
    }

    return false;

}


// ======================================================
// FIND HEADER POSITION
// ======================================================
//
// We search the physical header text for each logical
// header.
//
// Example:
//
// "PRODUCT NAME          PACKG       OPENING"
//
// returns:
//
// product -> position 0
// pack    -> position 21
// opening -> position 32
//
// ======================================================

function findFieldPosition(headerText, aliases) {

    const text =
        normalize(headerText);

    if (!text)
        return null;

    let best = null;

    for (const alias of aliases) {

        const normalizedAlias =
            normalize(alias);

        if (!normalizedAlias)
            continue;

        //------------------------------------------------
        // Direct search
        //------------------------------------------------

        let position =
            text.indexOf(normalizedAlias);

        if (position >= 0) {

            if (
                !best ||
                normalizedAlias.length >
                best.length
            ) {

                best = {

                    position,

                    length:
                        normalizedAlias.length,

                    alias:
                        normalizedAlias

                };

            }

        }

        //------------------------------------------------
        // Compact search
        //------------------------------------------------

        const compactAlias =
            compact(alias);

        if (!compactAlias)
            continue;

        let compactPosition = -1;

        let compactCount = 0;

        for (
            let i = 0;
            i < text.length;
            i++
        ) {

            if (
                /[A-Z0-9]/.test(text[i])
            ) {

                compactCount++;

            }

            const candidate =
                compact(
                    text.slice(
                        0,
                        i + 1
                    )
                );

            if (
                candidate.endsWith(
                    compactAlias
                )
            ) {

                compactPosition =
                    i + 1 -
                    compactAlias.length;

                break;

            }

        }

        if (
            compactPosition >= 0 &&
            (
                !best ||
                compactAlias.length >
                compact(
                    best.alias
                ).length
            )
        ) {

            best = {

                position:
                    compactPosition,

                length:
                    compactAlias.length,

                alias:
                    normalizedAlias

            };

        }

    }

    return best;

}


// ======================================================
// DETECT ALL HEADER POSITIONS
// ======================================================

function detectHeaderPositions(headerText) {

    const result = {

        product: null,

        opening: null,

        purchase: null,

        purchaseReturn: null,

        sales: null,

        salesReturn: null,

        free: null,

        replacement: null,

        closing: null,

        rate: null,

        value: null,

        pack: null,

        code: null

    };


    for (
        const field of Object.keys(FIELD_ALIASES)
    ) {

        const match =
            findFieldPosition(
                headerText,
                FIELD_ALIASES[field]
            );

        if (!match)
            continue;

        result[field] = {

            start:
                match.position,

            headerLength:
                match.length,

            header:
                match.alias

        };

    }

    return result;

}


// ======================================================
// SORT DETECTED FIELDS
// ======================================================

function sortedFields(layout) {

    return Object.entries(layout)

        .filter(
            ([, value]) =>
                value &&
                Number.isInteger(value.start)
        )

        .sort(
            (a, b) =>
                a[1].start -
                b[1].start
        );

}


// ======================================================
// BUILD FIELD BOUNDARIES
// ======================================================
//
// Each field extends until the next detected header.
//
// Example:
//
// PRODUCT | OPENING | PURCHASE | SALES
//
// PRODUCT starts at 0
// OPENING starts at 20
//
// Therefore product occupies:
//
// 0 -> 20
//
// ======================================================

function buildBoundaries(layout, headerLength) {

    const fields =
        sortedFields(layout);

    const boundaries = {};

    for (
        let i = 0;
        i < fields.length;
        i++
    ) {

        const [
            field,
            info
        ] = fields[i];

        const next =
            fields[i + 1];

        const start =
            info.start;

        let end =
            headerLength;

        if (next) {

            end =
                next[1].start;

        }

        if (end <= start) {

            end =
                start +
                Math.max(
                    info.headerLength,
                    1
                );

        }

        boundaries[field] = {

            start,

            end,

            width:
                end - start

        };

    }

    return boundaries;

}


// ======================================================
// EXTRACT FIXED-WIDTH FIELD
// ======================================================

function readFixedField(
    rowText,
    boundary
) {

    if (!boundary)
        return "";

    if (!rowText)
        return "";

    let start =
        boundary.start;

    let end =
        boundary.end;

    //------------------------------------------------
    // If row is shorter than start, field is empty.
    //------------------------------------------------

    if (
        start >= rowText.length
    ) {

        return "";

    }

    //------------------------------------------------
    // Don't go outside row.
    //------------------------------------------------

    end =
        Math.min(
            end,
            rowText.length
        );

    return rowText
        .slice(start, end)
        .trim();

}


// ======================================================
// NUMBER
// ======================================================

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }

    const text =
        String(value)
            .replace(/,/g, "")
            .replace(/%/g, "")
            .trim();

    if (!text)
        return 0;

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : 0;

}


// ======================================================
// DETECT NUMERIC TAIL
// ======================================================
//
// Used when fixed-width spacing is not perfectly aligned.
//
// Example:
//
// PRODUCT NAME 10'S  20  50  30  40
//
// If a field doesn't align exactly, the parser can
// still use the numeric tail as a secondary fallback.
//
// ======================================================

function numericTail(text) {

    const tokens =
        String(text || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const values = [];

    for (
        let i = tokens.length - 1;
        i >= 0;
        i--
    ) {

        const token =
            tokens[i]
                .replace(/,/g, "");

        if (
            /^-?\d+(?:\.\d+)?$/.test(token) ||
            /^-+$/.test(token)
        ) {

            values.unshift(token);

        }
        else {

            break;

        }

    }

    return values;

}


// ======================================================
// READ FIXED WIDTH ROW
// ======================================================

function parseFixedWidthRow(
    rowText,
    layout
) {

    const text =
        String(rowText ?? "")
            .replace(/\u0000/g, "")
            .replace(/\r?\n/g, " ");

    if (!text.trim())
        return null;


    const record = {

        product: "",

        opening: 0,

        purchase: 0,

        purchaseFree: 0,

        purchaseReturn: 0,

        sales: 0,

        salesReturn: 0,

        free: 0,

        replacement: 0,

        closing: 0,

        rate: 0,

        value: 0,

        pack: "",

        productCode: ""

    };


    //--------------------------------------------------
    // Read fields using header positions
    //--------------------------------------------------

    for (
        const field of Object.keys(
            layout.boundaries
        )
    ) {

        const value =
            readFixedField(
                text,
                layout.boundaries[field]
            );

        if (!value)
            continue;


        switch (field) {

            case "product":

                record.product =
                    value;

                break;


            case "opening":

                record.opening =
                    toNumber(value);

                break;


            case "purchase":

                record.purchase =
                    toNumber(value);

                break;


            case "purchaseReturn":

                record.purchaseReturn =
                    toNumber(value);

                break;


            case "sales":

                record.sales =
                    toNumber(value);

                break;


            case "salesReturn":

                record.salesReturn =
                    toNumber(value);

                break;


            case "free":

                record.free =
                    toNumber(value);

                break;


            case "replacement":

                record.replacement =
                    toNumber(value);

                break;


            case "closing":

                record.closing =
                    toNumber(value);

                break;


            case "rate":

                record.rate =
                    toNumber(value);

                break;


            case "value":

                record.value =
                    toNumber(value);

                break;


            case "pack":

                record.pack =
                    value;

                break;


            case "code":

                record.productCode =
                    value;

                break;

        }

    }


    //--------------------------------------------------
    // PRODUCT VALIDATION
    //--------------------------------------------------

    if (
        !record.product ||
        record.product.length < 2
    ) {

        return null;

    }


    //--------------------------------------------------
    // SECONDARY NUMERIC TAIL FALLBACK
    //--------------------------------------------------
    //
    // Only use this when the layout has a product
    // field but the movement fields could not be
    // read correctly.
    //
    //--------------------------------------------------

    const tail =
        numericTail(text);

    const movementFields = [

        "opening",
        "purchase",
        "purchaseReturn",
        "sales",
        "salesReturn",
        "closing"

    ];

    let mappedMovementCount = 0;

    for (
        const field of movementFields
    ) {

        const boundary =
            layout.boundaries[field];

        if (boundary) {

            mappedMovementCount++;

        }

    }


    //--------------------------------------------------
    // Do not override valid mapped values.
    //--------------------------------------------------

    if (
        mappedMovementCount === 0 &&
        tail.length >= 2
    ) {

        const values =
            tail.map(toNumber);

        record.closing =
            values[values.length - 1];

        if (
            values.length >= 2
        ) {

            record.sales =
                values[
                    values.length - 2
                ];

        }

        if (
            values.length >= 3
        ) {

            record.purchase =
                values[
                    values.length - 3
                ];

        }

        if (
            values.length >= 4
        ) {

            record.opening =
                values[
                    values.length - 4
                ];

        }

    }


    return record;

}


// ======================================================
// MAIN DETECTOR
// ======================================================

function detectFixedWidthLayout(
    headerText
) {

    const text =
        String(headerText ?? "");

    if (!text.trim())
        return null;


    const positions =
        detectHeaderPositions(text);


    //--------------------------------------------------
    // PRODUCT IS MANDATORY
    //--------------------------------------------------

    if (!positions.product)
        return null;


    //--------------------------------------------------
    // Count movement fields
    //--------------------------------------------------

    const movementFields = [

        "opening",
        "purchase",
        "purchaseReturn",
        "sales",
        "salesReturn",
        "free",
        "replacement",
        "closing",
        "rate",
        "value"

    ];


    const movementCount =
        movementFields.filter(
            field =>
                positions[field]
        ).length;


    //--------------------------------------------------
    // Need product + at least TWO useful movement
    // fields to classify as fixed-width.
    //--------------------------------------------------

    if (
        movementCount < 2
    ) {

        return null;

    }


    //--------------------------------------------------
    // Build boundaries
    //--------------------------------------------------

    const boundaries =
        buildBoundaries(
            positions,
            text.length
        );


    //--------------------------------------------------
    // Return layout
    //--------------------------------------------------

    return {

        detected: true,

        type:
            "FIXED_WIDTH",

        header:
            text,

        positions,

        boundaries,

        movementCount,

        confidence:
            400 +
            movementCount * 20

    };

}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    detectFixedWidthLayout,

    detectHeaderPositions,

    buildBoundaries,

    parseFixedWidthRow,

    readFixedField,

    numericTail

};