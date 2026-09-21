/**
 * ======================================================
 * EXTRACTION MAPPER V4
 * ======================================================
 *
 * Intelligent statement header mapping.
 *
 * IMPORTANT:
 * - PRODUCT DESCRIPTION has priority over PRODUCT CODE.
 * - Product code is NEVER selected as product when a
 *   product description/name column exists.
 * - Only PRODUCT is mandatory.
 * - Existing formats are preserved.
 * - Added DERMASCIENCE ProductName/OS/PQty/Stock format.
 * - Added value-column mapping.
 *
 * ======================================================
 */

const { tokenizeHeader } = require("./headerTokenizer");
const vocab = require("./businessVocabulary");


//------------------------------------------------------
// NORMALIZE
//------------------------------------------------------

function normalize(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/\r?\n/g, " ")
        .replace(/[_\-\/\\.,():]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}

//------------------------------------------------------
// COMPACT NORMALIZE
//------------------------------------------------------

function compact(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/[\s._\-\/\\():]/g, "")
        .trim();

}

//------------------------------------------------------
// TOKENIZE SAFELY
//------------------------------------------------------

function tokensOf(text) {

    const normalized = normalize(text);

    let tokens = [];

    try {

        tokens = tokenizeHeader(text) || [];

    } catch (error) {

        tokens = [];

    }

    if (!tokens.length) {

        tokens =
            normalized
                .split(" ")
                .filter(Boolean);

    }

    return tokens.map(normalize);

}

//------------------------------------------------------
// EXACT TOKEN MATCH
//------------------------------------------------------

function hasToken(tokens, word) {

    const target = normalize(word);

    return tokens.some(token =>
        token === target
    );

}

//======================================================
// PRODUCT SCORE
//======================================================

function productScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    //--------------------------------------------------
    // Strong product description headers
    //--------------------------------------------------

    if (h === "ITEM NAME")
        return 200;

    if (h === "ITEM DESCRIPTION")
        return 195;

    if (h === "PRODUCT NAME")
        return 190;

    if (h === "PRODUCTNAME")
        return 190;

    if (h === "PRODNAME")
        return 190;

    if (h === "PRODUCT DESCRIPTION")
        return 185;

    if (h === "ITEMS")
        return 180;

    if (h === "ITEM")
        return 175;

    if (h === "DESCRIPTION")
        return 170;

    if (h === "PARTICULARS")
        return 165;

    if (h === "PARTICULAR")
        return 160;

    if (h === "MEDICINE")
        return 155;

    if (h === "DRUG")
        return 150;

    if (h === "NAME")
        return 145;

    if (h === "DISPLAY NAME")
        return 140;

    if (h === "NAME TO DISPLAY")
        return 140;

    //--------------------------------------------------
    // Product code should NOT be preferred
    //--------------------------------------------------

    if (
        h === "PRODUCT NO" ||
        h === "PRODUCT NUMBER" ||
        h === "PRODUCT CODE" ||
        h === "ITEM CODE" ||
        h === "ITEM NO" ||
        h === "ITEM NUMBER" ||
        h === "SKU" ||
        h === "CODE"
    ) {

        return 20;

    }

    //--------------------------------------------------
    // Compound product headers
    //--------------------------------------------------

    if (
        h.includes("ITEM NAME") ||
        h.includes("PRODUCT NAME") ||
        h.includes("PRODUCTNAME") ||
        h.includes("ITEM DESCRIPTION") ||
        h.includes("ITEMS") ||
        h.includes("PRODUCT DESCRIPTION")
    ) {

        return 180;

    }

    //--------------------------------------------------
    // Vocabulary fallback
    //--------------------------------------------------

    const tokens = tokensOf(header);

    if (
        hasToken(tokens, "ITEM") ||
        hasToken(tokens, "PRODUCT") ||
        hasToken(tokens, "DESCRIPTION") ||
        hasToken(tokens, "PARTICULARS")
    ) {

        return 80;

    }

    return 0;

}

//======================================================
// OPENING SCORE
//======================================================

function openingScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "OPENING" ||
        h === "OPENING STOCK" ||
        h === "OPENINGSTOCK" ||
        h === "OPEN STOCK" ||
        h === "OPENING QTY" ||
        h === "OPEN QTY" ||
        h === "OPN"
    )
        return 150;

    if (
        h === "OP STK" ||
        h === "OPNSTK" ||
        h === "OPSTK" ||
        h === "OP STOCK" ||
        h === "OP QTY" ||
        h === "O S" ||
        h === "OP" ||
        h === "OP." ||
        h === "Op.Bal. Qty." ||
        h === "Op Bal Qty" ||
        h === "OP BAL QTY" 
    )
        return 145;

    //--------------------------------------------------
    // Short ERP abbreviation
    //--------------------------------------------------

    if (
        h === "OS"
    )
        return 155;

    if (
        h === "O STOCK" ||
        h === "OSTOCK"
    )
        return 150;

    if (h === "TOTAL STOCK")
        return 60;

    if (h.includes("OPENING"))
        return 120;

    if (h.includes("OP STK"))
        return 110;

    return 0;

}

//======================================================
// PURCHASE SCORE
//======================================================

function purchaseScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "PURCHASE" ||
        h === "PURCHASE QTY" ||
        h === "PURCHASEQUANTITY" ||
        h === "PURCHASES"
    )
        return 150;

    if (
        h === "PUR" ||
        h === "PURQTY" ||
        h === "P QTY" ||
        h === "PUR QTY"
    )
        return 140;

    //--------------------------------------------------
    // Short ERP abbreviation
    //--------------------------------------------------

    if (
        h === "PQTY"
    )
        return 155;

    if (
        h === "P QTY"
    )
        return 150;

    if (
    h === "RECEIPT" ||
    h === "RECIEPT" ||
    h === "RECEIPTS" ||
    h === "RCPT" ||
    h === "RCVD" ||
    h === "RECEIVED" ||
    h === "INWARD" ||
    h === "RECEIVE QUANTITY" ||
    h === "RECEVIED QTY" ||
    h === "REC QTY" ||
    h === "Receipt Qty." ||
    h === "Receipt Qty" ||
    h === "RECEIPT QTY" ||
    h === "PQ" ||
    h === "PURCHASES"
)
    return 130;

    if (h.includes("PURCHASE"))
        return 120;

    return 0;

}

//======================================================
// PURCHASE FREE SCORE
//======================================================

function purchaseFreeScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "PFR" ||
        h === "P FREE" ||
        h === "PFREE" ||
        h === "PSCH" ||
        h === "P SCH" ||
        h === "PURCHASE FREE" ||
        h === "PURCHASES FREE" ||
        h === "PURCHASESFREE" ||
        h === "PURCHASE FREE QTY" ||
        h === "FREESTOCKRECEIVEDONPURCHASE" ||
        h === "PUR FREE" ||
        h === "SP"
    )
        return 150;

    if (
        h.includes("PURCHASE FREE") ||
        h.includes("P FREE")
    )
        return 130;

    return 0;

}

//======================================================
// PURCHASE RETURN SCORE
//======================================================

function purchaseReturnScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "P RET" ||
        h === "P RETURN" ||
        h === "PUR RET" ||
        h === "PURRET" ||
        h === "PUR RETN" ||
        h === "PURCHASE RETURN" ||
        h === "PURCHASE RET" ||
        h === "PRET" ||
        h === "P R QUANTITY" ||
        h === "PR QUANTITY" ||
        h === "PURCHASERETURNQTY" ||
        h === "PR"
    )
        return 150;

    if (
        h.includes("PURCHASE RETURN") ||
        h.includes("PUR RET")
    )
        return 130;

    return 0;

}

//======================================================
// PURCHASE RETURN FREE SCORE
//======================================================

function purchaseReturnFreeScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "SPUR RET"
    )
        return 150;

    return 0;

}

//=   b v561        Zyra`   `12345678o0]=-08532101  `=====================================================
// SALES SCORE
//======================================================

function salesScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "CURRENT MONTH SALES" ||
        h === "MONTH SALES" ||
        h === "SALEQUANTITY" ||
        h === "SALE QUANTITY" ||
        h === "SALEQTY"
    )
        return 200;

    if (
        h === "SALES" ||
        h === "SALE"
    )
        return 180;

    if (
        h === "SALES QTY" ||
        h === "SALE QTY" 
    )
        return 175;

    if (
        h === "S QTY" ||
        h === "SALEQTY"
    )
        return 160;

    //--------------------------------------------------
    // Short ERP abbreviation
    //--------------------------------------------------

    if (
        h === "SQTY"
    )
        return 155;

    if (
    h === "ISSUE" ||
    h === "ISSUED" ||
    h === "OUTWARD" ||
    h === "ISSUE QUANTITY" ||
    h === "ISS QTY" ||
    h === "Issue Qty." ||
    h === "Issue Qty" ||
    h === "ISSUE QTY" ||
    h === "SQ" ||
    h === "SALEQTY"
)
    return 150;

    if (
        h.includes("CURRENT MONTH") &&
        h.includes("SALES")
    )
        return 190;

    if (h.includes("SALES"))
        return 140;

    return 0;

}

//======================================================
// SALES RETURN SCORE
//======================================================

function salesReturnScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
    h === "S RET" ||
    h === "S RETURN" ||
    h === "SAL RET" ||
    h === "SAL RETN" ||
    h === "SRETUN" ||
    h === "SALES RETURN" ||
    h === "SALESRET" ||
    h === "SRET" ||
    h === "SALESRETURNQTY" ||
    h === "SRETUR" ||
    h === "SR" ||
    h === "S CR"
)
    return 150;

    if (
        h.includes("SALES RETURN") ||
        h.includes("SALE RETURN")
    )
        return 140;

    return 0;

}


//======================================================
// FREE SCORE
//======================================================

function salesFreeScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "FREE QTY QTY" ||
        h === "FREESTOCKISSUEDONSALE" ||
        h === "FREE QTY" ||
        h === "FQTY" ||
        h === "SSCH" ||
        h === "S SCH" ||
        h === "SALES FREE" ||
        h === "SALE FREE" ||
        h === "SALESFREE" ||
        h === "S FREE" ||
        h === "SFREE" ||
        h === "SFRE" ||
        h === "FREE" ||
        h === "BONUS" ||
        h === "SCHEME" ||
        h === "SS" ||
        h === "FR1"
    )
        return 140;

    return 0;
}

function freeScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "FREE" ||
        h === "BONUS" ||
        h === "SCHEME" ||
        h === "SS"
    )
        return 140;

    return 0;
}

//======================================================
// REPLACEMENT SCORE
//======================================================

function replacementScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "REPL" ||
        h === "REPLQTY" ||
        h === "REPLACE" ||
        h === "REPLACEMENT" ||
        h === "PCOR" ||
        h === "P COR"
    )
        return 150;

    if (h.includes("REPL QTY"))
        return 130;

    return 0;

}

//======================================================
// SALES REPLACEMENT SCORE
//======================================================

function salesReplacementScore(header) {

const h = normalize(header);

if (!h)
    return 0;

if (
    h === "SALES REPLACEMENTQTY" ||
    h === "SL REPLACEMENT" ||
    h === "SALE REPL" ||
    h === "SL REP" ||
    h === "S REPL"
)
    return 150;

if (h.includes("SALES REPLACEMENT"))
    return 130;

return 0;

}


//======================================================
// CREDIT SCORE
//======================================================

function creditScore(header) {

    const h = normalize(header);

    if (
        h === "CR" ||
        h === "CREDIT" ||
        h === "CRQTY" ||
        h === "CR QTY" ||
        h === "REPLACEOTHERS"
    )
        return 140;

    return 0;

}

//======================================================
// DEBIT SCORE
//======================================================

function debitScore(header) {

    const h = normalize(header);

    if (
        h === "DB" ||
        h === "DR" ||
        h === "DEBIT" ||
        h === "REPLACEOTHERS"
    )
        return 140;

    return 0;

}

//======================================================
// ADJUSTMENT SCORE
//======================================================

function adjustmentScore(header) {

    const h = normalize(header);

    if (
        h === "ADJ" ||
        h === "ADJUST" ||
        h === "STKAD" ||
        h === "STK AD" ||
        h === "STK ADJ" ||
        h === "ADJUSTMENT" ||
        h === "ADJUSTMENTQUATITY" ||
        h === "ADJUSTMENTSQUATITY" ||
        h === "PCOR" ||
        h === "P COR" ||
        h === "OTHERS" ||
        h === "OTHER" ||
        h === "SHORTAGE QTY" ||
        h === "SHORTAGE"
    )
        return 140;

    return 0;

}

//======================================================
// CLOSING SCORE
//======================================================

function closingScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "CLOSING" ||
        h === "CLOSING STOCK" ||
        h === "CLOSING QTY"
    )
        return 180;

    if (
        h === "CL STK" ||
        h === "CLSTK" ||
        h === "CURSTK" ||
        h === "CL STOCK" ||
        h === "CL QTY" ||
        h === "CLSSTK" ||
        h === "CLS STK" ||
        h === "CLS.STK" ||
        h === "CLOS QTY" ||
        h === "CL STOCK AS ON" ||
        h === "TOTALSTOCK" ||
        h === "CLS QTY"
    )
        return 170;

    if (
        h === "BAL" ||
        h === "BALANCE" ||
        h === "BALANCE STOCK"
    )
        return 150;

    //--------------------------------------------------
    // ERP stock column
    //--------------------------------------------------

    if (
        h === "STOCK" ||
        h === "STOCK QTY"
    )
        return 155;

    if (h.includes("CLOSING"))
        return 140;

    return 0;

}

//======================================================
// RATE SCORE
//======================================================

function rateScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "RATE" ||
        h === "MRP" ||
        h === "PTR" ||
        h === "PTS" ||
        h === "PRICE" ||
        h === "PURRATE" ||
        h === "PUR RATE"
    )
        return 150;

    return 0;

}

//======================================================
// TRN IN QTY SCORE
//======================================================

function trnInQtyScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "TRN IN QTY" ||
        h === "TRANSFERINQUANTITY" ||
        h === "TRN IN" ||
        h === "TRNIN" ||
        h === "TRNINQTY" ||
        h === "BR I" ||
        h === "BR IN" ||
        h === "BR" ||
        h === "BRANCH IN" ||
        h === "BRANCH INWARD" ||
        h === "BRANCH INWARD QTY" ||
        h === "BRANCH IN QTY" ||
        h === "INWARD QTY" ||
        h === "INWARD" ||
        h === "IN"
    )
        return 150;

    return 0;

}

//======================================================
// TRN OUT QTY SCORE
//======================================================

function trnOutQtyScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "TRN OUT QTY" ||
        h === "TRANSFEROUTQUANTITY" ||
        h === "TRN OUT" ||
        h === "TRNOUT" ||
        h === "TRNOUTQTY" ||
        h === "BR R" ||
        h === "BT" ||
        h === "BR OUT" ||
        h === "BRANCH OUT" ||
        h === "BRANCH OUTWARD" ||
        h === "BRANCH OUTWARD QTY" ||
        h === "BRANCH OUT QTY" ||
        h === "OUTWARD QTY" ||
        h === "OUTWARD" ||
        h === "OUT" 
    )
        return 150;

    return 0;

}

//======================================================
// OPENING VALUE SCORE
//======================================================

function openingValueScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "OPENING VALUE" ||
        h === "OPENING VAL" ||
        h === "OPEN VALUE" ||
        h === "OP VALUE" ||
        h === "OPVAL"
    )
        return 150;

    if (
        h.includes("OPENING") &&
        h.includes("VALUE")
    )
        return 130;

    return 0;

}


//======================================================
// PURCHASE VALUE SCORE
//======================================================

function purchaseValueScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
    h === "PURCHASE VALUE" ||
    h === "PURCHASEVALUE" ||
    h === "PUR VALUE" ||
    h === "PURCHASE AMOUNT" ||
    h === "PUR AMOUNT" ||
    h === "RECEIVE VALUE" ||
    h === "REC VALUE" ||
    h === "PURCHASEVALUE"
)
    return 150;

    return 0;

}

//======================================================
// SALES VALUE SCORE
//======================================================

function salesValueScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
    h === "SALES VALUE" ||
    h === "SALE VALUE" ||
    h === "SALES AMOUNT" ||
    h === "SALE AMOUNT" ||
    h === "SALEVALUE" ||
    h === "ISSUE VALUE" ||
    h === "ISS VALUE" ||
    h === "SALESVALUE" ||
    h === "SAL VAL"
)
    return 150;

    return 0;

}

//======================================================
// CLOSING VALUE SCORE
//======================================================

function closingValueScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    if (
        h === "CLOSING VALUE" ||
        h === "CLOSING STOCK VALUE" ||
        h === "CLOSING AMOUNT" ||
        h === "STOCK VALUE" ||
        h === "STOCKVALUE" ||
        h === "CLOS VALUE" ||
        h === "STKVAL" ||
        h === "CLS VALUE"
    )
        return 150;

    return 0;

}

//======================================================
// SELECT BEST COLUMN
//======================================================

function selectBest(headers, scorer) {

    let bestIndex = null;

    let bestScore = 0;

    headers.forEach((header, index) => {

        const score =
            scorer(header);

        if (score > bestScore) {

            bestScore = score;

            bestIndex = index;

        }

    });

    return {

        index: bestIndex,

        score: bestScore

    };

}

//======================================================
// MAIN
//======================================================

function mapHeaders(headers) {

    //--------------------------------------------------
    // SAFETY
    //--------------------------------------------------

    if (!Array.isArray(headers)) {

        return {

            success: false,

            message:
                "Headers must be an array.",

            mapping: {},

            headers: []

        };

    }

    //--------------------------------------------------
    // BASE MAPPING
    //--------------------------------------------------

    const mapping = {

    product: null,
    productCode: null,
    productDescription: null,

    pack: null,

    opening: null,
    openingValue: null,

    purchase: null,
    purchaseFree: null,
    purchaseReturn: null,
    purchaseReturnFree: null,

    sales: null,
    salesFree: null,
    salesReturn: null,
    salesReturnFree: null,

    free: null,
    replacement: null,
    salesReplacement: null,

    
    credit: null,
    debit: null,
    adjustment: null,

    closing: null,
    total: null,
    rate: null,

    purchaseValue: null,
    salesValue: null,
    closingValue: null,

    specialFormat: false
};


// ==========================================================
// INFINA - FIRST / AUTHORITATIVE HEADER DETECTION
// ==========================================================

const infinaHeaders = headers.map((h) =>
    String(h ?? "")
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .replace(/\t/g, "")
        .replace(/\s+/g, "")
        .toUpperCase()
);

const infinaSignature = [
    "ITEMNAME",
    "OPENINGBALANCE",
    "SALES",
    "SALESFREE",
    "SALESAMOUNT",
    "SALESRETURN",
    "PURCHASES",
    "PURCHASESFREE",
    "PURCHASEAMOUNT",
    "PURCHASERETURN",
    "ADJUSTMENT",
    "CLOSINGBALANCE",
    "CLOSINGAMOUNT",
    "EXPIRYIN",
    "EXPIRYOUT"
];

const infinaStartIndex = infinaHeaders.indexOf("ITEMNAME");

const isInfinaFormat =
    infinaStartIndex >= 0 &&
    infinaHeaders.length >=
        infinaStartIndex + infinaSignature.length &&
    infinaSignature.every((expected, index) =>
        infinaHeaders[infinaStartIndex + index] === expected
    );

console.log("========== INFINA FIRST CHECK ==========");
console.log("Original headers:", headers);
console.log("Normalized headers:", infinaHeaders);
console.log("INFINA start index:", infinaStartIndex);
console.log("INFINA detected:", isInfinaFormat);

if (isInfinaFormat) {

    console.log("========== INFINA MAPPING APPLIED ==========");

    mapping.product = infinaStartIndex;
    mapping.productDescription = infinaStartIndex;

    mapping.opening = infinaStartIndex + 1;

    mapping.sales = infinaStartIndex + 2;
    mapping.salesFree = infinaStartIndex + 3;
    mapping.salesValue = infinaStartIndex + 4;
    mapping.salesReturn = infinaStartIndex + 5;

    mapping.purchase = infinaStartIndex + 6;
    mapping.purchaseFree = infinaStartIndex + 7;
    mapping.purchaseValue = infinaStartIndex + 8;
    mapping.purchaseReturn = infinaStartIndex + 9;

    mapping.adjustment = infinaStartIndex + 10;

    mapping.closing = infinaStartIndex + 11;
    mapping.closingValue = infinaStartIndex + 12;

    mapping.trnInQty = infinaStartIndex + 13;
    mapping.trnOutQty = infinaStartIndex + 14;

    mapping.specialFormat =
        "INFINA_NEWELL_AGENCIES_PHARMACEUTICALS";

    console.log("INFINA FINAL MAPPING:");
    console.log({
        product: mapping.product,
        opening: mapping.opening,

        sales: mapping.sales,
        salesFree: mapping.salesFree,
        salesValue: mapping.salesValue,
        salesReturn: mapping.salesReturn,

        purchase: mapping.purchase,
        purchaseFree: mapping.purchaseFree,
        purchaseValue: mapping.purchaseValue,
        purchaseReturn: mapping.purchaseReturn,

        adjustment: mapping.adjustment,

        closing: mapping.closing,
        closingValue: mapping.closingValue,

        trnInQty: mapping.trnInQty,
        trnOutQty: mapping.trnOutQty,

        specialFormat: mapping.specialFormat
    });

    // IMPORTANT:
    // Stop generic mapping from overriding INFINA.
    return {
        success: true,
        mapping,
        headers
    };
}

    //--------------------------------------------------
    // HEADER ANALYSIS
    //--------------------------------------------------

    const analyzed = [];

    headers.forEach((header, index) => {

        analyzed.push({

            index,

            original:
                String(header || ""),

            normalized:
                normalize(header),

            tokens:
                tokensOf(header)

        });

    });

    //--------------------------------------------------
    // NORMAL PRODUCT MAPPING
    //--------------------------------------------------

    mapping.product =
        selectBest(
            headers,
            productScore
        ).index;

    //--------------------------------------------------
    // PRODUCT DESCRIPTION
    //--------------------------------------------------

    if (
        mapping.product !== null &&
        mapping.product !== undefined
    ) {

        mapping.productDescription =
            mapping.product;

    }

    //--------------------------------------------------
    // MARG ERP DESCRIPTION FALLBACK
    //--------------------------------------------------

    if (
        mapping.product === null ||
        mapping.product === undefined
    ) {

        for (
            let i = 0;
            i < headers.length;
            i++
        ) {

            const compactHeader =
                compact(headers[i]);

            if (
                compactHeader ===
                "DESCRIPTION"
            ) {

                mapping.product = i;

                mapping.productDescription = i;

                mapping.specialFormat =
                    "MARG_DESCRIPTION_FORMAT";

                console.log("");

                console.log(
                    "===== MARG ERP DESCRIPTION FORMAT DETECTED ====="
                );

                console.log(
                    "Product Column :",
                    i
                );

                console.log(
                    "Product Header :",
                    headers[i]
                );

                console.log(
                    "================================================="
                );

                break;

            }

        }

    }

    //--------------------------------------------------
    // NORMAL COLUMN MAPPING
    //--------------------------------------------------

    mapping.opening =
        selectBest(
            headers,
            openingScore
        ).index;

    mapping.openingValue =
        selectBest(
            headers,
            openingValueScore
        ).index;

    mapping.purchase =
        selectBest(
            headers,
            purchaseScore
        ).index;

    mapping.purchaseFree =
        selectBest(
            headers,
            purchaseFreeScore
        ).index;

    mapping.purchaseReturn =
        selectBest(
            headers,
            purchaseReturnScore
        ).index;

    mapping.purchaseReturnFree =
        selectBest(
            headers,
            purchaseReturnFreeScore
        ).index;

    mapping.sales =
        selectBest(
            headers,
            salesScore
        ).index;

    const salesColumns = headers
    .map((header, index) => ({
        index,
        score: salesScore(header)
    }))
    .filter(item => item.score > 0)
    .map(item => item.index);

if (salesColumns.length > 1) {
    mapping.salesColumns = salesColumns;
}

const salesTradeIndex = headers.findIndex(
    header => normalize(header) === "SALE TRADE"
);

const salesApolloIndex = headers.findIndex(
    header => normalize(header) === "SALE APOLLO"
);

const trfOutIndex = headers.findIndex(
    header => normalize(header) === "TRF OUT"
);

if (
    salesTradeIndex >= 0 &&
    salesApolloIndex >= 0 &&
    trfOutIndex >= 0
) {
    mapping.salesColumns = [
        salesTradeIndex,
        salesApolloIndex,
        trfOutIndex
    ];
}

    mapping.salesFree =
    selectBest(
        headers,
        salesFreeScore
    ).index;

    mapping.salesReturn =
    selectBest(
        headers,
        salesReturnScore
    ).index;

//--------------------------------------------------
// RETRN QTY OCCURRENCE FORMAT
// First Retrn Qty  = Purchase Return
// Second Retrn Qty = Sales Return
//--------------------------------------------------

const retrnQtyIndexes = headers
    .map((header, index) => ({
        header: normalize(header),
        index
    }))
    .filter(item =>
        item.header === "RETRN QTY"
    )
    .map(item => item.index);

if (retrnQtyIndexes.length >= 2) {

    mapping.purchaseReturn =
        retrnQtyIndexes[0];

    mapping.salesReturn =
        retrnQtyIndexes[1];

}

        mapping.free =
        selectBest(
            headers,
            freeScore
        ).index;


//==================================================
// REPEATED FREE HEADER RULE
//==================================================
// Applies ONLY when FREE appears exactly 4 times.
//
// 1st FREE = Purchase Free
// 2nd FREE = Purchase Return Free
// 3rd FREE = Sales Free
// 4th FREE = Sales Return Free
//
// Existing formats with fewer/more FREE columns
// are NOT changed.
//==================================================

const freeIndexes = headers
    .map((header, index) => ({
        header: compact(header),
        index
    }))
    .filter(item =>
        item.header === "FREE"
    )
    .map(item =>
        item.index
    );

if (freeIndexes.length === 4) {

    mapping.purchaseFree =
        freeIndexes[0];

    mapping.purchaseReturnFree =
        freeIndexes[1];

    mapping.salesFree =
        freeIndexes[2];

    mapping.salesReturnFree =
        freeIndexes[3];

    console.log("");
    console.log(
        "===== REPEATED FREE HEADER RULE ====="
    );
    console.log(
        "1st FREE -> Purchase Free       :",
        mapping.purchaseFree
    );
    console.log(
        "2nd FREE -> Purchase Return Free:",
        mapping.purchaseReturnFree
    );
    console.log(
        "3rd FREE -> Sales Free           :",
        mapping.salesFree
    );
    console.log(
        "4th FREE -> Sales Return Free    :",
        mapping.salesReturnFree
    );
    console.log(
        "======================================"
    );
}


    mapping.replacement =
    selectBest(
        headers,
        replacementScore
    ).index;

    mapping.salesReplacement =
    selectBest(
        headers,
        salesReplacementScore
    ).index;

    mapping.trnInQty =
    selectBest(
        headers,
        trnInQtyScore
    ).index;

    mapping.trnOutQty =
    selectBest(
        headers,
        trnOutQtyScore
    ).index;

//--------------------------------------------------
// IMPERIA SRI LAKSHMI SRINIVASA MEDICALS FORMAT
//--------------------------------------------------
// Both OTHERS columns contribute to ONE adjustment.
// Source values are taken exactly as provided.
// No sign is assumed or changed.
//--------------------------------------------------

const sriLakshmiHeaders =
    headers.map(header => compact(header));

const sriLakshmiSignature = [
    "ITEMDIVISION00",
    "PACK",
    "OPENING",
    "PURCHASE",
    "SRETURN",
    "OTHERS",
    "SUBTOTAL",
    "SALE",
    "PRETURN",
    "OTHERS",
    "CLOSING",
    "ITEMCODE",
    "BRANCHTOTAL",
    "TOTAL",
    "DIVISION"
];

const isSriLakshmiFormat =
    sriLakshmiHeaders.length >=
        sriLakshmiSignature.length &&
    sriLakshmiSignature.every(
        (expected, index) =>
            sriLakshmiHeaders[index] === expected
    );

if (isSriLakshmiFormat) {

    const sriLakshmiOthersIndexes =
        sriLakshmiHeaders
            .map((header, index) => ({
                header,
                index
            }))
            .filter(item =>
                item.header === "OTHERS"
            )
            .map(item => item.index);

    mapping.product = 0;
    mapping.productDescription = 0;
    mapping.pack = 1;
    mapping.opening = 2;
    mapping.purchase = 3;
    mapping.salesReturn = 4;

    mapping.adjustmentColumns =
        sriLakshmiOthersIndexes;

    mapping.sales = 7;
    mapping.purchaseReturn = 8;
    mapping.closing = 10;
    mapping.productCode = 11;
    

    mapping.specialFormat =
        "IMPERIA_SRI_LAKSHMI_SRINIVASA_OTHERS";

}




       console.log("");
console.log("===== CREDIT MAPPER DEBUG =====");

headers.forEach((header, index) => {
    const normalized = normalize(header);

    if (
        normalized === "CR" ||
        normalized === "CREDIT"
    ) {
        console.log(
            "CREDIT HEADER FOUND -> index:",
            index,
            "| header:",
            header,
            "| normalized:",
            normalized
        );
    }
});


const creditResult =
    selectBest(
        headers,
        creditScore
    );

console.log(
    "Selected Credit Column:",
    creditResult.index
);

console.log(
    "Selected Credit Score:",
    creditResult.score
);

console.log("================================");

mapping.credit =
    creditResult.index;

    

    mapping.debit =
        selectBest(
            headers,
            debitScore
        ).index;

    mapping.adjustment =
        selectBest(
            headers,
            adjustmentScore
        ).index;

    mapping.closing =
        selectBest(
            headers,
            closingScore
        ).index;

    mapping.rate =
        selectBest(
            headers,
            rateScore
        ).index;

    mapping.purchaseValue =
        selectBest(
            headers,
            purchaseValueScore
        ).index;

    mapping.salesValue =
        selectBest(
            headers,
            salesValueScore
        ).index;

    mapping.closingValue =
        selectBest(
            headers,
            closingValueScore
        ).index;

//==================================================
// VASU AGENCIES DRUGS STRUCTURED XLS FORMAT
//==================================================
//
// Expected physical column sequence:
//
// ITEM
// PACK
// OPENING
// PURCHASE
// FREE
// P.RETURN
// FREE
// SALE
// FREE
// S.RETURN
// FREE
// OTHERS
// CLOSING
// ITEMCODE
// BRANCH
// TOTAL
//
// IMPORTANT:
// This format contains multiple FREE columns.
// Therefore it MUST be mapped by physical position.
// Do NOT use generic FREE scoring for this format.
//
//==================================================

const vasuHeaders =
    headers.map(header =>
        compact(header)
    );

console.log("");
console.log("===== VASU HEADER TEST =====");

vasuHeaders.forEach(
    (header, index) => {

        console.log(
            index,
            ":",
            header
        );

    }
);

console.log(
    "================================"
);


//--------------------------------------------------
// STRICT VASU SIGNATURE
//--------------------------------------------------

const vasuSignature = [
    "ITEM",
    "PACK",
    "OPENING",
    "PURCHASE",
    "FREE",
    "PRETURN",
    "FREE",
    "SALE",
    "FREE",
    "SRETURN",
    "FREE",
    "OTHERS",
    "CLOSING",
    "ITEMCODE",
    "BRANCHTOTAL"
];


const isVasuFormat =
    vasuHeaders.length >=
        vasuSignature.length &&
    vasuSignature.every(
        (expected, index) =>
            vasuHeaders[index] === expected
    );


//--------------------------------------------------
// STRICT POSITIONAL MAPPING
//--------------------------------------------------

if (isVasuFormat) {

    mapping.product = 0;
    mapping.productDescription = 0;

    mapping.pack = 1;

    mapping.opening = 2;

    mapping.purchase = 3;
    mapping.purchaseFree = 4;

    mapping.purchaseReturn = 5;
    mapping.purchaseReturnFree = 6;

    mapping.sales = 7;
    mapping.salesFree = 8;

    mapping.salesReturn = 9;
    mapping.salesReturnFree = 10;

    mapping.adjustment = 11;

    mapping.closing = 12;

    mapping.productCode = 13;


    mapping.total = 15;

    mapping.specialFormat =
        "VASU_AGENCIES_DRUGS_STRUCTURED_XLS";


    console.log("");

    console.log(
        "===== VASU AGENCIES DRUGS XLS FORMAT DETECTED ====="
    );

    console.log(
        "Product Column          :",
        mapping.product
    );

    console.log(
        "Pack Column             :",
        mapping.pack
    );

    console.log(
        "Opening Column          :",
        mapping.opening
    );

    console.log(
        "Purchase Column         :",
        mapping.purchase
    );

    console.log(
        "Purchase Free Column    :",
        mapping.purchaseFree
    );

    console.log(
        "Purchase Return Column  :",
        mapping.purchaseReturn
    );

    console.log(
        "Purchase Return Free    :",
        mapping.purchaseReturnFree
    );

    console.log(
        "Sales Column            :",
        mapping.sales
    );

    console.log(
        "Sales Free Column       :",
        mapping.salesFree
    );

    console.log(
        "Sales Return Column     :",
        mapping.salesReturn
    );

    console.log(
        "Sales Return Free       :",
        mapping.salesReturnFree
    );

    console.log(
        "Adjustment Column       :",
        mapping.adjustment
    );

    console.log(
        "Closing Column          :",
        mapping.closing
    );

    console.log(
        "Product Code Column     :",
        mapping.productCode
    );


    console.log(
        "Total Column            :",
        mapping.total
    );

    console.log(
        "Format                  :",
        mapping.specialFormat
    );

    console.log(
        "=================================================="
    );
}

//==================================================
// STRICT FREE COLUMN STRUCTURE
//==================================================
//
// Expected sequence:
//
// ITEM
// PACK
// OPENING
// PURCHASE
// FREE
// P.RETURN
// FREE
// SALE
// FREE
// S.RETURN
// FREE
// OTHERS
// CLOSING
// ITEMCODE
// BRANCH TOTAL
//
// FREE columns are mapped strictly by their
// physical position in this exact structure.
//
//==================================================

const freeStructureHeaders =
    headers.map(header =>
        compact(header)
    );

const freeStructureSignature = [
    "ITEM",
    "PACK",
    "OPENING",
    "PURCHASE",
    "FREE",
    "PRETURN",
    "FREE",
    "SALE",
    "FREE",
    "SRETURN",
    "FREE",
    "OTHERS",
    "CLOSING",
    "ITEMCODE",
    "BRANCHTOTAL"
];

const isFreeStructureFormat =
    freeStructureHeaders.length >=
        freeStructureSignature.length &&
    freeStructureSignature.every(
        (expected, index) =>
            freeStructureHeaders[index] === expected
    );

if (isFreeStructureFormat) {

    mapping.product = 0;
    mapping.productDescription = 0;

    mapping.pack = 1;
    mapping.opening = 2;

    mapping.purchase = 3;
    mapping.purchaseFree = 4;

    mapping.purchaseReturn = 5;
    mapping.purchaseReturnFree = 6;

    mapping.sales = 7;
    mapping.salesFree = 8;

    mapping.salesReturn = 9;
    mapping.salesReturnFree = 10;

    mapping.adjustment = 11;
    mapping.closing = 12;

    mapping.productCode = 13;

    // Do not use the generic FREE field
    mapping.free = null;

    mapping.specialFormat =
        "STRICT_FREE_TRANSACTION_STRUCTURE";

    console.log("");
    console.log(
        "===== STRICT FREE TRANSACTION FORMAT DETECTED ====="
    );

    console.log(
        "Purchase Free Column       :",
        mapping.purchaseFree
    );

    console.log(
        "Purchase Return Free       :",
        mapping.purchaseReturnFree
    );

    console.log(
        "Sales Free Column          :",
        mapping.salesFree
    );

    console.log(
        "Sales Return Free Column   :",
        mapping.salesReturnFree
    );

    console.log(
        "=================================================="
    );
}

//==================================================
// REPEATED OTHERS HEADER RULE KAYAL
// 1st OTHERS = CREDIT
// 2nd OTHERS = DEBIT
//==================================================

const othersIndexes = headers
    .map((header, index) => ({
        header: compact(header),
        index
    }))
    .filter(item => item.header === "OTHERS")
    .map(item => item.index);

if (othersIndexes.length === 2) {

    mapping.credit = othersIndexes[0];
    mapping.debit = othersIndexes[1];

    // OTHERS is being used as Credit/Debit,
    // so do not also map it as Adjustment.
    mapping.adjustment = null;

    console.log("");
    console.log("===== REPEATED OTHERS RULE =====");
    console.log(
        "1st OTHERS -> Credit :",
        mapping.credit
    );
    console.log(
        "2nd OTHERS -> Debit  :",
        mapping.debit
    );
    console.log(
        "Adjustment           :",
        mapping.adjustment
    );
    console.log("================================");
}

//==================================================
// RAVINDRA PHARMA DISTRIBUTORS
// STRICT REPLACE+ OTHERS CREDIT / DEBIT FORMAT
//==================================================

const ravindraHeaders =
    headers.map(header =>
        compact(header)
    );

const ravindraSignature = [
    "PRODUCTDESCRIPTION",
    "OPENINGSTOCK",
    "PURCHASEQUANTITY",
    "SALERETURNQUANTITY",
    "REPLACE+OTHERS",
    "TOTALRECEIVE",
    "SALEQUANTITY",
    "PRQUANTITY",
    "REPLACE+OTHERS",
    "CLOSINGSTOCK",
    "RATE",
    "LASTMONTHSALE",
    "EXPIRYSTOCK"
];

const isRavindraFormat =
    ravindraHeaders.length >=
        ravindraSignature.length &&
    ravindraSignature.every(
        (expected, index) =>
            ravindraHeaders[index] === expected
    );

if (isRavindraFormat) {

    mapping.product = 0;
    mapping.productDescription = 0;

    mapping.opening = 1;

    mapping.purchase = 2;

    mapping.salesReturn = 3;

    // FIRST "REPLACE+ OTHERS"
    // = CREDIT
    mapping.credit = 4;

    mapping.total = 5;

    mapping.sales = 6;

    mapping.purchaseReturn = 7;

    // SECOND "REPLACE+ OTHERS"
    // = DEBIT
    mapping.debit = 8;

    mapping.closing = 9;

    mapping.rate = 10;

    mapping.specialFormat =
        "RAVINDRA_REPLACE_OTHERS_CREDIT_DEBIT";

    console.log("");
    console.log(
        "===== RAVINDRA SPECIAL FORMAT ====="
    );

    console.log(
        "Credit Column :",
        mapping.credit
    );

    console.log(
        "Debit Column  :",
        mapping.debit
    );

    console.log(
        "Special Format:",
        mapping.specialFormat
    );

    console.log(
        "===================================="
    );
}

//==================================================
// DERMANEX SHIVA REMEDIES XLS FORMAT
    //
    // IMPORTANT:
    // This format is mapped STRICTLY by physical
    // column position because CL. STOCK and CL. VALUE
    // occur twice.
    //
    // Expected sequence:
    //
    // SNO.
    // ITEM NAME
    // CL. STOCK
    // CL. VALUE
    // PURCHASE
    // P. FREE QTY
    // PUR VALUE
    // TOTAL STK
    // SALE
    // SALE VALUE
    // SALE FREE
    // CL. STOCK
    // CL. VALUE
    //
    //==================================================

    const shivaHeaders =
        headers.map(header =>
            compact(header)
        );
        console.log("");
console.log("===== SHIVA HEADER TEST =====");

shivaHeaders.forEach(
    (header, index) => {
        console.log(
            index,
            ":",
            header
        );
    }
);

console.log(
    "================================"
);

    const shivaSignature = [
    "SNO",
    "COMPANY",
    "ITEMNAME",
    "CLSTOCK",
    "CLVALUE",
    "PURCHASE",
    "PFREEQTY",
    "PURVALUE",
    "TOTALSTK",
    "SALE",
    "SALEVALUE",
    "SALEFREE",
    "CLSTOCK",
    "CLVALUE"
];

    const isShivaFormat =
        shivaHeaders.length >=
            shivaSignature.length &&
        shivaSignature.every(
            (expected, index) =>
                shivaHeaders[index] === expected
        );

    if (isShivaFormat) {

        mapping.product = 2;
        mapping.productDescription = 2;

        mapping.opening = 3;
        mapping.openingValue = 4;

        mapping.purchase = 5;
        mapping.purchaseFree = 6;
        mapping.purchaseValue = 7;

        mapping.sales = 9;
        mapping.salesValue = 10;
        mapping.free = 11;

        mapping.closing = 12;
        mapping.closingValue = 13;  

        mapping.specialFormat =
            "DERMANEX_SHIVA_REMEDIES_XLS";

        console.log("");

        console.log(
            "===== DERMANEX SHIVA XLS FORMAT DETECTED ====="
        );

        console.log(
            "Product Column       :",
            mapping.product
        );

        console.log(
            "Opening Column       :",
            mapping.opening
        );

        console.log(
            "Opening Value Col.  :",
            mapping.openingValue
        );

        console.log(
            "Purchase Column      :",
            mapping.purchase
        );

        console.log(
            "Purchase Free Col.   :",
            mapping.purchaseFree
        );

        console.log(
            "Purchase Value Col.  :",
            mapping.purchaseValue
        );

        console.log(
            "Sales Column         :",
            mapping.sales
        );

        console.log(
            "Sales Value Col.     :",
            mapping.salesValue
        );

        console.log(
            "Sales Free Col.      :",
            mapping.free
        );

        console.log(
            "Closing Column       :",
            mapping.closing
        );

        console.log(
            "Closing Value Col.   :",
            mapping.closingValue
        );

        console.log(
            "==============================================="
        );
    }

//==================================================
// DERMANEX EXCEL STOCK FORMAT
//==================================================
//
// Product Name
// Packing
// OP
// OPVal
// PI
// PIVal
// ST (In)
// ST Value
// In
// Out
// May
// Jun
// Sale
// SI Value
// ST (Out)
// ST Value
// Stock Adj.
// Stock Adj. Value
// CLQty
// CLValue
//
// Only the established Common fields are mapped.
// Other source columns remain available through
// Raw Source Values / Header Mapping.
//==================================================

const dermAnexHeaders =
    headers.map(header => compact(header));

const daProductIndex =
    dermAnexHeaders.indexOf("PRODUCTNAME");

const daPackingIndex =
    dermAnexHeaders.indexOf("PACKING");

const daOpeningIndex =
    dermAnexHeaders.indexOf("OP");

const daOpeningValueIndex =
    dermAnexHeaders.indexOf("OPVAL");

const daPurchaseIndex =
    dermAnexHeaders.indexOf("PI");

const daPurchaseValueIndex =
    dermAnexHeaders.indexOf("PIVAL");

const daSalesIndex =
    dermAnexHeaders.indexOf("SALE");

const daSalesValueIndex =
    dermAnexHeaders.indexOf("SIVALUE");

const daClosingIndex =
    dermAnexHeaders.indexOf("CLQTY");

const daClosingValueIndex =
    dermAnexHeaders.indexOf("CLVALUE");

const daPTSIndex =
    dermAnexHeaders.indexOf("PTS");

//--------------------------------------------------
// Detect DERMANEX
//--------------------------------------------------

if (
    daProductIndex >= 0 &&
    daOpeningIndex >= 0 &&
    daPurchaseIndex >= 0 &&
    daSalesIndex >= 0 &&
    daClosingIndex >= 0 &&
    (
        daOpeningValueIndex >= 0 ||
        daPurchaseValueIndex >= 0 ||
        daSalesValueIndex >= 0 ||
        daClosingValueIndex >= 0
    )
) {

    mapping.product =
        daProductIndex;

    mapping.productDescription =
        daProductIndex;

    if (daPackingIndex >= 0) {
        mapping.pack =
            daPackingIndex;
    }

    if (daOpeningIndex >= 0) {
        mapping.opening =
            daOpeningIndex;
    }

    if (daOpeningValueIndex >= 0) {
        mapping.openingValue =
            daOpeningValueIndex;
    }

    if (daPurchaseIndex >= 0) {
        mapping.purchase =
            daPurchaseIndex;
    }

    if (daPurchaseValueIndex >= 0) {
        mapping.purchaseValue =
            daPurchaseValueIndex;
    }

    if (daSalesIndex >= 0) {
        mapping.sales =
            daSalesIndex;
    }

    if (daSalesValueIndex >= 0) {
        mapping.salesValue =
            daSalesValueIndex;
    }

    if (daClosingIndex >= 0) {
        mapping.closing =
            daClosingIndex;
    }

    if (daClosingValueIndex >= 0) {
        mapping.closingValue =
            daClosingValueIndex;
    }

    if (daPTSIndex >= 0) {
        mapping.rate =
            daPTSIndex;
    }

    mapping.specialFormat =
        "DERMANEX_STOCK_SALES";

    console.log("");

    console.log(
        "===== DERMANEX EXCEL STOCK FORMAT DETECTED ====="
    );

    console.log(
        "Product Column       :",
        mapping.product
    );

    console.log(
        "Packing Column       :",
        mapping.pack
    );

    console.log(
        "Opening Column       :",
        mapping.opening
    );

    console.log(
        "Opening Value Col.   :",
        mapping.openingValue
    );

    console.log(
        "Purchase Column      :",
        mapping.purchase
    );

    console.log(
        "Purchase Value Col.  :",
        mapping.purchaseValue
    );

    console.log(
        "Sales Column         :",
        mapping.sales
    );

    console.log(
        "Sales Value Col.     :",
        mapping.salesValue
    );

    console.log(
        "Closing Column       :",
        mapping.closing
    );

    console.log(
        "Closing Value Col.   :",
        mapping.closingValue
    );

    console.log(
        "PTS Column           :",
        mapping.rate
    );

    console.log(
        "Format               :",
        mapping.specialFormat
    );

    console.log(
        "================================================="
    );
}

    //==================================================
    // DERMASCIENCE PRODUCTNAME FORMAT
    //==================================================
    //
    // ProductName
    // OS
    // PQty
    // PFr
    // SQty
    // SFre
    // SRet
    // Stock
    // PurRate
    // StockValue
    // SaleValue
    // PCor
    // PRet
    //
    // Existing formats are NOT modified.
    //==================================================

    const dermScienceHeaders =
        headers.map(header =>
            compact(header)
        );

    const dsProductIndex =
        dermScienceHeaders.indexOf(
            "PRODUCTNAME"
        );

    const dsOpeningIndex =
        dermScienceHeaders.indexOf(
            "OS"
        );

    const dsPurchaseIndex =
        dermScienceHeaders.indexOf(
            "PQTY"
        );

    const dsPurchaseFreeIndex =
        dermScienceHeaders.indexOf(
            "PFR"
        );

    const dsSalesIndex =
        dermScienceHeaders.indexOf(
            "SQTY"
        );

    const dsSalesFreeIndex =
        dermScienceHeaders.indexOf(
            "SFRE"
        );

    const dsSalesReturnIndex =
        dermScienceHeaders.indexOf(
            "SRET"
        );

    const dsClosingIndex =
        dermScienceHeaders.indexOf(
            "STOCK"
        );

    const dsRateIndex =
        dermScienceHeaders.indexOf(
            "PURRATE"
        );

    const dsClosingValueIndex =
        dermScienceHeaders.indexOf(
            "STOCKVALUE"
        );

    const dsSalesValueIndex =
        dermScienceHeaders.indexOf(
            "SALEVALUE"
        );

    const dsReplacementIndex =
        dermScienceHeaders.indexOf(
            "PCOR"
        );

    const dsPurchaseReturnIndex =
        dermScienceHeaders.indexOf(
            "PRET"
        );

    //--------------------------------------------------
    // Detect DERMASCIENCE
    //--------------------------------------------------

    if (
        dsProductIndex >= 0 &&
        (
            dsOpeningIndex >= 0 ||
            dsPurchaseIndex >= 0 ||
            dsSalesIndex >= 0 ||
            dsClosingIndex >= 0
        )
    ) {

        mapping.product =
            dsProductIndex;

        mapping.productDescription =
            dsProductIndex;

        if (
            dsOpeningIndex >= 0
        ) {

            mapping.opening =
                dsOpeningIndex;

        }

        if (
            dsPurchaseIndex >= 0
        ) {

            mapping.purchase =
                dsPurchaseIndex;

        }

        if (
            dsPurchaseFreeIndex >= 0
        ) {

            mapping.purchaseFree =
                dsPurchaseFreeIndex;

        }

        if (
            dsPurchaseReturnIndex >= 0
        ) {

            mapping.purchaseReturn =
                dsPurchaseReturnIndex;

        }

        if (
            dsSalesIndex >= 0
        ) {

            mapping.sales =
                dsSalesIndex;

        }

        if (
            dsSalesFreeIndex >= 0
        ) {

            mapping.free =
                dsSalesFreeIndex;

        }

        if (
            dsSalesReturnIndex >= 0
        ) {

            mapping.salesReturn =
                dsSalesReturnIndex;

        }

        if (
            dsClosingIndex >= 0
        ) {

            mapping.closing =
                dsClosingIndex;

        }

        if (
            dsRateIndex >= 0
        ) {

            mapping.rate =
                dsRateIndex;

        }

        if (
            dsReplacementIndex >= 0
        ) {

            mapping.replacement =
                dsReplacementIndex;

        }

        if (
            dsClosingValueIndex >= 0
        ) {

            mapping.closingValue =
                dsClosingValueIndex;

        }

        if (
            dsSalesValueIndex >= 0
        ) {

            mapping.salesValue =
                dsSalesValueIndex;

        }

        mapping.specialFormat =
            "DERMASCIENCE_PRODUCTNAME_STOCK_FORMAT";

        console.log("");

        console.log(
            "===== DERMASCIENCE PRODUCTNAME FORMAT DETECTED ====="
        );

        console.log(
            "Product Column       :",
            mapping.product
        );

        console.log(
            "Opening Column       :",
            mapping.opening
        );

        console.log(
            "Purchase Column      :",
            mapping.purchase
        );

        console.log(
            "Purchase Free Col.   :",
            mapping.purchaseFree
        );

        console.log(
            "Purchase Return Col. :",
            mapping.purchaseReturn
        );

        console.log(
            "Sales Column         :",
            mapping.sales
        );

        console.log(
            "Sales Free Column    :",
            mapping.free
        );

        console.log(
            "Sales Return Column  :",
            mapping.salesReturn
        );

        console.log(
            "Closing Column       :",
            mapping.closing
        );

        console.log(
            "Rate Column          :",
            mapping.rate
        );

        console.log(
            "Replacement Column   :",
            mapping.replacement
        );

        console.log(
            "Closing Value Col.   :",
            mapping.closingValue
        );

        console.log(
            "Sales Value Col.     :",
            mapping.salesValue
        );

        console.log(
            "Format               :",
            mapping.specialFormat
        );

        console.log(
            "====================================================="
        );

    }

    //==================================================
    // CODE + ITEM DESCRIPTION + QTY FORMAT
    //==================================================

    const normalizedHeaders =
        headers.map(header =>
            String(header || "")
                .toUpperCase()
                .replace(/\r?\n/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        );

    const codeIndex =
        normalizedHeaders.indexOf(
            "CODE"
        );

    const itemDescriptionIndex =
        normalizedHeaders.indexOf(
            "ITEM DESCRIPTION"
        );

    const qtyIndexes = [];

    normalizedHeaders.forEach(
        (header, index) => {

            if (
                header === "QTY" ||
                header === "QTY." ||
                header === "QUANTITY"
            ) {

                qtyIndexes.push(index);

            }

        }
    );

    if (
        codeIndex >= 0 &&
        itemDescriptionIndex >= 0 &&
        qtyIndexes.length >= 2
    ) {

        mapping.product =
            itemDescriptionIndex;

        mapping.productDescription =
            itemDescriptionIndex;

        mapping.productCode =
            codeIndex;

        mapping.sales =
            qtyIndexes[0];

        mapping.closing =
            qtyIndexes[1];

        mapping.specialFormat =
            "CODE_ITEM_DESCRIPTION_SALES_CLOSING";

    }

    //==================================================
    // NAMETODISPLAY STOCK FORMAT
    //==================================================

    const nameToDisplayIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "NAMETODISPLAY"
        );

    const opStockIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "OPSTOCK"
        );

    const inStockIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "IN STOCK"
        );

    const outStockIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "OUT STOCK"
        );

    const closingStockIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "CL STOCK AS ON"
        );

    if (
        nameToDisplayIndex >= 0 &&
        (
            opStockIndex >= 0 ||
            inStockIndex >= 0 ||
            outStockIndex >= 0 ||
            closingStockIndex >= 0
        )
    ) {

        mapping.product =
            nameToDisplayIndex;

        mapping.productDescription =
            nameToDisplayIndex;

        if (
            opStockIndex >= 0
        ) {

            mapping.opening =
                opStockIndex;

        }

        if (
            inStockIndex >= 0
        ) {

            mapping.purchase =
                inStockIndex;

        }

        if (
            outStockIndex >= 0
        ) {

            mapping.sales =
                outStockIndex;

        }

        if (
            closingStockIndex >= 0
        ) {

            mapping.closing =
                closingStockIndex;

        }

        mapping.specialFormat =
            "NAMETODISPLAY_STOCK_FORMAT";

        console.log("");

        console.log(
            "===== NAMETODISPLAY FORMAT DETECTED ====="
        );

        console.log(
            "Product Column    :",
            mapping.product
        );

        console.log(
            "Opening Column    :",
            mapping.opening
        );

        console.log(
            "Purchase Column   :",
            mapping.purchase
        );

        console.log(
            "Sales Column      :",
            mapping.sales
        );

        console.log(
            "Closing Column    :",
            mapping.closing
        );

        console.log(
            "=========================================="
        );

    }

    //==================================================
    // NAMETODISPLAY UNIT1 FORMAT
    //==================================================

    const nameToDisplayUnit1Index =
        headers.findIndex(header =>
            normalize(header) ===
            "NAMETODISPLAY"
        );

    const opStockUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "OPSTOCK UNIT1"
                )
        );

    const purchaseQtyUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "PURCHASEQTY UNIT1"
                )
        );

    const salesQtyUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "SALESQTY UNIT1"
                )
        );

    const salesReturnQtyUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "SALESRETURNQTY UNIT1"
                )
        );

    const purchaseReturnQtyUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "PURCHASERETURNQTY UNIT1"
                )
        );

    const closingStockUnit1Index =
        headers.findIndex(header =>
            normalize(header)
                .startsWith(
                    "CL STOCK AS ON UNIT1"
                )
        );

    if (
        nameToDisplayUnit1Index >= 0 &&
        (
            opStockUnit1Index >= 0 ||
            purchaseQtyUnit1Index >= 0 ||
            salesQtyUnit1Index >= 0 ||
            closingStockUnit1Index >= 0
        )
    ) {

        mapping.product =
            nameToDisplayUnit1Index;

        mapping.productDescription =
            nameToDisplayUnit1Index;

        if (
            opStockUnit1Index >= 0
        ) {

            mapping.opening =
                opStockUnit1Index;

        }

        if (
            purchaseQtyUnit1Index >= 0
        ) {

            mapping.purchase =
                purchaseQtyUnit1Index;

        }

        if (
            salesReturnQtyUnit1Index >= 0
        ) {

            mapping.salesReturn =
                salesReturnQtyUnit1Index;

        }

        if (
            salesQtyUnit1Index >= 0
        ) {

            mapping.sales =
                salesQtyUnit1Index;

        }

        if (
            purchaseReturnQtyUnit1Index >= 0
        ) {

            mapping.purchaseReturn =
                purchaseReturnQtyUnit1Index;

        }

        if (
            closingStockUnit1Index >= 0
        ) {

            mapping.closing =
                closingStockUnit1Index;

        }

        mapping.specialFormat =
            "NAMETODISPLAY_UNIT1_STOCK_FORMAT";

        console.log("");

        console.log(
            "===== NAMETODISPLAY UNIT1 FORMAT DETECTED ====="
        );

        console.log(
            "Product Column        :",
            mapping.product
        );

        console.log(
            "Opening Column        :",
            mapping.opening
        );

        console.log(
            "Purchase Column       :",
            mapping.purchase
        );

        console.log(
            "Sales Return Column   :",
            mapping.salesReturn
        );

        console.log(
            "Sales Column          :",
            mapping.sales
        );

        console.log(
            "Purchase Return Col.  :",
            mapping.purchaseReturn
        );

        console.log(
            "Closing Column        :",
            mapping.closing
        );

        console.log(
            "==============================================="
        );

    }

    //==================================================
    // PRODUCT CODE + PRODUCT DESC + QTY FORMAT
    //==================================================

    const productCodeIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PRODUCT CODE"
        );

    const productDescIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PRODUCT DESC"
        );

    const openingQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "OPENING QTY"
        );

    const purchaseQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PURCHASE QTY"
        );

    const purchaseFreeQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PURCHASE FREE QTY"
        );

    const purchaseReturnQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PURCHASE RET QTY"
        );

    const saleQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "SALE QTY"
        );

    const saleFreeQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "SALE FREE QTY"
        );

    const saleReturnQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "SALE RET QTY"
        );

    const closingQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "CLOSING QTY"
        );

    const prateIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PRATE"
        );

    if (
        productCodeIndex >= 0 &&
        productDescIndex >= 0 &&
        (
            openingQtyIndex >= 0 ||
            purchaseQtyIndex >= 0 ||
            saleQtyIndex >= 0 ||
            closingQtyIndex >= 0
        )
    ) {

        mapping.product =
            productDescIndex;

        mapping.productDescription =
            productDescIndex;

        mapping.productCode =
            productCodeIndex;

        if (
            openingQtyIndex >= 0
        )
            mapping.opening =
                openingQtyIndex;

        if (
            purchaseQtyIndex >= 0
        )
            mapping.purchase =
                purchaseQtyIndex;

        if (
            purchaseFreeQtyIndex >= 0
        )
            mapping.purchaseFree =
                purchaseFreeQtyIndex;

        if (
            purchaseReturnQtyIndex >= 0
        )
            mapping.purchaseReturn =
                purchaseReturnQtyIndex;

        if (
            saleQtyIndex >= 0
        )
            mapping.sales =
                saleQtyIndex;

        if (
            saleFreeQtyIndex >= 0
        )
            mapping.free =
                saleFreeQtyIndex;

        if (
            saleReturnQtyIndex >= 0
        )
            mapping.salesReturn =
                saleReturnQtyIndex;

        if (
            closingQtyIndex >= 0
        )
            mapping.closing =
                closingQtyIndex;

        if (
            prateIndex >= 0
        )
            mapping.rate =
                prateIndex;

        mapping.specialFormat =
            "PRODUCT_CODE_DESC_QTY_FORMAT";

    }

    //==================================================
    // PRODUCTS + STOCK QTY FORMAT
    //==================================================

    const productsColumnIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PRODUCTS"
        );

    const openingStockQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "OPENING STOCK QTY"
        );

    const purchasedQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "PURCHASED QTY"
        );

    const salesQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "SALES QTY"
        );

    const freeQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "FREE QTY"
        );

    const closingStockQtyIndex =
        headers.findIndex(header =>
            normalize(header) ===
            "CLOSING STOCK QTY"
        );

    if (
        productsColumnIndex >= 0 &&
        (
            openingStockQtyIndex >= 0 ||
            purchasedQtyIndex >= 0 ||
            salesQtyIndex >= 0 ||
            closingStockQtyIndex >= 0
        )
    ) {

        mapping.product =
            productsColumnIndex;

        mapping.productDescription =
            productsColumnIndex;

        if (
            openingStockQtyIndex >= 0
        )
            mapping.opening =
                openingStockQtyIndex;

        if (
            purchasedQtyIndex >= 0
        )
            mapping.purchase =
                purchasedQtyIndex;

        if (
            salesQtyIndex >= 0
        )
            mapping.sales =
                salesQtyIndex;

        if (
            freeQtyIndex >= 0
        )
            mapping.free =
                freeQtyIndex;

        if (
            closingStockQtyIndex >= 0
        )
            mapping.closing =
                closingStockQtyIndex;

        mapping.specialFormat =
            "PRODUCTS_STOCK_QTY_FORMAT";

        console.log("");

        console.log(
            "===== PRODUCTS STOCK QTY FORMAT DETECTED ====="
        );

        console.log(
            "Product Column  :",
            mapping.product
        );

        console.log(
            "Opening Column  :",
            mapping.opening
        );

        console.log(
            "Purchase Column :",
            mapping.purchase
        );

        console.log(
            "Sales Column    :",
            mapping.sales
        );

        console.log(
            "Free Column     :",
            mapping.free
        );

        console.log(
            "Closing Column  :",
            mapping.closing
        );

        console.log(
            "=============================================="
        );

    }

    //==================================================
// IMPERIA CREDIT VALUE-COLUMN FORMAT
//==================================================
//
// IMPORTANT:
// In this specific Imperia structure:
//
// Cr header is at column 45
// Actual Cr value is at column 46
//
// This override applies ONLY when the complete
// Imperia physical header structure is detected.
// Do NOT change generic credit mapping.
//
const imperiaHeaders =
    headers.map(header => compact(header));

const isImperiaFormat =
    imperiaHeaders.length > 65 &&

    imperiaHeaders[1]  === "ITEM" &&
    imperiaHeaders[12] === "PACK" &&
    imperiaHeaders[23] === "OP" &&
    imperiaHeaders[23] === "OP" &&
    imperiaHeaders[25] === "PUR" &&
    imperiaHeaders[30] === "SP" &&
    imperiaHeaders[32] === "SALE" &&
    imperiaHeaders[34] === "SS" &&
    imperiaHeaders[38] === "BR" &&
    imperiaHeaders[42] === "TOTSAL" &&
    imperiaHeaders[45] === "CR" &&
    imperiaHeaders[50] === "DB" &&
    imperiaHeaders[52] === "ADJ" &&
    imperiaHeaders[56] === "BAL" &&
    imperiaHeaders[60] === "BVAL" &&
    imperiaHeaders[62] === "SVAL" &&
    imperiaHeaders[65] === "ORDER";

if (isImperiaFormat) {

    // Header is at 45.
    // Actual numeric CR value is at 46.
    mapping.credit = 46;

    mapping.specialFormat =
        "IMPERIA_CREDIT_VALUE_COLUMN";

    console.log("");
    console.log(
        "===== IMPERIA CREDIT VALUE-COLUMN FORMAT DETECTED ====="
    );

    console.log(
        "CR Header Column :",
        45
    );

    console.log(
        "CR Value Column  :",
        mapping.credit
    );

    console.log(
        "Format           :",
        mapping.specialFormat
    );

    console.log(
        "========================================================"
    );
}

    //==================================================
    // FINAL HEADER DEBUG
    //==================================================

    console.log("");

    console.log(
        "========== HEADER DEBUG =========="
    );

    headers.forEach((h, i) => {

        console.log(
            i,
            ":",
            h
        );

    });

    console.log(
        "=================================="
    );

    //==================================================
    // FINAL MAPPING DEBUG
    //==================================================

    console.log("");

    console.log(
        "========== EXTRACTOR MAP =========="
    );

    console.log(
        "Product          :",
        mapping.product
    );

    console.log(
        "Product Code     :",
        mapping.productCode
    );

    console.log(
        "Product Desc     :",
        mapping.productDescription
    );

    console.log(
        "Opening          :",
        mapping.opening
    );

    console.log(
        "Opening Value    :",
        mapping.openingValue
    );

    console.log(
        "Purchase         :",
        mapping.purchase
    );

    console.log(
        "Purchase Free    :",
        mapping.purchaseFree
    );

    console.log(
        "Purchase Return  :",
        mapping.purchaseReturn
    );

    console.log(
        "Sales            :",
        mapping.sales
    );

    console.log(
        "Sales Return     :",
        mapping.salesReturn
    );

    console.log(
        "Free             :",
        mapping.free
    );

    console.log(
        "Replacement      :",
        mapping.replacement
    );


    console.log(
        "Credit           :",
        mapping.credit
    );

    console.log(
        "Debit            :",
        mapping.debit
    );

    console.log(
        "Adjustment       :",
        mapping.adjustment
    );

    console.log(
        "Closing          :",
        mapping.closing
    );

    console.log(
        "Rate             :",
        mapping.rate
    );

    console.log(
        "Purchase Value   :",
        mapping.purchaseValue
    );

    console.log(
        "Sales Value      :",
        mapping.salesValue
    );

    console.log(
        "Closing Value    :",
        mapping.closingValue
    );

    console.log(
        "Special Format   :",
        mapping.specialFormat
    );

    console.log(
        "=================================="
    );

    
    //==================================================
    // PRODUCT REQUIRED
    //==================================================

    if (
        mapping.product === null ||
        mapping.product === undefined
    ) {

        return {

            success: false,

            message:
                "Product column not found.",

            mapping,

            headers: analyzed

        };

    }

    //==================================================
    // SUCCESS
    //==================================================

    return {

        success: true,

        mapping,

        headers: analyzed

    };

}

//======================================================
// EXPORT
//======================================================

module.exports = {

    mapHeaders

};