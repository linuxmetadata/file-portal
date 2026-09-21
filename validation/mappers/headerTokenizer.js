/**
 * ======================================================
 * HEADER TOKENIZER
 * ======================================================
 *
 * Converts a header into normalized searchable tokens.
 *
 * Example:
 *
 * "Opening Qty"
 *      ↓
 * ["OPENING","QTY"]
 *
 * "Receipt/Pur Value"
 *      ↓
 * ["RECEIPT","PUR","VALUE"]
 *
 * "PQty"
 *      ↓
 * ["P","QTY"]
 */

function tokenizeHeader(header) {

    if (!header)
        return [];

    let text = String(header)
        .toUpperCase()
        .trim();

    // Replace separators
    text = text
        .replace(/[\/\\(),._-]/g, " ")
        .replace(/\s+/g, " ");

    // Split known pharma abbreviations
    text = text
        .replace(/PQTY/g, "P QTY")
        .replace(/SQTY/g, "S QTY")
        .replace(/PRET/g, "P RET")
        .replace(/SRET/g, "S RET")
        .replace(/PFREE/g, "P FREE")
        .replace(/SFREE/g, "S FREE")
        .replace(/PURRATE/g, "PUR RATE")
        .replace(/OPENINGQTY/g, "OPENING QTY")
        .replace(/CLOSINGQTY/g, "CLOSING QTY")
        .replace(/OPENINGVALUE/g, "OPENING VALUE")
        .replace(/CLOSINGVALUE/g, "CLOSING VALUE")
        .replace(/Cr/g, "CREDIT")
        .replace(/CREDIT/g, "CREDIT")
        .replace(/Dr/g, "DEBIT")
        .replace(/DEBIT/g, "DEBIT")
        .replace(/dr/g, "DEBIT")
        .replace(/cr/g, "CREDIT");

    const tokens = text
        .split(/\s+/)
        .filter(Boolean);

    return [...new Set(tokens)];

}

module.exports = {

    tokenizeHeader

};