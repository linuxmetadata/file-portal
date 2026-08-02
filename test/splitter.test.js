const { splitProduct } = require("../matcher/splitter");

const products = [

    "EBERNET-M CREAM 15 GM",

    "VALEPTOL-CR 300 TAB",

    "ACTIVE-MF LOTION 200ML",

    "BILAZO-40 TAB",

    "EBERNET + CREAM 30GM",

    "ACNESTAL-5.5 SOAP",

    "VYSOV D 100/10"

];

for (const product of products) {

    console.log("--------------------------------");

    console.log(splitProduct(product));

}