const { getExcelFiles } = require("./reader");
const { detectWorkbook } = require("./detector");

const files = getExcelFiles();

for (const file of files) {

    console.log("--------------------------------");

    console.log(file.fileName);

    console.log(detectWorkbook(file.workbook));

}