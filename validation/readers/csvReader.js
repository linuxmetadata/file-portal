const XLSX = require("xlsx");

function readWorkbook(filePath) {

    try {

        const workbook = XLSX.readFile(filePath, {
            raw: true
        });

        return workbook;

    } catch (err) {

        console.error("CSV Reader Error:", err.message);

        return null;

    }

}

module.exports = {
    readWorkbook
};