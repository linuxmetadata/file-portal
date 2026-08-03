const path = require("path");
const { readWorkbook } = require("./excelReader");

function readDocument(filePath) {

    const extension = path
        .extname(filePath)
        .toLowerCase();

    switch (extension) {

        case ".xlsx":
        case ".xls":
            return readWorkbook(filePath);

        default:
            throw new Error(
                `Unsupported file format: ${extension}`
            );

    }

}

module.exports = {
    readDocument
};