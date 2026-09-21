/**
 * ======================================================
 * ROW VALIDATOR
 * ======================================================
 *
 * Determines whether a row is a valid product row.
 */

const INVALID_ROWS = [

    "OPENING",
    "OPENING VAL",
    "OPENING VALUE",

    "CLOSING",
    "CLOSING VAL",
    "CLOSING VALUE",

    "PURCHASE",
    "PURCHASE VALUE",

    "SALES",
    "SALES VALUE",

    "TOTAL",
    "GRAND TOTAL",
    "SUB TOTAL",

    "SUMMARY",

    "NET VALUE",
    "NET AMOUNT",

    "PAGE",

    "PREPARED",
    "PREPARED BY",

    "AUTHORISED",
    "AUTHORIZED",

    "COMPUTER GENERATED"

];

function normalize(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/[.:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}

function isProductRow(product) {

    const text = normalize(product);

    if (!text)
        return false;

    if (
        INVALID_ROWS.some(x => text === x)
    )
        return false;

    return true;

}

module.exports = {

    isProductRow

};