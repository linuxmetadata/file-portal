const XLSX = require("xlsx");

const PRODUCT_PATTERNS = [

    /PRODUCT/,
    /ITEM/,
    /DESCRIPTION/,
    /Party Name/,

    /PRODUCT\s*NAME/,
    /ITEM\s*NAME/,

    /PRODNAME/,
    /PRODUCTNAME/,

    /NAMETODISPLAY/,

    /^NAME$/,

    /PARTICULAR/,
    /MEDICINE/,
    /DRUG/

];

const SUPPORTING_HEADERS = [
    /QTY/,
    /QUANTITY/,
    /BATCH/,
    /EXP/,
    /EXPIRY/,
    /MRP/,
    /RATE/,
    /OPENING/,
    /CLOSING/,
    /PURCHASE/,
    /SALE/,
    /VALUE/,
    /STOCK/
];

function normalize(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}

function detectWorkbook(workbook) {

    let best = null;

    for (const sheetName of workbook.SheetNames) {

        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: ""
        });

        for (let r = 0; r < Math.min(rows.length, 50); r++) {

            const row = rows[r].map(normalize);

            let score = 0;
            let productColumn = -1;
            let productHeader = "";

            row.forEach((cell, c) => {

                if (!cell) return;

                if (PRODUCT_PATTERNS.some(p => p.test(cell))) {

                    score += 10;

                    if (productColumn === -1) {

                        productColumn = c;
                        productHeader = cell;

                    }

                }

                if (SUPPORTING_HEADERS.some(p => p.test(cell))) {

                    score += 2;

                }

            });

            if (
                productColumn !== -1 &&
                (!best || score > best.score)
            ) {

                best = {

                    found: true,

                    score,

                    sheetName,

                    headerRow: r,

                    productColumn,

                    productHeader

                };

            }

        }

    }

    return best || { found: false };

}

module.exports = {
    detectWorkbook,
    detectTable: detectWorkbook
};