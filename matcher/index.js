const { rawMatch } = require("./rawMatcher");
const { splitProduct } = require("./splitter");
const { getBrandProducts } = require("./priceIndex");
const { progressiveMatch } = require("./progressiveMatcher");
const { applyRules } = require("./rules");
const { normalizeProduct } = require("./normalizer");
const { generateAlternatives } = require("./advancedNormalizer");

/**
 * =====================================================
 * MAIN PRODUCT MATCHER
 * =====================================================
 */

function matchProduct(statementProduct, priceIndex) {

    // -----------------------------
    // STEP 1 : Raw Match
    // -----------------------------
    const raw = rawMatch(statementProduct, priceIndex);

    if (raw) {
        return {

    matched: true,

    stage: "RAW",

    product: raw,

    reason: "Exact product match"

};
    }

    // -----------------------------
    // STEP 2 : Original Matching
    // -----------------------------
    let result = execute(statementProduct, priceIndex);

    if (result) {
        return {
            matched: true,
            stage: "ORIGINAL",
            product: result
        };
    }

    // -----------------------------
    // STEP 3 : Simple Normalization
    // -----------------------------
    const normalized = normalizeProduct(statementProduct);

    result = execute(normalized, priceIndex);

    if (result) {
        return {
            matched: true,
            stage: "NORMALIZED",
            product: result
        };
    }

    // -----------------------------
    // STEP 4 : Advanced Normalization
    // -----------------------------
    const alternatives = generateAlternatives(normalized);

    for (const alt of alternatives) {

        result = execute(alt, priceIndex);

        if (result) {

            return {
                matched: true,
                stage: "ADVANCED",
                product: result
            };

        }

    }

    // -----------------------------
    // NO MATCH
    // -----------------------------
    return {

        matched: false,

        stage: "NONE",

        product: null

    };

}

/**
 * Executes one matching cycle
 */

function execute(product, priceIndex) {

    const statement = splitProduct(product);

    const candidates = getBrandProducts(
    priceIndex,
    statement.brand
);

    if (candidates.length === 0)
        return null;

    if (candidates.length === 1)
        return candidates[0].product;

    const progressive = progressiveMatch(
        statement.parts,
        candidates
    );

    const finalCandidates = applyRules(
        statement.parts,
        progressive.remaining
    );

    if (finalCandidates.length === 1)
        return finalCandidates[0].product;

    return null;

}

module.exports = {

    matchProduct

};