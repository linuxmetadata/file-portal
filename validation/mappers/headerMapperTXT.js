"use strict";

/**
 * ============================================================
 * UNIVERSAL TXT HEADER MAPPER
 * ============================================================
 *
 * IMPORTANT:
 *
 * This mapper maps EVERY detected header column.
 *
 * It does NOT throw away columns which are not part of the
 * standard stock fields.
 *
 * Example:
 *
 * ITEMCODE ITEMNAME CLSTOCK CLVALUE SALES SALESVALUE LM 1 LM 2
 *
 * becomes:
 *
 * ITEMCODE   -> productCode
 * ITEMNAME   -> product
 * CLSTOCK    -> closing
 * CLVALUE    -> closingValue
 * SALES      -> sales
 * SALESVALUE -> salesValue
 * LM 1       -> lastMonth1
 * LM 2       -> lastMonth2
 *
 * The extractor will later use the physical positions from
 * "columns".
 *
 * ============================================================
 */


// ============================================================
// TEXT HELPERS
// ============================================================

function cleanText(value) {

    return String(value == null ? "" : value)
        .replace(/\u0000/g, "")
        .replace(/\u001b/g, " ")
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function upper(value) {

    return cleanText(value).toUpperCase();

}


function normalize(value) {

    return upper(value)
        .replace(/[<>]/g, " ")
        .replace(/[()[\]{}]/g, " ")
        .replace(/[|:;,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function tokenNormalize(value) {

    return normalize(value)
        .replace(/\s+/g, "");
}


// ============================================================
// TOKEN POSITIONS
// ============================================================

function getTokens(line) {

    const text =
        String(line == null ? "" : line)
            .replace(/\r/g, "")
            .replace(/\t/g, " ");

    const result = [];

    const regex = /\S+/g;

    let match;

    while ((match = regex.exec(text)) !== null) {

        result.push({

            text: match[0],

            position: match.index,

            end:
                match.index +
                match[0].length

        });

    }

    return result;

}


// ============================================================
// HEADER LINES
// ============================================================

function getHeaderLines(detection) {

    if (!detection) {
        return [];
    }

    if (Array.isArray(detection.headerLines)) {

        return detection.headerLines
            .map(cleanText)
            .filter(Boolean);

    }

    if (Array.isArray(detection.headers)) {

        return detection.headers
            .map(cleanText)
            .filter(Boolean);

    }

    if (detection.headerText) {

        return [
            cleanText(
                detection.headerText
            )
        ];

    }

    return [];

}


// ============================================================
// PRODUCT HEADER
// ============================================================

function isProductHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "PRODUCT",
        "PRODUCTNAME",
        "ITEM",
        "ITEMNAME",
        "DESCRIPTION",
        "DESCRIPTIONPACKING",
        "PARTICULAR",
        "PARTICULARS",
        "MEDICINE",
        "MEDICINENAME",
        "NAME"

    ].includes(token);

}


// ============================================================
// PRODUCT CODE
// ============================================================

function isProductCodeHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "ITEMCODE",
        "PRODUCTCODE",
        "PRODCODE",
        "CODE",
        "ITEMNO",
        "ITEMNUMBER",
        "PRODUCTNO",
        "PRODUCTNUMBER",
        "SKU",
        "SKUCODE"

    ].includes(token);

}


// ============================================================
// PACKING
// ============================================================

function isPackingHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "PACK",
        "PACKING",
        "PACKG",
        "PKG",
        "PACKAGE"

    ].includes(token);

}


// ============================================================
// OPENING
// ============================================================

function isOpeningHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "OPENING",
        "OPEN",
        "OP",
        "OB",
        "O.B",
        "OSTK",
        "OPSTK",
        "OPQTY",
        "OPENINGSTOCK",
        "OPENINGBALANCE"

    ].includes(token);

}


// ============================================================
// PURCHASE / RECEIPT
// ============================================================

function isPurchaseHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "PURCHASE",
        "PUR",
        "PURC",
        "PURCH",
        "RECEIPT",
        "RECEIPTS",
        "RCPT",
        "P_QTY",
        "PQTY"

    ].includes(token);

}


// ============================================================
// SALES
// ============================================================

function isSalesHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "SALES",
        "SALE",
        "SAL",
        "L_SLE",
        "LSLE",
        "S_QTY",
        "SQTY",
        "ISSUE",
        "ISSUES"

    ].includes(token);

}


// ============================================================
// CLOSING
// ============================================================

function isClosingHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "CLOSING",
        "CLOSE",
        "CL",
        "CLST",
        "CLSTK",
        "CLSTOCK",
        "CLQTY",
        "QOH",
        "CURSTK",
        "CURRENTSTOCK",
        "BALANCE",
        "BAL"

    ].includes(token);

}


// ============================================================
// VALUE
// ============================================================

function isValueHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "VALUE",
        "VAL",
        "AMOUNT",
        "AMT"

    ].includes(token);

}


// ============================================================
// SPECIFIC VALUE HEADERS
// ============================================================

function isSalesValueHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "SALESVALUE",
        "SALVALUE",
        "SALVAL",
        "SAL.VAL",
        "S_VALUE",
        "SVAL",
        "S.VAL"

    ].includes(token);

}


function isClosingValueHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "CLOSINGVALUE",
        "CLVALUE",
        "CL.VALUE",
        "CLSTVALUE",
        "CLSTVAL",
        "CLST.VAL",
        "STOCKVALUE",
        "STKVALUE",
        "STKVAL",
        "STOCKVAL"

    ].includes(token);

}


function isPurchaseValueHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "PURCHASEVALUE",
        "PURVALUE",
        "PURVAL",
        "PUR.VAL",
        "P_VALUE",
        "PVAL"

    ].includes(token);

}


// ============================================================
// QTY
// ============================================================

function isQtyHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "QTY",
        "QUANTITY",
        "STOCK",
        "STK",
        "UNITS",
        "UNIT"

    ].includes(token);

}


// ============================================================
// AGE
// ============================================================

function isAgeHeader(value) {

    return tokenNormalize(value) === "AGE";

}


// ============================================================
// RETURN / ADJUSTMENT / FREE
// ============================================================

function isAdjustmentHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "ADJ",
        "ADJUST",
        "ADJUSTMENT",
        "ADJMT"

    ].includes(token);

}


function isCreditHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "CR",
        "CRNO",
        "CREDIT",
        "CREDITNOTE"

    ].includes(token);

}


function isDebitHeader(value) {

    const token =
        tokenNormalize(value);

    return [

        "DR",
        "DRNO",
        "DEBIT",
        "DEBITNOTE"

    ].includes(token);

}


// ============================================================
// SPECIAL HEADERS
// ============================================================

function detectSpecialHeader(value) {

    const normalized =
        tokenNormalize(value);

    /*
     * LM 1
     * LM 2
     * LM 3
     */

    const lm =
        normalized.match(/^LM(\d+)$/);

    if (lm) {

        return {

            field:
                `lastMonth${lm[1]}`,

            type:
                "VALUE",

            group:
                "lastMonth"

        };

    }

    /*
     * Previous Sales
     */

    if (
        normalized === "PREVSA" ||
        normalized === "PREVIOUSSALES" ||
        normalized === "PREVSALE"
    ) {

        return {

            field:
                "previousSales",

            type:
                "QTY",

            group:
                "previousSales"

        };

    }

    /*
     * Rate
     */

    if (
        normalized === "RATE" ||
        normalized === "PRATE"
    ) {

        return {

            field:
                "rate",

            type:
                "VALUE",

            group:
                "rate"

        };

    }

    return null;

}


// ============================================================
// DIRECT HEADER FIELD
// ============================================================

function detectDirectField(header) {

    const value =
        normalize(header);

    /*
     * Product code
     */

    if (isProductCodeHeader(value)) {

        return {
            field: "productCode",
            type: "TEXT",
            group: "product"
        };

    }

    /*
     * Product
     */

    if (isProductHeader(value)) {

        return {
            field: "product",
            type: "TEXT",
            group: "product"
        };

    }

    /*
     * Packing
     */

    if (isPackingHeader(value)) {

        return {
            field: "pack",
            type: "TEXT",
            group: "packing"
        };

    }

    /*
     * Specific values FIRST.
     */

    if (isPurchaseValueHeader(value)) {

        return {
            field: "purchaseValue",
            type: "VALUE",
            group: "purchase"
        };

    }

    if (isSalesValueHeader(value)) {

        return {
            field: "salesValue",
            type: "VALUE",
            group: "sales"
        };

    }

    if (isClosingValueHeader(value)) {

        return {
            field: "closingValue",
            type: "VALUE",
            group: "closing"
        };

    }

    /*
     * Standard fields.
     */

    if (isOpeningHeader(value)) {

        return {
            field: "opening",
            type: "QTY",
            group: "opening"
        };

    }

    if (isPurchaseHeader(value)) {

        return {
            field: "purchase",
            type: "QTY",
            group: "purchase"
        };

    }

    if (isSalesHeader(value)) {

        return {
            field: "sales",
            type: "QTY",
            group: "sales"
        };

    }

    if (isClosingHeader(value)) {

        return {
            field: "closing",
            type: "QTY",
            group: "closing"
        };

    }

    if (isAdjustmentHeader(value)) {

        return {
            field: "adjustment",
            type: "QTY",
            group: "adjustment"
        };

    }

    if (isCreditHeader(value)) {

        return {
            field: "credit",
            type: "QTY",
            group: "credit"
        };

    }

    if (isDebitHeader(value)) {

        return {
            field: "debit",
            type: "QTY",
            group: "debit"
        };

    }

    if (isAgeHeader(value)) {

        return {
            field: "age",
            type: "VALUE",
            group: "age"
        };

    }

    const special =
        detectSpecialHeader(value);

    if (special) {
        return special;
    }

    return null;

}


// ============================================================
// PARENT DETECTION FOR MULTI-ROW HEADERS
// ============================================================

function detectParentField(header) {

    const value =
        normalize(header);

    if (isOpeningHeader(value)) {
        return "opening";
    }

    if (isPurchaseHeader(value)) {
        return "purchase";
    }

    if (isSalesHeader(value)) {
        return "sales";
    }

    if (isClosingHeader(value)) {
        return "closing";
    }

    if (isAdjustmentHeader(value)) {
        return "adjustment";
    }

    if (isCreditHeader(value)) {
        return "credit";
    }

    if (isDebitHeader(value)) {
        return "debit";
    }

    return null;

}


// ============================================================
// CHILD TYPE
// ============================================================

function childType(value) {

    const token =
        tokenNormalize(value);

    if (
        token === "QTY" ||
        token === "QUANTITY"
    ) {

        return "QTY";

    }

    if (
        token === "VALUE" ||
        token === "VAL" ||
        token === "AMOUNT"
    ) {

        return "VALUE";

    }

    return null;

}


// ============================================================
// MULTI-ROW FIELD
// ============================================================

function resolveParentChild(
    parent,
    child
) {

    if (!parent) {
        return null;
    }

    if (parent === "opening") {

        if (child === "QTY") {

            return {
                field: "opening",
                type: "QTY"
            };

        }

    }

    if (parent === "purchase") {

        if (child === "QTY") {

            return {
                field: "purchase",
                type: "QTY"
            };

        }

        if (child === "VALUE") {

            return {
                field: "purchaseValue",
                type: "VALUE"
            };

        }

    }

    if (parent === "sales") {

        if (child === "QTY") {

            return {
                field: "sales",
                type: "QTY"
            };

        }

        if (child === "VALUE") {

            return {
                field: "salesValue",
                type: "VALUE"
            };

        }

    }

    if (parent === "closing") {

        if (child === "QTY") {

            return {
                field: "closing",
                type: "QTY"
            };

        }

        if (child === "VALUE") {

            return {
                field: "closingValue",
                type: "VALUE"
            };

        }

    }

    if (parent === "adjustment") {

        if (child === "QTY") {

            return {
                field: "adjustment",
                type: "QTY"
            };

        }

    }

    return null;

}


// ============================================================
// COLUMN OBJECT
// ============================================================

function makeColumn(
    position,
    header,
    field,
    type,
    group,
    headerRow
) {

    return {

        position:
            position,

        header:
            cleanText(header),

        normalizedHeader:
            normalize(header),

        field:
            field || null,

        type:
            type || "TEXT",

        group:
            group || null,

        headerRow:
            headerRow == null
                ? null
                : headerRow,

        confidence:
            field
                ? 100
                : 0

    };

}


// ============================================================
// SINGLE ROW PARSER
// ============================================================

function parseSingleRowHeader(
    line,
    productColumn
) {

    const columns = [];

    const tokens =
        getTokens(line);

    for (const token of tokens) {

        const detected =
            detectDirectField(
                token.text
            );

        if (detected) {

            columns.push(
                makeColumn(

                    token.position,

                    token.text,

                    detected.field,

                    detected.type,

                    detected.group,

                    0

                )
            );

        }

    }

    /*
     * If the detector already knows the product position,
     * use it even if the actual header is ITEMNAME.
     */

    if (
        !columns.some(
            c =>
                c.field === "product"
        )
    ) {

        const productToken =
            tokens.find(
                token =>
                    isProductHeader(
                        token.text
                    )
            );

        if (productToken) {

            columns.push(
                makeColumn(

                    productToken.position,

                    productToken.text,

                    "product",

                    "TEXT",

                    "product",

                    0

                )
            );

        }
        else {

            columns.push(
                makeColumn(

                    productColumn,

                    "PRODUCT",

                    "product",

                    "TEXT",

                    "product",

                    0

                )
            );

        }

    }

    return columns;

}


// ============================================================
// MULTI ROW PARSER
// ============================================================

function parseMultiRowHeader(
    lines,
    productColumn
) {

    const columns = [];

    const first =
        getTokens(
            lines[0] || ""
        );

    const second =
        getTokens(
            lines[1] || ""
        );

    /*
     * First row direct fields.
     */

    for (const token of first) {

        const direct =
            detectDirectField(
                token.text
            );

        if (direct) {

            columns.push(
                makeColumn(

                    token.position,

                    token.text,

                    direct.field,

                    direct.type,

                    direct.group,

                    0

                )
            );

        }

    }

    /*
     * Parent positions.
     */

    const parents = [];

    for (const token of first) {

        const parent =
            detectParentField(
                token.text
            );

        if (parent) {

            parents.push({

                position:
                    token.position,

                field:
                    parent,

                header:
                    token.text

            });

        }

    }

    /*
     * Child row.
     */

    for (const token of second) {

        const child =
            childType(
                token.text
            );

        if (!child) {
            continue;
        }

        let parent = null;

        let distance =
            Infinity;

        for (const candidate of parents) {

            if (
                candidate.position <=
                token.position
            ) {

                const d =
                    token.position -
                    candidate.position;

                if (d < distance) {

                    distance = d;

                    parent =
                        candidate;

                }

            }

        }

        if (!parent) {
            continue;
        }

        const resolved =
            resolveParentChild(
                parent.field,
                child
            );

        if (!resolved) {
            continue;
        }

        columns.push(
            makeColumn(

                token.position,

                `${parent.header} + ${token.text}`,

                resolved.field,

                resolved.type,

                parent.field,

                1

            )
        );

    }

    /*
     * Product fallback.
     */

    if (
        !columns.some(
            c =>
                c.field === "product"
        )
    ) {

        columns.push(
            makeColumn(

                productColumn,

                "PRODUCT",

                "product",

                "TEXT",

                "product",

                0

            )
        );

    }

    return columns;

}


// ============================================================
// DEDUPLICATE
// ============================================================

function deduplicateColumns(columns) {

    const result = [];

    const keys =
        new Set();

    for (const column of columns) {

        const key =
            `${column.position}|${column.field}|${column.type}`;

        if (keys.has(key)) {
            continue;
        }

        keys.add(key);

        result.push(column);

    }

    return result;

}


// ============================================================
// STRUCTURE IDENTIFICATION
// ============================================================

function identifyStructure(
    headerLines,
    columns
) {

    const text =
        headerLines
            .map(normalize)
            .join(" ");

    const normalized =
        tokenNormalize(text);

    /*
     * ITEMCODE / ITEMNAME structure.
     */

    if (
        normalized.includes("ITEMCODE") &&
        normalized.includes("ITEMNAME")
    ) {

        return {

            name:
                "ITEMCODE_ITEMNAME_STOCK_SALES",

            confidence:
                100

        };

    }

    /*
     * DESCRIPTION/PACKING + CR/DR.
     */

    if (
        normalized.includes("DESCRIPTION/PACKING") &&
        normalized.includes("CRNO") &&
        normalized.includes("DRNO")
    ) {

        return {

            name:
                "DESCRIPTION_PACKING_CREDIT_DEBIT",

            confidence:
                100

        };

    }

    /*
     * Two-row Qty/Value.
     */

    if (
        headerLines.length >= 2 &&
        normalized.includes("RECEIPTS") &&
        normalized.includes("SALES") &&
        normalized.includes("CLOSING")
    ) {

        return {

            name:
                "TWO_ROW_QTY_VALUE",

            confidence:
                100

        };

    }

    /*
     * Medicine format.
     */

    if (
        normalized.includes("MEDICINENAME") &&
        normalized.includes("PURC") &&
        normalized.includes("CLST")
    ) {

        return {

            name:
                "MEDICINE_STOCK_SALES",

            confidence:
                100

        };

    }

    /*
     * Generic but mapped.
     */

    if (
        columns.length >= 2
    ) {

        return {

            name:
                "GENERIC_MAPPED_TXT",

            confidence:
                75

        };

    }

    return {

        name:
            "UNKNOWN",

        confidence:
            0

    };

}


// ============================================================
// BUILD STANDARD MAP
// ============================================================

function buildStandardMap(
    columns,
    detection,
    structure
) {

    const map = {

        format:
            structure.name,

        structure:
            structure.name,

        structureConfidence:
            structure.confidence,

        headerless:
            Boolean(
                detection &&
                detection.headerless
            ),

        product:
            null,

        productDescription:
            null,

        productCode:
            null,

        pack:
            null,

        opening:
            null,

        purchase:
            null,

        purchaseFree:
            null,

        purchaseReturn:
            null,

        sales:
            null,

        salesReturn:
            null,

        free:
            null,

        replacement:
            null,

        branch:
            null,

        credit:
            null,

        debit:
            null,

        adjustment:
            null,

        closing:
            null,

        rate:
            null,

        purchaseValue:
            null,

        salesValue:
            null,

        closingValue:
            null,

        /*
         * Additional fields are intentionally retained.
         */

        previousSales:
            null,

        age:
            null,

        lastMonth1:
            null,

        lastMonth2:
            null,

        columns: columns.slice(),

        positions: {}

    };


    /*
     * Map every column.
     */

    for (const column of columns) {

        if (!column.field) {
            continue;
        }

        /*
         * Standard field.
         */

        if (
            Object.prototype.hasOwnProperty.call(
                map,
                column.field
            )
        ) {

            /*
             * Don't overwrite an already mapped field
             * unless the new one is more specific.
             */

            if (
                map[column.field] === null
            ) {

                map[column.field] = {

                    position:
                        column.position,

                    type:
                        column.type,

                    header:
                        column.header,

                    group:
                        column.group

                };

            }

        }

        /*
         * ALWAYS retain physical position.
         */

        map.positions[
            column.field
        ] = column.position;

    }


    /*
     * Product convenience.
     */

    if (
        map.product &&
        typeof map.product === "object"
    ) {

        map.productDescription =
            map.product.position;

    }

    /*
     * Compatibility:
     * product should be a position.
     */

    if (
        map.product &&
        typeof map.product === "object"
    ) {

        map.product =
            map.product.position;

    }


    /*
     * Product code.
     */

    if (
        map.productCode &&
        typeof map.productCode === "object"
    ) {

        map.productCode =
            map.productCode;

    }


    /*
     * Pack.
     */

    if (
        map.pack &&
        typeof map.pack === "object"
    ) {

        map.pack =
            map.pack;

    }


    /*
     * Fixed width map.
     */

    map.fixedWidth = {

        product:
            map.positions.product ?? null,

        productCode:
            map.positions.productCode ?? null,

        packing:
            map.positions.pack ?? null,

        opening:
            map.positions.opening ?? null,

        purchase:
            map.positions.purchase ?? null,

        purchaseValue:
            map.positions.purchaseValue ?? null,

        sales:
            map.positions.sales ?? null,

        salesValue:
            map.positions.salesValue ?? null,

        closing:
            map.positions.closing ?? null,

        closingValue:
            map.positions.closingValue ?? null,

        credit:
            map.positions.credit ?? null,

        debit:
            map.positions.debit ?? null,

        adjustment:
            map.positions.adjustment ?? null

    };


    return map;

}


// ============================================================
// MAIN
// ============================================================

function mapTXTHeader(detection) {

    if (!detection) {

        return {

            success:
                false,

            found:
                false,

            format:
                null,

            mapping:
                null,

            columns:
                [],

            message:
                "TXT header detection result is required."

        };

    }


    const headerLines =
        getHeaderLines(
            detection
        );


    if (!headerLines.length) {

        return {

            success:
                false,

            found:
                false,

            format:
                null,

            mapping:
                null,

            columns:
                [],

            message:
                "No header lines were supplied."

        };

    }


    const productColumn =
        Number.isFinite(
            Number(
                detection.productColumn
            )
        )
            ? Number(
                detection.productColumn
            )
            : 0;


    let columns;


    /*
     * Single-row header.
     */

    if (
        headerLines.length === 1
    ) {

        columns =
            parseSingleRowHeader(
                headerLines[0],
                productColumn
            );

    }


    /*
     * Multi-row header.
     */

    else {

        columns =
            parseMultiRowHeader(
                headerLines,
                productColumn
            );

    }


    columns =
        deduplicateColumns(
            columns
        );


    /*
     * Structure.
     */

    const structure =
        identifyStructure(
            headerLines,
            columns
        );


    /*
     * Standard map.
     */

    const mapping =
        buildStandardMap(
            columns,
            detection,
            structure
        );


    mapping.headerStart =
        detection.headerStart ??
        null;

    mapping.headerEnd =
        detection.headerEnd ??
        null;

    mapping.dataStarts =
        detection.dataStartsAt ??
        detection.dataStarts ??
        detection.dataStart ??
        null;

    mapping.headerLines =
        headerLines.slice();

    mapping.headerText =
        headerLines.join(" ");

    mapping.multiRowHeader =
        headerLines.length > 1;

    mapping.multiRow =
        headerLines.length > 1;


    /*
     * Unknown = don't pretend success.
     */

    if (
        structure.name === "UNKNOWN"
    ) {

        return {

            success:
                false,

            found:
                true,

            format:
                structure.name,

            confidence:
                0,

            mapping,

            columns,

            message:
                "Unknown TXT header structure. No safe mapping available."

        };

    }


    /*
     * At least one meaningful field must exist.
     */

    const meaningfulColumns =
        columns.filter(
            column =>
                column.field &&
                column.field !== "product"
        );


    if (
        meaningfulColumns.length === 0
    ) {

        return {

            success:
                false,

            found:
                true,

            format:
                structure.name,

            confidence:
                0,

            mapping,

            columns,

            message:
                "No meaningful header columns could be mapped."

        };

    }


    return {

        success:
            true,

        found:
            true,

        format:
            structure.name,

        structure:
            structure.name,

        confidence:
            structure.confidence,

        mapping,

        columns,

        message:
            ""

    };

}


// ============================================================
// COMPATIBILITY EXPORTS
// ============================================================

const mapHeaderTXT =
    mapTXTHeader;

const mapTXTHeaders =
    mapTXTHeader;

const mapHeader =
    mapTXTHeader;


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    mapTXTHeader,

    mapHeaderTXT,

    mapTXTHeaders,

    mapHeader

};