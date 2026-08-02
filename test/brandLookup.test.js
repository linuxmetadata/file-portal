const { getBrandCandidates } = require("../matcher/brandLookup");

const priceList = [

    "EBERNET CREAM 15GM",

    "EBERNET CREAM 30GM",

    "EBERNET CREAM 60GM",

    "EBERNET LOTION 40GM",

    "EBERNET M CREAM 15GM",

    "EBERNET + CREAM 30GM",

    "PERCOMPA 2MG",

    "PERCOMPA 4MG"

];

const candidates = getBrandCandidates("EBERNET", priceList);

console.log(candidates);