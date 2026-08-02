const { splitProduct } = require("./splitter");

/**
 * ====================================================
 * BRAND LOOKUP
 * ====================================================
 *
 * Returns all products having the same brand.
 *
 * No normalization.
 * No matching.
 * No scoring.
 */

function getBrandCandidates(statementBrand, priceList) {

    const candidates = [];

    for (const product of priceList) {

        const parsed = splitProduct(product);

        if (parsed.brand === statementBrand) {

            candidates.push({

                product,

                parsed

            });

        }

    }

    return candidates;

}

module.exports = {

    getBrandCandidates

};