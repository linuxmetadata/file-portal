/**
 * =====================================================
 * MATCH VALIDATOR
 * =====================================================
 */

function validate(results) {

    const summary = {
        total: results.length,
        matched: 0,
        unmatched: 0,
        raw: 0,
        original: 0,
        normalized: 0,
        advanced: 0,
        none: 0
    };

    for (const item of results) {

        if (item.matched) {

            summary.matched++;

            switch (item.stage) {

                case "RAW":
                    summary.raw++;
                    break;

                case "ORIGINAL":
                    summary.original++;
                    break;

                case "NORMALIZED":
                    summary.normalized++;
                    break;

                case "ADVANCED":
                    summary.advanced++;
                    break;
            }

        } else {

            summary.unmatched++;
            summary.none++;

        }

    }

    summary.matchRate =
        ((summary.matched / summary.total) * 100).toFixed(2) + "%";

    return summary;

}

module.exports = {

    validate

};