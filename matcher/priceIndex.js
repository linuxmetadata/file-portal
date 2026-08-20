const { splitProduct } = require("./splitter");
const { normalizeProduct } = require("./normalizer");

/**
 * =====================================================
 * PRICE INDEX
 * =====================================================
 * Builds searchable index from the price list.
 * Every product is normalized before indexing.
 */

function buildPriceIndex(priceList) {

    const index = {};

    for (const product of priceList) {

        const originalName = String(
            product["Product Description"] || ""
        ).trim();

        if (!originalName)
            continue;

        // Normalize exactly the same way as statement products
        const normalizedName = normalizeProduct(originalName);

        const parsed = splitProduct(normalizedName);

        if (!index[parsed.brand]) {
            index[parsed.brand] = [];
        }

        index[parsed.brand].push({

            product,              // Original record
            parsed,
            normalizedName

        });

    }

    return index;
}

/**
 * =====================================================
 * Get products by brand
 * =====================================================
 */

function getBrandProducts(index, brand) {

    return index[brand] || [];

}

module.exports = {

    buildPriceIndex,
    getBrandProducts

};