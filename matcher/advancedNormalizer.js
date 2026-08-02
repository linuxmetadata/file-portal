/**
 * =====================================================
 * ADVANCED NORMALIZER
 * =====================================================
 *
 * Handles complex normalization.
 *
 * Example:
 * 100/10 -> 10/100
 */

function generateAlternatives(product) {

    if (!product) {
        return [];
    }

    const alternatives = [product.toUpperCase()];

    // Reverse ratio values
    const ratioRegex = /\b(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\b/g;

    let match;

    while ((match = ratioRegex.exec(product)) !== null) {

        const original = match[0];

        const reversed = `${match[2]}/${match[1]}`;

        alternatives.push(
            product
                .toUpperCase()
                .replace(original.toUpperCase(), reversed)
        );

    }

    return [...new Set(alternatives)];

}

module.exports = {

    generateAlternatives

};