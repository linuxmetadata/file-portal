/**
 * ==========================================
 * RAW EXACT MATCH
 * ==========================================
 *
 * Checks statement product against the
 * indexed price list without normalization.
 */

function rawMatch(statementProduct, priceIndex) {

    if (!statementProduct || !priceIndex) {
        return null;
    }

    const statement = String(statementProduct)
        .trim()
        .toUpperCase();

    // Split to get the brand
    const brand = statement.split(" ")[0];

    const candidates = priceIndex[brand] || [];

    for (const item of candidates) {

        const priceProduct = String(
            item.product["Product Description"] || ""
        )
            .trim()
            .toUpperCase();

        if (statement === priceProduct) {
            return item.product;
        }
    }

    return null;
}

module.exports = {
    rawMatch
};