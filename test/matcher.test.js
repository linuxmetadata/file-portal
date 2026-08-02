const { matchProduct } = require("../matcher");

const priceList = [

    "EBERNET CREAM 15GM",
    "EBERNET CREAM 30GM",
    "EBERNET M CREAM 15GM",
    "VALEPTOL CR 300 TAB",
    "PERCOMPA 2MG",
    "PERCOMPA 6MG"

];

const statements = [

    "EBERNET-15GM CREAM",

    "EBERNET-M CREAM 15GM",

    "VALEPTOL-CR 300 TAB",

    "PERCOMPA-2 TAB",

    "PERCOMPA-6 TAB",

    "UNKNOWN PRODUCT"

];

for (const product of statements) {

    console.log("-----------------------------------");

    console.log(product);

    console.log(matchProduct(product, priceList));

}