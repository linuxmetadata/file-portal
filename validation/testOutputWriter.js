const processStatement = require("./processStatement");
const { writeExtraction } = require("./outputWriter");
const path = require("path");

(async () => {

    const file = path.join(
        __dirname,
        "input",
        "derma",
        "DERMANEX_ABHISHEK_PHARMA_UP415_SSS_1.XLS"
    );

    const result = await processStatement(file, "derma");

    if (!result.success) {

        console.log(result);

        return;

    }

    const output = await writeExtraction(
        result.data,
        "SSS"
    );

    console.log(output);

})();