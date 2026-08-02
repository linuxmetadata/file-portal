const { rawMatch } = require("../matcher/rawMatcher");

const priceList = [

    "EBERNET CREAM 15GM",
    "EBERNET CREAM 30GM",
    "PERCOMPA 2MG",
    "PERCOMPA 4MG"

];

console.log(rawMatch("PERCOMPA 2MG", priceList));

console.log(rawMatch("PERCOMPA 6MG", priceList));

console.log(rawMatch("EBERNET CREAM 15GM", priceList));