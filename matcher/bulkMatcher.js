const { buildPriceIndex } = require("./priceIndex");
const { matchProduct } = require("./index");

function bulkMatch(statementProducts, priceList) {

    const priceIndex = buildPriceIndex(priceList);

    const results = [];

    for (const statement of statementProducts) {

        const result = matchProduct(statement, priceIndex);

        results.push({

    statement,

    matched: result.matched,

    stage: result.stage,

    product: result.product,

    reason: result.reason || ""

});

    }

    return results;

}

module.exports = {
    bulkMatch
};