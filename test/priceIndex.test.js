const {
    buildPriceIndex,
    getBrandProducts
} = require("../matcher/priceIndex");

const priceList = [

    "EBERNET CREAM 15GM",

    "EBERNET CREAM 30GM",

    "EBERNET M CREAM 15GM",

    "PERCOMPA 2MG",

    "PERCOMPA 6MG",

    "VALEPTOL CR 300 TAB"

];

const index = buildPriceIndex(priceList);

console.log(Object.keys(index));

console.log();

console.log(getBrandProducts(index, "EBERNET"));

console.log();

console.log(getBrandProducts(index, "PERCOMPA"));