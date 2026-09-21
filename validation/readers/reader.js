const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const INPUT_FOLDER = path.join(__dirname, "input");

function getExcelFiles() {

    const files = [];

    if (!fs.existsSync(INPUT_FOLDER)) {
        return files;
    }

    const divisions = fs.readdirSync(INPUT_FOLDER);

    for (const division of divisions) {

        const divisionPath = path.join(INPUT_FOLDER, division);

        if (!fs.statSync(divisionPath).isDirectory()) continue;

        const divisionFiles = fs.readdirSync(divisionPath);

        for (const file of divisionFiles) {

            if (!/\.(xlsx|xls)$/i.test(file)) continue;

            const fullPath = path.join(divisionPath, file);

            const workbook = XLSX.readFile(fullPath);

            files.push({
                division,
                fileName: file,
                fullPath,
                workbook
            });

        }

    }

    return files;

}
function readWorkbook(filePath) {

    if (!fs.existsSync(filePath)) {
        throw new Error("File not found : " + filePath);
    }

    return XLSX.readFile(filePath);

}

module.exports = {
    getExcelFiles,
    readWorkbook
};