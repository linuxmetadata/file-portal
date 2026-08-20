/**
 * ======================================================
 * PRODUCT TOKENIZER
 * ======================================================
 *
 * Converts one token into searchable tokens.
 */

const {
    kb,
    normalizeWord
} = require("./knowledgeBase");

function tokenize(token) {

    token = String(token || "")
        .trim()
        .toUpperCase();

    if (!token)
        return [];

    const tokens = [];

    //--------------------------------------------------
    // Original
    //--------------------------------------------------

    tokens.push(token);

    //--------------------------------------------------
    // Normalized Word
    //--------------------------------------------------

    const normalized = normalizeWord(token);

    if (normalized !== token) {

        tokens.push(normalized);

    }

    //--------------------------------------------------
    // Number + Unit
    // Example:
    // 100MG
    // 15GR
    // 60ML
    //--------------------------------------------------

    const unitPattern = kb.units.join("|");

    const unitRegex = new RegExp(

        `^(\\d+(?:\\.\\d+)?)([A-Z]+)$`

    );

    const unitMatch = token.match(unitRegex);

    if (unitMatch) {

        const number = unitMatch[1];

        let unit = unitMatch[2];

        unit = normalizeWord(unit);

        tokens.push(number);

        tokens.push(unit);

        tokens.push(number + unit);

    }

    //--------------------------------------------------
    // Ratio
    // Example:
    // 100/10
    //--------------------------------------------------

    const ratioMatch = token.match(

        /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/

    );

    if (ratioMatch) {

        tokens.push(ratioMatch[1]);

        tokens.push(ratioMatch[2]);

    }

    //--------------------------------------------------
    // Compound Strength
    // Example:
    // 100MG/500MG
    //--------------------------------------------------

    if (token.includes("/")) {

        token.split("/")

            .forEach(part => {

                part = part.trim();

                if (!part)
                    return;

                tokens.push(part);

                const match = part.match(

                    /^(\d+(?:\.\d+)?)([A-Z]+)$/

                );

                if (match) {

                    const number = match[1];

                    let unit = match[2];

                    unit = normalizeWord(unit);

                    tokens.push(number);

                    tokens.push(unit);

                    tokens.push(number + unit);

                }

            });

    }

    //--------------------------------------------------
    // Remove duplicates
    //--------------------------------------------------

    return [...new Set(tokens)];

}

module.exports = {

    tokenize

};