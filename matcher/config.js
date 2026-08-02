/**
 * ======================================================
 * PRODUCT MATCHER CONFIGURATION
 * ======================================================
 * This file contains all business configurations.
 * No matching logic should be written here.
 */

module.exports = {

    // ==========================================
    // Mandatory Modifiers
    // ==========================================
    MANDATORY_MODIFIERS: [

        "M",
        "+",

        "CR",
        "SR",
        "ER",
        "XR",
        "MR",
        "IR",

        "DS",
        "OD",

        "PLUS",
        "FORTE",
        "GOLD",
        "LITE",
        "KID",
        "MF",
        "EZ"

    ],

    // ==========================================
    // Product Forms
    // ==========================================
    PRODUCT_FORMS: [

        "TAB",
        "TABLET",

        "CAP",
        "CAPS",
        "CAPSULE",
        "CAPSULES",

        "SOAP",

        "CREAM",

        "LOTION",
        "LOT",

        "GEL",

        "OINTMENT",

        "POWDER",

        "FACE",
        "WASH",
        "FACEWASH",

        "SHAMPOO",

        "SOLUTION",

        "SPRAY",

        "SERUM",

        "DROPS",

        "SUSPENSION",

        "SYRUP",
        "SYP"

    ],

    // ==========================================
    // Units
    // ==========================================
    UNITS: [

        "MG",
        "MCG",
        "GM",
        "G",
        "KG",

        "ML",
        "L",

    ],

    // 👇 ADD THIS HERE
    NORMALIZATION_RULES: {

        "TABLET": "TAB",
        "TABLETS": "TAB",

        "CAPSULE": "CAP",
        "CAPSULES": "CAP",
        "CAPS": "CAP",

        "SYRUP": "SYP",

        "LOTION": "LOT",

        "INJECTION": "INJ",

        "I.V.": "IV",
        "I/V": "IV"

    },
    
// ==========================================
// Table Extraction Configuration
// ==========================================

MAX_CONSECUTIVE_BLANK_ROWS: 3,

STOP_WORDS: [

    "TOTAL",
    "GRAND TOTAL",
    "SUB TOTAL",
    "NET TOTAL",

    "PREPARED BY",
    "CHECKED BY",

    "AUTHORIZED",
    "AUTHORISED",

    "SIGNATURE",

    "MANAGER",

    "END OF REPORT"

],

FOOTER_WORDS: [

    "PREPARED BY",
    "CHECKED BY",
    "AUTHORIZED",
    "AUTHORISED",
    "SIGNATURE"

]
};