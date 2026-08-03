const path = require("path");

const { readWorkbook } = require("./excelReader");

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
                workbook: readWorkbook(filePath)
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