/**
 * =====================================================
 * REPORT GENERATOR
 * =====================================================
 */

function generateReport(results) {

    return results.map(item => ({

        statementProduct: item.statement,

        matchedProduct: item.product || "",

        matched: item.matched ? "YES" : "NO",

        stage: item.stage,

        remarks: item.reason || ""

    }));

}

module.exports = {

    generateReport

};