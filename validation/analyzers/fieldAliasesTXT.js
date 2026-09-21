/**
 * ============================================================
 * TXT FIELD ALIASES
 * ============================================================
 *
 * Purpose:
 * Convert different source header names into one common
 * logical field name.
 *
 * IMPORTANT:
 * This is NOT a statement/company structure.
 * It is only a vocabulary layer.
 *
 * Example:
 *
 *   "PUR."       -> purchase
 *   "PURCHASE"   -> purchase
 *   "RECEIPTS"   -> purchase
 *   "INWARD"     -> purchase
 *
 * Existing extraction logic is not changed here.
 * ============================================================
 */


// ============================================================
// NORMALIZATION
// ============================================================

function normalizeHeader(value) {

    return String(value || "")
        .toUpperCase()
        .replace(/[()[\]{}<>:+\-_/\\.,'"`]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// ============================================================
// FIELD ALIASES
// ============================================================

const FIELD_ALIASES = {

    // --------------------------------------------------------
    // PRODUCT
    // --------------------------------------------------------

    product: [
        "PRODUCT",
        "PRODUCT NAME",
        "PRODUCTNAME",
        "NAME",
        "DESCRIPTION",
        "DESCRIPTION PACKING",
        "PARTICULAR",
        "PARTICULARS",
        "ITEM",
        "ITEM NAME",
        "MEDICINE",
        "MEDICINE NAME"
    ],


    // --------------------------------------------------------
    // PRODUCT CODE
    // --------------------------------------------------------

    productCode: [
        "CODE",
        "PRODUCT CODE",
        "PRODUCTCODE",
        "ITEM CODE",
        "ITEMCODE",
        "SKU",
        "SKU CODE"
    ],


    // --------------------------------------------------------
    // PACK
    // --------------------------------------------------------

    pack: [
        "PACK",
        "PACKING",
        "PKG",
        "PACKAGE",
        "PACK SIZE",
        "PACKING SIZE"
    ],


    // --------------------------------------------------------
    // AGE
    // --------------------------------------------------------

    age: [
        "AGE",
        "DAYS",
        "DAY"
    ],


    // --------------------------------------------------------
    // RATE / PRICE
    // --------------------------------------------------------

    rate: [
        "RATE",
        "PRATE",
        "P RATE",
        "PRICE",
        "UNIT RATE",
        "UNIT PRICE"
    ],


    // --------------------------------------------------------
    // OPENING
    // --------------------------------------------------------

    opening: [
        "OPENING",
        "OPEN",
        "OP",
        "OB",
        "OSTK",
        "OPSTK",
        "OP STOCK",
        "OPSTOCK",
        "OPENING STOCK",
        "OPENING BALANCE",
        "OP BAL",
        "OPBAL"
    ],


    // --------------------------------------------------------
    // PURCHASE
    // --------------------------------------------------------

    purchase: [
        "PURCHASE",
        "PUR",
        "PURC",
        "PUR QTY",
        "PURQTY",
        "PURCHASE QTY",
        "RECEIPT",
        "RECEIPTS",
        "RECEIPT QTY",
        "RECEIPTS QTY",
        "RCPT",
        "RCPT QTY",
        "INWARD",
        "IN",
        "INWARD QTY"
    ],


    // --------------------------------------------------------
    // PURCHASE RETURN
    // --------------------------------------------------------

    purchaseReturn: [
        "PRETURN",
        "P RETURN",
        "PUR RETURN",
        "PURCHASE RETURN",
        "PURCHASE RETURNS",
        "PUR RETURN QTY",
        "PURCHASE RETURN QTY"
    ],


    // --------------------------------------------------------
    // SALES
    // --------------------------------------------------------

    sales: [
        "SALE",
        "SALES",
        "SALE QTY",
        "SALES QTY",
        "ISSUE",
        "ISSUES",
        "ISSUED",
        "ISSUE QTY",
        "OUTWARD",
        "OUT",
        "OUTWARD QTY"
    ],


    // --------------------------------------------------------
    // SALES RETURN
    // --------------------------------------------------------

    salesReturn: [
        "SRETURN",
        "S RETURN",
        "SALE RETURN",
        "SALES RETURN",
        "SALES RETURNS",
        "SALES RETURN QTY"
    ],


    // --------------------------------------------------------
    // CLOSING
    // --------------------------------------------------------

    closing: [
        "CLOSING",
        "CLOSE",
        "CL",
        "CB",
        "CSTK",
        "CLSTK",
        "CL STOCK",
        "CLSTOCK",
        "CLOSING STOCK",
        "CLOSING BALANCE",
        "CLOSING BAL",
        "CL BAL",
        "CLBAL"
    ],


    // --------------------------------------------------------
    // QUANTITY
    // --------------------------------------------------------

    quantity: [
        "QTY",
        "QUANTITY",
        "UNIT",
        "UNITS"
    ],


    // --------------------------------------------------------
    // FREE
    // --------------------------------------------------------

    free: [
        "FREE",
        "FREE QTY",
        "FREE QUANTITY"
    ],


    // --------------------------------------------------------
    // VALUE
    // --------------------------------------------------------

    value: [
        "VALUE",
        "VAL",
        "AMOUNT",
        "AMT",
        "TOTAL VALUE"
    ],


    // --------------------------------------------------------
    // SALES VALUE
    // --------------------------------------------------------

    salesValue: [
        "SVALUE",
        "S VALUE",
        "SALE VALUE",
        "SALES VALUE",
        "SALES AMOUNT",
        "SALE AMOUNT"
    ],


    // --------------------------------------------------------
    // PURCHASE VALUE
    // --------------------------------------------------------

    purchaseValue: [
        "PURCHASE VALUE",
        "PURCHASE AMOUNT",
        "PUR VALUE",
        "PUR VALUE"
    ],


    // --------------------------------------------------------
    // CLOSING VALUE
    // --------------------------------------------------------

    closingValue: [
        "CL VALUE",
        "CLVALUE",
        "CLOSING VALUE",
        "CLOSING AMOUNT",
        "CLOSING STOCK VALUE"
    ],


    // --------------------------------------------------------
    // ADJUSTMENT PLUS / CREDIT
    // --------------------------------------------------------

    adjustmentPlus: [
        "CR",
        "CREDIT",
        "CR NO",
        "CRNO",
        "ST",
        "ST +",
        "ST+",
        "ST IN",
        "ST IN QTY"
    ],


    // --------------------------------------------------------
    // ADJUSTMENT MINUS / DEBIT
    // --------------------------------------------------------

    adjustmentMinus: [
        "DR",
        "DEBIT",
        "DR NO",
        "DRNO",
        "ST -",
        "ST-",
        "ST OUT",
        "ST OUT QTY"
    ],


    // --------------------------------------------------------
    // EXCESS
    // --------------------------------------------------------

    excess: [
        "EXCESS",
        "EXCESS QTY"
    ],


    // --------------------------------------------------------
    // SHORT
    // --------------------------------------------------------

    short: [
        "SHORT",
        "SHORTAGE",
        "SHORT QTY"
    ],


    // --------------------------------------------------------
    // PREVIOUS SALES
    // --------------------------------------------------------

    previousSales: [
        "PRVSA",
        "PR SALE",
        "PRSALE",
        "PREVIOUS SALE",
        "PREVIOUS SALES"
    ],


    // --------------------------------------------------------
    // LAST SALE
    // --------------------------------------------------------

    lastSale: [
        "LAST SALE",
        "LAST SALES",
        "LASTSALE"
    ],


    // --------------------------------------------------------
    // EXPIRY
    // --------------------------------------------------------

    expiry: [
        "EXP",
        "EXPIRY",
        "EXP DATE",
        "EXPIRY DATE"
    ],


    // --------------------------------------------------------
    // TOTAL
    // --------------------------------------------------------

    total: [
        "TOTAL",
        "TOTAL QTY",
        "TOTAL QUANTITY",
        "TOTAL STOCK"
    ]

};


// ============================================================
// BUILD REVERSE LOOKUP
// ============================================================

const ALIAS_LOOKUP = new Map();

for (
    const [field, aliases]
    of Object.entries(FIELD_ALIASES)
) {

    for (
        const alias
        of aliases
    ) {

        const normalized =
            normalizeHeader(alias);

        if (!normalized) {
            continue;
        }

        /*
         * First definition wins.
         *
         * This prevents later aliases from silently
         * changing an already-established meaning.
         */
        if (
            !ALIAS_LOOKUP.has(
                normalized
            )
        ) {

            ALIAS_LOOKUP.set(
                normalized,
                field
            );

        }

    }

}


// ============================================================
// EXACT MATCH
// ============================================================

function resolveAlias(
    value
) {

    const normalized =
        normalizeHeader(
            value
        );

    if (!normalized) {
        return null;
    }

    return (
        ALIAS_LOOKUP.get(
            normalized
        ) ||
        null
    );
}


// ============================================================
// GET ALL POSSIBLE MATCHES
// ============================================================

function findAliasMatches(
    value
) {

    const normalized =
        normalizeHeader(
            value
        );

    if (!normalized) {
        return [];
    }

    const matches = [];

    for (
        const [alias, field]
        of ALIAS_LOOKUP.entries()
    ) {

        if (
            alias === normalized
        ) {

            matches.push({
                field,
                alias,
                confidence: 100
            });

        }

    }

    return matches;
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    FIELD_ALIASES,

    ALIAS_LOOKUP,

    normalizeHeader,

    resolveAlias,

    findAliasMatches

};