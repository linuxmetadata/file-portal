const { splitProduct } = require("../matcher/splitter");
const { getBrandCandidates } = require("../matcher/brandLookup");
const { progressiveMatch } = require("../matcher/progressiveMatcher");
const { applyRules } = require("../matcher/rules");

const statement = splitProduct("EBERNET-15GM CREAM");

const priceList = [

    "EBERNET CREAM 15GM",

    "EBERNET M CREAM 15GM",

    "EBERNET + CREAM 15GM",

    "EBERNET CREAM 30GM"

];

const candidates = getBrandCandidates(statement.brand, priceList);

const progressive = progressiveMatch(statement.parts, candidates);

const finalCandidates = applyRules(
    statement.parts,
    progressive.remaining
);

console.log("Remaining Candidates");

console.log(finalCandidates.map(x => x.product));