const { buildPriceIndex } = require("./priceIndex");
const { matchProduct } = require("./index");

function bulkMatch(extractedRows, priceList) {

    const priceIndex = buildPriceIndex(priceList);

    const results = [];

    for (const row of extractedRows) {

        const result = matchProduct(
            row.product,
            priceIndex
        );

        results.push({

            ...row,

            matched: result.matched,

            matchedProduct: result.product || "",

            stage: result.stage,

            reason: result.reason || ""

        });

    }

    return results;

}

module.exports = {
    bulkMatch
};