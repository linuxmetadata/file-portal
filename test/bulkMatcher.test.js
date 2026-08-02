const { bulkMatch } = require("../matcher/bulkMatcher");

const statements = [
    "EBERNET-15GM CREAM",
    "EBERNET-M CREAM 15GM",
    "PERCOMPA-2 TAB",
    "PERCOMPA-6 TAB",
    "UNKNOWN"
];

const priceList = [
    "EBERNET CREAM 15GM",
    "EBERNET M CREAM 15GM",
    "PERCOMPA 2MG",
    "PERCOMPA 6MG"
];

console.table(
    bulkMatch(statements, priceList)
);