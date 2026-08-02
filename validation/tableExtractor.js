const XLSX = require("xlsx");

function extractTable(
    workbook,
    detectionResult,
    division = "",
    filePath = ""
) {

    if (!detectionResult || !detectionResult.found) {
        return {
            success: false,
            reason: "Detector failed"
        };
    }

    const worksheet = workbook.Sheets[detectionResult.sheetName];

    if (!worksheet) {
        return {
            success: false,
            reason: "Worksheet not found"
        };
    }

    const headers = readHeaders(
        worksheet,
        detectionResult.headerRow
    );

    const rows = extractRows(
        worksheet,
        headers,
        detectionResult.headerRow,
        detectionResult.productColumn
    );

    return {

        success: true,

        division,

        fileName: require("path").basename(filePath),

        sheetName: detectionResult.sheetName,

        headerRow: detectionResult.headerRow,

        productColumn: detectionResult.productColumn,

        headers,

        rows

    };

}

/*-------------------------------------------------------*/
/* Read Header Row                                       */
/*-------------------------------------------------------*/

function readHeaders(worksheet, headerRow) {

    const headers = [];

    const range = XLSX.utils.decode_range(worksheet["!ref"]);

    for (let col = range.s.c; col <= range.e.c; col++) {

        const cellAddress = XLSX.utils.encode_cell({
            r: headerRow,
            c: col
        });

        const cell = worksheet[cellAddress];

        if (!cell) continue;

        const value = String(cell.v).trim();

        if (!value) continue;

        headers.push({
            column: col,
            header: value
        });

    }

    return headers;

}
/*-------------------------------------------------------*/
/* isInvalidProductText                                       */
/*-------------------------------------------------------*/
function isInvalidProductText(text) {

    text = String(text).toUpperCase().trim();

    const invalid = [

        "TOTAL",
        "GRAND TOTAL",
        "SUB TOTAL",

        "OPENING",
        "OPENING STOCK",

        "CLOSING",
        "CLOSING STOCK",

        "RECEIVE",
        "RECEIPT",

        "ISSUE",

        "BALANCE"

    ];

    return invalid.some(x => text.includes(x));

}

/*-------------------------------------------------------*/
/* Find First Data Row                                   */
/*-------------------------------------------------------*/

function findFirstDataRow(
    worksheet,
    headerRow,
    productColumn
) {

    const range = XLSX.utils.decode_range(worksheet["!ref"]);

    for (let row = headerRow + 1; row <= range.e.r; row++) {

        const address = XLSX.utils.encode_cell({
            r: row,
            c: productColumn
        });

        const cell = worksheet[address];

        if (!cell)
            continue;

        const value = String(cell.v || "").trim();

        if (!value)
            continue;

        if (isInvalidProductText(value))
            continue;

        return row;

    }

    return -1;

}

/*-------------------------------------------------------*/
/* Extract Rows                                           */
/*-------------------------------------------------------*/

function extractRows(
    worksheet,
    headers,
    headerRow,
    productColumn
) {

    const rows = [];

    const startRow = findFirstDataRow(
        worksheet,
        headerRow,
        productColumn
    );

    if (startRow === -1)
        return rows;

    const range = XLSX.utils.decode_range(
        worksheet["!ref"]
    );

    for (let r = startRow; r <= range.e.r; r++) {

        const productAddress = XLSX.utils.encode_cell({
            r,
            c: productColumn
        });

        const productCell = worksheet[productAddress];

        if (!productCell)
            continue;

        const product = String(productCell.v || "").trim();

        if (!product)
            continue;

        if (isInvalidProductText(product))
            break;

        const rowData = {

            excelRow: r + 1,

            product,

            values: {}

        };

        let emptyCount = 0;

        headers.forEach(h => {

            const address = XLSX.utils.encode_cell({

                r,

                c: h.column

            });

            const cell = worksheet[address];

            const value = cell ? cell.v : "";

            if (
                value === "" ||
                value === null ||
                value === undefined
            )
                emptyCount++;

            rowData.values[h.header] = value;

        });

        if (emptyCount === headers.length)
            break;

        rows.push(rowData);

    }

    return rows;

}

module.exports = {
    extractTable
};