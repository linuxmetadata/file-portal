const path = require("path");
const processStatement = require("./processStatement");

// ======================================================
// CHANGE THIS FILE PATH TO ANY EXCEL FILE YOU WANT TO TEST
// ======================================================

const file = path.join(
    __dirname,
    "input",
    "derma",
    "DERMANEX_ABHISHEK_PHARMA_UP415_SSS_1.XLS"
);

(async () => {

    console.log("--------------------------------");
    console.log("Testing processStatement()");
    console.log("--------------------------------");

    const result = await processStatement(file, "derma");

    console.log(JSON.stringify(result, null, 2));

})();