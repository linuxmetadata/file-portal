const { getExcelFiles } = require("./reader");

const files = getExcelFiles();

console.log("Files Found :", files.length);

for (const file of files) {

    console.log("--------------------------------");

    console.log("Division :", file.division);

    console.log("File :", file.fileName);

    console.log("Sheets :", file.workbook.SheetNames);

}