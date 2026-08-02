const { splitProduct } = require("../matcher/splitter");
const { getBrandCandidates } = require("../matcher/brandLookup");
const { progressiveMatch } = require("../matcher/progressiveMatcher");

const statement = splitProduct("EBERNET-15GM CREAM");

const priceList = [

    "EBERNET CREAM 15GM",

    "EBERNET CREAM 30GM",

    "EBERNET CREAM 60GM",

    "EBERNET LOTION 40GM",

    "EBERNET M CREAM 15GM",

    "EBERNET + CREAM 30GM"

];

const candidates = getBrandCandidates(statement.brand, priceList);

const result = progressiveMatch(statement.parts, candidates);

console.log("Statement");

console.log(statement);

console.log();

console.log("Trace");

console.table(result.trace);

console.log();

console.log("Remaining");

console.log(result.remaining.map(x => x.product));