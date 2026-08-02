const { splitProduct } = require("./splitter");

/**
 * Build searchable index from price list
 */
function buildPriceIndex(priceList) {

    const index = {};

    for (const product of priceList) {

        const parsed = splitProduct(product);

        if (!index[parsed.brand]) {
            index[parsed.brand] = [];
        }

        index[parsed.brand].push({
            product,
            parsed
        });

    }

    return index;
}

/**
 * Get products by brand
 */
function getBrandProducts(index, brand) {

    return index[brand] || [];

}

module.exports = {
    buildPriceIndex,
    getBrandProducts
};