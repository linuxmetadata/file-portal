const { normalizeProduct } = require("../matcher/normalizer");

const products = [

    "PERCOMPA TABLET",

    "RABELIN CAPS",

    "FERIZAC SYRUP",

    "EBERNET LOTION 15 GM",

    "IBFLUX 200 ML",

    "ULIFUSE INJECTION"

];

for (const product of products) {

    console.log("--------------------------------");

    console.log("Original :", product);

    console.log("Normalized :", normalizeProduct(product));

}