const { readWorkbook: readExcel } = require("./excelReader");
const { readWorkbook: readCSV } = require("./csvReader");
const { readTXT } = require("./txtReader");
const { readWorkbook: readHTML } = require("./htmlReader");
const { readWorkbook: readPDF } = require("./pdfReader");
const { readWorkbook: readSmartXLS } = require("./smartXlsReader");


const readers = {

    // Existing XLSX reader remains unchanged
    ".xlsx": readExcel,

    // XLS now goes through smart detection.
    // Normal XLS still falls back to the existing
    // excelReader internally.
    ".xls": readSmartXLS,

    ".csv": readCSV,

    ".txt": readTXT,

    ".html": readHTML,

    ".htm": readHTML,

    ".pdf": readPDF

};


function getReader(extension) {

    return readers[
        String(extension || "").toLowerCase()
    ] || null;

}


module.exports = {

    getReader

};