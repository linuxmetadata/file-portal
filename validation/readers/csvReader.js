const XLSX = require("xlsx");

function readWorkbook(filePath) {

    try {

        const workbook = XLSX.readFile(filePath, {
            type: "file",
            raw: true
        });

        return workbook;

    } catch (err) {

        return null;

    }

}

module.exports = {
    readWorkbook
};