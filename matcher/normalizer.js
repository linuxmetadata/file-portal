const { normalizeWord, kb } = require("./knowledgeBase");

/**
 * =====================================================
 * SIMPLE NORMALIZER
 * =====================================================
 * Standardizes product text using synonym rules.
 */

function normalizeProduct(product) {

    if (!product) return "";

    let text = product.toUpperCase();

    // Apply word replacements
    // Apply synonym normalization
const words = text.split(/\s+/);

text = words
    .map(normalizeWord)
    .join(" ");

    // Join number + unit
    const unitPattern = kb.units.join("|");

const unitRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s+(${unitPattern})\\b`,
    "g"
);

text = text.replace(unitRegex, "$1$2");

    // Remove duplicate spaces
    text = text.replace(/\s+/g, " ").trim();

    return text;

}

module.exports = {

    normalizeProduct

};