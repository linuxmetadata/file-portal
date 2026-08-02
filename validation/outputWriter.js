const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const STORAGE = path.join(
    __dirname,
    "..",
    "storage",
    "extraction"
);

async function writeExtraction(data, statementType = "SSS") {

    const folder = path.join(STORAGE, statementType);

    if (!fs.existsSync(folder))
        fs.mkdirSync(folder, { recursive: true });

    const file = path.join(
        folder,
        "Master_Extraction.xlsx"
    );

    const workbook = new ExcelJS.Workbook();

    if (fs.existsSync(file))
        await workbook.xlsx.readFile(file);

    let sheet = workbook.getWorksheet("Extracted_Data");

    if (!sheet) {

        sheet = workbook.addWorksheet("Extracted_Data");

        sheet.addRow([
            "Upload Time",
            "Division",
            "Statement Type",
            "File Name",
            "Sheet",
            "Excel Row",
            "Product",
            "Header",
            "Value"
        ]);

    }

    const uploadTime = new Date();

    data.rows.forEach(row => {

        Object.entries(row.values).forEach(([header, value]) => {

            sheet.addRow([
                uploadTime,
                data.division,
                statementType,
                data.fileName,
                data.sheetName,
                row.excelRow,
                row.product,
                header,
                value
            ]);

        });

    });

    await workbook.xlsx.writeFile(file);

    return {

        success: true,

        file

    };

}

module.exports = {
    writeExtraction
};