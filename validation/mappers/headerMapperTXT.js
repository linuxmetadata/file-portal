/**
 * ============================================================
 * TXT HEADER MAPPER
 * ============================================================
 *
 * FINAL POSITION / STRUCTURE BASED MAPPER
 *
 * IMPORTANT:
 *
 * 1. Header detector decides WHERE the header is.
 * 2. Mapper decides WHAT each physical column means.
 * 3. Multi-row headers are mapped by horizontal position.
 * 4. Title/date/company rows are ignored.
 * 5. Generic QTY/FREE/VALUE are never mapped globally.
 * 6. Parent + child headers are combined.
 * 7. Missing columns are NOT automatically treated as errors.
 *
 * ============================================================
 */

"use strict";


// ============================================================
// BASIC HELPERS
// ============================================================

function clean(value) {

    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function upper(value) {

    return clean(value).toUpperCase();

}


function compact(value) {

    return upper(value)
        .replace(/[<>{}()[\]:;,|]/g, "")
        .replace(/\s+/g, "")
        .replace(/\./g, "");

}


function numberOrNull(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;

}


// ============================================================
// REMOVE DETECTOR LINE NUMBER
// ============================================================

function removeLineNumber(line) {

    return String(line ?? "")
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/^\s*\d+\s*:\s*/, "")
        .replace(/\s+$/, "");

}


// ============================================================
// GET HEADER ROWS
// ============================================================

function getHeaderRows(detector) {

    if (!detector) {
        return [];
    }

    let rows = [];

    if (
        Array.isArray(
            detector.headerLines
        )
    ) {

        rows =
            detector.headerLines.slice();

    }
    else if (
        Array.isArray(
            detector.headers
        )
    ) {

        rows =
            detector.headers.slice();

    }
    else if (
        detector.headerText
    ) {

        rows =
            String(
                detector.headerText
            )
                .split(/\r?\n/)
                .filter(Boolean);

    }

    return rows
        .map(removeLineNumber)
        .filter(Boolean);

}


// ============================================================
// TITLE / NON-COLUMN HEADER DETECTION
// ============================================================

function isTitleRow(row) {

    const text =
        upper(row);


    if (
        text.includes(
            "STOCK & SALES STATEMENT"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "STOCK AND SALES STATEMENT"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "STOCK & SALE STATEMENT"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "STOCK & SALES REPORT"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "STOCK AND SALES REPORT"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "COMPANY NAME"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "RUN DATE"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "PAGE NO"
        )
    ) {
        return true;
    }


    if (
        text.includes(
            "STATEMENT AS ON"
        )
    ) {
        return true;
    }


    return false;

}


// ============================================================
// SUMMARY VALUE ROW
// ============================================================
//
// Example:
//
// Opening Value : 18726.01 Sale Value : 39849.79
//
// This is NOT a column header.
//
// ============================================================

function isSummaryValueRow(row) {

    const text =
        upper(row);


    if (
        /OPENING\s+VALUE\s*:/.test(text)
    ) {
        return true;
    }


    if (
        /PURCHASE\s+VALUE\s*:/.test(text)
    ) {
        return true;
    }


    if (
        /CLOSING\s+VALUE\s*:/.test(text)
    ) {
        return true;
    }


    if (
        /SALE\s+VALUE\s*:/.test(text)
    ) {
        return true;
    }


    return false;

}


// ============================================================
// TOKEN WITH POSITION
// ============================================================

function tokenize(line) {

    const result = [];

    const regex =
        /\S+/g;

    let match;

    while (
        (match = regex.exec(line))
    ) {

        result.push({

            text:
                match[0],

            start:
                match.index,

            end:
                match.index +
                match[0].length

        });

    }

    return result;

}


// ============================================================
// HEADER SIGNAL
// ============================================================

function headerScore(row) {

    const text =
        upper(row);

    const words = [

        "PRODUCT",
        "PRODUCTNAME",

        "PARTICULAR",
        "PARTICULARS",

        "DESCRIPTION",
        "MEDICINE",

        "PACK",
        "PACKING",
        "PACKG",

        "OPEN",
        "OPENING",
        "OPSTK",
        "OPSTOCK",
        "OPNG",
        "OB",
        "Op.Stk",

        "PUR",
        "PURC",
        "PURCHASE",

        "RECEIPT",
        "RCPT",

        "SALE",
        "SALES",

        "CLOSING",
        "CLOSE",
        "CLST",
        "CLSTK",
        "CL.STK",
        "CLSTOCK",

        "STOCK",
        "VALUE",

        "QTY",
        "QUANTITY",

        "FREE",

        "RETURN",
        "RET",

        "ADJ",
        "ADJMT",
        "ADJUSTMENT",

        "EXPIRY",
        "EXP",

        "AGE",

        "CODE",

        "RATE",

        "PRATE",

        "PRVSA",

        "PREVIOUS",

        "LAST"

    ];

    let score = 0;

    for (
        const word
        of words
    ) {

        if (
            text.includes(word)
        ) {
            score++;
        }

    }

    return score;

}


// ============================================================
// ACTUAL COLUMN HEADER ROWS
// ============================================================

function selectHeaderRows(rows) {

    if (!rows.length) {
        return [];
    }


    const candidates =
        rows
            .map(
                (row, index) => ({

                    row,

                    index,

                    score:
                        headerScore(row),

                    title:
                        isTitleRow(row) ||
                        isSummaryValueRow(row)

                })
            )
            .filter(
                item =>
                    !item.title &&
                    item.score > 0
            );


    if (!candidates.length) {

        return rows;

    }


    /*
     * Preserve contiguous actual header rows.
     */

    const groups = [];

    let current = [];


    for (
        const item
        of candidates
    ) {

        if (!current.length) {

            current.push(item);

            continue;

        }


        const previous =
            current[
                current.length - 1
            ];


        if (
            item.index ===
            previous.index + 1
        ) {

            current.push(item);

        }
        else {

            groups.push(current);

            current = [item];

        }

    }


    if (current.length) {
        groups.push(current);
    }


    /*
     * Select group with strongest header signal.
     */

    groups.sort(
        (a, b) => {

            const sa =
                a.reduce(
                    (sum, x) =>
                        sum + x.score,
                    0
                );

            const sb =
                b.reduce(
                    (sum, x) =>
                        sum + x.score,
                    0
                );

            return sb - sa;

        }
    );


    const selected =
        groups[0] || [];


    return selected
        .slice(-3)
        .map(
            x =>
                x.row
        );

}


// ============================================================
// FIELD NORMALIZATION
// ============================================================

function normalizeFieldToken(text) {

    const c =
        compact(text);


    // --------------------------------------------------------
    // PRODUCT CODE
    // --------------------------------------------------------

    if (
        [
            "CODE",
            "ITEMCODE",
            "PRODUCTCODE",
            "PRODCODE",
            "SKUCODE"
        ].includes(c)
    ) {

        return "productCode";

    }


    // --------------------------------------------------------
    // PRODUCT
    // --------------------------------------------------------

    if (
        [
            "PRODUCT",
            "PRODUCTNAME",
            "NAME",
            "ITEM",
            "ITEMNAME",
            "DESCRIPTION",
            "DESCRIPTION/PACKING",
            "DESCRIPTIONPACKING",
            "PARTICULAR",
            "PARTICULARS",
            "MEDICINE",
            "MEDICINENAME"
        ].includes(c)
    ) {

        return "product";

    }


    // --------------------------------------------------------
    // PACK
    // --------------------------------------------------------

    if (
        [
            "PACK",
            "PACKING",
            "PACKG",
            "PKG",
            "PACKAGE",
            "PRO"
        ].includes(c)
    ) {

        return "pack";

    }


    // --------------------------------------------------------
    // OPENING
    // --------------------------------------------------------

    if (
        [
            "OPEN",
            "OPENING",
            "OP",
            "OB",
            "OPSTK",
            "OPSTOCK",
            "OPNG",
            "OPNGSTK",
            "OPNGSTOCK",
            "OPENINGSTOCK",
            "OPENINGBAL",
            "OPENINGBALANCE",
            "OPQTY"
        ].includes(c)
    ) {

        return "opening";

    }


    // --------------------------------------------------------
    // PURCHASE
    // --------------------------------------------------------

    if (
        [
            "PUR",
            "PURC",
            "PURCH",
            "PURCHASE",
            "PURCHASES",
            "RCPT",
            "RCPTS",
            "RECEIPT",
            "RECEIPTS",
            "RECD",
            "RECEIVED",
            "INWARD",
            "INWARDS"
        ].includes(c)
    ) {

        return "purchase";

    }


    // --------------------------------------------------------
    // PURCHASE RETURN
    // --------------------------------------------------------

    if (
        [
            "PRETURN",
            "PRET",
            "PURRETURN",
            "PURCHASERETURN",
            "PURRET"
        ].includes(c)
    ) {

        return "purchaseReturn";

    }


    // --------------------------------------------------------
    // SALES
    // --------------------------------------------------------

    if (
        [
            "SALE",
            "SALES",
            "SAL",
            "LSLE",
            "ISSUE",
            "ISSUES",
            "ISSUED",
            "OUTWARD",
            "OUTWARDS"
        ].includes(c)
    ) {

        return "sales";

    }


    // --------------------------------------------------------
    // SALES RETURN
    // --------------------------------------------------------

    if (
        [
            "SRETURN",
            "SALESRETURN",
            "SALERETURN",
            "RETURN",
            "RET"
        ].includes(c)
    ) {

        return "salesReturn";

    }


    // --------------------------------------------------------
    // ADJUSTMENT
    // --------------------------------------------------------

    if (
        [
            "ADJ",
            "ADJMT",
            "ADJUST",
            "ADJUSTMENT",
            "ADJUSTMENTS"
        ].includes(c)
    ) {

        return "adjustment";

    }


    // --------------------------------------------------------
    // CLOSING
    // --------------------------------------------------------

    if (
        [
            "CLOSING",
            "CLOSE",
            "CL",
            "CLST",
            "CLSTK",
            "CLSTOCK",
            "CLSTOCKQTY",
            "CLQTY",
            "CSTOCK",
            "CURRENTSTOCK",
            "CURSTK",
            "QOH",
            "CLOSTK",
            "CLOSTOCK"
        ].includes(c)
    ) {

        return "closing";

    }


    // --------------------------------------------------------
    // RATE
    // --------------------------------------------------------

    if (
        [
            "RATE",
            "PRATE",
            "UNITRATE"
        ].includes(c)
    ) {

        return "rate";

    }


    // --------------------------------------------------------
    // EXPIRY
    // --------------------------------------------------------

    if (
        [
            "EXP",
            "EXPIRY",
            "EXPDATE"
        ].includes(c)
    ) {

        return "expiry";

    }


    // --------------------------------------------------------
    // AGE
    // --------------------------------------------------------

    if (
        [
            "AGE",
            "DAYS",
            "DAY"
        ].includes(c)
    ) {

        return "age";

    }


    // --------------------------------------------------------
    // PREVIOUS SALES
    // --------------------------------------------------------

    if (
        [
            "PRVSA",
            "PREVSA",
            "PREVIOUSSALE",
            "PREVIOUSSALES"
        ].includes(c)
    ) {

        return "previousSales";

    }


    // --------------------------------------------------------
    // LAST SALE
    // --------------------------------------------------------

    if (
        [
            "LASTSALE",
            "LASTSALES"
        ].includes(c)
    ) {

        return "lastSale";

    }


    // --------------------------------------------------------
    // TOTAL
    // --------------------------------------------------------

    if (
        [
            "TOTAL",
            "TOTALSTOCK"
        ].includes(c)
    ) {

        return "total";

    }


    // --------------------------------------------------------
    // VALUE
    // --------------------------------------------------------

    if (
        [
            "VALUE",
            "VAL",
            "AMOUNT",
            "AMT"
        ].includes(c)
    ) {

        return "value";

    }


    // --------------------------------------------------------
    // QTY
    // --------------------------------------------------------

    if (
        [
            "QTY",
            "QUANTITY",
            "UNIT",
            "UNITS"
        ].includes(c)
    ) {

        return "qty";

    }


    // --------------------------------------------------------
    // FREE
    // --------------------------------------------------------

    if (
        c === "FREE"
    ) {

        return "free";

    }


    // --------------------------------------------------------
    // ADDITIONAL SOURCE-SPECIFIC FIELDS
    // --------------------------------------------------------

    if (["MOUT", "MOUTQTY"].includes(c)) {
        return "mOut";
    }

    if (["ORDQTY", "ORDERQTY", "ORDERQUANTITY"].includes(c)) {
        return "orderQty";
    }

    if (["EXCES", "EXCESS"].includes(c)) {
        return "excess";
    }

    if (["DUMP"].includes(c)) {
        return "dump";
    }

    if (["OPNGBAL", "OPNGSTOCK"].includes(c)) {
        return "opening";
    }

    if (["CLOSBAL", "CLOSTK", "CLOSTOCK"].includes(c)) {
        return "closing";
    }

    if (["PRQTY"].includes(c)) {
        return "purchase";
    }

    if (["SALVAL", "SALESVALUE"].includes(c)) {
        return "salesValue";
    }

    if (["CLVAL", "CLOSINGVALUE"].includes(c)) {
        return "closingValue";
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
    options = {}
) {

    return {

        position,

        header:
            clean(header),

        field,

        type,

        group:
            options.group ??
            field,

        row:
            options.row ??
            0,

        confidence:
            options.confidence ??
            100,

        source:
            options.source ??
            "header"

    };

}


// ============================================================
// SINGLE ROW MAPPER
// ============================================================

function mapSingleRow(
    row
) {

    const result = [];
    const parts = tokenize(row || "");

    for (let i = 0; i < parts.length; i++) {

        const token = parts[i];
        const text = upper(token.text);
        const compactText = compact(token.text);

        // PRODUCT NAME is one logical header.
        if (
            compactText === "PRODUCT" &&
            parts[i + 1] &&
            compact(parts[i + 1].text) === "NAME"
        ) {
            result.push(
                makeColumn(
                    token.start,
                    `${token.text} ${parts[i + 1].text}`,
                    "product",
                    "TEXT",
                    { source: "single-row", group: "product" }
                )
            );
            i++;
            continue;
        }

        // NAME following PRODUCT is never a second product column.
        if (
            compactText === "NAME" &&
            parts[i - 1] &&
            compact(parts[i - 1].text) === "PRODUCT"
        ) {
            continue;
        }

        let field = normalizeFieldToken(token.text);

        // Explicit one-row aliases.
        if (compactText === "OPSTK") field = "opening";
        if (compactText === "OPSTOCK") field = "opening";
        if (compactText === "OSTK") field = "opening";
        if (compactText === "PURC") field = "purchase";
        if (compactText === "PRQTY") field = "purchase";
        if (compactText === "RCPT") field = "purchase";
        if (compactText === "SALE") field = "sales";
        if (compactText === "SALES") field = "sales";
        if (compactText === "CLST") field = "closing";
        if (compactText === "CLSTK") field = "closing";
        if (compactText === "QOH") field = "closing";
        if (compactText === "CSTK") field = "closing";
        if (compactText === "SALVAL") field = "salesValue";
        if (compactText === "SALESVALUE") field = "salesValue";
        if (compactText === "CLVAL") field = "closingValue";
        if (compactText === "STOCKVAL") field = "closingValue";
        if (compactText === "ORDQTY") field = "orderQty";
        if (compactText === "MOUT") field = "mOut";
        if (compactText === "EXCES") field = "excess";
        if (compactText === "DUMP") field = "dump";

        if (!field) continue;

        // Generic child labels are not source columns in a one-row map.
        if (["qty", "free", "value", "stock"].includes(field)) {
            continue;
        }

        let type = "QTY";

        if (["product", "productCode", "pack"].includes(field)) {
            type = "TEXT";
        }
        else if ([
            "rate", "value", "salesValue", "closingValue",
            "openingValue", "purchaseValue"
        ].includes(field)) {
            type = "VALUE";
        }
        else if (field === "expiry") {
            type = "DATE";
        }
        else if (field === "age") {
            type = "NUMBER";
        }

        result.push(
            makeColumn(
                token.start,
                token.text,
                field,
                type,
                {
                    source: "single-row",
                    group: field
                }
            )
        );
    }

    return result;

}


// ============================================================
// DESCRIPTION / PACKING
// ============================================================

function mapDescriptionPacking(
    rows
) {

    const result = [];


    const first =
        rows[0] || "";


    const second =
        rows[1] || "";


    const firstTokens =
        tokenize(first);


    const secondTokens =
        tokenize(second);


    /*
     * First row:
     *
     * DESCRIPTION/PACKING
     * Pro.
     * OPENING
     * PUR.
     * SALE
     * CR.NO.
     * DR.NO.
     * CLOSING
     */


    for (
        const token
        of firstTokens
    ) {

        const text =
            upper(token.text);


        if (
            text ===
            "DESCRIPTION/PACKING"
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "product",
                    "TEXT",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            text ===
            "PRO."
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "pack",
                    "TEXT",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            text ===
            "OPENING"
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "opening",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            [
                "PUR.",
                "PUR"
            ].includes(text)
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "purchase",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            text ===
            "SALE"
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "sales",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            [
                "CR.NO.",
                "CR.NO"
            ].includes(text)
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "credit",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            [
                "DR.NO.",
                "DR.NO"
            ].includes(text)
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "debit",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }
        else if (
            text ===
            "CLOSING"
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "closing",
                    "QTY",
                    {
                        source:
                            "description"
                    }
                )
            );

        }

    }


    /*
     * Child row:
     *
     * Age QTY. QTY. QTY. ST.[+] ST.[-] QTY.
     *
     * AGE belongs to product column.
     * It must NOT replace product.
     */

    const age =
        secondTokens.find(
            x =>
                upper(
                    x.text
                ) === "AGE"
        );


    if (age) {

        result.push(
            makeColumn(
                age.start,
                age.text,
                "age",
                "NUMBER",
                {
                    source:
                        "description-child",
                    row: 1
                }
            )
        );

    }


    return result;

}


// ============================================================
// MEDICINE STOCK SALES
// ============================================================

function mapMedicine(
    row
) {

    const result = [];

    const parts =
        tokenize(row);


    for (
        const token
        of parts
    ) {

        const text =
            upper(token.text);


        if (
            text ===
            "MEDICINE"
        ) {

            result.push(
                makeColumn(
                    token.start,
                    token.text,
                    "product",
                    "TEXT"
                )
            );

            continue;

        }


        if (
            text ===
            "NAME"
        ) {

            /*
             * MEDICINE NAME is two words.
             * Product is already handled by MEDICINE.
             */

            continue;

        }


        const field =
            normalizeFieldToken(
                token.text
            );


        if (!field) {
            continue;
        }


        if (
            field ===
            "total"
        ) {
            continue;
        }


        if (
            field ===
            "value"
        ) {
            continue;
        }


        let type =
            "QTY";


        if (
            [
                "pack"
            ].includes(field)
        ) {

            type =
                "TEXT";

        }
        else if (
            [
                "salesValue",
                "closingValue",
                "rate"
            ].includes(field)
        ) {

            type =
                "VALUE";

        }


        result.push(
            makeColumn(
                token.start,
                token.text,
                field,
                type,
                {
                    source:
                        "medicine"
                }
            )
        );

    }


    /*
     * Specific medicine aliases.
     */

    const normalized =
        upper(row);


    const valueMatches = [

        {
            text:
                "SAL.VAL",
            field:
                "salesValue"
        },

        {
            text:
                "CLST.VAL",
            field:
                "closingValue"
        },

        {
            text:
                "CL.ST",
            field:
                "closing"
        },

        {
            text:
                "CLST",
            field:
                "closing"
        },

        {
            text:
                "L_SLE",
            field:
                "sales"
        }

    ];


    for (
        const item
        of valueMatches
    ) {

        const index =
            normalized.indexOf(
                item.text
            );


        if (
            index < 0
        ) {
            continue;
        }


        const already =
            result.some(
                x =>
                    x.position ===
                    index
            );


        if (
            already
        ) {
            continue;
        }


        result.push(
            makeColumn(
                index,
                item.text,
                item.field,
                item.field.includes(
                    "Value"
                )
                    ? "VALUE"
                    : "QTY",
                {
                    source:
                        "medicine-specific"
                }
            )
        );

    }


    return result;

}


// ============================================================
// PARENT TOKEN IDENTIFICATION
// ============================================================

function parentField(
    token
) {

    const text =
        upper(token);


    /*
     * Exact aliases first.
     */

    const field =
        normalizeFieldToken(
            token
        );


    if (
        field &&
        ![
            "qty",
            "free",
            "value",
            "total"
        ].includes(field)
    ) {

        return field;

    }


    /*
     * Special abbreviations.
     */

    if (
        [
            "OPSTK",
            "OPSTOCK",
            "OPNG.BAL",
            "OPNGBAL",
            "Op.Stk",
        ].includes(
            compact(text)
        )
    ) {

        return "opening";

    }


    if (
        [
            "CLSTK",
            "CLSTOCK",
            "CL.STK"
        ].includes(
            compact(text)
        )
    ) {

        return "closing";

    }


    return null;

}


// ============================================================
// CHILD TOKEN TYPE
// ============================================================

function childType(
    token
) {

    const c =
        compact(token);


    if (
        [
            "QTY",
            "QUANTITY",
            "UNIT",
            "UNITS"
        ].includes(c)
    ) {

        return "QTY";

    }


    if (
        c ===
        "FREE"
    ) {

        return "FREE";

    }


    if (
        [
            "VALUE",
            "VAL",
            "AMOUNT",
            "AMT"
        ].includes(c)
    ) {

        return "VALUE";

    }


    if (
        [
            "STOCK",
            "STK"
        ].includes(c)
    ) {

        return "STOCK";

    }


    return null;

}



// ============================================================
// CODE / NAME / PRATE DATA POSITION SUPPORT
// ============================================================

/*
 * CODE_NAME_STOCK is a fixed-width report where the header token
 * positions are NOT always the same as the actual data positions.
 *
 * Example:
 *   Header:  OpStock
 *   Data:               141.56  9  0 ...
 *
 * Therefore this structure must use the real data token positions
 * when they are available.
 *
 * This helper is deliberately isolated to CODE_NAME_STOCK so that
 * all other existing TXT structures keep their current behavior.
 */

function scorePossibleDataLine(line) {

    if (!line || typeof line !== "string") {
        return -1;
    }

    const text = line.trim();

    if (!text) {
        return -1;
    }

    const tokens = tokenize(line);

    if (tokens.length < 5) {
        return -1;
    }

    const numericCount = tokens.filter(
        token => isNumericToken(token.text)
    ).length;

    if (numericCount < 5) {
        return -1;
    }

    const upperText = upper(line);

    if (
        upperText.includes("OPSTOCK") ||
        upperText.includes("PURCHASE") ||
        upperText.includes("PRETURN") ||
        upperText.includes("SRETURN") ||
        upperText.includes("CLSTOCK")
    ) {
        return -1;
    }

    return numericCount * 10 + tokens.length;
}


function isNumericToken(value) {

    const text =
        String(value ?? "")
            .trim()
            .replace(/,/g, "");

    if (!text) {
        return false;
    }

    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text);
}


function findPossibleDataLine(value, depth = 0, seen = new Set()) {

    if (depth > 6 || value == null) {
        return null;
    }

    if (
        typeof value === "object" &&
        value !== null
    ) {

        if (seen.has(value)) {
            return null;
        }

        seen.add(value);
    }

    let best = null;
    let bestScore = -1;

    if (typeof value === "string") {

        const score =
            scorePossibleDataLine(value);

        if (score > bestScore) {
            return {
                line: value,
                score
            };
        }

        return null;
    }

    if (Array.isArray(value)) {

        for (const item of value) {

            if (typeof item !== "string") {
                continue;
            }

            const score =
                scorePossibleDataLine(item);

            if (score > bestScore) {
                bestScore = score;
                best = {
                    line: item,
                    score
                };
            }
        }

        return best;
    }

    if (typeof value === "object") {

        const preferredKeys = [
            "dataLines",
            "dataRows",
            "sampleData",
            "sampleLines",
            "nonBlankLines",
            "lines",
            "rawLines",
            "rows",
            "contentLines",
            "textLines"
        ];

        for (const key of preferredKeys) {

            if (!(key in value)) {
                continue;
            }

            const found =
                findPossibleDataLine(
                    value[key],
                    depth + 1,
                    seen
                );

            if (
                found &&
                found.score > bestScore
            ) {
                best = found;
                bestScore = found.score;
            }
        }

        /*
         * Also inspect nested reader/source objects.
         * This is intentionally limited by depth so it cannot
         * create a recursive traversal problem.
         */
        for (const [key, child] of Object.entries(value)) {

            if (
                preferredKeys.includes(key) ||
                child == null
            ) {
                continue;
            }

            if (
                typeof child !== "object" &&
                typeof child !== "string"
            ) {
                continue;
            }

            const found =
                findPossibleDataLine(
                    child,
                    depth + 1,
                    seen
                );

            if (
                found &&
                found.score > bestScore
            ) {
                best = found;
                bestScore = found.score;
            }
        }
    }

    return best;
}


function getCodeNameDataPositions(
    detector,
    columns,
    source = null
) {

    const sourceValue =
        source &&
        Array.isArray(source.lines)
            ? source.lines
            : source;

    const found =
        findPossibleDataLine(
            sourceValue || detector
        );

    if (
        !found ||
        !found.line
    ) {
        return null;
    }

    const line =
        String(found.line)
            .replace(/\r/g, "");

    const tokens =
        tokenize(line);

    /*
     * ============================================================
     * CODE_NAME_STOCK - REAL DATA POSITION DETECTION
     * ============================================================
     *
     * The header positions are NOT necessarily the same as the
     * physical positions used by the data rows.
     *
     * Example data row:
     *
     * ACNESTAL FACE WASH 60 ML    141.56       9        0 ...
     *
     * "60" belongs to the product name.
     *
     * The actual numeric data block starts at 141.56 and contains
     * exactly 14 numeric values:
     *
     *   0  rate
     *   1  opening
     *   2  purchase
     *   3  purchaseFree
     *   4  purchaseReturn
     *   5  sales
     *   6  salesFree
     *   7  salesValue
     *   8  salesReturn
     *   9  excess
     *  10  short
     *  11  closing
     *  12  closingFree
     *  13  closingValue
     *
     * IMPORTANT:
     * The extractor needs dataStart/dataEnd, not just position.
     * We therefore populate both position and the actual physical
     * boundaries.
     * ============================================================
     */

    const numericTokenIndexes = [];

    for (
        let i = 0;
        i < tokens.length;
        i++
    ) {

        if (
            isNumericToken(
                tokens[i].text
            )
        ) {

            numericTokenIndexes.push(i);

        }

    }

    /*
     * ============================================================
     * FIND THE REAL 14-COLUMN DATA BLOCK
     * ============================================================
     *
     * Do NOT simply take the last 14 numeric values.
     *
     * Example:
     *
     *     TAL FACE WASH 60 ML 141.56 9 0 1 ...
     *
     * "60" is part of PRODUCT. "141.56" is RATE.
     *
     * The real report block is therefore a contiguous run of
     * exactly 14 numeric tokens.
     * ============================================================
     */

    if (
        numericTokenIndexes.length < 14
    ) {

        return null;

    }

    let actualNumericIndexes = null;

    /*
     * Prefer a contiguous run of 14 numeric tokens whose first
     * token is preceded by a non-numeric token. This correctly
     * separates numbers embedded in product names from report data.
     */
    for (
        let i = 0;
        i <= numericTokenIndexes.length - 14;
        i++
    ) {

        const candidate =
            numericTokenIndexes.slice(
                i,
                i + 14
            );

        let contiguous = true;

        for (
            let j = 1;
            j < candidate.length;
            j++
        ) {

            if (
                candidate[j] !==
                candidate[j - 1] + 1
            ) {

                contiguous = false;
                break;
            }

        }

        if (!contiguous) {
            continue;
        }

        const firstIndex =
            candidate[0];

        const previousToken =
            tokens[firstIndex - 1];

        if (
            previousToken &&
            !isNumericToken(
                previousToken.text
            )
        ) {

            actualNumericIndexes =
                candidate;

            break;

        }

    }

    /*
     * Compatibility fallback when the first numeric data token is
     * at the beginning of a source line and therefore has no
     * preceding token.
     */
    if (
        !actualNumericIndexes
    ) {

        for (
            let i = 0;
            i <= numericTokenIndexes.length - 14;
            i++
        ) {

            const candidate =
                numericTokenIndexes.slice(
                    i,
                    i + 14
                );

            let contiguous = true;

            for (
                let j = 1;
                j < candidate.length;
                j++
            ) {

                if (
                    candidate[j] !==
                    candidate[j - 1] + 1
                ) {

                    contiguous = false;
                    break;
                }

            }

            if (contiguous) {

                actualNumericIndexes =
                    candidate;

                break;

            }

        }

    }

    if (
        !actualNumericIndexes ||
        actualNumericIndexes.length !== 14
    ) {

        return null;

    }

    const numericTokens =
        actualNumericIndexes.map(
            index =>
                tokens[index]
        );

    /*
     * ============================================================
     * FIELD ORDER
     * ============================================================
     */

    const numericFields = [

        "rate",

        "opening",

        "purchase",

        "purchaseFree",

        "purchaseReturn",

        "sales",

        "salesFree",

        "salesValue",

        "salesReturn",

        "excess",

        "short",

        "closing",

        "closingFree",

        "closingValue"

    ];

    /*
     * ============================================================
     * BUILD PHYSICAL DATA POSITION MAP
     * ============================================================
     */

    const positionMap = {};

    for (
        let i = 0;
        i < numericFields.length;
        i++
    ) {

        positionMap[
            numericFields[i]
        ] = numericTokens[i];

    }

    /*
     * ============================================================
     * PRODUCT COLUMN
     * ============================================================
     *
     * Product starts at column 0 and ends immediately before the
     * first actual numeric data token.
     *
     * This preserves numbers that are part of the product name.
     *
     * Example:
     *
     *   ACNESTAL FACE WASH 60 ML
     *                            ^
     *                            data starts at 141.56
     *
     * Therefore the extractor receives:
     *
     *   dataStart = 0
     *   dataEnd   = rate.start
     */

    const productColumn =
        columns.find(
            column =>
                column.field === "product"
        );

    if (
        productColumn
    ) {

        productColumn.position =
            0;

        productColumn.dataStart =
            0;

        productColumn.dataEnd =
            numericTokens[0].start;

        productColumn.dataWidth =
            Math.max(
                0,
                productColumn.dataEnd -
                productColumn.dataStart
            );

        productColumn.source =
            "data-position";

        productColumn.confidence =
            100;

    }

    /*
     * ============================================================
     * PRODUCT CODE
     * ============================================================
     *
     * The header contains "Code", but this particular report's
     * actual data rows do not contain a separate product code.
     *
     * Do NOT treat the first word of the product name as a code.
     */

    const productCodeColumn =
        columns.find(
            column =>
                column.field === "productCode"
        );

    if (
        productCodeColumn
    ) {

        const firstToken =
            tokens[0];

        const looksLikeProductCode =
            Boolean(firstToken) &&
            (
                /\d/.test(
                    firstToken.text
                ) ||
                /[-/]/.test(
                    firstToken.text
                )
            ) &&
            firstToken.text.length <= 20;

        /*
         * Only keep a product code if the first token clearly looks
         * like an actual code AND it is before the product text.
         *
         * In the supplied report the first token is:
         *
         *   ACNESTAL
         *
         * so it must remain part of the product name.
         */

        if (
            looksLikeProductCode
        ) {

            productCodeColumn.position =
                firstToken.start;

            productCodeColumn.dataStart =
                firstToken.start;

            productCodeColumn.dataEnd =
                firstToken.end;

            productCodeColumn.dataWidth =
                Math.max(
                    0,
                    firstToken.end -
                    firstToken.start
                );

            productCodeColumn.source =
                "data-position";

            productCodeColumn.confidence =
                100;

        }
        else {

            const index =
                columns.indexOf(
                    productCodeColumn
                );

            if (
                index >= 0
            ) {

                columns.splice(
                    index,
                    1
                );

            }

        }

    }

    /*
     * ============================================================
     * NUMERIC COLUMNS
     * ============================================================
     *
     * Set ALL three representations:
     *
     *   position
     *   dataStart
     *   dataEnd
     *
     * This keeps the mapper compatible with existing code while
     * making fixed-width extraction use the actual data positions.
     */

    for (
        const column of columns
    ) {

        if (
            !column ||
            !column.field
        ) {

            continue;

        }

        const token =
            positionMap[
                column.field
            ];

        if (
            !token
        ) {

            continue;

        }

        column.position =
            token.start;

        column.dataStart =
            token.start;

        column.dataEnd =
            token.end;

        column.dataWidth =
            Math.max(
                0,
                token.end -
                token.start
            );

        column.source =
            "data-position";

        column.confidence =
            100;

    }

    /*
     * ============================================================
     * RETURN
     * ============================================================
     */

    return {

        line,

        tokens,

        numericTokens,

        positionMap,

        dataStartTokenIndex:
            actualNumericIndexes[0],

        dataStart:
            numericTokens[0].start,

        dataEnd:
            numericTokens[
                numericTokens.length - 1
            ].end

    };

}

// ============================================================
// TWO ROW: CODE / NAME / PRATE FORMAT
// ============================================================

function mapCodeNameStructure(
    rows,
    detector = null,
    source = null
) {

    const result = [];


    /*
     * ============================================================
     * CODE / NAME / PRATE / STOCK FORMAT
     * ============================================================
     *
     * Example:
     *
     * Code     Name       Prate OpStock   Purchase   Preturn
     * Sales    SValue     SReturn Excess Short ClStock Cl Value
     *
     * Child row:
     *
     *                              Qty Free       Qty Free
     *                                             Qty Free
     *
     * Important:
     *
     * - Generic QTY / FREE / VALUE tokens are NOT parent columns.
     * - Parent/child relationships are determined by position.
     * - CL + VALUE is treated as one logical closingValue field.
     * - Existing helper functions are reused.
     */


    // ============================================================
    // FIRST HEADER ROW
    // ============================================================

    const first =
        tokenize(
            rows[0] || ""
        );


    // ============================================================
    // SECOND HEADER ROW
    // ============================================================

    const second =
        tokenize(
            rows[1] || ""
        );


    // ============================================================
    // PARENT DEFINITIONS
    // ============================================================

    const definitions = {

        CODE: {
            field: "productCode",
            type: "TEXT"
        },

        NAME: {
            field: "product",
            type: "TEXT"
        },

        PRATE: {
            field: "rate",
            type: "VALUE"
        },

        OPSTOCK: {
            field: "opening",
            type: "QTY"
        },

        PURCHASE: {
            field: "purchase",
            type: "QTY"
        },

        PRETURN: {
            field: "purchaseReturn",
            type: "QTY"
        },

        SALES: {
            field: "sales",
            type: "QTY"
        },

        SVALUE: {
            field: "salesValue",
            type: "VALUE"
        },

        SRETURN: {
            field: "salesReturn",
            type: "QTY"
        },

        EXCESS: {
            field: "excess",
            type: "QTY"
        },

        SHORT: {
            field: "short",
            type: "QTY"
        },

        CLSTOCK: {
            field: "closing",
            type: "QTY"
        }

    };


    // ============================================================
    // BUILD PARENT COLUMNS
    // ============================================================

    for (
        let i = 0;
        i < first.length;
        i++
    ) {

        const token =
            first[i];


        const current =
            compact(
                token.text
            );


        // --------------------------------------------------------
        // CL VALUE
        //
        // Handle this BEFORE standalone CL.
        // --------------------------------------------------------

        if (
            current === "CL"
        ) {

            const next =
                first[i + 1];


            if (
                next &&
                compact(next.text) ===
                "VALUE"
            ) {

                result.push(
                    makeColumn(
                        token.start,
                        `${token.text} ${next.text}`,
                        "closingValue",
                        "VALUE",
                        {
                            source:
                                "code-name",
                            row: 0
                        }
                    )
                );


                // Skip VALUE because it has already been consumed.
                i++;

                continue;
            }
        }


        // --------------------------------------------------------
        // Ignore generic VALUE.
        //
        // VALUE without a parent is not enough information to
        // create a logical field.
        // --------------------------------------------------------

        if (
            current === "VALUE" ||
            current === "QTY" ||
            current === "FREE" ||
            current === "QUANTITY"
        ) {
            continue;
        }


        // --------------------------------------------------------
        // Normal parent definition.
        // --------------------------------------------------------

        const definition =
            definitions[
                current
            ];


        if (!definition) {
            continue;
        }


        result.push(
            makeColumn(
                token.start,
                token.text,
                definition.field,
                definition.type,
                {
                    source:
                        "code-name",
                    row: 0
                }
            )
        );

    }


    // ============================================================
    // PARENT COLUMNS
    //
    // Include opening, purchase, sales AND closing.
    // ============================================================

    const parentColumns =
        result.filter(
            x =>
                [
                    "opening",
                    "purchase",
                    "sales",
                    "closing"
                ].includes(
                    x.field
                )
        );


    // ============================================================
    // SORT PARENTS BY PHYSICAL POSITION
    // ============================================================

    parentColumns.sort(
        (
            a,
            b
        ) =>
            a.position -
            b.position
    );


    // ============================================================
    // CHILD TYPE
    // ============================================================

    for (
        const child
        of second
    ) {

        const type =
            childType(
                child.text
            );


        if (!type) {
            continue;
        }


        // --------------------------------------------------------
        // Find nearest parent on the LEFT.
        // --------------------------------------------------------

        let parent =
            null;


        for (
            const p
            of parentColumns
        ) {

            if (
                p.position <=
                child.start
            ) {

                if (
                    !parent ||
                    p.position >
                    parent.position
                ) {

                    parent =
                        p;

                }

            }

        }


        if (!parent) {
            continue;
        }


        // ========================================================
        // RESOLVE LOGICAL FIELD
        // ========================================================

        let field =
            parent.field;


        // --------------------------------------------------------
        // FREE columns
        // --------------------------------------------------------

        if (
            type === "FREE"
        ) {

            if (
                parent.field ===
                "purchase"
            ) {

                field =
                    "purchaseFree";

            }

            else if (
                parent.field ===
                "sales"
            ) {

                field =
                    "salesFree";

            }

            else if (
                parent.field ===
                "closing"
            ) {

                field =
                    "closingFree";

            }

            else if (
                parent.field ===
                "opening"
            ) {

                field =
                    "openingFree";

            }

            else {

                // Do not invent a field for unrelated parents.
                continue;

            }

        }


        // --------------------------------------------------------
        // VALUE columns
        // --------------------------------------------------------

        else if (
            type === "VALUE"
        ) {

            if (
                parent.field ===
                "purchase"
            ) {

                field =
                    "purchaseValue";

            }

            else if (
                parent.field ===
                "sales"
            ) {

                field =
                    "salesValue";

            }

            else if (
                parent.field ===
                "closing"
            ) {

                field =
                    "closingValue";

            }

            else if (
                parent.field ===
                "opening"
            ) {

                field =
                    "openingValue";

            }

            else {

                continue;

            }

        }


        // --------------------------------------------------------
        // QTY
        //
        // QTY simply represents the parent's logical field.
        // --------------------------------------------------------

        else {

            field =
                parent.field;

        }


        // ========================================================
        // PREVENT DUPLICATE DIRECT PARENT FIELD
        //
        // Example:
        //
        // PURCHASE header itself creates:
        //     purchase
        //
        // PURCHASE Qty creates the same logical field:
        //     purchase
        //
        // We must not keep two identical mappings.
        // ========================================================

        const alreadyExists =
            result.some(
                existing =>
                    existing.field === field &&
                    existing.position === child.start
            );


        if (alreadyExists) {
            continue;
        }


        // ========================================================
        // ADD CHILD COLUMN
        // ========================================================

        result.push(
            makeColumn(
                child.start,
                `${parent.header} + ${child.text}`,
                field,
                type === "VALUE"
                    ? "VALUE"
                    : "QTY",
                {
                    source:
                        "parent-child",
                    row: 1,
                    group:
                        parent.field
                }
            )
        );

    }


    // ============================================================
    // FINAL SORT
    // ============================================================

    result.sort(
        (
            a,
            b
        ) =>
            a.position -
            b.position
    );

    /*
     * IMPORTANT:
     * Header positions and data positions can differ in
     * CODE_NAME_STOCK. When the detector carries the source
     * data lines, use the real data token positions.
     *
     * If no data line is available, the original header-based
     * mapping is retained exactly as before.
     */
    /*
     * IMPORTANT:
     * CODE_NAME_STOCK cannot be calibrated from header positions.
     * The real data rows must be supplied by the caller.
     *
     * The caller should pass the TXT reader result as the second
     * argument to mapTXTHeader().
     */
    getCodeNameDataPositions(
        detector,
        result,
        source
    );

    result.sort(
        (
            a,
            b
        ) =>
            a.position -
            b.position
    );


    return result;

}


// ============================================================
// ITEM NAME / BOX / PACK / QTY FORMAT
// ============================================================
//
// Example:
// ITEM NAME BOX PACK OPQTY P_QTY REPL S_QTY B_QTY
//
// This is a single physical header row whose labels describe
// independent fixed-width fields.  It is intentionally handled
// before the generic MULTI_ROW logic so that:
//   ITEM NAME -> product
//   PACK     -> pack
//   OPQTY    -> opening
//   P_QTY    -> purchase
//   REPL     -> replacement
//   S_QTY    -> sales
//   B_QTY    -> closing
//
// BOX is a source-specific column with no canonical field, so it
// is deliberately not invented into the common record schema.
//
// IMPORTANT:
// - Header positions are retained.
// - No product-name splitting is performed here.
// - Existing generic MULTI_ROW behavior remains unchanged.
// ============================================================

function isItemNameBoxPackHeader(row) {

    const tokens = tokenize(row || "").map(
        token => compact(token.text)
    );

    return (
        tokens.length >= 8 &&
        tokens[0] === "ITEM" &&
        tokens[1] === "NAME" &&
        tokens[2] === "BOX" &&
        tokens[3] === "PACK" &&
        tokens[4] === "OPQTY" &&
        tokens[5] === "PQTY" &&
        tokens[6] === "REPL" &&
        tokens[7] === "SQTY" &&
        tokens[8] === "BQTY"
    );
}


function mapItemNameBoxPack(rows) {

    const result = [];

    const headerIndex = (rows || []).findIndex(
        row => isItemNameBoxPackHeader(row)
    );

    if (headerIndex < 0) {
        return result;
    }

    const header = rows[headerIndex] || "";
    const tokens = tokenize(header);

    const definitions = {
        "ITEM": {
            field: "product",
            type: "TEXT",
            group: "product"
        },
        "NAME": {
            field: null
        },
        "BOX": {
            field: null
        },
        "PACK": {
            field: "pack",
            type: "TEXT",
            group: "pack"
        },
        "OPQTY": {
            field: "opening",
            type: "QTY",
            group: "opening"
        },
        "PQTY": {
            field: "purchase",
            type: "QTY",
            group: "purchase"
        },
        "REPL": {
            field: "replacement",
            type: "QTY",
            group: "replacement"
        },
        "SQTY": {
            field: "sales",
            type: "QTY",
            group: "sales"
        },
        "BQTY": {
            field: "closing",
            type: "QTY",
            group: "closing"
        }
    };

    for (const token of tokens) {

        const key = compact(token.text);
        const definition = definitions[key];

        if (!definition || !definition.field) {
            continue;
        }

        result.push(
            makeColumn(
                token.start,
                token.text,
                definition.field,
                definition.type,
                {
                    source: "item-name-box-pack",
                    row: headerIndex,
                    group: definition.group,
                    confidence: 100
                }
            )
        );
    }

    return result;
}


// ============================================================
// GENERIC MULTI ROW
// ============================================================

function mapMultiRow(
    rows
) {

    const result = [];

    if (!rows || !rows.length) {
        return result;
    }

    // Source-specific ITEM NAME / BOX / PACK format.
    // Keep this branch isolated so existing generic MULTI_ROW
    // structures continue through the original logic unchanged.
    if (
        rows.some(
            row => isItemNameBoxPackHeader(row)
        )
    ) {
        return mapItemNameBoxPack(rows);
    }

    // Preserve the physical header rows exactly as supplied.
    const parentRow = rows[0] || "";
    const childRows = rows.slice(1);
    const parents = tokenize(parentRow);

    // Build parent columns only. Never map generic QTY/FREE/VALUE
    // from the parent row as standalone fields.
    const parentObjects = [];

    for (let i = 0; i < parents.length; i++) {

        const token = parents[i];
        const c = compact(token.text);

        // PRODUCT NAME is one physical logical field.
        if (
            c === "PRODUCT" &&
            parents[i + 1] &&
            compact(parents[i + 1].text) === "NAME"
        ) {
            const obj = makeColumn(
                token.start,
                `${token.text} ${parents[i + 1].text}`,
                "product",
                "TEXT",
                {
                    source: "parent",
                    row: 0,
                    group: "product"
                }
            );
            parentObjects.push(obj);
            result.push(obj);
            i++;
            continue;
        }

        // NAME after PRODUCT is part of PRODUCT NAME.
        if (
            c === "NAME" &&
            parents[i - 1] &&
            compact(parents[i - 1].text) === "PRODUCT"
        ) {
            continue;
        }

        let field = normalizeFieldToken(token.text);

        // Structure aliases.
        if (c === "OSTK") field = "opening";
        if (c === "OPSTK") field = "opening";
        if (c === "OPSTOCK") field = "opening";
        if (c === "OPNGBAL") field = "opening";
        if (c === "OPNGSTOCK") field = "opening";
        if (c === "RECEIPT") field = "purchase";
        if (c === "RCPT") field = "purchase";
        if (c === "PURC") field = "purchase";
        if (c === "PRQTY") field = "purchase";
        if (c === "SALE") field = "sales";
        if (c === "SALES") field = "sales";
        if (c === "PRVSA") field = "previousSales";
        if (c === "PRSALE") field = "previousSales";
        if (c === "CLOSBAL") field = "closing";
        if (c === "CLSTK") field = "closing";
        if (c === "CLSTOCK") field = "closing";
        if (c === "CLOSTK") field = "closing";
        if (c === "QOH") field = "closing";
        if (c === "CSTK") field = "closing";
        if (c === "CLOSE") field = "closing";
        if (c === "ORDQTY") field = "orderQty";
        if (c === "EXCES") field = "excess";
        if (c === "MOUT") field = "mOut";
        if (c === "DUMP") field = "dump";

        // Two ADJ columns in DEEPAA are physically distinct.
        if (c === "ADJ") {
            const previousAdj = parentObjects.filter(
                x => x.field === "adjustment" ||
                     x.field === "adjustmentMinus" ||
                     x.field === "adjustmentPlus"
            ).length;

            if (previousAdj === 0) field = "adjustmentMinus";
            else field = "adjustmentPlus";
        }

        if (!field) continue;

        // Generic labels cannot be parent columns.
        if (["qty", "free", "value", "stock", "total"].includes(field)) {
            continue;
        }

        let type = "QTY";
        if (["product", "productCode", "pack"].includes(field)) type = "TEXT";
        if (["rate", "value", "salesValue", "closingValue"].includes(field)) type = "VALUE";
        if (field === "expiry") type = "DATE";
        if (field === "age") type = "NUMBER";

        const obj = makeColumn(
            token.start,
            token.text,
            field,
            type,
            {
                source: "parent",
                row: 0,
                group: field
            }
        );

        parentObjects.push(obj);
        result.push(obj);
    }

    // Parent physical boundaries.
    for (let i = 0; i < parentObjects.length; i++) {
        parentObjects[i]._end =
            i < parentObjects.length - 1
                ? parentObjects[i + 1].position
                : Number.MAX_SAFE_INTEGER;
    }

    // Fields that may legitimately have QTY/FREE/VALUE children.
    const childCapable = new Set([
        "opening",
        "purchase",
        "sales",
        "closing",
        "purchaseReturn",
        "salesReturn",
        "adjustmentMinus",
        "adjustmentPlus",
        "total"
    ]);

    for (let rowIndex = 0; rowIndex < childRows.length; rowIndex++) {

        const childRow = childRows[rowIndex] || "";

        // A summary row is never a child header.
        if (isSummaryValueRow(childRow)) continue;

        const children = tokenize(childRow);

        for (const child of children) {

            const cc = compact(child.text);

            // AGE/DAYS is only meaningful as an explicit age field.
            if (cc === "AGE" || cc === "DAYS" || cc === "DAY") {
                result.push(
                    makeColumn(
                        child.start,
                        child.text,
                        "age",
                        "NUMBER",
                        {
                            source: "child",
                            row: rowIndex + 1,
                            group: "age"
                        }
                    )
                );
                continue;
            }

            let childKind = null;
            if (["QTY", "QUANTITY", "UNIT", "UNITS"].includes(cc)) childKind = "qty";
            if (cc === "FREE") childKind = "free";
            if (["VALUE", "VAL", "AMOUNT", "AMT"].includes(cc)) childKind = "value";
            if (["STOCK", "STK"].includes(cc)) childKind = "stock";

            if (!childKind) continue;

            // Find parent by actual physical position.
            let parent = parentObjects.find(
                p => child.start >= p.position && child.start < p._end
            );

            if (!parent) {
                parent = parentObjects
                    .filter(p => p.position <= child.start)
                    .sort((a, b) => b.position - a.position)[0] || null;
            }

            if (!parent) continue;

            // Never attach child columns to product/pack/rate/age.
            if (!childCapable.has(parent.field)) continue;

            let field = null;
            let type = "QTY";

            if (childKind === "qty") {
                field = parent.field;
            }
            else if (childKind === "free") {
                field = `${parent.field}Free`;
            }
            else if (childKind === "value") {
                field = `${parent.field}Value`;
                type = "VALUE";
            }
            else if (childKind === "stock") {
                // STOCK under OPEN/CLOSE refers to the parent quantity;
                // do not create a duplicate generic field.
                field = parent.field;
            }

            if (!field) continue;

            result.push(
                makeColumn(
                    child.start,
                    `${parent.header} + ${child.text}`,
                    field,
                    type,
                    {
                        source: "parent-child",
                        row: rowIndex + 1,
                        group: parent.field
                    }
                )
            );
        }
    }

    for (const item of result) {
        delete item._end;
    }

    return result;
}


// ============================================================
// SEMICOLON
// ============================================================

function mapSemicolon(
    row
) {

    const result = [];


    const parts =
        row
            .split(";")
            .map(clean);


    for (
        let i = 0;
        i < parts.length;
        i++
    ) {

        const text =
            parts[i];


        if (!text) {
            continue;
        }


        let field =
            normalizeFieldToken(
                text
            );


        /*
         * Pr.Sale is a previous sale field.
         */

        if (
            compact(text) ===
            "PRSALE"
        ) {

            field =
                "previousSales";

        }


        if (!field) {

            /*
             * Preserve unknown source column.
             */

            result.push(
                makeColumn(
                    i,
                    text,
                    null,
                    "UNKNOWN",
                    {
                        source:
                            "semicolon",
                        confidence:
                            0
                    }
                )
            );

            continue;

        }


        let type =
            "QTY";


        if (
            [
                "product",
                "productCode",
                "pack"
            ].includes(field)
        ) {

            type =
                "TEXT";

        }
        else if (
            [
                "rate",
                "salesValue",
                "closingValue"
            ].includes(field)
        ) {

            type =
                "VALUE";

        }
        else if (
            field ===
            "expiry"
        ) {

            type =
                "DATE";

        }


        result.push(
            makeColumn(
                i,
                text,
                field,
                type,
                {
                    source:
                        "semicolon"
                }
            )
        );

    }


    return result;

}


// ============================================================
// DEDUPLICATE
// ============================================================

function deduplicate(
    columns
) {

    const result = [];

    const seen =
        new Set();


    /*
     * Keep the first mapping for the same physical
     * position + field.
     */

    for (
        const column
        of columns.sort(
            (a, b) =>
                a.position -
                b.position
        )
    ) {

        const key =
            [
                column.position,
                column.field,
                column.type
            ].join("|");


        if (
            seen.has(key)
        ) {
            continue;
        }


        seen.add(key);

        result.push(
            column
        );

    }


    return result;

}


// ============================================================
// SPECIAL STRUCTURE DETECTION
// ============================================================

function detectStructure(
    detector,
    rows
) {

    const detection =
        upper(
            detector?.detection
        );


    const all =
        rows
            .map(upper)
            .join(" ");


    const c =
        compact(all);


    /*
     * Explicit detector structures.
     */

    if (
        detection ===
        "MEDICINE_STOCK_SALES"
    ) {

        return "MEDICINE_STOCK_SALES";

    }


    if (
        detection ===
        "FIXED_WIDTH_PARTICULARS"
    ) {

        return "FIXED_WIDTH_PARTICULARS";

    }


    if (
        c.includes(
            "DESCRIPTION/PACKING"
        )
    ) {

        return "DESCRIPTION_PACKING";

    }


    if (
        rows.some(
            row =>
                row.includes(";")
        )
    ) {

        return "SEMICOLON";

    }


    /*
     * Code/Name/Prate format.
     */

    if (
        c.includes("CODENAMEPRATE") &&
        c.includes("OPSTOCK") &&
        c.includes("PRETURN")
    ) {

        return "CODE_NAME_STOCK";

    }


    /*
     * ProductName / Pack / OpStk format.
     */

    if (
        c.includes("PRODUCTNAME") &&
        (
            c.includes("OPSTK") ||
            c.includes("OPSTOCK")
        ) &&
        (
            c.includes("RCPT") ||
            c.includes("PUR")
        )
    ) {

        return "PRODUCT_STOCK";

    }


    // --------------------------------------------------------
    // Known grouped formats
    // --------------------------------------------------------

    if (
        /PRODUCT\s+NAME/i.test(all) &&
        /RETAIL/i.test(all) &&
        /CASH/i.test(all)
    ) {
        return "PALANIAPPA";
    }

    if (
        /PRODUCT\s+NAME/i.test(all) &&
        /PURCH/i.test(all) &&
        /PREV/i.test(all) &&
        /CURRENT/i.test(all) &&
        /EXP/i.test(all)
    ) {
        return "CHELLAS";
    }

    if (
        /PRODUCT\s+NAME/i.test(all) &&
        /REC/i.test(all) &&
        /ORD\.?QTY/i.test(all)
    ) {
        return "DEEPAA";
    }

    if (
        /PRODUCT\s+NAME/i.test(all) &&
        /OP\.?QTY/i.test(all) &&
        /PR\.?QTY/i.test(all) &&
        /M\.?OUT/i.test(all)
    ) {
        return "FIXED_WIDTH_PARTICULARS";
    }

    if (rows.length >= 2) {
        return "MULTI_ROW";
    }

    return "SINGLE_ROW";

}


// ============================================================
// FIELD MAP
// ============================================================

function buildFieldMap(
    columns
) {

    const map = {};


    for (
        const column
        of columns
    ) {

        if (
            !column.field
        ) {
            continue;
        }


        /*
         * First physical mapping wins.
         */

        if (
            map[column.field]
        ) {
            continue;
        }


        map[column.field] = {

            position:
                column.position,

            header:
                column.header,

            type:
                column.type,

            group:
                column.group,

            confidence:
                column.confidence

        };

    }


    return map;

}


// ============================================================
// VALIDATION
// ============================================================
//
// IMPORTANT:
//
// Do NOT require opening/purchase/sales/closing for every
// statement.
//
// A valid source may contain only some of them.
//
// We require:
//   1. Actual header found
//   2. Product found
//   3. At least one additional usable field
//
// ============================================================

function validate(
    columns
) {

    const mapped =
        columns.filter(
            column =>
                Boolean(
                    column.field
                )
        );


    const fields =
        new Set(
            mapped.map(
                column =>
                    column.field
            )
        );


    const hasProduct =
        fields.has(
            "product"
        );


    const operationalFields = [

        "opening",
        "purchase",
        "purchaseFree",

        "sales",
        "salesFree",

        "closing",
        "closingFree",

        "closingValue",
        "salesValue",

        "purchaseReturn",
        "salesReturn",

        "adjustment",

        "previousSales",

        "lastSale",

        "expiry"

    ];


    const hasOperational =
        operationalFields.some(
            field =>
                fields.has(field)
        );


    const success =
        hasProduct &&
        hasOperational;


    return {

        success,

        hasProduct,

        hasOperational,

        mappedColumns:
            mapped.length,

        fields:
            Array.from(
                fields
            ),

        missing:
            success
                ? []
                : [
                    !hasProduct
                        ? "product"
                        : null,

                    !hasOperational
                        ? "usable stock/sales field"
                        : null
                ].filter(Boolean)

    };

}


// ============================================================
// MAIN MAPPER
// ============================================================

function mapTXTHeader(
    detector,
    source = null
) {

    if (!detector) {

        return {

            success:
                false,

            found:
                false,

            detection:
                null,

            structure:
                null,

            format:
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

            dataStartsAt:
                null,

            headerless:
                false,

            headers:
                [],

            headerText:
                "",

            columns:
                [],

            mapping:
                {},

            validation:
                null,

            message:
                "Detector result is required."

        };

    }


    /*
     * --------------------------------------------------------
     * Detector header rows.
     * --------------------------------------------------------
     */

    const rawRows =
        getHeaderRows(
            detector
        );


    if (!rawRows.length) {

        return {

            success:
                false,

            found:
                false,

            detection:
                detector.detection ??
                null,

            structure:
                null,

            format:
                null,

            confidence:
                0,

            headerStart:
                detector.headerStart ??
                null,

            headerEnd:
                detector.headerEnd ??
                null,

            productColumn:
                detector.productColumn ??
                null,

            dataStart:
                detector.dataStartsAt ??
                detector.dataStarts ??
                null,

            dataStartsAt:
                detector.dataStartsAt ??
                detector.dataStarts ??
                null,

            headerless:
                Boolean(
                    detector.headerless
                ),

            headers:
                [],

            headerText:
                "",

            columns:
                [],

            mapping:
                {},

            validation:
                null,

            message:
                "No detector header rows found."

        };

    }


    /*
     * --------------------------------------------------------
     * Select actual column rows.
     * --------------------------------------------------------
     */

    const rows =
        selectHeaderRows(
            rawRows
        );


    /*
     * --------------------------------------------------------
     * Structure.
     * --------------------------------------------------------
     */

    const structure =
        detectStructure(
            detector,
            rows
        );


    /*
     * --------------------------------------------------------
     * Product position.
     * --------------------------------------------------------
     */

    const productColumn =
        numberOrNull(
            detector.productColumn
        ) ??
        0;


    let columns = [];


    /*
     * --------------------------------------------------------
     * MEDICINE
     * --------------------------------------------------------
     */

    if (
        structure ===
        "MEDICINE_STOCK_SALES"
    ) {

        columns =
            mapMedicine(
                rows[0]
            );

    }


    /*
     * --------------------------------------------------------
     * DESCRIPTION/PACKING
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "DESCRIPTION_PACKING"
    ) {

        columns =
            mapDescriptionPacking(
                rows
            );

    }


    /*
     * --------------------------------------------------------
     * PARTICULARS
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "FIXED_WIDTH_PARTICULARS"
    ) {

        columns =
            mapSingleRow(
                rows[0]
            );

    }


    /*
     * --------------------------------------------------------
     * SEMICOLON
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "SEMICOLON"
    ) {

        columns =
            mapSemicolon(
                rows[0]
            );

    }


    /*
     * --------------------------------------------------------
     * CODE / NAME / PRATE
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "CODE_NAME_STOCK"
    ) {

        columns =
            mapCodeNameStructure(
                rows,
                detector,
                source
            );

    }


    /*
     * --------------------------------------------------------
     * PRODUCT STOCK
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "PRODUCT_STOCK"
    ) {

        columns =
            mapMultiRow(
                rows
            );

    }


    /*
     * --------------------------------------------------------
     * KNOWN GROUPED MULTI-ROW STRUCTURES
     * --------------------------------------------------------
     */

    else if (
        structure === "PALANIAPPA" ||
        structure === "CHELLAS" ||
        structure === "DEEPAA"
    ) {

        columns =
            mapMultiRow(
                rows
            );

    }


    /*
     * --------------------------------------------------------
     * MULTI ROW
     * --------------------------------------------------------
     */

    else if (
        structure ===
        "MULTI_ROW"
    ) {

        columns =
            mapMultiRow(
                rows
            );

    }


    /*
     * --------------------------------------------------------
     * SINGLE ROW
     * --------------------------------------------------------
     */

    else {

        columns =
            mapSingleRow(
                rows[0]
            );

    }


    /*
     * --------------------------------------------------------
     * Fallback product.
     * --------------------------------------------------------
     */

    if (
        !columns.some(
            column =>
                column.field ===
                "product"
        )
    ) {

        const productToken =
            tokenize(
                rows[0]
            ).find(
                token => {

                    const c =
                        compact(
                            token.text
                        );

                    return [

                        "PRODUCT",
                        "PRODUCTNAME",
                        "PARTICULAR",
                        "PARTICULARS",
                        "DESCRIPTION",
                        "MEDICINE"

                    ].includes(c);

                }
            );


        if (productToken) {

            columns.unshift(

                makeColumn(

                    productToken.start,

                    productToken.text,

                    "product",

                    "TEXT",

                    {
                        source:
                            "product-fallback",
                        confidence:
                            90
                    }

                )

            );

        }
        else {

            /*
             * Only use detector productColumn as a final
             * fallback. Do not invent a header name that
             * extractor could mistake for actual source text.
             */

            columns.unshift(

                makeColumn(

                    productColumn,

                    "PRODUCT",

                    "product",

                    "TEXT",

                    {
                        source:
                            "product-fallback",
                        confidence:
                            50
                    }

                )

            );

        }

    }


    /*
     * --------------------------------------------------------
     * Deduplicate.
     * --------------------------------------------------------
     */

    columns =
        deduplicate(
            columns
        );


    /*
     * --------------------------------------------------------
     * Validation.
     * --------------------------------------------------------
     */

    const validation =
        validate(
            columns
        );


    /*
     * --------------------------------------------------------
     * Field map.
     * --------------------------------------------------------
     */

    const fieldMap =
        buildFieldMap(
            columns
        );


    /*
     * --------------------------------------------------------
     * Data start.
     * --------------------------------------------------------
     */

    const dataStart =
        numberOrNull(detector.dataStartsAt) ??
        numberOrNull(detector.dataStarts) ??
        numberOrNull(detector.dataStart) ??
        numberOrNull(detector.dataStartLine) ??
        null;


    /*
     * --------------------------------------------------------
     * Confidence.
     * --------------------------------------------------------
     */

    const detectorConfidence =
        numberOrNull(
            detector.confidence
        ) ??
        0;


    const mappedCount =
        columns.filter(
            column =>
                Boolean(
                    column.field
                )
        ).length;


    let confidence =
        detectorConfidence;


    if (
        validation.success
    ) {

        confidence =
            Math.max(
                detectorConfidence,
                Math.min(
                    950,
                    500 +
                    mappedCount * 50
                )
            );

    }
    else {

        /*
         * Do not report an artificial 850/950 for a bad map.
         */

        confidence =
            Math.min(
                detectorConfidence,
                500
            );

    }


    /*
     * --------------------------------------------------------
     * Final mapping object.
     * --------------------------------------------------------
     */

    const mapping = {

        structure,

        format:
            structure,

        detection:
            detector.detection ??
            null,

        headerStart:
            detector.headerStart ??
            null,

        headerEnd:
            detector.headerEnd ??
            null,

        dataStart,

        dataStartsAt:
            dataStart,

        productColumn,

        headers:
            rows.slice(),

        columns:
            columns.slice(),

        fields:
            fieldMap

    };


    /*
     * --------------------------------------------------------
     * Also expose every field directly.
     *
     * This gives the extractor both:
     *
     * mapping.fields.product
     *
     * and
     *
     * mapping.product
     *
     * --------------------------------------------------------
     */

    for (
        const [field, value]
        of Object.entries(
            fieldMap
        )
    ) {

        mapping[field] =
            value;

    }


    /*
     * --------------------------------------------------------
     * Final result.
     * --------------------------------------------------------
     */

    return {

        success:
            validation.success,

        found:
            columns.length > 0,

        detection:
            detector.detection ??
            null,

        structure,

        format:
            structure,

        confidence,

        headerStart:
            detector.headerStart ??
            null,

        headerEnd:
            detector.headerEnd ??
            null,

        productColumn,

        dataStart,

        dataStartsAt:
            dataStart,

        headerless:
            Boolean(
                detector.headerless
            ),

        headerText:
            rows.join(" "),

        headers:
            rows.slice(),

        columns,

        mapping,

        validation,

        message:
            validation.success
                ? ""
                : `Missing required mapping: ${validation.missing.join(", ")}`

    };

}


// ============================================================
// COMPATIBILITY FUNCTIONS
// ============================================================

const mapHeaderTXT =
    mapTXTHeader;

const mapTXTHeaders =
    mapTXTHeader;

const mapHeader =
    mapTXTHeader;


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    mapTXTHeader,

    mapHeaderTXT,

    mapTXTHeaders,

    mapHeader

};
