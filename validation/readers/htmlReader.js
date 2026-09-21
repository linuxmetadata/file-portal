const XLSX = require("xlsx");

function readWorkbook(filePath) {

    try {

        const workbook = XLSX.readFile(filePath);

        return workbook;

    } catch (err) {

        console.error("HTML Reader Error:", err.message);

        return null;

    }

}

module.exports = {
    readWorkbook
};