const path = require("path");

const supportedFormats = [
    ".xlsx",
    ".xls",
    ".csv"
];
const { readWorkbook: readExcel } = require("./excelReader");
const { readWorkbook: readCSV } = require("./csvReader");

function readDocument(filePath) {

    const extension = path
        .extname(filePath)
        .toLowerCase();

    switch (extension) {

        case ".xlsx":
case ".xls":

    return {
        success: true,
        type: "excel",
        workbook: readExcel(filePath)
    };

case ".csv":

    return {
        success: true,
        type: "csv",
        workbook: readCSV(filePath)
    };

        default:

            return {
                success: false,
                message: `Unsupported file format: ${extension}`
            };

    }

}

module.exports = {
    readDocument
};