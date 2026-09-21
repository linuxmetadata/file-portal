/**
 * ======================================================
 * COLUMN DETECTOR V2
 * ======================================================
 *
 * Detects important columns from the detected header row.
 *
 * IMPORTANT:
 *
 * 1. Existing header formats are preserved.
 * 2. Abbreviated ERP headers are supported.
 * 3. Product description has priority over product code.
 * 4. PRODUCT is mandatory.
 * 5. OPENING / PURCHASE / SALES / CLOSING are mandatory.
 *
 * Example:
 *
 * SlNo | ProductName | OS | PQty | PFr | SQty | SFre |
 * SRet | Stock | PurRate | StockValue | SaleValue | PCor | PRet
 *
 * Mapping:
 *
 * ProductName  -> product
 * OS           -> opening
 * PQty         -> purchase
 * PFr          -> purchaseFree
 * SQty         -> sales
 * SFre         -> free
 * SRet         -> salesReturn
 * Stock        -> closing
 * PurRate      -> rate
 * StockValue   -> closingValue
 * SaleValue    -> salesValue
 * PCor         -> adjustment
 * PRet         -> purchaseReturn
 *
 * ======================================================
 */


/* ======================================================
 * COLUMN RULES
 * ====================================================== */

const COLUMN_RULES = Object.freeze({

    //--------------------------------------------------
    // PRODUCT
    //--------------------------------------------------

    product: [

        "PRODUCT DESCRIPTION",
        "ITEM DESCRIPTION",
        "PRODUCT NAME",
        "PRODUCTNAME",
        "PRODNAME",

        "ITEM NAME",
        "ITEM",

        "PRODUCT",
        "DESCRIPTION",
        "PARTICULARS",
        "PARTICULAR",

        "MEDICINE",
        "DRUG",

        "NAME",
        "DISPLAY NAME",
        "NAMETODISPLAY",

        "PRODUCTS"

    ],


    //--------------------------------------------------
    // OPENING
    //--------------------------------------------------

    opening: [

        "OPENING STOCK",
        "OPEN STOCK",
        "OPENING",

        "OPENING QTY",
        "OPEN QTY",

        "OP STOCK",
        "OP STK",
        "OP QTY",

        "OSTOCK",
        "O STOCK",
        "OS"

    ],


    //--------------------------------------------------
    // PURCHASE
    //--------------------------------------------------

    purchase: [

        "PURCHASE QUANTITY",
        "PURCHASE QTY",
        "PURCHASE",

        "PURCHASES",

        "PUR",
        "P QTY",

        "RECEIPT",
        "RECEIPTS",
        "RECEIVE",
        "RECEIVED",
        "RCPT",
        "RCVD",

        "INWARD",

        "PQTY",
        "P QTY"

    ],


    //--------------------------------------------------
    // PURCHASE FREE
    //--------------------------------------------------

    purchaseFree: [

        "PURCHASE FREE",
        "PURCHASE FREE QTY",
        "PURCHASE FREE QUANTITY",

        "PFREE",
        "P FREE",

        "PFR",
        "P FR"

    ],


    //--------------------------------------------------
    // PURCHASE RETURN
    //--------------------------------------------------

    purchaseReturn: [

        "PURCHASE RETURN",
        "PURCHASE RET",
        "PURCHASE RETN",

        "PUR RET",
        "PUR RETN",

        "P RETURN",
        "P RET",

        "PRET",
        "P RET"

    ],


    //--------------------------------------------------
    // SALES
    //--------------------------------------------------

    sales: [

        "SALE QUANTITY",
        "SALES QUANTITY",

        "SALE QTY",
        "SALES QTY",

        "SALE",
        "SALES",

        "S QTY",

        "ISSUE",
        "ISSUED",

        "OUTWARD",

        "SQTY",
        "S QTY"

    ],


    //--------------------------------------------------
    // SALES RETURN
    //--------------------------------------------------

    salesReturn: [

        "SALES RETURN",
        "SALE RETURN",

        "SALES RET",
        "SALE RET",

        "SAL RET",
        "SAL RETN",

        "S RETURN",
        "S RET",

        "SRET",
        "S RET"

    ],


    //--------------------------------------------------
    // FREE / BONUS
    //--------------------------------------------------

    free: [

        "FREE",
        "FREE QTY",
        "FREE QUANTITY",

        "BONUS",
        "SCHEME",

        "SALES FREE",
        "SALES FREE QTY",

        "S FREE",
        "SFREE",
        "S FRE"

    ],


    //--------------------------------------------------
    // REPLACEMENT
    //--------------------------------------------------

    replacement: [

        "REPLACEMENT",
        "REPLACE",
        "REPL",

        "REPLACEMENT QTY"

    ],


    //--------------------------------------------------
    // BRANCH
    //--------------------------------------------------

    branch: [

        "BRANCH",
        "BR",

        "TRANSFER"

    ],


    //--------------------------------------------------
    // CREDIT
    //--------------------------------------------------

    credit: [

        "CREDIT",
        "CR"

    ],


    //--------------------------------------------------
    // DEBIT
    //--------------------------------------------------

    debit: [

        "DEBIT",
        "DR",
        "DB"

    ],


    //--------------------------------------------------
    // ADJUSTMENT
    //--------------------------------------------------

    adjustment: [

        "ADJUSTMENT",
        "ADJUST",
        "ADJ",

        "CORRECTION",
        "CORRECTION QTY",

        "PCOR",
        "P COR",

        "PCORRE"

    ],


    //--------------------------------------------------
    // CLOSING
    //--------------------------------------------------

    closing: [

        "CLOSING STOCK",
        "CLOSING",

        "CLOSING QTY",

        "CL STOCK",
        "CL STK",
        "CL QTY",

        "BALANCE STOCK",
        "BALANCE",

        "BAL",

        "STOCK",

        "CLOSING STOCK QTY",

        "CL STOCK AS ON",

        "CLOSING STOCK AS ON"

    ],


    //--------------------------------------------------
    // RATE
    //--------------------------------------------------

    rate: [

        "RATE",
        "MRP",
        "PTR",
        "PTS",
        "PRICE",

        "PUR RATE",
        "PURRATE",

        "PRATE"

    ],


    //--------------------------------------------------
    // CLOSING VALUE
    //--------------------------------------------------

    closingValue: [

        "CLOSING VALUE",
        "CLOSING STOCK VALUE",

        "CL VALUE",
        "CL STOCK VALUE",

        "STOCK VALUE",
        "STOCKVALUE",

        "CLOSINGVALUE"

    ],


    //--------------------------------------------------
    // SALES VALUE
    //--------------------------------------------------

    salesValue: [

        "SALES VALUE",
        "SALE VALUE",

        "SALEVALUE",
        "SALESVALUE",

        "OUT VALUE",
        "OUTWARD VALUE"

    ]

});


/* ======================================================
 * NORMALIZE
 * ====================================================== */

function normalize(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/\r?\n/g, " ")
        .replace(/[_\-\/\\.,():`'"]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/* ======================================================
 * COMPACT NORMALIZE
 *
 * Used for:
 *
 * ProductName
 * PQty
 * PFr
 * SQty
 * SFre
 * SRet
 * PurRate
 * StockValue
 * SaleValue
 *
 * ====================================================== */

function compact(text) {

    return normalize(text)
        .replace(/\s+/g, "");

}


/* ======================================================
 * EXACT MATCH
 * ====================================================== */

function findExact(header, rules) {

    for (const rule of rules) {

        const normalizedRule =
            normalize(rule);

        const index =
            header.findIndex(
                h => h === normalizedRule
            );

        if (index !== -1) {

            return index;

        }

    }

    return -1;

}


/* ======================================================
 * COMPACT EXACT MATCH
 * ====================================================== */

function findCompactExact(header, rules) {

    const compactHeader =
        header.map(compact);

    for (const rule of rules) {

        const normalizedRule =
            compact(rule);

        const index =
            compactHeader.findIndex(
                h => h === normalizedRule
            );

        if (index !== -1) {

            return index;

        }

    }

    return -1;

}


/* ======================================================
 * CONTAINS MATCH
 * ====================================================== */

function findContains(header, rules) {

    for (const rule of rules) {

        const normalizedRule =
            normalize(rule);

        const index =
            header.findIndex(
                h => h.includes(normalizedRule)
            );

        if (index !== -1) {

            return index;

        }

    }

    return -1;

}


/* ======================================================
 * FIND FIELD
 * ====================================================== */

function findField(header, rules) {

    //--------------------------------------------------
    // 1. Normal exact match
    //--------------------------------------------------

    let index =
        findExact(
            header,
            rules
        );

    if (index !== -1)
        return index;


    //--------------------------------------------------
    // 2. Compact exact match
    //--------------------------------------------------

    index =
        findCompactExact(
            header,
            rules
        );

    if (index !== -1)
        return index;


    //--------------------------------------------------
    // 3. Contains fallback
    //--------------------------------------------------

    index =
        findContains(
            header,
            rules
        );

    if (index !== -1)
        return index;


    return undefined;

}


/* ======================================================
 * SPECIAL ERP FORMAT
 *
 * DERMASCIENCE / PRODUCTNAME FORMAT
 * ======================================================
 *
 * ProductName | OS | PQty | PFr | SQty | SFre |
 * SRet | Stock | PurRate | StockValue | SaleValue |
 * PCor | PRet
 *
 * ====================================================== */

function detectDermascienceFormat(
    originalHeader,
    normalizedHeader
) {

    const compactHeader =
        normalizedHeader.map(compact);


    const productIndex =
        compactHeader.indexOf(
            "PRODUCTNAME"
        );


    const openingIndex =
        compactHeader.indexOf(
            "OS"
        );


    const purchaseIndex =
        compactHeader.indexOf(
            "PQTY"
        );


    const purchaseFreeIndex =
        compactHeader.indexOf(
            "PFR"
        );


    const purchaseReturnIndex =
        compactHeader.indexOf(
            "PRET"
        );


    const salesIndex =
        compactHeader.indexOf(
            "SQTY"
        );


    const salesFreeIndex =
        compactHeader.indexOf(
            "SFRE"
        );


    const salesReturnIndex =
        compactHeader.indexOf(
            "SRET"
        );


    const closingIndex =
        compactHeader.indexOf(
            "STOCK"
        );


    const rateIndex =
        compactHeader.indexOf(
            "PURRATE"
        );


    const closingValueIndex =
        compactHeader.indexOf(
            "STOCKVALUE"
        );


    const salesValueIndex =
        compactHeader.indexOf(
            "SALEVALUE"
        );


    const adjustmentIndex =
        compactHeader.indexOf(
            "PCOR"
        );


    //--------------------------------------------------
    // Need ProductName + movement columns
    //--------------------------------------------------

    if (
        productIndex < 0
    ) {

        return null;

    }


    if (
        openingIndex < 0 &&
        purchaseIndex < 0 &&
        salesIndex < 0 &&
        closingIndex < 0
    ) {

        return null;

    }


    //--------------------------------------------------
    // Build mapping
    //--------------------------------------------------

    const mapping = {};


    mapping.product =
        productIndex;


    mapping.productDescription =
        productIndex;


    if (openingIndex >= 0)
        mapping.opening =
            openingIndex;


    if (purchaseIndex >= 0)
        mapping.purchase =
            purchaseIndex;


    if (purchaseFreeIndex >= 0)
        mapping.purchaseFree =
            purchaseFreeIndex;


    if (purchaseReturnIndex >= 0)
        mapping.purchaseReturn =
            purchaseReturnIndex;


    if (salesIndex >= 0)
        mapping.sales =
            salesIndex;


    if (salesFreeIndex >= 0)
        mapping.free =
            salesFreeIndex;


    if (salesReturnIndex >= 0)
        mapping.salesReturn =
            salesReturnIndex;


    if (closingIndex >= 0)
        mapping.closing =
            closingIndex;


    if (rateIndex >= 0)
        mapping.rate =
            rateIndex;


    if (closingValueIndex >= 0)
        mapping.closingValue =
            closingValueIndex;


    if (salesValueIndex >= 0)
        mapping.salesValue =
            salesValueIndex;


    if (adjustmentIndex >= 0)
        mapping.adjustment =
            adjustmentIndex;


    mapping.specialFormat =
        "DERMASCIENCE_PRODUCTNAME_FORMAT";


    return mapping;

}


/* ======================================================
 * MAIN
 * ====================================================== */

function findColumns(header) {

    //--------------------------------------------------
    // Safety
    //--------------------------------------------------

    if (!Array.isArray(header)) {

        return {

            success: false,

            mapping: {},

            missing: [

                "product",
                "opening",
                "purchase",
                "sales",
                "closing"

            ]

        };

    }


    //--------------------------------------------------
    // Normalize once
    //--------------------------------------------------

    const normalizedHeader =
        header.map(normalize);


    //--------------------------------------------------
    // Mapping
    //--------------------------------------------------

    const mapping = {};


    /* =================================================
     * SPECIAL DERMASCIENCE FORMAT FIRST
     * ================================================= */

    const dermascienceMapping =
        detectDermascienceFormat(
            header,
            normalizedHeader
        );


    if (dermascienceMapping) {

        Object.assign(
            mapping,
            dermascienceMapping
        );

    }


    /* =================================================
     * NORMAL MAPPING
     *
     * Only fill fields that have not already been
     * detected by the special format.
     * ================================================= */

    Object.entries(
        COLUMN_RULES
    ).forEach(
        ([field, rules]) => {

            //------------------------------------------------
            // Do not overwrite special-format mappings
            //------------------------------------------------

            if (
                mapping[field] !== undefined
            ) {

                return;

            }


            const index =
                findField(
                    normalizedHeader,
                    rules
                );


            if (
                index !== undefined
            ) {

                mapping[field] =
                    index;

            }

        }
    );


    /* =================================================
     * EXTRA SAFETY FOR ABBREVIATED HEADERS
     * =================================================
     *
     * These rules are deliberately exact.
     *
     * They will NOT interfere with ordinary XLS/XLSX
     * headers.
     * ================================================= */

    const compactHeader =
        normalizedHeader.map(compact);


    //--------------------------------------------------
    // ProductName
    //--------------------------------------------------

    if (
        mapping.product === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PRODUCTNAME"
            );

        if (index >= 0) {

            mapping.product =
                index;

            mapping.productDescription =
                index;

        }

    }


    //--------------------------------------------------
    // OS
    //--------------------------------------------------

    if (
        mapping.opening === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "OS"
            );

        if (index >= 0) {

            mapping.opening =
                index;

        }

    }


    //--------------------------------------------------
    // PQty
    //--------------------------------------------------

    if (
        mapping.purchase === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PQTY"
            );

        if (index >= 0) {

            mapping.purchase =
                index;

        }

    }


    //--------------------------------------------------
    // PFr
    //--------------------------------------------------

    if (
        mapping.purchaseFree === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PFR"
            );

        if (index >= 0) {

            mapping.purchaseFree =
                index;

        }

    }


    //--------------------------------------------------
    // PRet
    //--------------------------------------------------

    if (
        mapping.purchaseReturn === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PRET"
            );

        if (index >= 0) {

            mapping.purchaseReturn =
                index;

        }

    }


    //--------------------------------------------------
    // SQty
    //--------------------------------------------------

    if (
        mapping.sales === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "SQTY"
            );

        if (index >= 0) {

            mapping.sales =
                index;

        }

    }


    //--------------------------------------------------
    // SFre
    //--------------------------------------------------

    if (
        mapping.free === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "SFRE"
            );

        if (index >= 0) {

            mapping.free =
                index;

        }

    }


    //--------------------------------------------------
    // SRet
    //--------------------------------------------------

    if (
        mapping.salesReturn === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "SRET"
            );

        if (index >= 0) {

            mapping.salesReturn =
                index;

        }

    }


    //--------------------------------------------------
    // Stock
    //--------------------------------------------------

    if (
        mapping.closing === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "STOCK"
            );

        if (index >= 0) {

            mapping.closing =
                index;

        }

    }


    //--------------------------------------------------
    // PurRate
    //--------------------------------------------------

    if (
        mapping.rate === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PURRATE"
            );

        if (index >= 0) {

            mapping.rate =
                index;

        }

    }


    //--------------------------------------------------
    // StockValue
    //--------------------------------------------------

    if (
        mapping.closingValue === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "STOCKVALUE"
            );

        if (index >= 0) {

            mapping.closingValue =
                index;

        }

    }


    //--------------------------------------------------
    // SaleValue
    //--------------------------------------------------

    if (
        mapping.salesValue === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "SALEVALUE"
            );

        if (index >= 0) {

            mapping.salesValue =
                index;

        }

    }


    //--------------------------------------------------
    // PCor
    //--------------------------------------------------

    if (
        mapping.adjustment === undefined
    ) {

        const index =
            compactHeader.indexOf(
                "PCOR"
            );

        if (index >= 0) {

            mapping.adjustment =
                index;

        }

    }


    //--------------------------------------------------
    // Mandatory columns
    //--------------------------------------------------

    const required = [

        "product",
        "opening",
        "purchase",
        "sales",
        "closing"

    ];


    const missing =
        required.filter(
            field =>
                mapping[field] === undefined
        );


    //--------------------------------------------------
    // Result
    //--------------------------------------------------

    return {

        success:
            missing.length === 0,

        mapping,

        missing

    };

}


/* ======================================================
 * EXPORT
 * ====================================================== */

module.exports = {

    findColumns

};