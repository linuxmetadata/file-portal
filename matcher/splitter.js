/**
 * ======================================================
 * PRODUCT SPLITTER
 * ======================================================
 *
 * Converts product into:
 * Brand
 * Expanded searchable parts
 */

function expandToken(token) {

    token = token.toUpperCase();

    const expanded = [];

    // Original token
    expanded.push(token);

    // Match number + unit
    const unitMatch = token.match(/^(\d+(?:\.\d+)?)(MG|GM|ML|MCG|KG|L)$/);

    if (unitMatch) {

        expanded.push(unitMatch[1]); // Number

        expanded.push(unitMatch[2]); // Unit

    }

    return expanded;

}

function splitProduct(productName) {

    if (!productName) {

        return {

            original: "",

            brand: "",

            parts: []

        };

    }

    const original = String(productName || "").trim();

    let text = original

    .replace(/[()]/g, " ")

    .replace(/\+/g, " + ")

    .replace(/-/g, "")

    .replace(/[\/_]/g, " ")

    .replace(/\s+/g, " ")

    .trim();

    const tokens = text.split(" ");

    if (tokens.length === 0) {

        return {

            original,

            brand: "",

            parts: []

        };

    }

    const brand = tokens[0].toUpperCase();

    const parts = [];

    for (let i = 1; i < tokens.length; i++) {

        const { tokenize } = require("./tokenizer");

const expanded = tokenize(tokens[i]);

parts.push(...expanded);

    }

    // Remove duplicates
    const uniqueParts = [...new Set(parts)];

    return {

        original,

        brand,

        parts: uniqueParts,

        tokenCount: uniqueParts.length

    };

}

module.exports = {

    splitProduct

};