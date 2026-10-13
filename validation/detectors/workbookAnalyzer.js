const XLSX = require("xlsx");

function analyzeWorkbook(workbook) {

    const analysis = {

        totalSheets: workbook.SheetNames.length,

        sheets: []

    };

    workbook.SheetNames.forEach(sheetName => {

        const sheet = workbook.Sheets[sheetName];

        const range = sheet["!ref"]
            ? XLSX.utils.decode_range(sheet["!ref"])
            : null;

        const rows = range ? range.e.r + 1 : 0;
        const cols = range ? range.e.c + 1 : 0;

        const preview = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            blankrows: false
        }).slice(0, 10);

        analysis.sheets.push({

            sheetName,

            rows,

            columns: cols,

            preview

        });

    });

    return analysis;

}

module.exports = {
    analyzeWorkbook
};