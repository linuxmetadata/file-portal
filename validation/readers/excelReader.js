const XLSX = require("xlsx");

function readWorkbook(filePath) {

    try {

        const workbook = XLSX.readFile(filePath);

        return workbook;

    } catch (err) {

        return null;

    }

}

module.exports = {
    readWorkbook
};