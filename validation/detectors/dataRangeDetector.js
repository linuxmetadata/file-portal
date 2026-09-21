const XLSX = require("xlsx");

//======================================================
// NORMALIZE
//======================================================

function normalize(value) {

    return String(value ?? "")
        .toUpperCase()
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


//======================================================
// NUMBER
//======================================================

function isNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return false;
    }

    if (typeof value === "number") {
        return Number.isFinite(value);
    }

    const text = String(value)
        .replace(/,/g, "")
        .trim();

    if (!text) {
        return false;
    }

    return Number.isFinite(
        Number(text)
    );

}


//======================================================
// FOOTERS
//======================================================

const FOOTERS = [

    "TOTAL",
    "GRAND TOTAL",
    "SUB TOTAL",
    "SUBTOTAL",
    "SUMMARY",
    "NET TOTAL",
    "NET VALUE",
    "NET AMOUNT",
    "PREPARED",
    "PREPARED BY",
    "AUTHORISED",
    "AUTHORIZED",
    "COMPUTER GENERATED",
    "PAGE"

];

function isFooter(value) {

    const text =
        normalize(value);

    if (!text) {
        return false;
    }

    return FOOTERS.some(word =>

        text === word ||
        text.startsWith(word + " ") ||
        text.startsWith(word + ":")

    );

}


//======================================================
// METADATA
//======================================================

function isMetadata(value) {

    const text =
        normalize(value);

    if (!text) {
        return true;
    }

    const patterns = [

        /^FROM\s+/,
        /^TO\s+/,
        /^REPORT/,
        /^STATEMENT/,
        /^STOCK REPORT/,
        /^STOCK & SALE/,
        /^STOCK AND SALE/,
        /^SALES REPORT/,
        /^PURCHASE REPORT/,
        /^COMPANY/,
        /^ADDRESS/,
        /^PHONE/,
        /^MOBILE/,
        /^EMAIL/,
        /^GSTIN/,
        /^PREPARED/,
        /^AUTHORIZED/,
        /^AUTHORISED/,
        /^PAGE\s+\d+/,
        /^PRINTED/,
        /^GENERATED/,
        /^DATE\s*:/,
        /^PERIOD\s*:/,
        /^LOCATION\s*:/,
        /^BRANCH\s*:/

    ];

    return patterns.some(
        pattern =>
            pattern.test(text)
    );

}


//======================================================
// PRODUCT TEXT
//======================================================

function looksLikeProduct(value) {

    const text =
        normalize(value);

    if (!text) {
        return false;
    }

    if (text.length < 2) {
        return false;
    }

    if (isNumber(text)) {
        return false;
    }

    if (isFooter(text)) {
        return false;
    }

    if (isMetadata(text)) {
        return false;
    }

    if (

        text === "ITEM" ||
        text === "PRODUCT" ||
        text === "PRODUCT NAME" ||
        text === "PRODUCTNAME" ||
        text === "DESCRIPTION" ||
        text === "ITEM DESCRIPTION" ||
        text === "PARTICULAR" ||
        text === "PARTICULARS" ||
        text === "NAME"

    ) {

        return false;

    }

    if (!/[A-Z]/.test(text)) {
        return false;
    }

    return true;

}


//======================================================
// SPECIAL FORMAT CHECK
//======================================================

function isProductStockQtyFormat(
    specialFormat
) {

    if (!specialFormat) {
        return false;
    }

    const value =
        normalize(
            specialFormat
        )
        .replace(/\s+/g, "_");

    return (

        value ===
            "PRODUCTS_STOCK_QTY_FORMAT"

        ||

        value ===
            "PRODUCTNAME_OS_PQTY_SQTY_STOCK_FORMAT"

        ||

        value ===
            "PRODUCT_NAME_OS_PQTY_SQTY_STOCK_FORMAT"

        ||

        value ===
            "PRODUCTNAME_STOCK_QTY_FORMAT"

    );

}


//======================================================
// FIND ACTUAL PRODUCT COLUMN
//======================================================

function detectProductColumn(
    rows,
    headerIndex,
    mappedProductColumn,
    numericColumns
) {

    //--------------------------------------------------
    // First try mapped product column.
    //
    // If the mapped column contains valid products,
    // strongly prefer it.
    //--------------------------------------------------

    if (
        Number.isInteger(
            Number(mappedProductColumn)
        ) &&
        Number(mappedProductColumn) >= 0
    ) {

        const mapped =
            Number(mappedProductColumn);

        let validCount = 0;

        for (
            let r = headerIndex + 1;
            r < rows.length &&
            r < headerIndex + 80;
            r++
        ) {

            const row =
                rows[r] || [];

            const value =
                normalize(
                    row[mapped]
                );

            if (
                looksLikeProduct(value)
            ) {

                validCount++;

            }

        }

        if (
            validCount > 0
        ) {

            console.log("");

            console.log(
                "========== PRODUCT COLUMN DETECTION =========="
            );

            console.log(
                "Mapped Product Column :",
                mappedProductColumn
            );

            console.log(
                "Detected Product Col  :",
                mapped
            );

            console.log(
                "Product Column Score  :",
                validCount * 10
            );

            console.log(
                "=============================================="
            );

            return mapped;

        }

    }


    //--------------------------------------------------
    // Fallback scan
    //--------------------------------------------------

    let bestColumn = -1;
    let bestScore = -1;

    const maxColumns =
        rows.reduce(

            (max, row) =>
                Math.max(
                    max,
                    row.length
                ),

            0

        );

    for (
        let c = 0;
        c < maxColumns;
        c++
    ) {

        let productCount = 0;
        let numericEvidence = 0;

        for (
            let r = headerIndex + 1;
            r < rows.length &&
            r < headerIndex + 80;
            r++
        ) {

            const row =
                rows[r] || [];

            const value =
                normalize(
                    row[c]
                );

            if (
                looksLikeProduct(value)
            ) {

                productCount++;

                let numbers = 0;

                for (
                    const nc of numericColumns
                ) {

                    if (
                        nc === c
                    ) {
                        continue;
                    }

                    if (
                        isNumber(
                            row[nc]
                        )
                    ) {

                        numbers++;

                    }

                }

                if (
                    numbers >= 1
                ) {

                    numericEvidence++;

                }

            }

        }

        let score =
            productCount * 2 +
            numericEvidence * 4;

        if (
            c === mappedProductColumn
        ) {

            score += 10;

        }

        if (
            score > bestScore
        ) {

            bestScore =
                score;

            bestColumn =
                c;

        }

    }

    console.log("");

    console.log(
        "========== PRODUCT COLUMN DETECTION =========="
    );

    console.log(
        "Mapped Product Column :",
        mappedProductColumn
    );

    console.log(
        "Detected Product Col  :",
        bestColumn
    );

    console.log(
        "Product Column Score  :",
        bestScore
    );

    console.log(
        "=============================================="
    );

    return bestColumn;

}


//======================================================
// FIND FIRST PRODUCT ROW
//======================================================

function findFirstProductRow(
    rows,
    headerIndex,
    productColumn,
    numericColumns,
    specialFormat
) {

    const start =
        Math.max(
            headerIndex + 1,
            0
        );

    console.log("");

    console.log(
        "========== SEARCH FIRST PRODUCT =========="
    );

    console.log(
        "Header Index   :",
        headerIndex
    );

    console.log(
        "Product Column :",
        productColumn
    );

    console.log(
        "Search Start   :",
        start + 1
    );

    //--------------------------------------------------
    // Search
    //--------------------------------------------------

    for (
        let r = start;
        r < rows.length;
        r++
    ) {

        const row =
            rows[r] || [];

        const product =
            normalize(
                row[productColumn]
            );

        if (
            product
        ) {

            console.log(
                "CHECK ROW",
                r + 1,
                "| PRODUCT =",
                product
            );

        }

        if (
            !looksLikeProduct(product)
        ) {

            continue;

        }

        //--------------------------------------------------
        // Numeric evidence
        //--------------------------------------------------

        let numericCount = 0;

        for (
            const c of numericColumns
        ) {

            if (
                c === productColumn
            ) {
                continue;
            }

            if (
                isNumber(
                    row[c]
                )
            ) {

                numericCount++;

            }

        }

        //--------------------------------------------------
        // Numeric validation
        //--------------------------------------------------

        const numericValidationRequired =
            numericColumns.length > 0;

        const specialFormatAllowsProductOnly =
            isProductStockQtyFormat(
                specialFormat
            );

        //--------------------------------------------------
        // IMPORTANT
        //
        // A valid product must NOT be rejected just
        // because all mapped movement columns happen
        // to be blank or zero.
        //
        // The row is still a valid product row.
        //--------------------------------------------------

        const productOnlyFallback =

            specialFormatAllowsProductOnly

            ||

            (
                numericValidationRequired &&
                numericCount === 0
            );

        if (

            productOnlyFallback ||

            !numericValidationRequired ||

            numericCount >= 1

        ) {

            console.log("");

            console.log(
                "FIRST PRODUCT ROW :",
                r + 1
            );

            console.log(
                "PRODUCT           :",
                product
            );

            console.log(
                "NUMERIC VALUES    :",
                numericCount
            );

            console.log(
                "NUMERIC VALIDATION:",
                productOnlyFallback

                    ? (
                        specialFormatAllowsProductOnly
                            ? "SPECIAL FORMAT - PRODUCT ONLY"
                            : "PRODUCT FALLBACK - NO NUMERIC EVIDENCE"
                    )

                    : numericValidationRequired
                        ? "REQUIRED"
                        : "NOT REQUIRED"
            );

            console.log(
                "=========================================="
            );

            return r;

        }

    }

    console.log(
        "NO PRODUCT ROW FOUND"
    );

    console.log(
        "=========================================="
    );

    return -1;

}


//======================================================
// FIND LAST PRODUCT ROW
//======================================================
//
// Blank rows DO NOT terminate the range.
//
// Footer DOES terminate the range.
//
// Metadata after products terminates the range.
//======================================================

function findLastProductRow(
    rows,
    firstRow,
    productColumn,
    numericColumns,
    specialFormat
) {

    let lastRow = -1;

    const specialFormatAllowsProductOnly =
        isProductStockQtyFormat(
            specialFormat
        );

    const numericValidationRequired =
        numericColumns.length > 0;

    for (
        let r = firstRow;
        r < rows.length;
        r++
    ) {

        const row =
            rows[r] || [];

        const product =
            normalize(
                row[productColumn]
            );

        //--------------------------------------------------
        // BLANK ROW
        //--------------------------------------------------

        if (!product) {

            continue;

        }

        //--------------------------------------------------
        // FOOTER
        //--------------------------------------------------

        if (isFooter(product)) {
    continue;
}

        //--------------------------------------------------
        // METADATA
        //--------------------------------------------------

        if (isMetadata(product)) {
    continue;
}

        //--------------------------------------------------
        // PRODUCT
        //--------------------------------------------------

        if (
            !looksLikeProduct(product)
        ) {

            continue;

        }

        //--------------------------------------------------
        // NUMERIC VALUES
        //--------------------------------------------------

        let numericCount = 0;

        for (
            const c of numericColumns
        ) {

            if (
                c === productColumn
            ) {

                continue;

            }

            if (
                isNumber(
                    row[c]
                )
            ) {

                numericCount++;

            }

        }

        //--------------------------------------------------
        // ACCEPT
        //--------------------------------------------------

        const productOnlyFallback =

            specialFormatAllowsProductOnly

            ||

            (
                numericValidationRequired &&
                numericCount === 0
            );

        if (

            productOnlyFallback ||

            !numericValidationRequired ||

            numericCount >= 1

        ) {

            lastRow = r;

        }

    }

    return lastRow;

}


//======================================================
// BUILD NUMERIC COLUMNS
//======================================================
//
// Only actual numeric/movement fields are used.
//
// Metadata fields such as:
//
// productCode
// productDescription
// specialFormat
//
// are excluded automatically because their values
// are not numeric column indexes.
//======================================================

function buildNumericColumns(
    columnMap
) {

    const numericFields = [

        "opening",
        "purchase",
        "purchaseFree",
        "purchaseReturn",
        "sales",
        "salesReturn",
        "free",
        "replacement",
        "branch",
        "credit",
        "debit",
        "adjustment",
        "closing",
        "rate",

        "purchaseValue",
        "salesValue",
        "closingValue",

        "stockValue",
        "saleValue"

    ];

    const result = [];

    for (
        const field of numericFields
    ) {

        if (
            !columnMap
        ) {
            continue;
        }

        const index =
            columnMap[field];

        if (
            index === null ||
            index === undefined ||
            index === ""
        ) {

            continue;

        }

        const numberIndex =
            Number(index);

        if (
            Number.isInteger(
                numberIndex
            ) &&
            numberIndex >= 0
        ) {

            if (
                !result.includes(
                    numberIndex
                )
            ) {

                result.push(
                    numberIndex
                );

            }

        }

    }

    return result;

}


//======================================================
// MAIN
//======================================================

function findDataRange(
    workbook,
    headerInfo,
    columnMap
) {

    //--------------------------------------------------
    // Safety
    //--------------------------------------------------

    if (
        !workbook ||
        !headerInfo
    ) {

        return {

            success: false,

            message:
                "Workbook or header information missing.",

            firstDataRow: -1,
            lastDataRow: -1,
            totalRows: 0

        };

    }

    //--------------------------------------------------
    // Sheet
    //--------------------------------------------------

    const sheet =
        workbook.Sheets[
            headerInfo.sheetName
        ];

    if (!sheet) {

        return {

            success: false,

            message:
                "Worksheet not found.",

            firstDataRow: -1,
            lastDataRow: -1,
            totalRows: 0

        };

    }

    //--------------------------------------------------
    // Rows
    //--------------------------------------------------

    const rows =
        XLSX.utils.sheet_to_json(
            sheet,
            {
                header: 1,
                blankrows: true,
                defval: ""
            }
        );

    //--------------------------------------------------
    // Header
    //--------------------------------------------------

    const headerIndex =
        Math.max(
            0,
            Number(
                headerInfo.headerRow
            ) - 1
        );

    //--------------------------------------------------
    // Safe map
    //--------------------------------------------------

    const map =
        columnMap &&
        typeof columnMap === "object"
            ? columnMap
            : {};

    //--------------------------------------------------
    // Numeric columns
    //--------------------------------------------------

    const numericColumns =
        buildNumericColumns(
            map
        );

    //--------------------------------------------------
    // Mapped product column
    //--------------------------------------------------

    const mappedProductColumn =
        Number(
            map.product
        );

    //--------------------------------------------------
    // Detect actual product column
    //--------------------------------------------------

    const productColumn =
        detectProductColumn(

            rows,

            headerIndex,

            Number.isFinite(
                mappedProductColumn
            )
                ? mappedProductColumn
                : -1,

            numericColumns

        );

    //--------------------------------------------------
    // Invalid product column
    //--------------------------------------------------

    if (
        productColumn < 0
    ) {

        return {

            success: false,

            message:
                "Product column could not be detected.",

            firstDataRow: -1,
            lastDataRow: -1,
            totalRows: 0,

            productColumn

        };

    }

    //--------------------------------------------------
    // Find first product
    //--------------------------------------------------

    const firstIndex =
        findFirstProductRow(

            rows,

            headerIndex,

            productColumn,

            numericColumns,

            map.specialFormat

        );

    //--------------------------------------------------
    // No product
    //--------------------------------------------------

    if (
        firstIndex < 0
    ) {

        return {

            success: false,

            message:
                "No valid product rows found after header.",

            firstDataRow: -1,
            lastDataRow: -1,
            totalRows: 0,

            productColumn

        };

    }

    //--------------------------------------------------
    // Last product
    //--------------------------------------------------

    const lastIndex =
        findLastProductRow(

            rows,

            firstIndex,

            productColumn,

            numericColumns,

            map.specialFormat

        );

    //--------------------------------------------------
    // Invalid range
    //--------------------------------------------------

    if (
        lastIndex < firstIndex
    ) {

        return {

            success: false,

            message:
                "Invalid data range.",

            firstDataRow:
                firstIndex + 1,

            lastDataRow:
                -1,

            totalRows: 0,

            productColumn

        };

    }

    //--------------------------------------------------
    // Excel row numbers
    //--------------------------------------------------

    const firstDataRow =
        firstIndex + 1;

    const lastDataRow =
        lastIndex + 1;

    const totalRows =
        lastDataRow -
        firstDataRow +
        1;

    //--------------------------------------------------
    // DEBUG
    //--------------------------------------------------

    console.log("");

    console.log(
        "===== DATA RANGE ====="
    );

    console.table({

        success: true,

        productColumn,

        firstDataRow,

        lastDataRow,

        totalRows

    });

    console.log(
        "======================"
    );

    //--------------------------------------------------
    // Result
    //--------------------------------------------------

    return {

        success: true,

        productColumn,

        firstDataRow,

        lastDataRow,

        totalRows

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    findDataRange

};