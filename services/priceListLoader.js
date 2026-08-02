const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const PRICE_FOLDER = path.join(__dirname, "..", "priceLists");

function loadPriceList() {

    if (!fs.existsSync(PRICE_FOLDER)) {
        throw new Error("Price List folder not found");
    }

    // Find the only Excel file in the folder
    const files = fs.readdirSync(PRICE_FOLDER)
        .filter(file =>
            file.endsWith(".xlsx") ||
            file.endsWith(".xls")
        );

    if (files.length === 0) {
        throw new Error("No Price List found");
    }

    if (files.length > 1) {
        throw new Error("Multiple Price Lists found. Keep only one file.");
    }

    const filePath = path.join(PRICE_FOLDER, files[0]);

    console.log("Loading Price List:", files[0]);

    const workbook = XLSX.readFile(filePath);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(sheet, {
    range: 5,      // Row 6 (0-based index)
    defval: "",
    raw: false
});
}

module.exports = {
    loadPriceList
};