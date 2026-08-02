/**
 * ======================================================
 * PRODUCT TOKENIZER
 * ======================================================
 *
 * Converts one token into searchable tokens.
 *
 * Example:
 * 15GM
 * ↓
 * 15GM
 * 15
 * GM
 */

const CONFIG = require("./config");

function tokenize(token) {

    token = token.toUpperCase().trim();

    const tokens = [token];

    // -------------------------
    // Number + Unit
    // -------------------------

    const { kb } = require("./knowledgeBase");

const unitPattern = kb.units.join("|");

const unitRegex = new RegExp(
    `^(\\d+(?:\\.\\d+)?)(${unitPattern})$`
);

const unitMatch = token.match(unitRegex);

    if (unitMatch) {

        tokens.push(unitMatch[1]);
        tokens.push(unitMatch[2]);

    }

    // -------------------------
    // Ratio
    // -------------------------

    const ratioMatch = token.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);

    if (ratioMatch) {

        tokens.push(ratioMatch[1]);
        tokens.push(ratioMatch[2]);

    }

    return [...new Set(tokens)];

}

module.exports = {

    tokenize

};