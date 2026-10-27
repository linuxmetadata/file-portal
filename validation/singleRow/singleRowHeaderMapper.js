/**
 * ============================================================
 * SINGLE ROW TXT COMMON HEADER MAPPER
 * ============================================================
 *
 * SCRIPT 3
 *
 * STRUCTURE-FIRST / STRUCTURE-AWARE MAPPER
 *
 * IMPORTANT:
 *   - Does NOT re-extract TXT rows.
 *   - Does NOT calculate business values.
 *   - Does NOT modify Script 2.
 *   - Product values are NEVER split.
 *   - Known structure mappings always have priority.
 *   - Unknown source headers are preserved.
 *   - Ambiguous generic aliases are NOT allowed to override
 *     a structure-specific decision.
 *   - Duplicate common fields do not overwrite the first
 *     authoritative mapping.
 *
 * INPUT:
 *   Script 2 -> extractSingleRowData()
 *
 * OUTPUT:
 *   Script 4 -> mapExtractionResult()
 * ============================================================
 */

"use strict";

/*
 * ============================================================
 * HEADER NORMALIZATION
 * ============================================================
 */

function normalizeHeader(value) {
    return String(value ?? "")
        .toUpperCase()
        .replace(/[<>{}()[\]:;,|/\\'"`]/g, "")
        .replace(/[.\-]/g, "")
        .replace(/\s+/g, "")
        .trim();
}

function compactHeader(value) {
    return normalizeHeader(value);
}

function normalizeIdentifier(value) {
    return String(value ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "")
        .trim();
}

/*
 * ============================================================
 * COMMON FIELDS
 * ============================================================
 */

const COMMON_FIELDS = Object.freeze({
    PRODUCT: "product",
    PACK: "pack",
    OPENING: "opening",
    PURCHASE: "purchase",
    PURCHASE_FREE_QTY: "purchaseFreeQty",
    PURCHASE_RETURN_FREE_QTY: "purchaseReturnFreeQty",
    TOTAL: "total",
    SALES: "sales",
    SALES_FREE_QTY: "salesFreeQty",
    CLOSING: "closing",
    CLOSING_VALUE: "closingValue",
    SALES_VALUE: "salesValue",
    AGE: "age",
    DAY: "day",
    EXPIRY: "expiry",
    PR_SALE: "prSale",
    REPLACEMENT: "replacement",
    FREE: "free",
    ADJUSTMENT: "adjustment",
    PURCHASE_RETURN: "purchaseReturn",
    SALES_RETURN: "salesReturn",
    PRODUCT_CODE: "productCode",
    HSN_CODE: "hsnCode",
    SERIAL: "serialNumber",
    PRICE: "price",
    AMOUNT: "amount"
});

/*
 * ============================================================
 * STRUCTURE FIELD MAP
 * ============================================================
 *
 * IMPORTANT:
 *
 * These are the already-reviewed H001-H033 structure mappings.
 *
 * Do NOT use column position here.
 * The physical source header is the authority.
 *
 * Fields intentionally set to null remain unidentified.
 * That is safer than assigning a wrong business meaning.
 * ============================================================
 */

const STRUCTURE_FIELD_MAP = Object.freeze({

    H001: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OP: "opening",
        RECEIPTS: "purchase",
        SALES: "sales",
        CLOSING: "closing"
    },

    H002: {
        PACKING: "pack",
        OPENING: "opening",
        PUR: "purchase",
        SALE: "sales",
        CLOSING: "closing",
        AGE: "age"
    },

    H003: {
        PRODUCT_NAME: "product",
        OPEN: "opening",
        REC: "purchase",
        ADJ: "adjustment",
        TOTAL: "total",
        SALES: "sales",
        CLOSE: "closing"
    },

    H004: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OPENING_STOCK: "opening",
        PURCHASE: "purchase",
        SALES: "sales",
        CLOSING_STOCK: "closing"
    },

    H005: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        O_STK: "opening",
        PURC: "purchase",
        TOT: "total",
        SALE: "sales",
        QOH: "closing",
        VALUE: "closingValue",
        AGE: "age"
    },

    H006: {
        ITEMCODE: "productCode",
        ITEMNAME: "product",
        CLSTOCK: "closing",
        CLVALUE: "closingValue",
        SALES: "sales",
        SALESVALUE: "salesValue",
        // LM 1 / LM 2 are intentionally left unidentified.
    },

    H007: {
        ITEM_NAME: "product",
        /*
         * BOX is a source-only field.
         * There is no standard common "box" field in COMMON_FIELDS.
         * Preserve BOX under source/unidentified rather than creating
         * an incomplete common mapping container.
         */
        BOX: null,
        PACK: "pack",
        OPQTY: "opening",
        P_QTY: "purchase",
        REPL: "replacement",
        S_QTY: "sales",
        B_QTY: "closing"
    },

    H008: {
        CODE: "productCode",
        NAME: "product",
        PRATE: "price",
        OP: "opening",
        PURCHASE: "purchase",
        PRETURN: "purchaseReturn",
        SALES: "sales",
        SVALUE: "salesValue",
        SRETURN: "salesReturn",
        CLSTOCK: "closing"
    },

    H009: {
        PRODUCT_NAME: "product",
        PACK: "pack",
        OPSTK: "opening",
        PUR: "purchase",
        SALE: "sales",
        CURSTK: "closing",
        STKVAL: "closingValue"
    },

    H010: {
        PRODUCT_NAME: "product",
        PACK: "pack",
        OPEN: "opening",
        RECD: "purchase",
        SALES: "sales",
        CLOSE: "closing",
        VALUE: "closingValue"
    },

    H011: {
        CODE: "productCode",
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OPENING: "opening",
        RECEIPTS: "purchase",
        TOTAL: "total",
        SALES: "sales",
        CLOSING: "closing"
    },

    H012: {
        CODE: "productCode",
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OPENING: "opening",
        RECEIPTS: "purchase",
        TOTAL: "total",
        SALE: "sales",
        SALES: "sales",
        CLOSING: "closing",
        CLOSING_AGE: "age"
    },

    H013: {
        PRODUCTNAME: "product",
        PACK: "pack",
        OPSTK: "opening",
        SALE: "sales",
        STOCKVAL: "closingValue",
        SALEVALUE: "salesValue"
    },

    H014: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        O_STK: "opening",
        PURC: "purchase",
        TOT: "total",
        SALE: "sales",
        QOH: "closing",
        VALUE: "closingValue",
        AGE: "age"
    },

    H015: {
        DIVISON: null,
        ITEM_CODE: "productCode",
        ITEM_NAME: "product",
        PACKSIZE: "pack",
        P_RATE: "purchaseRate",
        PTR: "price",
        OPENING: "opening",
        OPENING_VALUE: "openingValue",
        PUR_QTY: "purchase",
        PUR_FQTY: "purchaseFreeQty",
        RPL_QTY: "replacement",
        PUR_VALUE: "purchaseValue",
        PUR_RET_QTY: "purchaseReturn",
        PUR_RET_FQTY: "purchaseReturnFreeQty",
        SALE_QTY: "sales",
        SALE_FQTY: "salesFreeQty",
        SALE_VALUE: "salesValue",
        SALE_QTY_1: null,
        SALE_QTY_2: null,
        SALE_RET_QTY: "salesReturn",
        SALE_RET_FQTY: "salesReturnFreeQty",
        OTHER_QTY: null,
        CLOSING: "closing",
        CLOSING_AMOUNT_PTR: "closingValue",
        STOCK_AMOUNT_PUR_RATE: null,
        STATUS: null
    },

    H016: {
        OPENING: "opening",
        SALES: "sales",
        CLOSING: "closing",
        PRODUCT_NAME: "product",
        PACKING: "pack",
        PURC: "purchase"
    },

    H017: {
        /*
         * H017 exact reviewed source structure.
         *
         * IMPORTANT:
         * This mapper preserves the physical source columns and maps
         * only meanings established for the reviewed H017 layout.
         *
         * Expanded H017 source fields:
         *   MEDICINE NAME -> product
         *   PACK          -> pack
         *   O.B           -> opening
         *   PURC          -> purchase
         *   TOTAL         -> total
         *   PRTN          -> purchaseReturn
         *   L_SLE         -> sales
         *   ADJ           -> adjustment
         *   SALES         -> sales
         *   FREE          -> free
         *   REPL          -> replacement
         *   SAL.VAL       -> salesValue
         *   CL.ST         -> closing
         *   CLST.VAL      -> closingValue
         *
         * L_SLE and SALES both map to the standard sales field.
         * mapRecord() already uses "first authoritative mapping wins",
         * so the second SALES column cannot overwrite the first value.
         *
         * Source values are never split or recalculated here.
         */
        MEDICINE_NAME: "product",
        NAME: "product",
        PACK: "pack",
        O_B: "opening",
        PURC: "purchase",
        TOTAL: "total",
        PRTN: "purchaseReturn",
        L_SLE: "sales",
        ADJ: "adjustment",
        SALES: "sales",
        FREE: "free",
        REPL: "replacement",
        SAL_VAL: "salesValue",
        CL_ST: "closing",
        CLST_VAL: "closingValue"
    },

    H018: {
        /*
         * H018 exact source structure:
         *
         * MEDICINE NAME | PACK | O.B | PURC | TOTAL | L_SLE |
         * ADJ | SALES | SAL.VAL | CL.ST | CLST.VAL
         *
         * Established meanings:
         *   MEDICINE NAME -> product
         *   PACK         -> pack
         *   O.B          -> opening
         *   PURC         -> purchase
         *   TOTAL        -> total
         *   ADJ          -> adjustment
         *   SALES        -> sales
         *   SAL.VAL      -> salesValue
         *   CL.ST        -> closing
         *   CLST.VAL     -> closingValue
         *
         * L_SLE is preserved as an unidentified source field because
         * the current common-field registry does not establish a
         * standard business meaning for it.
         */
        MEDICINE_NAME: "product",
        NAME: "product",
        PACK: "pack",
        O_B: "opening",
        PURC: "purchase",
        TOTAL: "total",
        L_SLE: null,
        ADJ: "adjustment",
        SALES: "sales",
        SAL_VAL: "salesValue",
        CL_ST: "closing",
        CLST_VAL: "closingValue"
    },

    H019: {
        PRODUCT_NAME: "product",
        PACKG: "pack",
        OPENING: "opening",
        RECEIPT: "purchase",
        SALES: "sales",
        O_STK: "opening",
        CLOSING: "closing",
        AGE: "age",
        DAY: "day"
    },

    H020: {
    "Product Name": "product",
    "Packing": "pack",
    "Op.Stk": "opening",
    "P.Qtye": "purchase",
    "Tot": "total",
    "S.Qty": "sales",
    "Qoh": "closing",
    "Value": "closingValue",
    "Age": "age"
    },

    H021: {
        PRODUCT_NAME: "product",
        PACKG: "pack",
        OPENING: "opening",
        RECEIPT: "purchase",
        SALES: "sales",
        ADJMT: "adjustment",
        CLOSING: "closing",
        CLOSING_AGE: "age",
        DAY: "day"
    },

    H022: {
        PACK: "pack",
        CODE: "productCode",
        OPENING: "opening",
        PURCHASE: "purchase",
        PRE: "purchaseReturn",
        SALE: "sales",
        SRE: "salesReturn",
        ADJ: "adjustment",
        CLOSING: "closing"
    },

    /*
     * H023 deliberately has no semantic mapping.
     *
     * The reviewed reference does not establish whether
     * repeated QTY / VALUE columns represent opening,
     * purchase, sales or closing.
     */
    H023: {},

    H024: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        O_BAL: "opening",
        RCPTS: "purchase",
        TOTAL: "total",
        SALES: "sales",
        PUR_RET: "purchaseReturn",
        CL_BAL: "closing",
        CL_VALUE: "closingValue",
        AGE: "age"
    },

    H025: {
        DATE: null,
        INV_NO: null,
        CUSTOMER_NAME: null,
        ADDR: null,
        QTY: null,
        FREE: "free",
        PRICE: "price",
        AMOUNT: "amount"
    },

    H026: {
        SNO: "serialNumber",
        PARTICULARS: "product",
        OPSTK: "opening",
        PUR: "purchase",
        STKIN: "StockIn",
        SALE: "sales",
        UCS: null,
        STKOT: "StockOut",
        CLSTK: "closing",
        SALEVALUE: "salesValue",
        STOCK_VALUE: "closingValue"
    },

    H027: {
        CODE: "productCode",
        NAME: "product",
        PRATE: "price",
        OP: "opening",
        PURCHASE: "purchase",
        PRETURN: "purchaseReturn",
        SALES: "sales",
        SVALUE: "salesValue",
        SRETURN: "salesReturn",
        EXCESS: null,
        SHORT: null,
        CLSTOCK: "closing"
    },

    H028: {
        PRODUCT_NAME: "product",
        PACKG: "pack",
        SALES: "sales",
        CLOSING: "closing",
        DAY: "day"
    },

    H029: {
        PRODUCT_NAME: "product",
        PACK: "pack",
        O_STK: "opening",
        PURC: "purchase",
        TOT: "total",
        SALE: "sales",
        QOH: "closing",
        VALUE: "closingValue",
        AGE: "age"
    },

    H030: {
        PARTICULARS: "product",
        PKG: "pack",
        OP: "opening",
        PR_QTY: "purchase",
        SLRET: "salesReturn",
        SALE: "sales",
        CL_STK: "closing",
        SAL_VAL: "salesValue",
        CLVAL: "closingValue"
    },

    H031: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OPENING: "opening",
        PURCHASE: "purchase",
        SALES: "sales",
        C_STOCK: "closing",
        EXPIRY: "expiry",
        PR_SALE: "prSale"
    },

    H032: {
        PRODUCT_NAME: "product",
        PACKING: "pack",
        OP: "opening",
        RECEIPTS: "purchase",
        TOTAL: "total",
        PURCHASE: "purchase",
        SALES: "sales",
        DAY: "day"
    },

    H033: {
        OPENING: "opening",
        SALES: "sales",
        CLOSING: "closing",
        PRODUCT_NAME: "product",
        PACKING: "pack",
        PURC: "purchase",
        FREE: "free",
        OPENING_STOCK: "opening",
        PURCHASE: "purchase"
    },
        H034: {
        PRODUCT_NAME: "product",
        UNIT: "pack",
        OP_ST: "opening",
        ST_IN: "purchase",
        ST_OUT: "sales",
        BAL: "closing",
        VALUE: "closingValue"
    }
});

/*
 * ============================================================
 * FALLBACK ALIASES
 * ============================================================
 *
 * IMPORTANT:
 *
 * These are ONLY used if the structure-specific map does not
 * contain the header.
 *
 * Deliberately excluded:
 *   BOX
 *   QTY
 *   VALUE
 *   DESCRIPTION/PACKING
 *   PARTICULARS
 *   NAME
 *
 * where their meaning can be structure-dependent.
 * ============================================================
 */

const HEADER_ALIASES = Object.freeze({

    PRODUCTNAME: "product",
    PRODUCT: "product",
    ITEMNAME: "product",
    ITEM: "product",
    MEDICINENAME: "product",
    MEDICINE: "product",
    DESCRIPTION: "product",

    PACKING: "pack",
    PACKSIZE: "pack",
    PACKG: "pack",
    PACK: "pack",

    OSTK: "opening",
    OPSTK: "opening",
    OPENING: "opening",
    OPENINGBAL: "opening",
    OPENINGBALANCE: "opening",
    OPNGBAL: "opening",
    OBAL: "opening",
    OB: "opening",
    OPQTY: "opening",
    OP_STK: "opening",
    O_STK: "opening",
    O_BAL: "opening",

    PURC: "purchase",
    PURCHASE: "purchase",
    PQTY: "purchase",
    PUR: "purchase",
    RECEIPT: "purchase",
    RECEIPTS: "purchase",
    RCPT: "purchase",
    RECD: "purchase",
    P_QTY: "purchase",
    P_QTYE: "purchase",
    PR_QTY: "purchase",

    TOT: "total",
    TOTAL: "total",
    TOTALS: "total",

    SALE: "sales",
    SALES: "sales",
    S_QTY: "sales",
    SQTY: "sales",
    SALE_QTY: "sales",

    QOH: "closing",
    CLOSING: "closing",
    CSTOCK: "closing",
    C_STOCK: "closing",
    CLST: "closing",
    CLSTK: "closing",
    CLSTOCK: "closing",
    CLBAL: "closing",
    CL_BAL: "closing",
    CURSTK: "closing",
    B_QTY: "closing",

    STKVAL: "closingValue",
    STOCKVAL: "closingValue",
    STOCKVALUE: "closingValue",
    CL_VALUE: "closingValue",
    CLVALUE: "closingValue",

    SALEVALUE: "salesValue",
    SALESVALUE: "salesValue",
    SVALUE: "salesValue",
    SALE_VALUE: "salesValue",
    SAL_VAL: "salesValue",

    AGE: "age",
    DAY: "day",

    EXPIRY: "expiry",

    PRSALE: "prSale",
    PR_SALE: "prSale",

    REPL: "replacement",
    REPLACEMENT: "replacement",

    FREE: "free",

    ADJ: "adjustment",
    ADJUSTMENT: "adjustment",
    ADJMT: "adjustment",

    PRET: "purchaseReturn",
    PRETURN: "purchaseReturn",
    PURRET: "purchaseReturn",
    PUR_RET: "purchaseReturn",
    PURCHASERETURN: "purchaseReturn",

    SRET: "salesReturn",
    SRETURN: "salesReturn",
    SALRET: "salesReturn",
    SALE_RET_QTY: "salesReturn",
    SALESRETURN: "salesReturn",

    ITEMCODE: "productCode",
    ITEM_CODE: "productCode",
    PRODUCTCODE: "productCode",
    CODE: "productCode",

    HSN: "hsnCode",
    HSNCODE: "hsnCode",

    SNO: "serialNumber",
    NO: "serialNumber",

    PRATE: "price",
    P_RATE: "price",
    PRICE: "price",

    AMOUNT: "amount"
});

/*
 * ============================================================
 * STRUCTURE SIGNATURES
 * ============================================================
 *
 * Used only to identify the structure.
 *
 * A structure must achieve a meaningful signature score.
 * We do not classify a statement from one generic header.
 * ============================================================
 */

const STRUCTURE_SIGNATURES = Object.freeze({

    H001: [
        "PRODUCTNAME",
        "PACKING",
        "OP",
        "RECEIPTS",
        "SALES",
        "CLOSING"
    ],

    H002: [
        "PACKING",
        "OPENING",
        "PUR",
        "SALE",
        "CLOSING",
        "AGE"
    ],

    H003: [
        "PRODUCTNAME",
        "OPEN",
        "REC",
        "ADJ",
        "TOTAL",
        "SALES",
        "CLOSE"
    ],

    H004: [
        "PRODUCTNAME",
        "PACKING",
        "OPENINGSTOCK",
        "PURCHASE",
        "SALES",
        "CLOSINGSTOCK"
    ],

    H005: [
        "PRODUCTNAME",
        "PACKING",
        "OSTK",
        "PURC",
        "TOT",
        "SALE",
        "QOH",
        "VALUE",
        "AGE"
    ],

    H006: [
        "ITEMCODE",
        "ITEMNAME",
        "CLSTOCK",
        "SALES"
    ],

    H007: [
        "ITEMNAME",
        "BOX",
        "PACK",
        "OPQTY",
        "P_QTY",
        "REPL",
        "S_QTY",
        "B_QTY"
    ],

    H008: [
        "CODE",
        "NAME",
        "PRATE",
        "OP",
        "PURCHASE",
        "PRETURN",
        "SALES",
        "SVALUE",
        "SRETURN",
        "CLSTOCK"
    ],

    H009: [
        "PRODUCTNAME",
        "PACK",
        "OPSTK",
        "PUR",
        "SALE",
        "CURSTK",
        "STKVAL"
    ],

    H010: [
        "PRODUCTNAME",
        "PACK",
        "OPEN",
        "RECD",
        "SALES",
        "CLOSE",
        "VALUE"
    ],

    H011: [
        "CODE",
        "PRODUCTNAME",
        "PACKING",
        "OPENING",
        "RECEIPTS",
        "TOTAL",
        "SALES",
        "CLOSING"
    ],

    H012: [
        "CODE",
        "PRODUCTNAME",
        "PACKING",
        "OPENING",
        "RECEIPTS",
        "TOTAL",
        "SALES",
        "CLOSING",
        "CLOSINGAGE"
    ],

    H013: [
        "PRODUCTNAME",
        "PACK",
        "OPSTK",
        "SALE",
        "STOCKVAL",
        "SALEVALUE"
    ],

    H014: [
        "PRODUCTNAME",
        "PACKING",
        "OSTK",
        "PURC",
        "TOT",
        "SALE",
        "QOH",
        "VALUE",
        "AGE"
    ],

    H015: [
        "DIVISON",
        "ITEMCODE",
        "ITEMNAME",
        "PACKSIZE",
        "PRATE",
        "PTR",
        "OPENING",
        "OPENINGVALUE",
        "PURQTY",
        "PURFQTY",
        "RPLQTY",
        "PURVALUE",
        "PURRETQTY",
        "PURRETFQTY",
        "SALEQTY",
        "SALEFQTY",
        "SALEVALUE",
        "SALEQTY1",
        "SALEQTY2",
        "SALERETQTY",
        "SALERETFQTY",
        "OTHERQTY",
        "CLOSING",
        "CLOSINGAMOUNTPTR",
        "STOCKAMOUNTPURRATE",
        "STATUS"
    ],

    H016: [
        "OPENING",
        "SALES",
        "CLOSING",
        "PRODUCTNAME",
        "PACKING",
        "PURC"
    ],

    H017: [
        /*
         * Exact H017 physical header signature.
         *
         * These are structure-identification headers only.
         * They do not assign business meanings.
         */
        "MEDICINENAME",
        "PACK",
        "OB",
        "PURC",
        "TOTAL",
        "LSLE",
        "ADJ",
        "SALES",
        "SALVAL",
        "CLST",
        "CLSTVAL"
    ],

    H018: [
        "MEDICINENAME",
        "PACK",
        "OB",
        "PURC",
        "TOTAL",
        "LSLE",
        "ADJ",
        "SALES",
        "SALVAL",
        "CLST",
        "CLSTVAL"
    ],

    H019: [
        "PRODUCTNAME",
        "PACKG",
        "OPENING",
        "RECEIPT",
        "SALES",
        "CLOSING",
        "AGE",
        "DAY"
    ],

     H020: [
        "Product Name",
        "Packing",
        "Op.stk",
        "P.Qtye",
        "TOT",
        "S.Qty",
        "Qoh",
        "Value",
        "Age"
    ],

    H021: [
        "PRODUCTNAME",
        "PACKG",
        "OPENING",
        "RECEIPT",
        "SALES",
        "ADJMT",
        "CLOSING",
        "CLOSINGAGE",
        "DAY"
    ],

    H022: [
        "PACK",
        "CODE",
        "OPENING",
        "PURCHASE",
        "SALE",
        "ADJ",
        "CLOSING"
    ],

    H023: [
        "QTY",
        "VALUE"
    ],

    H024: [
        "PRODUCTNAME",
        "PACKING",
        "OBAL",
        "TOTAL",
        "SALES",
        "PURRET",
        "CLBAL",
        "CLVALUE",
        "AGE"
    ],

    H025: [
        "DATE",
        "INVNO",
        "CUSTOMERNAME",
        "ADDR",
        "QTY",
        "FREE",
        "PRICE",
        "AMOUNT"
    ],

    H026: [
        "SNO",
        "PARTICULARS",
        "OPSTK",
        "PUR",
        "STKIN",
        "SALE",
        "UCS",
        "STKOT",
        "CLSTK",
        "SALEVALUE",
        "STOCKVALUE"
    ],

    H027: [
        "CODE",
        "NAME",
        "PRATE",
        "OP",
        "PURCHASE",
        "PRETURN",
        "SALES",
        "SVALUE",
        "SRETURN",
        "EXCESS",
        "SHORT",
        "CLSTOCK"
    ],

    H028: [
        "PRODUCTNAME",
        "PACKG",
        "SALES",
        "CLOSING",
        "DAY"
    ],

    H029: [
        "PRODUCTNAME",
        "PACK",
        "OSTK",
        "PURC",
        "TOT",
        "SALE",
        "QOH",
        "VALUE",
        "AGE"
    ],

    H030: [
        "PARTICULARS",
        "PKG",
        "OP",
        "PRQTY",
        "SALE",
        "CLSTK",
        "SALVAL"
    ],

    H031: [
        "PRODUCTNAME",
        "PACKING",
        "OPENING",
        "PURCHASE",
        "SALES",
        "CSTOCK",
        "EXPIRY",
        "PRSALE"
    ],

    H032: [
        "PRODUCTNAME",
        "PACKING",
        "OP",
        "RECEIPTS",
        "TOTAL",
        "PURCHASE",
        "SALES",
        "DAY"
    ],

    H033: [
        "OPENING",
        "SALES",
        "CLOSING",
        "PRODUCTNAME",
        "PACKING",
        "PURC",
        "FREE",
        "OPENINGSTOCK",
        "PURCHASE"
    ],
        H034: [
        "PRODUCT_NAME",
        "UNIT",
        "OP_ST",
        "ST_IN",
        "ST_OUT",
        "BAL",
        "VALUE"
    ]
    
});

/*
 * ============================================================
 * UTILITY
 * ============================================================
 */

function hasOwn(object, key) {
    return !!object &&
        Object.prototype.hasOwnProperty.call(object, key);
}

function uniqueNormalizedColumns(columns) {
    return [
        ...new Set(
            (columns || [])
                .map(column =>
                    normalizeHeader(
                        column.header ??
                        column.sourceHeader ??
                        column
                    )
                )
                .filter(Boolean)
        )
    ];
}

/*
 * ============================================================
 * STRUCTURE SCORING
 * ============================================================
 */

function scoreStructure(columns, structureId) {

    const sourceHeaders =
        uniqueNormalizedColumns(columns);

    const signature =
        STRUCTURE_SIGNATURES[structureId] || [];

    if (
        !sourceHeaders.length ||
        !signature.length
    ) {
        return 0;
    }

    let matched = 0;

    for (const token of signature) {

        const normalizedToken =
            normalizeHeader(token);

        if (
            sourceHeaders.includes(
                normalizedToken
            )
        ) {
            matched++;
        }
    }

    return matched / signature.length;
}

/*
 * ============================================================
 * STRUCTURE IDENTIFICATION
 * ============================================================
 *
 * Priority:
 *
 * 1. Explicit extractor structure ID
 * 2. Exact / strongest structure signature
 * 3. No structure
 *
 * IMPORTANT:
 * We do not classify from a weak generic match.
 * ============================================================
 */

function inferStructureId(header) {

    if (!header) {
        return null;
    }

    const explicit =
        header.structureId ??
        header.structure ??
        header.structureID ??
        header.id ??
        null;

    if (
        explicit &&
        STRUCTURE_FIELD_MAP[explicit]
    ) {
        return explicit;
    }

    const columns =
        Array.isArray(header.columns)
            ? header.columns
            : [];

    let bestId = null;
    let bestScore = 0;

    for (
        const structureId
        of Object.keys(STRUCTURE_SIGNATURES)
    ) {

        const score =
            scoreStructure(
                columns,
                structureId
            );

        if (score > bestScore) {
            bestScore = score;
            bestId = structureId;
        }
    }

    /*
     * Require at least 60% of the structure signature.
     *
     * This prevents:
     *
     * PRODUCT NAME + SALES
     *
     * from being incorrectly classified as a complete
     * structure.
     */
    if (bestScore < 0.60) {
        return null;
    }

    return bestId;
}

/*
 * ============================================================
 * GET STRUCTURE MAP
 * ============================================================
 */

function getStructureMap(structureId) {

    if (
        !structureId ||
        !STRUCTURE_FIELD_MAP[structureId]
    ) {
        return null;
    }

    return STRUCTURE_FIELD_MAP[structureId];
}

/*
 * ============================================================
 * MAP ONE HEADER
 * ============================================================
 *
 * STRUCTURE-SPECIFIC RULE:
 *   wins over fallback alias.
 *
 * EXPLICIT NULL:
 *   means intentionally unidentified.
 *
 * This distinction is important.
 *
 * Example:
 *
 *   H027 EXCESS -> null
 *
 * must NOT fall back to some generic alias.
 * ============================================================
 */

function mapHeader(
    sourceHeader,
    position = null,
    index = null,
    structureId = null
) {

    const original =
        String(
            sourceHeader ?? ""
        ).trim();

    const normalized =
        normalizeHeader(
            original
        );

    const structureMap =
        getStructureMap(
            structureId
        );

    let commonField = null;
    let mappingSource = "NONE";

    /*
     * Structure maps use registry identifiers such as PRODUCT_NAME
     * and O_STK, while physical source headers may arrive as
     * PRODUCTNAME and O.Stk. Compare them through the same normalized
     * representation used by the rest of the mapper.
     *
     * This keeps the structure-specific mapping authoritative without
     * changing the source header text stored in the output.
     */
    let structureKey = null;

    if (structureMap) {
        structureKey =
            Object.keys(structureMap).find(
                key =>
                    normalizeHeader(key).replace(/_/g, "") === normalized.replace(/_/g, "")
            );
    }

    if (
        structureMap &&
        structureKey !== undefined &&
        structureKey !== null
    ) {

        /*
         * IMPORTANT:
         *
         * Even null is authoritative.
         */
        commonField =
            structureMap[structureKey];

        mappingSource =
            commonField
                ? "STRUCTURE"
                : "STRUCTURE_UNIDENTIFIED";

    } else {

        commonField =
            HEADER_ALIASES[
                normalized
            ] || null;

        mappingSource =
            commonField
                ? "FALLBACK"
                : "NONE";
    }

    return {

        index,

        position,

        sourceHeader:
            original,

        normalizedHeader:
            normalized,

        structureId:
            structureId || null,

        commonField,

        mappingSource,

        status:
            commonField
                ? "MAPPED"
                : "UNIDENTIFIED"
    };
}

/*
 * ============================================================
 * MAP HEADER OBJECT
 * ============================================================
 */

function mapHeaders(header) {

    if (
        !header ||
        !Array.isArray(
            header.columns
        )
    ) {

        return {
            success: false,
            message:
                "Header columns are required.",
            structureId: null,
            structureScore: 0,
            columns: []
        };
    }

    const structureId =
        inferStructureId(
            header
        );

    let sourceColumns = header.columns;

    /*
     * ============================================================
     * H007 HEADER REPAIR
     * ============================================================
     *
     * Script 2 is authoritative and is not modified.
     *
     * H007 physically contains these eight source columns:
     *   ITEM NAME | BOX | PACK | OPQTY | P_QTY | REPL | S_QTY | B_QTY
     *
     * Some downstream header representations can arrive with only
     * a subset of those columns.  In that case, restore ONLY the
     * missing H007 source columns from the known H007 fixed-width
     * layout.  Record values are still looked up by source header;
     * no numeric-token parsing is introduced.
     *
     * Known H007 boundaries:
     *   ITEM NAME :  0 -> 31
     *   BOX       : 31 -> 39
     *   PACK      : 39 -> 44
     *   OPQTY     : 44 -> 51
     *   P_QTY     : 51 -> 58
     *   REPL      : 58 -> 65
     *   S_QTY     : 65 -> 72
     *   B_QTY     : 72 -> 81
     * ============================================================
     */

    if (
        structureId === "H007" &&
        Array.isArray(sourceColumns)
    ) {

        const h007Columns = [
            {
                header: "ITEM NAME",
                normalized: "ITEMNAME",
                position: 0,
                end: 31
            },
            {
                header: "BOX",
                normalized: "BOX",
                position: 31,
                end: 39
            },
            {
                header: "PACK",
                normalized: "PACK",
                position: 39,
                end: 44
            },
            {
                header: "OPQTY",
                normalized: "OPQTY",
                position: 44,
                end: 51
            },
            {
                header: "P_QTY",
                normalized: "PQTY",
                position: 51,
                end: 58
            },
            {
                header: "REPL",
                normalized: "REPL",
                position: 58,
                end: 65
            },
            {
                header: "S_QTY",
                normalized: "SQTY",
                position: 65,
                end: 72
            },
            {
                header: "B_QTY",
                normalized: "BQTY",
                position: 72,
                end: 81
            }
        ];

        const existingByNormalized =
            new Map(
                sourceColumns
                    .map(column => [
                        normalizeHeader(
                            column.header
                        ),
                        column
                    ])
            );

        sourceColumns =
            h007Columns.map(
                (definition, index) => {

                    const existing =
                        existingByNormalized.get(
                            normalizeHeader(
                                definition.header
                            )
                        );

                    if (existing) {
                        return {
                            ...existing,
                            header:
                                definition.header,
                            normalized:
                                definition.normalized,
                            position:
                                definition.position,
                            end:
                                definition.end,
                            index
                        };
                    }

                    return {
                        ...definition,
                        index
                    };
                }
            );
    }

    /*
     * ============================================================
     * H009 HEADER REPAIR
     * ============================================================
     *
     * Script 2 is authoritative and normally supplies Sale and
     * CurStk as separate fixed-width columns.
     *
     * Some downstream/header representations can nevertheless
     * arrive with the physical labels "Sale CurStk" merged into
     * one header entry.  Do NOT change Script 2 or use token
     * splitting.  Repair only this known H009 header case from
     * the physical positions already present in the header.
     *
     * H009:
     *   Pur    starts at 51
     *   Sale   starts at 60
     *   CurStk starts at 65
     *   StkVal starts at 75
     * ============================================================
     */

    if (
        structureId === "H009" &&
        Array.isArray(sourceColumns)
    ) {

        const hasMergedSaleCurStk =
            sourceColumns.some(
                column =>
                    normalizeHeader(
                        column.header
                    ) === "SALECURSTK"
            );

        if (hasMergedSaleCurStk) {

            const repairedColumns =
                sourceColumns.filter(
                    column =>
                        normalizeHeader(
                            column.header
                        ) !== "SALECURSTK"
                );

            repairedColumns.push(
                {
                    index: repairedColumns.length,
                    header: "Sale",
                    normalized: "SALE",
                    position: 60,
                    end: 65
                },
                {
                    index: repairedColumns.length + 1,
                    header: "CurStk",
                    normalized: "CURSTK",
                    position: 65,
                    end: 75
                },
                {
                    index: repairedColumns.length + 2,
                    header: "StkVal",
                    normalized: "STKVAL",
                    position: 75,
                    end: 81
                }
            );

            sourceColumns =
                repairedColumns.sort(
                    (a, b) =>
                        Number(a.position ?? 0) -
                        Number(b.position ?? 0)
                );

        } else {

            /*
             * H009 may arrive with Sale and CurStk already separated
             * while the final StkVal header is missing from the
             * downstream header representation.
             *
             * Add ONLY the known H009 StkVal source column.
             * Do not alter, reorder, split, or reinterpret any
             * existing source columns.
             */
            const hasStkVal =
                sourceColumns.some(
                    column =>
                        normalizeHeader(
                            column.header
                        ) === "STKVAL"
                );

            if (!hasStkVal) {
                sourceColumns = [
                    ...sourceColumns,
                    {
                        index: sourceColumns.length,
                        header: "StkVal",
                        normalized: "STKVAL",
                        position: 75,
                        end: 81
                    }
                ].sort(
                    (a, b) =>
                        Number(a.position ?? 0) -
                        Number(b.position ?? 0)
                );
            }
        }
    }

    const columns =
        sourceColumns.map(
            (column, index) =>
                mapHeader(
                    column.header,
                    column.position,
                    column.index ??
                        index,
                    structureId
                )
        );

    const structureScore =
        structureId
            ? scoreStructure(
                header.columns,
                structureId
            )
            : 0;

    return {

        success: true,

        sourceHeader:
            header.text,

        headerLineNumber:
            header.lineNumber,

        structureId,

        structureScore,

        columns
    };
}

/*
 * ============================================================
 * RECORD VALUE LOOKUP
 * ============================================================
 *
 * Script 2 is authoritative.
 *
 * First:
 *   exact physical source header
 *
 * Then:
 *   normalized source header
 *
 * NEVER:
 *   numeric position fallback
 *
 * This is critical because different structures use
 * different physical columns.
 * ============================================================
 */

function lookupRecordValue(
    record,
    sourceHeader,
    normalizedHeader,
    structureId = null
) {

    const values =
        record &&
        record.values
            ? record.values
            : {};

    const rawValues =
        record &&
        record.rawValues
            ? record.rawValues
            : {};

    let value;
    let rawValue;

    /*
     * EXACT LOOKUP
     */
    if (
        hasOwn(
            values,
            sourceHeader
        )
    ) {
        value =
            values[
                sourceHeader
            ];
    }

    if (
        hasOwn(
            rawValues,
            sourceHeader
        )
    ) {
        rawValue =
            rawValues[
                sourceHeader
            ];
    }

    /*
     * NORMALIZED LOOKUP
     *
     * Only used when extractor and header differ
     * in harmless punctuation / spacing.
     */
    if (
        value === undefined
    ) {

        const key =
            Object.keys(
                values
            ).find(
                candidate =>
                    normalizeHeader(
                        candidate
                    ) ===
                    normalizedHeader
            );

        if (
            key !== undefined
        ) {

            value =
                values[key];

            if (
                rawValue === undefined &&
                hasOwn(
                    rawValues,
                    key
                )
            ) {
                rawValue =
                    rawValues[key];
            }
        }
    }

    return {
        value,
        rawValue
    };
}

/*
 * ============================================================
 * COMMON VALUE NORMALIZATION
 * ============================================================
 *
 * Source values such as "---", "-", and blank fields mean
 * "no numeric value" in common mapped fields.
 *
 * IMPORTANT:
 *   - The original source value is preserved unchanged.
 *   - Only the value written to the common object is normalized.
 *   - Zero remains zero.
 * ============================================================
 */

function normalizeCommonValue(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    if (
        typeof value === "string"
    ) {

        const trimmed =
            value.trim();

        if (
            trimmed === "" ||
            trimmed === "---" ||
            trimmed === "-"
        ) {
            return null;
        }
    }

    return value;
}

/*
 * ============================================================
 * MAP EXTRACTED RECORD
 * ============================================================
 */

function mapRecord(
    record,
    mappedHeader
) {

    if (
        !record ||
        !mappedHeader ||
        !Array.isArray(
            mappedHeader.columns
        )
    ) {

        throw new Error(
            "Record and mapped header are required."
        );
    }

    const common = {};
    const source = {};
    const unidentified = {};

    for (
        const column
        of mappedHeader.columns
    ) {

        const sourceHeader =
            column.sourceHeader;

        const lookedUp =
            lookupRecordValue(
                record,
                sourceHeader,
                column.normalizedHeader,
                column.structureId ||
                    mappedHeader.structureId ||
                    null
            );

        const value =
            lookedUp.value;

        const rawValue =
            lookedUp.rawValue;

        /*
         * ====================================================
         * ALWAYS PRESERVE RAW SOURCE FIELD
         * ====================================================
         */

        source[
            sourceHeader
        ] = {

            value:
                value !== undefined
                    ? value
                    : null,

            rawValue:
                rawValue !== undefined
                    ? rawValue
                    : null,

            extractorKey:
                sourceHeader,

            position:
                column.position,

            normalizedHeader:
                column.normalizedHeader,

            structureId:
                column.structureId,

            commonField:
                column.commonField,

            mappingSource:
                column.mappingSource,

            status:
                column.status
        };

        /*
         * ====================================================
         * COMMON MAPPING
         * ====================================================
         *
         * First authoritative mapping wins.
         *
         * This prevents:
         *
         *   OPENING
         *   OPENING STOCK
         *
         * from accidentally overwriting one another.
         * ====================================================
         */

        if (
            column.commonField
        ) {

            if (
                !hasOwn(
                    common,
                    column.commonField
                )
            ) {

                common[
                    column.commonField
                ] =
                    normalizeCommonValue(
                        value
                    );
            }

        } else {

            /*
             * =================================================
             * UNIDENTIFIED SOURCE FIELD
             * =================================================
             */

            unidentified[
                sourceHeader
            ] = {

                value:
                    value !== undefined
                        ? value
                        : null,

                rawValue:
                    rawValue !== undefined
                        ? rawValue
                        : null,

                position:
                    column.position,

                normalizedHeader:
                    column.normalizedHeader,

                structureId:
                    column.structureId,

                mappingSource:
                    column.mappingSource
            };
        }
    }

    return {

        rowNumber:
            record.rowNumber,

        rawLine:
            record.rawLine,

        common,

        source,

        unidentified,

        structureId:
            mappedHeader.structureId || null,

        structureScore:
            mappedHeader.structureScore || 0
    };
}

/*
 * ============================================================
 * MAP COMPLETE EXTRACTION RESULT
 * ============================================================
 */

function mapExtractionResult(
    extractionResult
) {

    if (
        !extractionResult ||
        !extractionResult.success
    ) {

        return {

            success: false,

            message:
                "Valid extraction result is required.",

            records: []
        };
    }

    // Script 2 may expose the detected structure on the extraction
    // result rather than repeating it inside extractionResult.header.
    // Pass that authoritative structure through to Script 3 so every
    // mapped record receives the same structureId as the mapped result.
    const mappingHeader = {
        ...(extractionResult.header || {}),
        structureId:
            extractionResult.structureId ||
            extractionResult.structure ||
            extractionResult.header?.structureId ||
            extractionResult.header?.structure ||
            null
    };

    const mappedHeader =
        mapHeaders(
            mappingHeader
        );

    if (
        !mappedHeader.success
    ) {

        return {

            success: false,

            message:
                mappedHeader.message,

            records: []
        };
    }

    /*
     * ========================================================
     * MAP EVERY RECORD
     * ========================================================
     */

    const records =
        Array.isArray(
            extractionResult.records
        )
            ? extractionResult.records.map(
                record =>
                    mapRecord(
                        record,
                        mappedHeader
                    )
            )
            : [];

    /*
     * ========================================================
     * RETURN
     * ========================================================
     */

    return {

        success: true,

        file:
            extractionResult.file,

        structureId:
            mappedHeader.structureId ||
            extractionResult.structureId ||
            extractionResult.structure ||
            null,

        structureScore:
            mappedHeader.structureScore || 0,

        header:
            mappedHeader,

        dataStart:
            extractionResult.dataStart,

        recordCount:
            records.length,

        records
    };
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {

    COMMON_FIELDS,

    normalizeHeader,

    compactHeader,

    normalizeIdentifier,

    inferStructureId,

    scoreStructure,

    mapHeader,

    mapHeaders,

    mapRecord,

    mapExtractionResult,

    lookupRecordValue,

    normalizeCommonValue,

    HEADER_ALIASES,

    STRUCTURE_FIELD_MAP,

    STRUCTURE_SIGNATURES
};

/*
 * ============================================================
 * DIRECT CLI TEST
 * ============================================================
 */

if (
    require.main === module
) {

    const filePath =
        process.argv[2];

    if (
        !filePath
    ) {

        console.error(
            "Usage:"
        );

        console.error(
            'node validation/singleRow/singleRowHeaderMapper.js "path\\file.txt"'
        );

        process.exit(1);
    }

    try {

        const {
            extractSingleRowData
        } =
            require(
                "./singleRowDataExtractor"
            );

        const extraction =
            extractSingleRowData(
                filePath
            );

        const result =
            mapExtractionResult(
                extraction
            );

        console.log(
            JSON.stringify(
                result,
                null,
                2
            )
        );

    } catch (error) {

        console.error(
            error.stack ||
            error.message
        );

        process.exit(1);
    }
}