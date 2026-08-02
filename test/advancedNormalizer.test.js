const { generateAlternatives } = require("../matcher/advancedNormalizer");

const products = [

    "VYSOV D 100/10",

    "ABC 500/50 TAB",

    "XYZ 1000/50"

];

for (const product of products) {

    console.log("--------------------------------");

    console.log(product);

    console.log(generateAlternatives(product));

}