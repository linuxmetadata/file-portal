/**
 * ======================================================
 * EXTRACTOR
 * ======================================================
 *
 * Extracts product records from detected Excel data.
 *
 * Supported:
 *
 * - Normal Excel statements
 * - CODE + ITEM DESCRIPTION
 * - PRODUCT CODE + PRODUCT DESC
 * - PRODUCTS + STOCK QTY
 * - NAMETODISPLAY
 * - DERMANEX fixed-width
 * - INTEGRA fixed-width
 * - INFINA fixed-width
 *
 * IMPORTANT:
 *
 * dataRangeDetector returns Excel row numbers:
 *
 *     firstDataRow = 2
 *     lastDataRow  = 30
 *
 * This extractor converts them to zero-based array
 * indexes internally:
 *
 *     start = 1
 *     end   = 29
 *
 * Therefore Excel row 2 is correctly extracted.
 *
 * ======================================================
 */

const XLSX = require("xlsx");
const { isProductRow } = require("./validators/rowValidator");


//======================================================
// IGNORE ROWS
//======================================================

const IGNORE_ROWS = Object.freeze([

    "TOTAL",
    "GRAND TOTAL",
    "SUB TOTAL",
    "SUBTOTAL",

    "TOTAL QTY",
    "TOTAL QUANTITY",
    "TOTAL VALUE",

    "NET VALUE",
    "NET AMOUNT",
    "NET TOTAL",

    "SUMMARY",

    "OPENING VAL",
    "OPENING VALUE",

    "CLOSING VAL",
    "CLOSING VALUE",

    "SALES VALUE",
    "PURCHASE VALUE",

    "OPENING QTY",
    "CLOSING QTY",
    "SALES QTY",
    "PURCHASE QTY",

    "PAGE",

    "PREPARED",
    "PREPARED BY",

    "AUTHORISED",
    "AUTHORIZED",

    "COMPUTER GENERATED"

]);


//======================================================
// NUMBER
//======================================================

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }

    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : 0;

    }

    const text =
        String(value)
            .replace(/,/g, "")
            .trim();

    if (!text) {
        return 0;
    }


    // Handle quantity format such as "10:0".
    // Use the first number only when the entire value
    // matches the number:number pattern.
    const colonMatch = text.match(
        /^([-+]?\d+(?:\.\d+)?)\s*:\s*([-+]?\d+(?:\.\d+)?)$/
    );

    if (colonMatch) {
        return Number(colonMatch[1]);
    }

    const num = Number(text);

    return Number.isNaN(num)
        ? 0
        : num;


}


//======================================================
// GET VALUE
//======================================================

function getValue(
    row,
    index
) {

    if (
        index === null ||
        index === undefined ||
        index < 0
    ) {

        return 0;

    }

    const rawValue =
        row[index];

    return toNumber(
        rawValue
    );

}


//======================================================
// STRING VALUE
//======================================================

function getStringValue(
    row,
    index
) {

    if (
        !Array.isArray(row) ||
        index === null ||
        index === undefined ||
        index < 0
    ) {

        return "";

    }

    return String(

        row[index] === null ||
        row[index] === undefined

            ? ""

            : row[index]

    ).trim();

}


//======================================================
// STOP ROW
//======================================================

function shouldStop(product) {

    const text =
        String(
            product || ""
        )
        .trim()
        .toUpperCase();

    if (!text) {
        return true;
    }

        //--------------------------------------------------
    // TARGETED NON-PRODUCT ROW FILTER
    // Based on confirmed rows from the latest statement.
    //--------------------------------------------------

    if (
        text.startsWith("PURCHASE DETAIL") ||
        text.startsWith("SUPPLIER NAME") ||
        /^MARG ERP NANO\s+FOR\s+CHEMIST\b/.test(text) ||
        /^\d+\s+LINUX\s+LABORATOR/i.test(text)
    ) {
        return true;
    }

    return IGNORE_ROWS.some(
        word =>

            text === word ||
            text.startsWith(
                word + " "
            ) ||
            text.startsWith(
                word + ":"
            )

    );

}


//======================================================
// CHECK NUMERIC DATA
//======================================================

function hasNumericData(
    row,
    productColumn
) {

    if (!Array.isArray(row)) {
        return false;
    }

    for (
        let i = 0;
        i < row.length;
        i++
    ) {

        if (
            i === productColumn
        ) {
            continue;
        }

        const value =
            row[i];

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            continue;

        }

        if (
            typeof value === "number"
        ) {

            return true;

        }

        const text =
            String(value)
                .replace(/,/g, "")
                .trim();

        if (
            text !== "" &&
            !Number.isNaN(
                Number(text)
            )
        ) {

            return true;

        }

    }

    return false;

}


//======================================================
// MAPPED MOVEMENT
//======================================================

function hasMappedMovementColumns(
    map
) {

    if (!map) {
        return false;
    }

    const fields = [

        "opening",
        "pack",
        "purchase",
        "purchaseFree",
        "purchaseReturn",
        "sales",
        "salesReturn",
        "free",
        "replacement",
        "salesReplacement",
        "branch",
        "trnInQty",
        "trnOutQty",
        "credit",
        "debit",
        "adjustment",
        "brkexp",
        "closing",
        "rate",

        "purchaseValue",
        "salesValue",
        "closingValue"

    ];

    return fields.some(
        field =>

            map[field] !== null &&
            map[field] !== undefined

    );

}


//======================================================
// PRODUCT COLUMN
//======================================================

function getProductColumn(
    analysis,
    map
) {

    if (
        map &&
        map.product !== null &&
        map.product !== undefined
    ) {

        return Number(
            map.product
        );

    }

    if (
        analysis &&
        analysis.productColumn !== null &&
        analysis.productColumn !== undefined
    ) {

        return Number(
            analysis.productColumn
        );

    }

    if (
        analysis &&
        analysis.mapping &&
        analysis.mapping.product !== null &&
        analysis.mapping.product !== undefined
    ) {

        return Number(
            analysis.mapping.product
        );

    }

    return 0;

}


//======================================================
// PRODUCT DESCRIPTION
//======================================================

function getProductDescriptionColumn(
    analysis,
    map
) {

    if (
        map &&
        map.productDescription !== null &&
        map.productDescription !== undefined
    ) {

        return Number(
            map.productDescription
        );

    }

    if (
        analysis &&
        analysis.productDescriptionColumn !== null &&
        analysis.productDescriptionColumn !== undefined
    ) {

        return Number(
            analysis.productDescriptionColumn
        );

    }

    return null;

}


//======================================================
// PRODUCT CODE
//======================================================

function detectProductCodeColumn(
    rows,
    analysis,
    map
) {

    if (
        map &&
        map.productCode !== null &&
        map.productCode !== undefined
    ) {

        return Number(
            map.productCode
        );

    }

    if (
        analysis &&
        analysis.productCodeColumn !== null &&
        analysis.productCodeColumn !== undefined
    ) {

        return Number(
            analysis.productCodeColumn
        );

    }

    const headerRow =
        Number(
            analysis &&
            analysis.headerRow
                ? analysis.headerRow
                : 1
        ) - 1;

    const headers =
        rows[headerRow] || [];

    for (
        let h = 0;
        h < headers.length;
        h++
    ) {

        const header =
            String(
                headers[h] || ""
            )
            .replace(/\s+/g, "")
            .replace(/[._-]/g, "")
            .toUpperCase();

        if (

            header === "CODE" ||
            header === "PRODUCTCODE" ||
            header === "ITEMCODE" ||
            header === "PRODUCTNO" ||
            header === "PRODUCTNUMBER"

        ) {

            return h;

        }

    }

    return null;

}


//======================================================
// FIXED WIDTH FORMAT
//======================================================

function isNumericOrDashToken(
    value
) {

    const text =
        String(
            value == null
                ? ""
                : value
        )
        .trim()
        .replace(/,/g, "");

    if (!text) {
        return false;
    }

    if (
        /^-+$/.test(text)
    ) {

        return true;

    }

    return !Number.isNaN(
        Number(text)
    );

}


//======================================================
// DERMANEX DETECTION
//======================================================

function detectFixedWidthStockSalesFormat(
    rows,
    analysis
) {

    const headerRow =
        Number(
            analysis &&
            analysis.headerRow
                ? analysis.headerRow
                : 1
        ) - 1;

    const start =
        Math.max(
            0,
            headerRow - 3
        );

    const end =
        Math.min(
            rows.length - 1,
            headerRow + 5
        );

    let combinedHeader = "";

    for (
        let i = start;
        i <= end;
        i++
    ) {

        const text =
            String(
                (rows[i] || [])[0] || ""
            )
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

        if (text) {

            combinedHeader +=
                " " + text;

        }

    }
        if (
        /ITEM\s+DESCRIPTION/.test(combinedHeader) &&
        /OPENING/.test(combinedHeader) &&
        /RECEIPT/.test(combinedHeader) &&
        /ISSUE/.test(combinedHeader) &&
        /CLOSING/.test(combinedHeader) &&
        /DUMP/.test(combinedHeader)
    ) {
        return "BAJRANG_FIXED_WIDTH_STOCK_SALES";
    }

    if (

        /PRODUCT\s+NAME/.test(
            combinedHeader
        ) &&

        /PACKING/.test(
            combinedHeader
        ) &&

        /\bOP\b/.test(
            combinedHeader
        ) &&

        /RECEIPTS/.test(
            combinedHeader
        ) &&

        /SALES/.test(
            combinedHeader
        ) &&

        /CLOSING/.test(
            combinedHeader
        ) &&

        /QTY/.test(
            combinedHeader
        ) &&

        /VALUE/.test(
            combinedHeader
        )

    ) {

        return "DERMANEX_STOCK_SALES";

    }

    if (

        /PARTICULARS\s+PKG/.test(
            combinedHeader
        ) &&

        /OP/.test(
            combinedHeader
        ) &&

        /PR/.test(
            combinedHeader
        ) &&

        /CL/.test(
            combinedHeader
        ) &&

        /SAL/.test(
            combinedHeader
        )

    ) {

        return "INTEGRA_STOCK_SALES";

    }

    if (

        /PRODUCT\s+NAME/.test(
            combinedHeader
        ) &&

        /PACK/.test(
            combinedHeader
        ) &&

        /OPENING/.test(
            combinedHeader
        ) &&

        /RECEIPT/.test(
            combinedHeader
        ) &&

        /CLOSING/.test(
            combinedHeader
        )

    ) {

        return "INFINA_STOCK_SALES";

    }

    return null;

}


//======================================================
// INTEGRA FORMAT
//======================================================

function isIntegraSpecialFormat(
    analysis,
    map
) {

    return (

        analysis &&

        (

            analysis.specialFormat ===
                "INTEGRA_STOCK_SALES"

            ||

            analysis.specialFormat ===
                "FIXED_WIDTH_INTEGRA_STOCK_SALES"

        )

    )

    ||

    (

        map &&

        (

            map.specialFormat ===
                "INTEGRA_STOCK_SALES"

            ||

            map.specialFormat ===
                "FIXED_WIDTH_INTEGRA_STOCK_SALES"

        )

    );

}

//======================================================
// BAJRANG FIXED-WIDTH STOCK SALES PARSER
//======================================================

function parseBajrangFixedWidthStockSalesRow(
    rawRow
) {

    let text =
        String(
            rawRow || ""
        )
        .replace(/\u0000/g, "")
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .trim();

    if (!text) {
        return null;
    }

    // -----------------------------------------------
    // Ignore separator/footer rows
    // -----------------------------------------------

    if (
        /^-+$/.test(text) ||
        /^=+$/.test(text)
    ) {
        return null;
    }

    const upper =
        text.toUpperCase();

    if (
        upper.startsWith("TOTAL") ||
        upper.startsWith("GRAND TOTAL") ||
        upper.startsWith("SUB TOTAL") ||
        upper.startsWith("POWERED BY") ||
        upper.startsWith("PREPARED") ||
        upper.startsWith("AUTHORISED") ||
        upper.startsWith("AUTHORIZED")
    ) {
        return null;
    }

    // -----------------------------------------------
    // BAJRANG structure
    //
    // PRODUCT / PACK
    // OPENING QTY
    // OPENING VALUE
    // RECEIPT QTY
    // RECEIPT VALUE
    // ISSUE QTY
    // ISSUE VALUE
    // CLOSING QTY
    // CLOSING VALUE
    // DUMP
    //
    // Some rows contain fewer trailing values.
    // Therefore DO NOT require exactly 9 values.
    // -----------------------------------------------

    const tokens =
        text.split(/\s+/)
            .filter(Boolean);

    if (tokens.length < 3) {
        return null;
    }

    let numericStart = -1;

    /*
     * Find the first position where the remaining
     * tokens are all numeric or "-".
     *
     * Minimum expected movement structure:
     *
     * Opening Qty
     * Opening Value
     * Receipt Qty
     * Receipt Value
     * Issue Qty
     * Issue Value
     * Closing Qty
     *
     * Therefore at least 7 trailing values
     * are required.
     */

    for (
        let i = 1;
        i <= tokens.length - 7;
        i++
    ) {

        const tail =
            tokens.slice(i);

        if (
            tail.length < 7
        ) {
            continue;
        }

        if (
            tail.every(
                value =>
                    isNumericOrDashToken(value)
            )
        ) {

            numericStart = i;
            break;

        }

    }

    if (
        numericStart < 1
    ) {
        return null;
    }

    const product =
        tokens
            .slice(0, numericStart)
            .join(" ")
            .trim();

    const values =
        tokens.slice(numericStart);

    if (!product) {
        return null;
    }

    // -----------------------------------------------
    // Fixed positions
    // -----------------------------------------------

    return {

        product,

        opening:
            toNumber(values[0]),

        openingValue:
            toNumber(values[1]),

        purchase:
            toNumber(values[2]),

        purchaseValue:
            toNumber(values[3]),

        sales:
            toNumber(values[4]),

        salesValue:
            toNumber(values[5]),

        closing:
            toNumber(values[6]),

        // These columns may not exist in every row.
        // toNumber(undefined) safely returns 0.

        closingValue:
            toNumber(values[7]),

        dump:
            toNumber(values[8])

    };

}

//======================================================
// DERMANEX PARSER
//======================================================

function parseDermanexStockSalesRow(
    rawRow
) {

    let text =
        String(
            rawRow || ""
        )
        .replace(/\u0000/g, "")
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .trim();

    if (!text) {
        return null;
    }

    if (
        /^-+$/.test(text)
    ) {

        return null;

    }

    const upper =
        text.toUpperCase();

    if (

        upper.startsWith("TOTAL") ||
        upper.startsWith("GRAND TOTAL") ||
        upper.startsWith("SUB TOTAL") ||
        upper.startsWith("POWERED BY") ||
        upper.startsWith("PREPARED") ||
        upper.startsWith("AUTHORISED") ||
        upper.startsWith("AUTHORIZED")

    ) {

        return null;

    }

    const tokens =
        text.split(/\s+/);

    if (
        tokens.length < 9
    ) {

        return null;

    }

    let packIndex = -1;

    for (
        let p = 1;
        p <= tokens.length - 8;
        p++
    ) {

        const remaining =
            tokens.slice(
                p + 1
            );

        if (
            remaining.length !== 7
        ) {

            continue;

        }

        if (
            remaining.every(
                isNumericOrDashToken
            )
        ) {

            packIndex = p;
            break;

        }

    }

    if (
        packIndex < 1
    ) {

        return null;

    }

    const product =
        tokens
            .slice(
                0,
                packIndex
            )
            .join(" ")
            .trim();

    const pack =
        tokens[packIndex];

    const values =
        tokens.slice(
            packIndex + 1
        );

    if (

        !product ||
        !pack ||
        values.length !== 7

    ) {

        return null;

    }

    return {

        product,

        pack,

        opening:
            toNumber(values[0]),

        purchase:
            toNumber(values[1]),

        purchaseValue:
            toNumber(values[2]),

        sales:
            toNumber(values[3]),

        salesValue:
            toNumber(values[4]),

        closing:
            toNumber(values[5]),

        closingValue:
            toNumber(values[6])

    };

}


//======================================================
// INTEGRA PARSER
//======================================================

function parseIntegraStockSalesRow(
    rawRow
) {

    const text =
        String(
            rawRow || ""
        )
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (
        !text ||
        shouldStop(text)
    ) {

        return null;

    }

    if (

        /^[-=]+$/.test(text) ||
        /^TOTAL\b/i.test(text) ||
        /^GRAND\s+TOTAL\b/i.test(text) ||
        /^SUB\s+TOTAL\b/i.test(text)

    ) {

        return null;

    }

    const tokens =
        text.split(/\s+/);

    if (
        tokens.length < 10
    ) {

        return null;

    }

    let packIndex = -1;

    for (
        let p = 1;
        p <= tokens.length - 9;
        p++
    ) {

        const tail =
            tokens.slice(
                p + 1,
                p + 9
            );

        if (

            tail.length === 8 &&
            tail.every(
                isNumericOrDashToken
            )

        ) {

            packIndex = p;
            break;

        }

    }

    if (
        packIndex < 1
    ) {

        return null;

    }

    const product =
        tokens
            .slice(
                0,
                packIndex
            )
            .join(" ")
            .trim();

    const pack =
        tokens[packIndex];

    const values =
        tokens.slice(
            packIndex + 1,
            packIndex + 9
        );

    if (

        !product ||
        !pack ||
        values.length !== 8

    ) {

        return null;

    }

    return {

        product,

        pack,

        opening:
            toNumber(values[0]),

        purchase:
            toNumber(values[1]),

        salesReturn:
            toNumber(values[2]),

        sales:
            toNumber(values[3]),

        adjustment:
            toNumber(values[4]),

        closing:
            toNumber(values[5]),

        salesValue:
            toNumber(values[6]),

        closingValue:
            toNumber(values[7])

    };

}


//======================================================
// INFINA PARSER
//======================================================

function parseInfinaStockSalesRow(
    rawRow
) {

    const text =
        String(
            rawRow || ""
        )
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (

        !text ||
        shouldStop(text) ||
        /^[-=]+$/.test(text)

    ) {

        return null;

    }

    const tokens =
        text.split(/\s+/);

    if (
        tokens.length < 8
    ) {

        return null;

    }

    let packIndex = -1;

    for (
        let p = 1;
        p <= tokens.length - 7;
        p++
    ) {

        const tail =
            tokens.slice(
                p + 1
            );

        if (

            tail.length >= 7 &&
            tail.every(
                isNumericOrDashToken
            )

        ) {

            packIndex = p;
            break;

        }

    }

    if (
        packIndex < 1
    ) {

        return null;

    }

    const product =
        tokens
            .slice(
                0,
                packIndex
            )
            .join(" ")
            .trim();

    const pack =
        tokens[packIndex];

    const values =
        tokens.slice(
            packIndex + 1
        );

    if (

        !product ||
        !pack ||
        values.length < 7

    ) {

        return null;

    }

    return {

        product,

        pack,

        opening:
            toNumber(values[0]),

        purchase:
            toNumber(values[1]),

        sales:
            toNumber(values[2]),

        salesCash:
            toNumber(values[3]),

        closing:
            toNumber(
                values.length >= 10
                    ? values[6]
                    : values[
                        values.length - 3
                    ]
            ),

        closingValue:
            toNumber(
                values.length >= 10
                    ? values[8]
                    : values[
                        values.length - 2
                    ]
            ),

        age:
            toNumber(
                values[
                    values.length - 1
                ]
            )

    };

}

// ============================================================
// KABSON PHARMA - STOCK & SALES ANALYSIS
// ============================================================

function isKabsonStockSalesFormat(rows, analysis) {

    try {

        const headerRowIndex = Number(analysis?.headerRow || 1) - 1;

        const headerRow = rows[headerRowIndex] || [];

        const headers = headerRow.map(value =>
            String(value ?? "")
                .replace(/\s+/g, " ")
                .trim()
                .toUpperCase()
        );

        const requiredHeaders = [
            "ITEM DESCRIPTION",
            "OPENING",
            "RECEIPT",
            "ISSUE",
            "CLOSING M.EXP"
        ];

        const headersMatch =
            headers.length >= requiredHeaders.length &&
            requiredHeaders.every(
                (header, index) => headers[index] === header
            );

        if (!headersMatch) {
            return false;
        }

        // Make this detector specific to KABSON PHARMA.
        // This prevents this logic from affecting other statements
        // having a similar five-column structure.

        const previousRows = rows
            .slice(0, headerRowIndex)
            .flat()
            .map(value => String(value ?? "").trim().toUpperCase())
            .join(" ");

        return previousRows.includes("KABSON PHARMA");

    } catch (error) {

        console.error(
            "KABSON FORMAT DETECTION ERROR:",
            error.message
        );

        return false;
    }
}


// ------------------------------------------------------------
// Split Kabson product description into Product + Pack
// ------------------------------------------------------------

function splitKabsonProductAndPack(rawProduct) {

    const text = String(rawProduct ?? "")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) {
        return {
            product: "",
            pack: ""
        };
    }

    // First preference:
    // Original Kabson files normally have multiple spaces
    // between Product and Pack.
    const multiSpaceMatch = String(rawProduct)
        .match(/^(.+?)\s{2,}(.+?)\s*$/);

    if (multiSpaceMatch) {

        return {
            product: multiSpaceMatch[1].trim(),
            pack: multiSpaceMatch[2].trim()
        };
    }

    // Fallback:
    // Handles cases such as:
    //
    // HYDRAVO SKIN MOISTURIZ 50GRM
    // PRODUCT NAME 1X150
    // PRODUCT NAME 1X30 G
    // PRODUCT NAME 1X15GR

    const packMatch = text.match(
        /^(.*?)\s+((?:\d+\s*[xX]\s*\d+|\d+(?:\.\d+)?)[A-Za-z]*(?:\s+[A-Za-z]+)?)$/i
    );

    if (packMatch) {

        return {
            product: packMatch[1].trim(),
            pack: packMatch[2].trim()
        };
    }

    // If no pack pattern can be identified,
    // keep the complete text as Product.
    return {
        product: text,
        pack: ""
    };
}


// ------------------------------------------------------------
// Kabson Closing M.EXP parser
// ------------------------------------------------------------

function getKabsonClosingValue(value) {

    const text = String(value ?? "").trim();

    if (!text) {
        return 0;
    }

    // Dash means zero.
    if (/^-+$/.test(text)) {
        return 0;
    }

    // Examples:
    //
    // 16 1/27  -> 16
    // 5 4/26   -> 5
    // 2        -> 2
    //
    // We only need the quantity before the M.EXP value.

    const quantityMatch = text.match(
        /^[-+]?\d+(?:\.\d+)?/
    );

    if (!quantityMatch) {
        return 0;
    }

    return toNumber(quantityMatch[0]);
}


// ------------------------------------------------------------
// Kabson row parser
// ------------------------------------------------------------

function parseKabsonStockSalesRow(row, productColumn = 0) {

    if (!Array.isArray(row)) {
        return null;
    }

    const rawProduct = getStringValue(
        row,
        productColumn
    );

    if (!rawProduct) {
        return null;
    }

    const normalizedProduct = rawProduct
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

    // --------------------------------------------------------
    // Kabson section headings - NOT products
    // --------------------------------------------------------

    if (
        normalizedProduct === "LINUX DERMA DIV" ||
        normalizedProduct === "LINUX LABORATORIES PVT LTD"
    ) {
        return null;
    }

    // Existing footer / stop-row protection.
    if (shouldStop(rawProduct)) {
        return null;
    }

    const productPack = splitKabsonProductAndPack(
        rawProduct
    );

    if (!productPack.product) {
        return null;
    }

    // Kabson mapping:
    //
    // ITEM DESCRIPTION -> Product
    // OPENING          -> Opening
    // RECEIPT          -> Purchase
    // ISSUE            -> Sales
    // CLOSING M.EXP    -> Closing

    const opening = getValue(row, 1);

    const purchase = getValue(row, 2);

    const sales = getValue(row, 3);

    const closing = getKabsonClosingValue(
        row[4]
    );

    return {

        product: productPack.product,

        productDescription: productPack.product,

        pack: productPack.pack,

        opening: opening,

        purchase: purchase,

        sales: sales,

        closing: closing
    };
}

//======================================================
// UTKARSH TWO-ROW STOCK & SALES
//======================================================

function isUtkarshTwoRowStockSalesFormat(
    sourceHeaders
) {

    if (
        !Array.isArray(sourceHeaders) ||
        sourceHeaders.length < 12
    ) {

        return false;

    }

    const headers =
        sourceHeaders.map(
            value =>
                String(value ?? "")
                    .trim()
                    .toUpperCase()
        );

    return (

        headers[0] ===
            "ITEM DESCRIPTION"

        &&

        headers[1] ===
            "OPENING STOCK"

        &&

        headers[3] ===
            "PURCHASE FREE"

        &&

        headers[6] ===
            "=B+C+D STOCK"

        &&

        headers[8] ===
            "SALES FREE SAMPLE"

        &&

        headers[11] ===
            "=G H I STOCK"

    );

}

//======================================================
// UTKARSH NUMERIC BOUNDARY PARSER
//======================================================

function parseUtkarshNumericBoundaries(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return [];
    }

    const text = String(value);

    const matches =
        text.match(
            /[-+]?(?:\d+(?:\.\d+)?|\.\d+)/
        );

    if (!matches) {
        return [];
    }

    return text
        .match(
            /[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g
        )
        .map(
            value =>
                Number(value)
        );
}
//======================================================
// UTKARSH ROW PARSER
//======================================================

function parseUtkarshTwoRowStockSalesRow(
    row,
    productColumn = 0
) {

    if (!Array.isArray(row)) {
        return null;
    }

    const product =
        getStringValue(
            row,
            productColumn
        );

    if (!product) {
        return null;
    }

    if (shouldStop(product)) {
        return null;
    }

    //--------------------------------------------------
    // Physical source columns
    //--------------------------------------------------

    const opening = getValue(row, 1);
const purchase = getValue(row, 2);
const purchaseFree = getValue(row, 3);

// E = SALES RETURN + SALES RETURN FREE
const salesReturnValues =
    parseUtkarshNumericBoundaries(row[4]);

const salesReturn =
    salesReturnValues[0] ?? 0;

const salesReturnFree =
    salesReturnValues[1] ?? 0;

// F = REPLACEMENT
const replacement =
    getValue(row, 5);

// G = TOTAL
const total =
    getValue(row, 6);

// H = SALES
const sales =
    getValue(row, 7);

// I = SALES FREE + SALES SAMPLE
const salesValues =
    parseUtkarshNumericBoundaries(row[8]);

const salesFree =
    salesValues[0] ?? 0;

const salesSample =
    salesValues[1] ?? 0;

// J = PURCHASE RETURN + TRN OUT
const purchaseReturnValues =
    parseUtkarshNumericBoundaries(row[9]);

const purchaseReturn =
    purchaseReturnValues[0] ?? 0;

const trnOut =
    purchaseReturnValues[1] ?? 0;

// K = SALES REPLACEMENT
const salesReplacement =
    getValue(row, 10);

// L = CLOSING
const closing =
    getValue(row, 11);

    //--------------------------------------------------
    // Return physical values exactly as supplied
    //--------------------------------------------------

    return {
    product,
    productDescription: product,
    opening,
    purchase,
    purchaseFree,
    salesReturn,
    salesReturnFree,
    replacement,
    total,
    sales,
    salesFree,
    salesSample,
    purchaseReturn,
    trnOut,
    salesReplacement,
    closing
};

}

//======================================================
// BUILD NORMAL RECORD
//======================================================

function buildNormalRecord(
    row,
    rowNumber,
    product,
    finalProduct,
    map,
    fixedWidthRecord
) {

    const record = {

    rowNumber,

    product:
        fixedWidthRecord
            ? fixedWidthRecord.product
            : finalProduct,

    pack:
        fixedWidthRecord
            ? fixedWidthRecord.pack
            : getStringValue(
                row,
                map.pack
            ),



    opening:
            fixedWidthRecord
                ? fixedWidthRecord.opening
                : getValue(
                    row,
                    map.opening
                ),

        openingValue:
            fixedWidthRecord
                ? (
                    fixedWidthRecord.openingValue !==
                        undefined
                        ? fixedWidthRecord.openingValue
                        : 0
                )
                : getValue(
                    row,
                    map.openingValue
                ),

        purchase:
            fixedWidthRecord
                ? fixedWidthRecord.purchase
                : getValue(
                    row,
                    map.purchase
                ),

        purchaseFree:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.purchaseFree
                ),

        purchaseReturn:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.purchaseReturn
                ),

        purchaseReturnFree:
    fixedWidthRecord
        ? 0
        : getValue(
            row,
            map.purchaseReturnFree
        ),

        sales:
            fixedWidthRecord
                ? fixedWidthRecord.sales
                : getValue(
                    row,
                    map.sales
                ),

        salesFree:
        fixedWidthRecord
        ? 0
        : getValue(
            row,
            map.salesFree
        ),

        salesReturn:

            fixedWidthRecord &&
            fixedWidthRecord.salesReturn !==
                undefined

                ? fixedWidthRecord.salesReturn

                : getValue(
                    row,
                    map.salesReturn
                ),

        salesReturnFree:
    fixedWidthRecord
        ? 0
        : getValue(
            row,
            map.salesReturnFree
        ),

        free:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.free
                ),

        replacement:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.replacement
                ),
        salesReplacement:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.salesReplacement
                ),

        branch:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.branch
                ),

        trnInQty:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.trnInQty
                ),

        trnOutQty:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.trnOutQty
                ),

        credit:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.credit
                ),

        debit:
            fixedWidthRecord
                ? 0
                : getValue(
                    row,
                    map.debit
                ),

        adjustment:

            fixedWidthRecord &&
            fixedWidthRecord.adjustment !==
                undefined

                ? fixedWidthRecord.adjustment

                : getValue(
                    row,
                    map.adjustment
                ),

        brkexp:

            fixedWidthRecord &&
            fixedWidthRecord.brkexp !==
                undefined

                ? fixedWidthRecord.brkexp

                : getValue(
                    row,
                    map.brkexp
                ),

        closing:
            fixedWidthRecord
                ? fixedWidthRecord.closing
                : getValue(
                    row,
                    map.closing
                ),

        rate:
            fixedWidthRecord
                ? (
                    fixedWidthRecord.rate !==
                    undefined
                        ? fixedWidthRecord.rate
                        : 0
                )
                : getValue(
                    row,
                    map.rate
                )

    };



    //--------------------------------------------------
    // Additional values
    //--------------------------------------------------

    if (
        fixedWidthRecord
    ) {

        if (
            fixedWidthRecord.pack !==
            undefined
        ) {

            record.pack =
                fixedWidthRecord.pack;

        }

        if (
            fixedWidthRecord.purchaseValue !==
            undefined
        ) {

            record.purchaseValue =
                fixedWidthRecord.purchaseValue;

        }

        if (
            fixedWidthRecord.salesValue !==
            undefined
        ) {

            record.salesValue =
                fixedWidthRecord.salesValue;

        }

        if (
            fixedWidthRecord.closingValue !==
            undefined
        ) {

            record.closingValue =
                fixedWidthRecord.closingValue;

        }

        if (
            fixedWidthRecord.age !==
            undefined
        ) {

            record.age =
                fixedWidthRecord.age;

        }

    }

    //--------------------------------------------------
    // NORMAL EXCEL VALUE COLUMNS
    //--------------------------------------------------

    if (
        !fixedWidthRecord
    ) {

        if (
            map.purchaseValue !==
            undefined
        ) {

            record.purchaseValue =
                getValue(
                    row,
                    map.purchaseValue
                );

        }

        if (
            map.salesValue !==
            undefined
        ) {

            record.salesValue =
                getValue(
                    row,
                    map.salesValue
                );

        }

        if (
            map.closingValue !==
            undefined
        ) {

            record.closingValue =
                getValue(
                    row,
                    map.closingValue
                );

        }

    }

    return record;

}



//======================================================
// SOURCE COLUMNS
//======================================================
//
// IMPORTANT:
// The extractor preserves the complete original Excel row.
// It does NOT decide which source headers are business fields.
// The mapper remains responsible for interpreting headers.
//
// Each source column is retained by physical column index so
// duplicate source headers (for example "ST Value") are never
// overwritten or lost.
//======================================================

function getSourceHeaders(
    rows,
    analysis
) {

    const headerRow =
        Number(
            analysis &&
            analysis.headerRow
                ? analysis.headerRow
                : 1
        ) - 1;

    if (
        analysis &&
        Array.isArray(analysis.headers) &&
        analysis.headers.length > 0
    ) {

        return analysis.headers.map(
            header => {

                if (
                    header &&
                    typeof header === "object"
                ) {

                if (
                    header.original !== undefined
                ) {
                return String(
                    header.original
                );
                }

                    if (
                        header.name !== undefined
                    ) {
                        return String(
                            header.name
                        );
                    }

                    if (
                        header.header !== undefined
                    ) {
                        return String(
                            header.header
                        );
                    }

                    if (
                        header.value !== undefined
                    ) {
                        return String(
                            header.value
                        );
                    }

                }

                return String(
                    header == null
                        ? ""
                        : header
                );

            }
        );

    }

    return Array.isArray(rows[headerRow])
        ? rows[headerRow].map(
            header =>
                String(
                    header == null
                        ? ""
                        : header
                )
        )
        : [];

}


function createSourceColumns(
    row,
    sourceHeaders
) {

    const safeRow =
        Array.isArray(row)
            ? row
            : [];

    const safeHeaders =
        Array.isArray(sourceHeaders)
            ? sourceHeaders
            : [];

    const columnCount =
        Math.max(
            safeRow.length,
            safeHeaders.length
        );

    const sourceColumns = [];

    for (
        let index = 0;
        index < columnCount;
        index++
    ) {

        sourceColumns.push({

            columnIndex:
                index,

            header:
                String(
                    safeHeaders[index] == null
                        ? ""
                        : safeHeaders[index]
                ).trim(),

            value:
                safeRow[index] === null ||
                safeRow[index] === undefined
                    ? ""
                    : safeRow[index]

        });

    }

    return sourceColumns;

}


//======================================================
// MAIN EXTRACTOR
//======================================================

function extractRows(
    workbook,
    analysis
) {

    //--------------------------------------------------
    // SAFETY
    //--------------------------------------------------

    if (
        !workbook ||
        !analysis
    ) {

        return {

            success: false,

            totalRecords: 0,

            records: [],

            message:
                "Invalid workbook or analysis."

        };

    }

    //--------------------------------------------------
    // SHEET
    //--------------------------------------------------

    const sheet =
        workbook.Sheets[
            analysis.sheetName
        ];

    if (!sheet) {

        return {

            success: false,

            totalRecords: 0,

            records: [],

            message:
                "Statement sheet not found."

        };

    }

    //--------------------------------------------------
    // ROWS
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
    // MAP
    //--------------------------------------------------

    const map =
        analysis.mapping || {};

    //--------------------------------------------------
    // SOURCE HEADERS
    //--------------------------------------------------
    //
    // Preserve the complete header row exactly by physical
    // column position. This is source extraction only.
    // Header interpretation remains the mapper's job.
    //--------------------------------------------------

    const sourceHeaders =
        getSourceHeaders(
            rows,
            analysis
        );



    //==================================================
    // NUTRIMAX / R.A. ENTERPRISES
    // STOCK GROUP SUMMARY EXTRACTION
    //==================================================

    const nutrimaxHeaderIndex =
        Number(analysis.headerRow || 1) - 1;

    const nutrimaxHeaderRow =
        rows[nutrimaxHeaderIndex] || [];

    const nutrimaxGroupRow =
        rows[nutrimaxHeaderIndex + 1] || [];

    const nutrimaxSubHeaderRow =
        rows[nutrimaxHeaderIndex + 2] || [];

    const nutrimaxTitleText =
        rows
            .slice(0, nutrimaxHeaderIndex)
            .flat()
            .map(value => String(value ?? ""))
            .join(" ")
            .toUpperCase();

    const nutrimaxNormalize = value =>
        String(value ?? "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");

    const isNutrimaxStockGroupSummary =
        nutrimaxTitleText.includes("STOCK GROUP SUMMARY") &&
        nutrimaxTitleText.includes("R.A.ENTERPRISES") &&
        nutrimaxNormalize(nutrimaxHeaderRow[0]) === "PARTICULARS" &&
        nutrimaxNormalize(nutrimaxGroupRow[1]) === "OPENINGBALANCE" &&
        nutrimaxNormalize(nutrimaxGroupRow[4]) === "INWARDS" &&
        nutrimaxNormalize(nutrimaxGroupRow[7]) === "OUTWARDS" &&
        nutrimaxNormalize(nutrimaxGroupRow[10]) === "CLOSINGBALANCE" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[1]) === "QUANTITY" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[2]) === "RATE" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[3]) === "VALUE" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[4]) === "QUANTITY" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[7]) === "QUANTITY" &&
        nutrimaxNormalize(nutrimaxSubHeaderRow[10]) === "QUANTITY";

    if (isNutrimaxStockGroupSummary) {

        console.log(
            "NUTRIMAX STOCK GROUP SUMMARY FORMAT:",
            true
        );

        const nutrimaxHeaders = [
            "Product",
            "Opening Balance Quantity",
            "Opening Balance Rate",
            "Opening Balance Value",
            "Inwards Quantity",
            "Inwards Rate",
            "Inwards Value",
            "Outwards Quantity",
            "Outwards Rate",
            "Outwards Value",
            "Closing Balance Quantity",
            "Closing Balance Rate",
            "Closing Balance Value"
        ];

        const nutrimaxRecords = [];

        const firstProductRow =
            nutrimaxHeaderIndex + 3;

        for (
            let i = firstProductRow;
            i < rows.length;
            i++
        ) {

            const row = rows[i] || [];

            const product =
                getStringValue(row, 0);

            if (!product || shouldStop(product)) {
                continue;
            }

            const record = {
                rowNumber: i + 1,

                product,
                productDescription: product,
                productCode: "",
                pack: "",

                // Opening Balance
                opening: getValue(row, 1),
                openingRate: getValue(row, 2),
                openingValue: getValue(row, 3),

                // Inwards = Purchase
                purchase: getValue(row, 4),
                purchaseRate: getValue(row, 5),
                purchaseValue: getValue(row, 6),

                // Outwards = Sales
                sales: getValue(row, 7),
                salesRate: getValue(row, 8),
                salesValue: getValue(row, 9),

                // Closing Balance
                closing: getValue(row, 10),
                closingRate: getValue(row, 11),
                closingValue: getValue(row, 12),

                // Preserve source information
                sourceHeaders: nutrimaxHeaders.slice(),
                sourceRow: row.slice(),
                sourceColumns: createSourceColumns(
                    row,
                    nutrimaxHeaders
                )
            };

            // Use the closing rate as the standard rate.
            record.rate = record.closingRate;

            nutrimaxRecords.push(record);
        }

        console.log(
            "NUTRIMAX RECORDS EXTRACTED:",
            nutrimaxRecords.length
        );

        return {
            success: true,
            totalRecords: nutrimaxRecords.length,
            records: nutrimaxRecords
        };
    }


    //==================================================
    // STOCK AND SALE MANUFACTURE WISE - MULTI-ROW FIX
    //==================================================

    const swathiHeaderIndex =
        Number(analysis.headerRow || 1) - 1;

    const swathiHeader =
        rows[swathiHeaderIndex] || [];

    const swathiTitle =
        rows.slice(0, swathiHeaderIndex)
            .flat()
            .map(value => String(value ?? ""))
            .join(" ")
            .toUpperCase();

    const swathiHeaderValue = index =>
        String(swathiHeader[index] ?? "")
            .trim()
            .toUpperCase()
            .replace(/[.]/g, "");

    const isSwathiMultiRowFormat =
        swathiTitle.includes("STOCK AND SALE MANUFACTURE WISE") &&
        swathiHeaderValue(3) === "CODE" &&
        swathiHeaderValue(6) === "ITEM" &&
        swathiHeaderValue(13) === "PACK" &&
        swathiHeaderValue(16) === "OP" &&
        swathiHeaderValue(18) === "PUR QTY" &&
        swathiHeaderValue(22) === "SALE QTY" &&
        swathiHeaderValue(24) === "BAL";

    if (isSwathiMultiRowFormat) {

        console.log(
            "SWATHI MULTI-ROW EXTRACTION:",
            true
        );

        const swathiRecords = [];
        let current = null;

        const hasCellValue = value =>
            value !== "" &&
            value !== null &&
            value !== undefined;

        function saveSwathiRecord() {

            if (!current) return;

            const sourceRow = current.productRow;

            const record = buildNormalRecord(
                sourceRow,
                current.rowNumber,
                current.product,
                current.product,
                map,
                null
            );

            record.product = current.product;
            record.productDescription = current.product;
            record.productCode = current.code;
            record.pack = current.pack;

            record.opening = current.opening;
            record.purchase = current.purchase;
            record.sales = current.sales;
            record.closing = current.closing;

            // Preserve the original product row and headers.
            record.sourceHeaders = sourceHeaders.slice();
            record.sourceRow = sourceRow.slice();
            record.sourceColumns =
                createSourceColumns(sourceRow, sourceHeaders);

            // Keep all physical rows that contributed to this record.
            record.sourceRows = current.sourceRows.map(
                row => row.slice()
            );

            swathiRecords.push(record);
            current = null;
        }

        for (
            let i = swathiHeaderIndex + 1;
            i < rows.length;
            i++
        ) {

            const row = rows[i] || [];

            const product = getStringValue(row, map.product);
            const pack = getStringValue(row, map.pack);

            // A product starts when both Item and Pack are populated.
            if (product && pack) {

                if (shouldStop(product)) {
                    saveSwathiRecord();
                    continue;
                }

                saveSwathiRecord();

                current = {
                    rowNumber: i + 1,
                    product,
                    pack,
                    code: "",
                    opening: 0,
                    purchase: 0,
                    sales: 0,
                    closing: 0,
                    productRow: row.slice(),
                    sourceRows: [row.slice()]
                };

                continue;
            }

            if (!current) continue;

            // Keep the original rows associated with this product.
            current.sourceRows.push(row.slice());

            const code = getStringValue(row, map.code);
            if (code) current.code = code;

            // Read from the EXISTING mapped columns.
            if (hasCellValue(row[map.opening])) {
                current.opening = getValue(row, map.opening);
            }

            if (hasCellValue(row[map.purchase])) {
                current.purchase = getValue(row, map.purchase);
            }

            if (hasCellValue(row[map.sales])) {
                current.sales = getValue(row, map.sales);
            }

            if (hasCellValue(row[map.closing])) {
                current.closing = getValue(row, map.closing);
            }
        }

        saveSwathiRecord();

        console.log(
            "SWATHI RECORDS EXTRACTED:",
            swathiRecords.length
        );

        return {
            success: true,
            totalRecords: swathiRecords.length,
            records: swathiRecords
        };
    }


    //==================================================
    // META PATWARI PHARMA - MULTI-ROW PRODUCT EXTRACTION
    //==================================================

    const metaPatwariHeaderRowIndex =
        Number(analysis.headerRow || 1) - 1;

    const metaPatwariHeaderText =
        rows
            .slice(
                Math.max(0, metaPatwariHeaderRowIndex - 2),
                Math.min(rows.length, metaPatwariHeaderRowIndex + 3)
            )
            .map(row =>
                (row || [])
                    .map(value =>
                        String(value ?? "")
                            .trim()
                            .toUpperCase()
                    )
                    .join(" ")
            )
            .join(" ");

    const metaPatwariHeader =
        rows[metaPatwariHeaderRowIndex] || [];

    const isMetaPatwariFormat =
        metaPatwariHeader.length >= 24 &&
        /\bCODE\b/.test(metaPatwariHeaderText) &&
        /\bITEM\b/.test(metaPatwariHeaderText) &&
        /\bPACK\b/.test(metaPatwariHeaderText) &&
        /\bPUR\s*QTY\b/.test(metaPatwariHeaderText) &&
        /\bSALE\s*QTY\b/.test(metaPatwariHeaderText) &&
        /\bBAL\b/.test(metaPatwariHeaderText) &&
        rows.some((row, index) =>
            index > metaPatwariHeaderRowIndex &&
            String((row || [])[6] ?? "").trim() !== "" &&
            String((row || [])[12] ?? "").trim() !== ""
        );

    if (isMetaPatwariFormat) {

        console.log(
            "META PATWARI MULTI-ROW FORMAT:",
            true
        );

        const metaPatwariRecords = [];

        const firstProductSearchRow =
            metaPatwariHeaderRowIndex + 1;

        let currentProduct = null;

        function saveMetaPatwariProduct() {

            if (!currentProduct) {
                return;
            }

            metaPatwariRecords.push({
                rowNumber: currentProduct.rowNumber,

                product: currentProduct.product,
                productDescription: currentProduct.product,
                productCode: currentProduct.productCode,
                pack: currentProduct.pack,

                opening: currentProduct.opening,
                purchase: currentProduct.purchase,
                sales: currentProduct.sales,
                closing: currentProduct.closing,

                openingValue: 0,
                purchaseValue: 0,
                salesValue: 0,
                closingValue: 0,

                sourceHeaders: sourceHeaders.slice(),

                sourceRow: currentProduct.sourceRow.slice(),

                sourceRows: currentProduct.sourceRows.map(
                    row => row.slice()
                ),

                sourceColumns: createSourceColumns(
                    currentProduct.sourceRow,
                    sourceHeaders
                )
            });

        }

        for (
            let i = firstProductSearchRow;
            i < rows.length;
            i++
        ) {

            const row = rows[i] || [];

            const productName =
                getStringValue(row, 6);

            const pack =
                getStringValue(row, 12);

            // A new product begins when both the product
            // name and pack are present.
            if (productName && pack) {

                if (shouldStop(productName)) {
                    saveMetaPatwariProduct();
                    currentProduct = null;
                    continue;
                }

                saveMetaPatwariProduct();

                currentProduct = {
                    rowNumber: i + 1,

                    product: productName,
                    productCode: "",
                    pack,

                    opening: 0,
                    purchase: 0,
                    sales: 0,
                    closing: 0,

                    sourceRow: row.slice(),
                    sourceRows: [row.slice()]
                };

                continue;
            }

            if (!currentProduct) {
                continue;
            }

            currentProduct.sourceRows.push(row.slice());

            // Column D: Product code
            const code =
                getStringValue(row, 3);

            if (code) {
                currentProduct.productCode = code;
            }

            // Only replace a movement value when its
            // physical source cell actually contains data.
            if (
                row[15] !== "" &&
                row[15] !== null &&
                row[15] !== undefined
            ) {
                currentProduct.opening =
                    getValue(row, 15);
            }

            if (
                row[17] !== "" &&
                row[17] !== null &&
                row[17] !== undefined
            ) {
                currentProduct.purchase =
                    getValue(row, 17);
            }

            if (
                row[21] !== "" &&
                row[21] !== null &&
                row[21] !== undefined
            ) {
                currentProduct.sales =
                    getValue(row, 21);
            }

            if (
                row[23] !== "" &&
                row[23] !== null &&
                row[23] !== undefined
            ) {
                currentProduct.closing =
                    getValue(row, 23);
            }
        }

        saveMetaPatwariProduct();

        console.log(
            "META PATWARI RECORDS:",
            metaPatwariRecords.length
        );

        return {
            success: true,
            totalRecords: metaPatwariRecords.length,
            records: metaPatwariRecords
        };
    }


 //==================================================
 // MAMATA CLOSING STOCK FORMAT DETECTION
 //==================================================

const mamataHeaderRowIndex =
    Number(analysis.headerRow || 1) - 1;

const mamataHeaderRow =
    rows[mamataHeaderRowIndex] || [];

const mamataStatementTitle =
    rows
        .slice(0, mamataHeaderRowIndex)
        .flat()
        .map(value => String(value ?? ""))
        .join(" ")
        .toUpperCase();


const isMamataClosingStockFormat =
    String(mamataHeaderRow[0] ?? "").trim().toUpperCase() === "ITEM DESCRIPTION" &&
    String(mamataHeaderRow[1] ?? "").trim().toUpperCase() === "OPENING" &&
    String(mamataHeaderRow[2] ?? "").trim().toUpperCase() === "RECEIPT" &&
    String(mamataHeaderRow[3] ?? "").trim().toUpperCase() === "ISSUE" &&
    String(mamataHeaderRow[4] ?? "").trim().toUpperCase() === "CLOSING";


console.log(
    "MAMATA CLOSING FORMAT:",
    isMamataClosingStockFormat
);


    //--------------------------------------------------
// UTKARSH TWO-ROW FORMAT
//--------------------------------------------------

const isUtkarshFormat =
    analysis.specialFormat ===
        "UTKARSH_TWO_ROW_EXCEL_STOCK_SALES" ||
    isUtkarshTwoRowStockSalesFormat(
        sourceHeaders
    );

const isImperiaFormat =
    analysis.specialFormat ===
        "IMPERIA_TWO_ROW_EXCEL_STOCK_SALES" ||
    analysis.detection ===
        "IMPERIA_TWO_ROW_EXCEL_STOCK_SALES";

console.log(
    "UTKARSH FORMAT:",
    isUtkarshFormat
);

console.log(
    "IMPERIA FORMAT:",
    isImperiaFormat
);

    //--------------------------------------------------
    // PRODUCT COLUMN
    //--------------------------------------------------

    const productColumn =
        getProductColumn(
            analysis,
            map
        );

    //--------------------------------------------------
    // CODE
    //--------------------------------------------------

    const productCodeColumn =
        detectProductCodeColumn(
            rows,
            analysis,
            map
        );

    //--------------------------------------------------
    // DESCRIPTION
    //--------------------------------------------------

    const productDescriptionColumn =
        getProductDescriptionColumn(
            analysis,
            map
        );

    // ============================================================
// KABSON FORMAT DETECTION
// ============================================================

const isKabsonFormat = isKabsonStockSalesFormat(
    rows,
    analysis
);

console.log(
    "KABSON FORMAT:",
    isKabsonFormat
);

    //--------------------------------------------------
    // FIXED WIDTH
    //--------------------------------------------------

    const detectedFixedWidthFormat =
        detectFixedWidthStockSalesFormat(
            rows,
            analysis
        );

    const fixedWidthFormat =
        detectedFixedWidthFormat ||

        (
            isIntegraSpecialFormat(
                analysis,
                map
            )

                ? "INTEGRA_STOCK_SALES"

                : null
        );

    const isDermanexFormat =
        fixedWidthFormat ===
        "DERMANEX_STOCK_SALES";

    const isIntegraFormat =
        fixedWidthFormat ===
        "INTEGRA_STOCK_SALES";

    const isInfinaFormat =
        fixedWidthFormat ===
        "INFINA_STOCK_SALES";

    const isBajrangFormat =
        fixedWidthFormat ===
        "BAJRANG_FIXED_WIDTH_STOCK_SALES";

    //--------------------------------------------------
    // SPECIAL
    //--------------------------------------------------

    const isSpecialFormat =
        Boolean(
            map.specialFormat
        );

    const hasFixedWidthFormat =

    isDermanexFormat ||
    isIntegraFormat ||
    isInfinaFormat ||
    isBajrangFormat;

    //--------------------------------------------------
    // DEBUG
    //--------------------------------------------------

    console.log("");

    console.log(
        "===== PRODUCT CODE DETECTION ====="
    );

    console.log(
        "Product Column :",
        productColumn
    );

    console.log(
        "Code Column    :",
        productCodeColumn
    );

    console.log(
        "Description Col:",
        productDescriptionColumn
    );

    console.log(
        "=================================="
    );

    console.log("");

    console.log(
        "===== EXTRACTOR MAP ====="
    );

    console.table(
        map
    );

    console.log(
        "========================="
    );

    //--------------------------------------------------
    // FORMAT
    //--------------------------------------------------

    console.log("");

    console.log(
        "===== FORMAT DETECTION ====="
    );

    console.log(
        "Detected Format :",
        fixedWidthFormat || "NORMAL"
    );

    console.log(
        "DERMANEX        :",
        isDermanexFormat
    );

    console.log(
        "INTEGRA         :",
        isIntegraFormat
    );

    console.log(
        "INFINA          :",
        isInfinaFormat
    );

    console.log(
        "Special Map     :",
        map.specialFormat || false
    );

    console.log(
        "============================"
    );

    //--------------------------------------------------
    // MOVEMENT
    //--------------------------------------------------

    const movementColumnsMapped =
        hasMappedMovementColumns(
            map
        );

    //--------------------------------------------------
    // DATA RANGE
    //--------------------------------------------------
    //
    // IMPORTANT:
    //
    // dataRangeDetector returns Excel row numbers.
    //
    // Example:
    //
    // firstDataRow = 2
    // lastDataRow  = 30
    //
    // Convert to zero-based array:
    //
    // 2 - 1 = 1
    // 30 - 1 = 29
    //
    //--------------------------------------------------

    let extractionStart;
    let extractionEnd;

    if (

        analysis.firstDataRow !==
            undefined &&

        analysis.lastDataRow !==
            undefined

    ) {

        extractionStart =
            Number(
                analysis.firstDataRow
            ) - 1;

        extractionEnd = rows.length - 1;

    }

    else {

        extractionStart =
            Math.max(
                0,
                Number(
                    analysis.headerRow || 1
                )
            );

        extractionEnd =
            rows.length - 1;

    }

        //==================================================
    // BAJRANG FIXED-WIDTH DATA RANGE
    //==================================================

    if (
        isBajrangFormat
    ) {

        const fixedWidthStart =
            rows.findIndex(
                (row, index) => {

                    if (
                        index <=
                        Number(
                            analysis.headerRow
                        )
                    ) {
                        return false;
                    }

                    const text =
                        String(
                            (row || [])[0] || ""
                        ).trim();

                    if (!text) {
                        return false;
                    }

                    const tokens =
                        text.split(/\s+/)
                            .filter(Boolean);

                    if (
                        tokens.length < 10
                    ) {
                        return false;
                    }

                    const tail =
                        tokens.slice(
                            tokens.length - 9
                        );

                    return tail.every(
                        value =>
                            isNumericOrDashToken(
                                value
                            )
                    );

                }
            );

        if (
            fixedWidthStart >= 0
        ) {

            extractionStart =
                fixedWidthStart;

        }

    }

    //--------------------------------------------------
    // Clamp
    //--------------------------------------------------

    extractionStart =
        Math.max(
            0,
            Math.min(
                extractionStart,
                rows.length - 1
            )
        );

    extractionEnd =
        Math.max(
            extractionStart,
            Math.min(
                extractionEnd,
                rows.length - 1
            )
        );

    //--------------------------------------------------
    // DEBUG RANGE
    //--------------------------------------------------

    console.log("");

    console.log(
        "===== EXTRACTION RANGE ====="
    );

    console.log(
        "Start Row :",
        extractionStart + 1
    );

    console.log(
        "End Row   :",
        extractionEnd + 1
    );

    console.log(
        "============================"
    );

    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    const extracted = [];

    //==================================================
    // LOOP
    //==================================================

    for (
        let i = extractionStart;
        i <= extractionEnd;
        i++
    ) {

        const row =
            rows[i] || [];

    // ============================================================
// KABSON ROW PARSING
// ============================================================

let kabsonRecord = null;

if (isKabsonFormat) {

    kabsonRecord = parseKabsonStockSalesRow(
        row,
        productColumn
    );

    // In Kabson format, every row that is not a valid
    // product row is ignored.
    //
    // This is important because rows such as:
    //
    // LINUX DERMA DIV
    // LINUX LABORATORIES PVT LTD
    //
    // must NEVER enter the normal product extraction logic.

    if (!kabsonRecord) {
        continue;
    }
}


        //------------------------------------------------
        // FIXED WIDTH
        //------------------------------------------------

        let fixedWidthRecord =
            null;

        if (
            isDermanexFormat
        ) {

            fixedWidthRecord =
                parseDermanexStockSalesRow(
                    getStringValue(
                        row,
                        productColumn
                    )
                );


            if (
                !fixedWidthRecord
            ) {

                continue;

            }

        }

                if (
            !fixedWidthRecord &&
            isBajrangFormat
        ) {

            fixedWidthRecord =
                parseBajrangFixedWidthStockSalesRow(
                    getStringValue(
                        row,
                        productColumn
                    )
                );

            if (
                !fixedWidthRecord
            ) {
                continue;
            }

        }

        if (
            !fixedWidthRecord &&
            isIntegraFormat
        ) {

            fixedWidthRecord =
                parseIntegraStockSalesRow(
                    getStringValue(
                        row,
                        productColumn
                    )
                );

        }

        if (
            !fixedWidthRecord &&
            isInfinaFormat
        ) {

            fixedWidthRecord =
                parseInfinaStockSalesRow(
                    getStringValue(
                        row,
                        productColumn
                    )
                );

        }

        //------------------------------------------------
        // PRODUCT
        //------------------------------------------------

        const product =
            isKabsonFormat
                ? kabsonRecord.product
                : (
            fixedWidthRecord?.product ||
            getStringValue(row, productColumn)
        );

        //------------------------------------------------
        // Blank
        //------------------------------------------------

        if (!product) {
            continue;
        }

        //------------------------------------------------
        // Footer
        //------------------------------------------------

        if (
            shouldStop(product)
        ) {

            // A footer/summary row must not terminate the
            // detected data range. Continue scanning the
            // remaining rows because dataRangeDetector has
            // already established the extraction boundary.
            continue;

        }

        //------------------------------------------------
        // Metadata
        //------------------------------------------------

        const upper =
            product
                .toUpperCase();

        if (

            upper.startsWith(
                "COMPANY"
            ) ||

            upper.startsWith(
                "GROUP"
            ) ||

            upper.startsWith(
                "CATEGORY"
            ) ||

            upper.startsWith(
                "DIVISION"
            ) ||

            upper.startsWith(
                "DIVN"
            )

        ) {

            continue;

        }

        //------------------------------------------------
        // VALIDATE PRODUCT
        //------------------------------------------------

        let validProductRow =
            false;

        if (
            fixedWidthRecord
        ) {

            validProductRow =
                true;

        }

        else {

            //------------------------------------------------
            // SPECIAL EXCEL STATEMENT VALIDATION
            //------------------------------------------------
            //
            // For a mapped special-format Excel statement,
            // the header mapper has already established the
            // product and movement columns. Do not make the
            // generic product-name validator the authority for
            // accepting the row.
            //
            // A valid product row must:
            //   1. have a product value,
            //   2. not be a footer/metadata row,
            //   3. contain numeric evidence somewhere in the
            //      complete source row.
            //
            // This is intentionally limited to the special
            // Excel format. Existing normal/TXT behaviour stays
            // unchanged.
            //------------------------------------------------

            if (
                map.specialFormat ===
                    "DERMANEX_STOCK_SALES"
            ) {

                validProductRow =
                    product.length >= 2 &&
                    hasNumericData(
                        row,
                        productColumn
                    ) &&
                    !shouldStop(
                        product
                    );

            }

            else {

                validProductRow =
                    isProductRow(
                        product
                    );

                //------------------------------------------------
                // Existing fallback
                //------------------------------------------------

                if (
                    !validProductRow
                ) {

                    const numericRow =
                        hasNumericData(
                            row,
                            productColumn
                        );

                    const hasProductCode =

                        productCodeColumn !==
                            null &&

                        productCodeColumn !==
                            undefined &&

                        getStringValue(
                            row,
                            productCodeColumn
                        ) !== "";

                    if (

                        product.length >= 2 &&

                        numericRow &&

                        !shouldStop(product) &&

                        (
                            productCodeColumn ===
                                null ||

                            productCodeColumn ===
                                undefined ||

                            hasProductCode
                        )

                    ) {

                        validProductRow =
                            true;

                    }

                }

            }

        }

        //------------------------------------------------
        // Invalid
        //------------------------------------------------

        if (
            !validProductRow
        ) {

            continue;

        }



        //------------------------------------------------
        // PRODUCT CODE
        //------------------------------------------------

        let productCode =
            null;


        if (

            productCodeColumn !==
                null &&

            productCodeColumn !==
                undefined

        ) {

            productCode =
                getStringValue(
                    row,
                    productCodeColumn
                );

        }

        //------------------------------------------------
        // DESCRIPTION
        //------------------------------------------------

        let productDescription =
            product;

        if (

            !fixedWidthRecord &&

            productDescriptionColumn !==
                null &&

            productDescriptionColumn !==
                undefined

        ) {

            const description =
                getStringValue(
                    row,
                    productDescriptionColumn
                );

            if (
                description
            ) {

                productDescription =
                    description;

            }

        }

        //------------------------------------------------
        // FINAL PRODUCT
        //------------------------------------------------

        let finalProduct =
    productDescription;



if (
    map.specialFormat ===
        "CODE_ITEM_DESCRIPTION_SALES_CLOSING"
    &&
    map.specialFormat !==
        "VASU_AGENCIES_DRUGS_STRUCTURED_XLS"
) {



    if (
        productCode &&
        productDescription
    ) {

        finalProduct =
            `${productCode} - ${productDescription}`;

    }

}



const isDafMedicineAgencies =
    Array.isArray(sourceHeaders) &&
    sourceHeaders.length >= 16 &&
    String(sourceHeaders[0] ?? "")
        .trim()
        .toUpperCase() === "CODE" &&
    String(sourceHeaders[1] ?? "")
        .trim()
        .toUpperCase() === "PRODUCT NAME" &&
    String(sourceHeaders[2] ?? "")
        .trim()
        .toUpperCase() === "UNIT" &&
    String(sourceHeaders[3] ?? "")
        .trim()
        .toUpperCase() === "CURRENT STOCK" &&
    String(sourceHeaders[4] ?? "")
        .trim()
        .toUpperCase() === "SALES SCHEME" &&
    String(sourceHeaders[6] ?? "")
        .trim()
        .toUpperCase() === "PURC.SCHEME" &&
    String(sourceHeaders[8] ?? "")
        .trim()
        .toUpperCase() === "COST PRICE" &&
    String(sourceHeaders[9] ?? "")
        .trim()
        .toUpperCase() === "VALUE" &&
    String(sourceHeaders[10] ?? "")
        .trim()
        .toUpperCase() === "M.R.P." &&
    String(sourceHeaders[11] ?? "")
        .trim()
        .toUpperCase() === "PURCHASE PRICE" &&
    String(sourceHeaders[12] ?? "")
        .trim()
        .toUpperCase() === "SALES PRICE";

let record;

if (isDafMedicineAgencies) {

    console.log("");
    console.log("===== DAF PHYSICAL COLUMN EXTRACTION =====");

    // --------------------------------------------------------
    // First build the normal record so the existing
    // extractor structure remains intact.
    // --------------------------------------------------------

    record =
        buildNormalRecord(
            row,
            i + 1,
            product,
            finalProduct,
            map,
            fixedWidthRecord
        );



    // --------------------------------------------------------
    // DAF PHYSICAL COLUMNS
    //
    // These are taken STRICTLY by physical column number.
    // No header matching or business interpretation.
    // --------------------------------------------------------

    record.dafColumns = {};

    for (
        let columnIndex = 0;
        columnIndex < 16;
        columnIndex++
    ) {

        record.dafColumns[columnIndex] =
            row[columnIndex];

    }

    // --------------------------------------------------------
    // DAF PHYSICAL HEADERS
    // --------------------------------------------------------

    record.dafHeaders =
        sourceHeaders.slice(
            0,
            16
        );

    // --------------------------------------------------------
    // DAF COMPLETE PHYSICAL SOURCE ROW
    // --------------------------------------------------------

    record.sourceRow =
        Array.isArray(row)
            ? row.slice()
            : [];

    // --------------------------------------------------------
    // DAF COMPLETE SOURCE COLUMNS
    // --------------------------------------------------------

    record.sourceColumns =
        createSourceColumns(
            row,
            sourceHeaders
        );

} else if (
    isUtkarshFormat ||
    isImperiaFormat
) {

    // ========================================================
    // UTKARSH TWO-ROW STOCK & SALES
    // ========================================================

    console.log("");

    console.log(
        "===== UTKARSH PHYSICAL COLUMN EXTRACTION ====="
    );

    const utkarshRecord =
        parseUtkarshTwoRowStockSalesRow(
            row,
            productColumn
        );

    if (!utkarshRecord) {
        continue;
    }

    // --------------------------------------------------------
    // Keep normal record structure
    // --------------------------------------------------------

    record =
        buildNormalRecord(
            row,
            i + 1,
            product,
            finalProduct,
            map,
            fixedWidthRecord
        );

    // --------------------------------------------------------
    // UTKARSH PHYSICAL VALUES
    // --------------------------------------------------------

    record.utkarshColumns = {};

    for (
        let columnIndex = 0;
        columnIndex < 12;
        columnIndex++
    ) {

        record.utkarshColumns[columnIndex] =
            row[columnIndex];

    }

// --------------------------------------------------------
// UTKARSH PARSED VALUES
// --------------------------------------------------------

record.opening =
    utkarshRecord.opening;

record.purchase =
    utkarshRecord.purchase;

record.purchaseFree =
    utkarshRecord.purchaseFree;

record.salesReturn =
    utkarshRecord.salesReturn;

record.salesReturnFree =
    utkarshRecord.salesReturnFree;

record.replacement =
    utkarshRecord.salesReplacement;

record.total =
    utkarshRecord.total;

record.sales =
    utkarshRecord.sales;

record.salesFree =
    utkarshRecord.salesFree;

record.salesSample =
    utkarshRecord.salesSample;

record.purchaseReturn =
    utkarshRecord.purchaseReturn;

record.trnOutQty =
    utkarshRecord.trnOut;

record.salesReplacement =
    utkarshRecord.replacement;

record.closing =
    utkarshRecord.closing;

record.product =
    utkarshRecord.product;

record.productDescription =
    utkarshRecord.productDescription;

    // --------------------------------------------------------
    // UTKARSH SOURCE HEADERS
    // --------------------------------------------------------

    record.utkarshHeaders =
        sourceHeaders.slice(
            0,
            12
        );

    // --------------------------------------------------------
    // COMPLETE SOURCE ROW
    // --------------------------------------------------------

    record.sourceRow =
        Array.isArray(row)
            ? row.slice()
            : [];

    // --------------------------------------------------------
    // COMPLETE SOURCE COLUMNS
    // --------------------------------------------------------

    record.sourceColumns =
        createSourceColumns(
            row,
            sourceHeaders
        );

} else {

    // --------------------------------------------------------
    // EXISTING EXTRACTION
    // --------------------------------------------------------

    record =
        buildNormalRecord(
            row,
            i + 1,
            product,
            finalProduct,
            map,
            fixedWidthRecord
        );

}



//==================================================
// MAMATA CLOSING STOCK OVERRIDE
//==================================================

if (isMamataClosingStockFormat) {
    const closingParts = String(row[4] ?? "")
        .replace(/,/g, "")
        .match(/[-+]?\d*\.?\d+/g);

    if (closingParts && closingParts.length >= 2) {
        record.closing = Number(closingParts[0]);
    }
}



// ============================================================
// KABSON FINAL FIELD OVERRIDE
// ============================================================

if (isKabsonFormat && kabsonRecord) {

    record.product =
        kabsonRecord.product;

    record.productDescription =
        kabsonRecord.productDescription;

    record.pack =
        kabsonRecord.pack;

    record.opening =
        kabsonRecord.opening;

    record.purchase =
        kabsonRecord.purchase;

    record.sales =
        kabsonRecord.sales;

    record.closing =
        kabsonRecord.closing;
}



//==================================================
// BASANTI RECORD DEBUG
//==================================================

if (
    Number(row?.[4]) !== 0 ||
    Number(row?.[7]) !== 0
)

        //------------------------------------------------
        // COMPLETE SOURCE ROW
        //------------------------------------------------
        //
        // Preserve every source header and every source value.
        // Do not convert or discard values here.
        // The mapper/master layer can interpret these values
        // later. Physical column indexes are retained so
        // duplicate headers remain distinguishable.
        //------------------------------------------------

        record.sourceHeaders =
            sourceHeaders.slice();

        record.sourceColumns =
            createSourceColumns(
                row,
                sourceHeaders
            );

        record.sourceRow =
            Array.isArray(row)
                ? row.slice()
                : [];

        //------------------------------------------------
        // METADATA
        //------------------------------------------------

        if (

            isSpecialFormat ||

            productCodeColumn !==
                null

        ) {

            record.productCode =
                productCode;

            record.productDescription =
                productDescription;

        }

        //------------------------------------------------
        // DERMANEX
        //------------------------------------------------

        if (
            isDermanexFormat &&
            fixedWidthRecord
        ) {

            record.product =
                fixedWidthRecord.product;

            record.productDescription =
                fixedWidthRecord.product;

            record.pack =
                fixedWidthRecord.pack;

            record.opening =
                fixedWidthRecord.opening;

            record.purchase =
                fixedWidthRecord.purchase;

            record.purchaseValue =
                fixedWidthRecord.purchaseValue;

            record.sales =
                fixedWidthRecord.sales;

            record.salesValue =
                fixedWidthRecord.salesValue;

            record.closing =
                fixedWidthRecord.closing;

            record.closingValue =
                fixedWidthRecord.closingValue;

        }

        //------------------------------------------------
        // PUSH
        //------------------------------------------------

        extracted.push(
            record
        );

        //------------------------------------------------
        // DEBUG FIRST FIVE
        //------------------------------------------------

        if (
            extracted.length <= 5
        ) {

            console.log("");

            console.log(
                "EXTRACTED ROW :",
                i + 1
            );

            console.log(
                "Product        :",
                record.product
            );

            console.log(
                "Opening        :",
                record.opening
            );

            console.log(
                "Purchase       :",
                record.purchase
            );

            console.log(
                "Sales          :",
                record.sales
            );

            console.log(
                "Closing        :",
                record.closing
            );

        }

    }

    //--------------------------------------------------
    // SUMMARY
    //--------------------------------------------------

    console.log("");

    console.log(
        "========== EXTRACTION SUMMARY =========="
    );

    console.log(
        "Records Extracted :",
        extracted.length
    );

    console.log(
        "Special Format    :",
        isSpecialFormat
    );

    console.log(
        "Fixed Width Format:",
        fixedWidthFormat || false
    );

    console.log(
        "Movement Mapped   :",
        movementColumnsMapped
    );

    console.log(
        "========================================"
    );

    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    return {

        success: true,

        totalRecords:
            extracted.length,

        records:
            extracted

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    extractRows

};
