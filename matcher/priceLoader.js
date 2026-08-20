const XLSX = require("xlsx");

/**
 * ======================================================
 * PRICE LIST LOADER
 * ======================================================
 *
 * Loads the Linux price list and converts it into
 * a clean array of product objects.
 */

function loadPriceList(filePath) {

    const workbook = XLSX.readFile(filePath);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {

        header: 1,

        blankrows: false,

        defval: ""

    });

    //--------------------------------------------------
    // Locate Header Row
    //--------------------------------------------------

    let headerRow = -1;

    for (let i = 0; i < rows.length; i++) {

        const row = rows[i].map(cell =>
            String(cell)
                .trim()
                .toUpperCase()
        );

        const hasProduct = row.includes("PRODUCT DESCRIPTION");
        const hasPack = row.includes("PACK");
        const hasCode = row.includes("PRODUCT CODE");

        if (hasProduct && hasPack && hasCode) {

            headerRow = i;
            break;

        }

    }

    if (headerRow === -1) {

        throw new Error("Price list header not found.");

    }

    //--------------------------------------------------
    // Headers
    //--------------------------------------------------

    const headers = rows[headerRow].map(h =>
        String(h).trim()
    );

    //--------------------------------------------------
    // Read Products
    //--------------------------------------------------

    const priceList = [];

    for (let i = headerRow + 1; i < rows.length; i++) {

        const row = rows[i];

        if (!row || row.length === 0)
            continue;

        const product = {};

        headers.forEach((header, index) => {

            product[header] = row[index];

        });

        if (
            !product["Product Description"] ||
            String(product["Product Description"]).trim() === ""
        ) {
            continue;
        }

        priceList.push(product);

    }

    return {

        headerRow: headerRow + 1,

        totalProducts: priceList.length,

        priceList

    };

}

module.exports = {

    loadPriceList

};