/**
 * =====================================================
 * ADVANCED NORMALIZER
 * =====================================================
 *
 * Generates alternate representations of products.
 */

function generateAlternatives(product) {

    if (!product) {
        return [];
    }

    const source = product.toUpperCase();

    const alternatives = [source];

    // -------------------------------------
    // Rule 1 : Reverse simple ratios
    // Example:
    // 100/10 -> 10/100
    // -------------------------------------

    const ratioRegex = /\b(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\b/g;

    let match;

    while ((match = ratioRegex.exec(source)) !== null) {

        const original = match[0];

        const reversed = `${match[2]}/${match[1]}`;

        alternatives.push(
            source.replace(original, reversed)
        );

    }

    // -------------------------------------
    // Rule 2 : Expand strength notation
    // Example:
    // 100/10/500MG
    // ->
    // 100MG/10MG/500MG
    // -------------------------------------

    const strengthRegex = /(\d+)\/(\d+)\/(\d+)\s*MG\b/g;

    while ((match = strengthRegex.exec(source)) !== null) {

        const expanded =
            `${match[1]}MG/${match[2]}MG/${match[3]}MG`;

        alternatives.push(
            source.replace(match[0], expanded)
        );

    }

    return [...new Set(alternatives)];

}

module.exports = {
    generateAlternatives
};