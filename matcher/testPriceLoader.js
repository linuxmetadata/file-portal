const { loadPriceList } = require("./priceLoader");

const file = process.argv[2];

if (!file) {

    console.log("Usage:");
    console.log("node matcher/testPriceLoader.js <price-list>");

    process.exit(1);

}

const result = loadPriceList(file);

console.log("");

console.log("======================================");
console.log("PRICE LOADER TEST");
console.log("======================================");

console.log("Header Row    :", result.headerRow);
console.log("Total Products:", result.totalProducts);

console.log("");

console.log(result.priceList[0]);
console.log(result.priceList[1]);