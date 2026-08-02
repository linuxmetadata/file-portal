/**
 * ==========================================
 * RAW EXACT MATCH
 * ==========================================
 *
 * Checks statement product against price list
 * without any modification.
 */

function rawMatch(statementProduct, priceList) {

    if (!statementProduct || !priceList.length) {
        return null;
    }

    const statement = statementProduct.trim().toUpperCase();

    for (const product of priceList) {

        const priceProduct = product.trim().toUpperCase();

        if (statement === priceProduct) {
            return product;
        }

    }

    return null;

}

module.exports = {

    rawMatch

};