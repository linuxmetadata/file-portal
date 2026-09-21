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

    const num =
        Number(text);

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

    return toNumber(
        row[index]
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
    // BAJRANG structure:
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
    // The final 9 tokens are numeric or "-".
    // -----------------------------------------------

    const tokens =
        text.split(/\s+/)
            .filter(Boolean);

    if (tokens.length < 10) {
        return null;
    }

    let numericStart = -1;

    for (
        let i = 1;
        i <= tokens.length - 9;
        i++
    ) {

        const tail =
            tokens.slice(i);

        if (
            tail.length !== 9
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

    if (numericStart < 1) {
        return null;
    }

    const product =
        tokens
            .slice(0, numericStart)
            .join(" ")
            .trim();

    const values =
        tokens.slice(numericStart);

    if (
        !product ||
        values.length !== 9
    ) {
        return null;
    }

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
            ? (
                fixedWidthRecord.pack !== undefined
                    ? fixedWidthRecord.pack
                    : ""
            )
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

        extractionEnd =
            Number(
                analysis.lastDataRow
            ) - 1;

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
        //==================================================
// RETURN SOURCE ROW DEBUG
//==================================================

if (extracted.length < 5) {

    console.log("");
    console.log("===== RETURN SOURCE DEBUG =====");

    console.log("Source Row :", i + 1);
    console.log("row.length :", row?.length);

    console.log("row[4] :", row?.[4]);
    console.log("row[7] :", row?.[7]);

    console.log("map.purchaseReturn :", map?.purchaseReturn);
    console.log("map.salesReturn    :", map?.salesReturn);

    console.log("================================");
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
                !fixedWidthRecord &&
                extracted.length > 0
            ) {

                break;

            }

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
            fixedWidthRecord

                ? fixedWidthRecord.product

                : getStringValue(
                    row,
                    productColumn
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



        //------------------------------------------------
        // BUILD
        //------------------------------------------------

        const record =
            buildNormalRecord(

                row,

                i + 1,

                product,

                finalProduct,

                map,

                fixedWidthRecord

            );

            console.log("");
console.log("===== DERMASCIENCE RECORD VALUE CHECK =====");
console.log("Product       :", product);
console.log("Source Br I   :", row?.[17]);
console.log("Source Br R   :", row?.[18]);
console.log("Map Br I      :", map?.trnInQty);
console.log("Map Br R      :", map?.trnOutQty);
console.log("Record TRN IN :", record?.trnInQty);
console.log("Record TRN OUT:", record?.trnOutQty);
console.log("===========================================");

        //==================================================
// BASANTI RECORD DEBUG
//==================================================

if (
    Number(row?.[4]) !== 0 ||
    Number(row?.[7]) !== 0
) {

    console.log("");
    console.log("===== RECORD RETURN DEBUG =====");

    console.log(
        "record.purchaseReturn :",
        record.purchaseReturn
    );

    console.log(
        "record.salesReturn    :",
        record.salesReturn
    );

    console.log("================================");
}

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
