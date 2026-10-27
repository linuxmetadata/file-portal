/**

======================================================

EXTRACTION MAPPER V4

======================================================



Intelligent statement header mapping.



IMPORTANT:



PRODUCT DESCRIPTION has priority over PRODUCT CODE.



Product code is NEVER selected as product when a

product description/name column exists.



Only PRODUCT is mandatory.



Existing formats are preserved.



Added DERMASCIENCE ProductName/OS/PQty/Stock format.



Added value-column mapping.



======================================================
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

//--------------------------------------------------
// code Score
//--------------------------------------------------

function codeScore(header) {

const h = normalize(header);

if (
    h === "CODE"
) {

    return 100;

}
}

//--------------------------------------------------
// Packing Score
//--------------------------------------------------

function packScore(header) {

    const h = normalize(header);

    if (!h)
        return 0;

    // Exact / strongest packing headers
    if (
        h === "PACK" ||
        h === "PACKING" ||
        h === "PACKAGE" ||
        h === "PACK SIZE" ||
        h === "PACKING SIZE" ||
        h === "PACKING TYPE" ||
        h === "PACK QTY" ||
        h === "PACKING QTY" ||
        h === "STRENGTH" ||
        h === "UNIT" ||
        h === "ITEM UNIT" ||
        h === "UDESC"

    ) {
        return 100;
    }

    // Common abbreviation
    if (
        h === "PKG" ||
        h === "PKG SIZE" ||
        h === "PKG QTY"
    ) {
        return 95;
    }

    // Compound packing header
    if (
        h.includes("PACK") ||
        h.includes("PACK SIZE")
    ) {
        return 90;
    }

    return 0;
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
    h === "SKU" 
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
    h === "OPEING STOCK" ||
    h === "OPEN STOCK" ||
    h === "OPENING QTY" ||
    h === "OPEN QTY" ||
    h === "OPEN STK" ||
    h === "OPN" ||
    h === "OPEN" ||
    h === "OPENSTK"
)
    return 150;

if (
    h === "OP STK" ||
    h === "OP ST" ||
    h === "OPNSTK" ||
    h === "OPSTK" ||
    h === "OP STCK" ||
    h === "OP STOCK" ||
    h === "OP QTY" ||
    h === "O S" ||
    h === "OPQ" ||
    h === "OP" ||
    h === "OP " ||
    h === "OP." ||
    h === "OSTK" ||
    h === "Op.Bal. Qty." ||
    h === "Op Bal Qty" ||
    h === "OP BAL QTY" ||
    h === "OPSTOCK" ||
    h === "STK OPN" ||
    h === "OPQTY" ||
    h === "OPEN STCK" ||
    h === "OPSTK QTY" ||
    h === "OPNG BAL" ||
    h === "OPNGBAL" ||
    h === "O BALANCE" ||
    h === "OPG QTY" ||
    h === "OP QNT" ||
    h === "OP QNTY" ||
    h === "OP BAL " ||
    h === "OP BAL"

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

if (h === "TOTAL STOCK"||
    h === "TOTALSTOCK"
)
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
    h === "PURCHASEQTY" ||
    h === "PURCHASES" ||
    h === "PURCHASEQUANTITY" ||
    h === "PURCHASE QUANTITY" ||
    h === "RECP QTY" ||
    h === "PQ" ||
    h === "PURCHASES" ||
    h === "TOTPURQTY" ||
    h === "PURCHQTY" ||
    h === "PURCH.QTY" ||
    h === "PURC" ||
    h === "PURC QTY" ||
    h === "PURCH"
)
    return 150;

if (
    h === "PUR" ||
    h === "PURQTY" ||
    h === "PURQTY " ||
    h === "P QTY" ||
    h === "PUR QTY" ||
    h === "PURQTY" ||
    h === "PURSTK"
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
h === "RECIPET" ||
h === "RECEIPTS" ||
h === "RCPT" ||
h === "RCVD" ||
h === "RECEIVED" ||
h === "INWARD" ||
h === "RECEIVE QUANTITY" ||
h === "RECEVIED QTY" ||
h === "RECEIVED QTY" ||
h === "REC QTY" ||
h === "Receipt Qty." ||
h === "Receipt Qty" ||
h === "RECEIPT QTY" ||
h === "TOTAL PURCHASE" ||
h === "PI" ||
h === "TOTAL PURCHASE QUANTITY" ||
h === "QTY IN" ||
h === "REC" ||
h === "PURTOT" ||
h === "PUR TOT" ||
h === "IN QTY" ||
h === "INQTY" ||
h === "IN QUANTITY" ||
h === "STK RCV" ||
h === "RCT QTY" ||
h === "PIQ" ||
h === "REC" ||
h === "PUR+RPL" ||
h === "N T PUR" ||
h === "INW QTY" ||
h === "RCPT" ||
h === "PUR QNT" ||
h === "PUR QNTY" ||
h === "PURCHASE 1" ||
h === "RCT" ||
h === "RCPTS" ||
h === "RECPTS"


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
    h === "PURCHASE FREE" ||
    h === "PURCHASES FREE" ||
    h === "PURCHASESFREE" ||
    h === "FREESTOCKRECEIVEDONPURCHASE" ||
    h === "PURCHASE FREE QTY" ||
    h === "PUR FREE" ||
    h === "PSCH" ||
    h === "P SCH" ||
    h === "SP" ||
    h === "P S QTY" ||
    h === "PSQTY" ||
    h === "PS QTY" ||
    h === "P SQTY" ||
    h === "PURCSCHEMEFREE" ||
    h === "PURCHFREEQTY" ||
    h === "SP QTY" ||
    h === "PURSCM" ||
    h === "FR" ||
    h === "PURCHASE F QTY" ||
    h === "PURFREEQTY" ||
    h === "PU F" ||
    h === "P F QTY"

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
    h === "PRET" ||
    h === "P RETURN" ||
    h === "PUR RET" ||
    h === "PURRET" ||
    h === "PUR RETN" ||
    h === "PURCHASE RETURN" ||
    h === "PURCHASE RETRUN" ||
    h === "PURCHASE RET" ||
    h === "PURCHASE RTN" ||
    h === "PRET" ||
    h === "P R QUANTITY" ||
    h === "PR QUANTITY" ||
    h === "PURCHASERETURNQTY" ||
    h === "PR" ||
    h === "PURC RETRUN" ||
    h === "P RET QTY" ||
    h === "TOTAL PURCHASE RETURN" ||
    h === "TOTAL PURCHASE RETURN QUANTITY" ||
    h === "P RETURN QTY" ||
    h === "PUR  RET" ||
    h === "PURC RETURN QTY" ||
    h === "PRETUR" ||
    h === "P RETU" ||
    h === "PRETQTY" ||
    h === "PRET QTY" ||
    h === "PU R" ||
    h === "PRETURN" ||
    h === "PRET QTY" ||
    h === "PRN" ||
    h === "RT QNTY" ||
    h === "P R QTY"
)
    return 150;


if (
    h.includes("PURCHASE RETURN") ||
    h.includes("PUR RET") ||
    h.includes("P RTN")
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
    h === "SPUR RET" ||
    h === "PURCHASE RET FREE QTY" ||
    h === "PUR RET FREE" ||
    h === "PUR RET FREE QTY" ||
    h === "PURCHASE RETURN FREE" ||
    h === "PURCHASE RETURN FREE QTY" ||
    h === "PURCH RET FREE" ||
    h === "PURCH RET FREE QTY" ||
    h === "P RTN FREE" ||
    h === "P R F QTY"
)
    return 150;

return 0;

}

//=   b v561        Zyra   12345678o0]=-08532101  `=====================================================
// SALES SCORE
//======================================================

function salesScore(header) {

const h = normalize(header);

if (!h)
    return 0;

if (
    h === "CURRENT MONTH SALES" ||
    h === "CURRENTMONTHSALES" ||
    h === "MONTH SALES" ||
    h === "SALEQUANTITY" ||
    h === "SALE QUANTITY" ||
    h === "SALEQTY" ||
    h === "SALESQTY" ||
    h === "TOTAL SALES" ||
    h === "SALE * APPROX VALUE" ||
    h === "CUR MON QTY " ||
    h === "CM SALES" ||
    h === "ISSUE QTY" ||
    h === "ISSUE" ||
    h === "SALE QNTY"
)
    return 200;

if (
    h === "SALES" ||
    h === "SALE" ||
    h === "NET SALE 1" ||
    h === "NET SALES QTY"
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
h === "SALEQTY" ||
h === "TOTAL SALE" ||
h === "SI" ||
h === "TOTAL SALE QUANTITY" ||
h === "QTY OUT" ||
h === "SOLD QTY" ||
h === "SALETOT" ||
h === "OUT QTY" ||
h === "OUTQTY" ||
h === "SALE TOT" ||
h === "STK ISS" ||
h === "OUT QUANTITY" ||
h === "SIQ" ||
h === "SALE1" ||
h === "SALE 1" ||
h === "SALES QTY" ||
h === "SA" ||
h === "SALE+RPL" ||
h === "N T SALE" ||
h === "SL QNT" ||
h === "SALE QNTY" ||
h === "SLS" ||
h === "MTD QTY"

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
h === "SRET" ||
h === "S RETURN" ||
h === "SAL RET" ||
h === "SAL RETN" ||
h === "SALE RTN" ||
h === "SRETUN" ||
h === "SALES RETURN" ||
h === "SALESRET" ||
h === "SALES RET" ||
h === "SALE RET" ||
h === "SALERET" ||
h === "SRET" ||
h === "SALESRETURNQTY" ||
h === "SALERETURNQUANTITY" ||
h === "SALE RETURNQUANTITY" ||
h === "SRETUR" ||
h === "SR" ||
h === "S CR" ||
h === "SL RET QTY" ||
h === "S RET QTY" ||
h === "SRQTY" ||
h === "SR QTY" ||
h === "TOTAL SALE RETURN" ||
h === "TOTAL SALE RETURN QUANTITY" ||
h === "S RETURN QTY " ||
h === "SALE RETURN 1" ||
h === "SAL RT" ||
h === "S RETU" ||
h === "SRETQTY" ||
h === "S RTN" ||
h === "SALES RTN" ||
h === "SRET QTY" ||
h === "SL RET" ||
h === "RT QNTY" ||
h === "SALES RTN" ||
h === "SRN" ||
h === "RF QNTY" ||
h === "S R QTY"


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
// SALES RETURN FREE SCORE
//======================================================

function salesReturnFreeScore(header) {

const h = normalize(header);

if (!h)
    return 0;

if (
h === "SALE RET FREE QTY" ||
h === "S RTN FREE" ||
h === "S R F QTY"

)
return 150;

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
    h === "FREE" ||
    h === "BONUS" ||
    h === "SCHEME" ||
    h === "SS" ||
    h === "FREE QTY QTY" ||
    h === "FREE QTY FREE QTY" ||
    h === "FREE QTY" ||
    h === "FQTY" ||
    h === "SALES FREE" ||
    h === "SALE FREE" ||
    h === "SALESFREE" ||
    h === "FREESALES" ||
    h === "S FREE" ||
    h === "SFREE" ||
    h === "SFRE" ||
    h === "FREE" ||
    h === "BONUS" ||
    h === "SCHEME SALE QUANTITY" ||
    h === "SSCH" ||
    h === "S SCH" ||
    h === "FR1" ||
    h === "S S QTY" ||
    h === "SS QTY" ||
    h === "S SQTY" ||
    h === "FREEQTY" ||
    h === "FREE SALE QTY" ||
    h === "FREE RPL" ||
    h === "SCQ" ||
    h === "SALE FREE QTY" ||
    h === "SALES FREE QTY" ||
    h === "FREESTOCKISSUEDONSALE" ||
    h === "SLSCM" ||
    h === "SALES F QTY" ||
    h === "FREE RETN QTY" ||
    h === "SALFREE" ||
    h === "F RE" ||
    h === "FREE I" ||
    h === "SA F" ||
    h === "I FREE" ||
    h === "S F QTY"

    
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
    h === "REPL QTY" ||
    h === "REPLACE" ||
    h === "REPLACEMENT" ||
    h === "PCOR" ||
    h === "P COR" ||
    h === "PURCHASE REPLACEMENTQTY" ||
    h === "RQTY" ||
    h === "RP2" ||
    h === "P REPL" ||
    h === "REP OTH" ||
    h === "OTH" ||
    h === "RPL QTY"
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
h === "SALEREPLACEMENT" ||
h === "SL REPLACEMENT" ||
h === "SALE REPL" ||
h === "SL REP" ||
h === "S REPL" ||
h === "RP" ||
h === "REP OTH IS" ||
h === "SL RPL" ||
h === "RETURN QUANTITY" ||
h === "OTHS"

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
    h === "CRQTY" ||
    h === "REPLACEOTHERS" ||
    h === "IN" ||
    h === "CRESTK" ||
    h === "CR NO"
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
    h === "DBQTY" ||
    h === "DB QTY" ||
    h === "REPLACEOTHERS" ||
    h === "OUT" ||
    h === "DBNT QTY" ||
    h === "DBSTK" ||
    h === "DR NO"
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
    h === "ADJQTY" ||
    h === "ADJUST" ||
    h === "STKADJ" ||
    h === "STKAD" ||
    h === "STK AD" ||
    h === "STK ADJ" ||
    h === "ADJUSTMENT" ||
    h === "ADJUSTMENTSQUATITY" ||
    h === "ADJUSTMENTSQUANTITY" ||
    h === "ADJUSTMENTQUANTITY" ||
    h === "ADJUSTMENT QUANTITY" ||
    h === "P COR" ||
    h === "OTHERS" ||
    h === "OTHER" ||
    h === "OTHER QTY" ||
    h === "SHORTAGE QTY" ||
    h === "SHORTAGE" ||
    h === "STOCK ADJ" ||
    h === "SAQTY" ||
    h === "PCORRE"
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
    h === "CLOSINGSTOCK" ||
    h === "CLOSING QTY"
)
    return 180;

if (
    h === "CL STK" ||
    h === "CL STCK" ||
    h === "CURSTK" ||
    h === "CL STOCK" ||
    h === "CL QTY" ||
    h === "CLSSTK" ||
    h === "CLS STK" ||
    h === "CLS.STK" ||
    h === "CLSTK" ||
    h === "CLOS QTY" ||
    h === "CL STOCK AS ON" ||
    h === "CLSTOCKASON" ||
    h === "TOTALSTOCK" ||
    h === "CLS QTY" ||
    h === "CLQTY" ||
    h === "C STK" ||
    h === "CSTK" ||
    h === "QOH" ||
    h === "CL STOCK QTY" ||
    h === "CLOSESTK" ||
    h === "CL ST" ||
    h === "CLSG STCK"

    
)
    return 170;

if (
    h === "BAL" ||
    h === "BAL QTY" ||
    h === "BAlQTY" ||
    h === "STK BAL" ||
    h === "STK BALANCE" ||
    h === "BALANCE" ||
    h === "BALANCE QTY" ||
    h === "BALANCE STOCK" ||
    h === "CURRENT STOCK" ||
    h === "CLO " ||
    h === "CLO" ||
    h === "CLQ" ||
    h === "CLSTK QTY" ||
    h === "RCPTS" ||
    h === "PUR SCH QTY" ||
    h === "BR QTY" ||
    h === "CR QTY" ||
    h === "C BALANCE" ||
    h === "CI STOCK" ||
    h === "CLG QTY" ||
    h === "CL QNT" ||
    h === "CL QNT " ||
    h === "BAL QNTY" ||
    h === "CLS" ||
    h === "C BAL" ||
    h === "CL BAL"

)
    return 150;

//--------------------------------------------------
// ERP stock column
//--------------------------------------------------

if (
    h === "STOCK" ||
    h === "STOCK QTY" ||
    h === "QTY"
)
    return 155;

if (
    h === "BVAL"
)
    return 60;

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
    h === "TRANSFERINQUANTITY"
)
    return 160;

if (
    h === "STK IN" ||
    h === "STKIN" ||
    h === "TRN IN QTY" ||
    h === "TRN IN" ||
    h === "TRNIN" ||
    h === "TRFIN" ||
    h === "TRF IN" ||
    h === "TRNINQTY" ||
    h === "BR I" ||
    h === "BR IN" ||
    h === "BRANCH IN" ||
    h === "BRANCH INWARD" ||
    h === "BRANCH INWARD QTY" ||
    h === "TRANSFER IN QUANTITY" ||
    h === "BRANCH IN QTY" ||
    h === "INWARD QTY" ||
    h === "INWARD" ||
    h === "STKIN QTY" ||
    h === "ST IN" ||
    h === "BRANCH TRANSFER RECEIVED" ||
    h === "BRANCHTRANSFERRECEIVED" ||
    h === "STOCK TRF IN" ||
    h === "BR" ||
    h === "OTHER INWARD" ||
    h === "STOCKIN"
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
    h === "TRANSFEROUTQUANTITY"
)
    return 160;

if (
    h === "STK OUT" ||
    h === "STKOUT" ||
    h === "TRN OUT QTY" ||
    h === "TRN OUT" ||
    h === "TRNOUT" ||
    h === "TRNOUTQTY" ||
    h === "TRF OUT" ||
    h === "TRFOUT" ||
    h === "ST" ||
    h === "BR R" ||
    h === "BR OUT" ||
    h === "BRANCH OUT" ||
    h === "BRANCH OUTWARD" ||
    h === "BRANCH OUTWARD QTY" ||
    h === "TRANSFER OUT QUANTITY" ||
    h === "BRANCH OUT QTY" ||
    h === "OUTWARD QTY" ||
    h === "OUTWARD" ||
    h === "STKOUTQTY" ||
    h === "ST OUT" ||
    h === "BRANCH TRANSFER SENT" ||
    h === "BRANCHTRANSFERSENT" ||
    h === "TRANSFER" ||
    h === "TRANSFER OUT" ||
    h === "TRANSFER OUTWARD" ||
    h === "TRANSFER OUTWARD QTY" ||
    h === "TRANSFER OUT QTY" ||
    h === "STOCK TRF OUT" ||
    h === "BT" ||
    h === "OTHER OUTWARD" ||
    h === "STOCK OUT QTY"
)
    return 150;

if (
    h === "BR"
)
    return 130;

}

//======================================================
// BRK & EXP SCORE
//======================================================

function brkexpScore(header) {

const h = normalize(header);

if (!h)
    return 0;

if (
    h === "BRK EXP" ||
    h === "BRKEXP" ||
    h === "BRK/EXP" ||
    h === "GODOWN BRKG EXP" ||
    h === "DAMAGE" ||
    h === "NONSALABLEQTY" ||
    h === "BRK" ||
    h === "EXP"

)
    return 150;

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
h === "SAL VAL" ||
h === "SVAL"

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
    h === "CLS VALUE" ||
    h === "BVAL"
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
// UTKARSH MEDICOS TWO-ROW MAPPING
//======================================================
//
// This mapping is activated ONLY when the combined
// UTKARSH two-row header signature is present.
//
// Physical columns:
//
// 0  ITEM DESCRIPTION
// 1  OPENING STOCK
// 2  OPENING QTY
// 3  PURCHASE FREE
// 4  S/R QTY FREE
// 5  REPL/ OTHER
// 6  =B+C+D STOCK
// 7  SALES QTY
// 8  SALES FREE SAMPLE
// 9  STOCK P/R T/F
// 10 REPL/ OTHER
// 11 =G-H-I STOCK
//======================================================

function isUtkarchTwoRowMapping(headers) {

    if (
        !Array.isArray(headers) ||
        headers.length < 12
    ) {
        return false;
    }

    const h =
        headers.map(
            value =>
                compact(value)
        );

    return (
        h[0] === "ITEMDESCRIPTION" &&
        h[1].includes("OPENING") &&
        h[3].includes("PURCHASE") &&
        h[4].includes("SR") &&
        h[5].includes("REPL") &&
        h[6].includes("=B+C+D") &&
        h[8].includes("SALES") &&
        h[9].includes("STOCK") &&
        h[10].includes("REPL") &&
        h[11].includes("=G-H-I")
    );
}


function buildUtkarchTwoRowMapping(headers) {

    const mapping = {

        product:
            0,

        productCode:
            null,

        productDescription:
            null,

        pack:
            null,

        opening:
            1,

        openingValue:
            null,

        purchase:
            3,

        purchaseFree:
            null,

        purchaseReturn:
            4,

        purchaseReturnFree:
            null,

        sales:
            7,

        salesFree:
            8,

        salesReturn:
            9,

        salesReturnFree:
            null,

        replacement:
            5,

        salesReplacement:
            10,

        credit:
            null,

        debit:
            null,

        adjustment:
            null,

        closing:
            11,

        total:
            6,

        rate:
            null,

        purchaseValue:
            null,

        salesValue:
            null,

        closingValue:
            null,

        specialFormat:
            "UTKARSH_TWO_ROW_EXCEL_STOCK_SALES",

        trnInQty:
            null,

        trnOutQty:
            null

    };

    return mapping;
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


    // ======================================================
    // UNITED ENTERPRISE - CSV STOCK REPORT
    // Exact 10-column header structure
    // ======================================================

    const unitedEnterpriseHeaders =
        headers.map(header => compact(header));

    const isUnitedEnterpriseCsvFormat =
        unitedEnterpriseHeaders.length === 10 &&
        unitedEnterpriseHeaders[0] === "SRNO" &&
        unitedEnterpriseHeaders[1] === "ITEMNAME" &&
        unitedEnterpriseHeaders[2] === "QTY" &&
        unitedEnterpriseHeaders[3] === "INVVALUE" &&
        unitedEnterpriseHeaders[4] === "QTY" &&
        unitedEnterpriseHeaders[5] === "INVVALUE" &&
        unitedEnterpriseHeaders[6] === "QTY" &&
        unitedEnterpriseHeaders[7] === "INVVALUE" &&
        unitedEnterpriseHeaders[8] === "QTY" &&
        unitedEnterpriseHeaders[9] === "INVVALUE";

    if (isUnitedEnterpriseCsvFormat) {

        mapping.product = 1;
        mapping.productDescription = 1;

        mapping.opening = 2;
        mapping.openingValue = 3;

        mapping.purchase = 4;
        mapping.purchaseValue = 5;

        mapping.sales = 6;
        mapping.salesValue = 7;

        mapping.closing = 8;
        mapping.closingValue = 9;

        mapping.purchaseFree = null;
        mapping.purchaseReturn = null;
        mapping.purchaseReturnFree = null;

        mapping.salesFree = null;
        mapping.salesReturn = null;
        mapping.salesReturnFree = null;

        mapping.replacement = null;
        mapping.salesReplacement = null;

        mapping.credit = null;
        mapping.debit = null;
        mapping.adjustment = null;

        mapping.total = null;
        mapping.rate = null;

        mapping.specialFormat =
            "UNITED_ENTERPRISE_CSV_STOCK_REPORT";

        console.log(
            "===== UNITED ENTERPRISE CSV MAPPING APPLIED ====="
        );

        console.log({
            product: mapping.product,
            opening: mapping.opening,
            openingValue: mapping.openingValue,
            purchase: mapping.purchase,
            purchaseValue: mapping.purchaseValue,
            sales: mapping.sales,
            salesValue: mapping.salesValue,
            closing: mapping.closing,
            closingValue: mapping.closingValue,
            specialFormat: mapping.specialFormat
        });

        return {
            success: true,
            mapping,
            headers
        };
    }


//======================================================
// UTKARSH MEDICOS TWO-ROW MAPPING
//======================================================

if (isUtkarchTwoRowMapping(headers)) {

    console.log("");
    console.log("===== UTKARSH TWO-ROW MAPPING APPLIED =====");

    const utkarchMapping =
        buildUtkarchTwoRowMapping(headers);

    console.log(
        "UTKARSH FINAL MAPPING:",
        utkarchMapping
    );

    return {
        success: true,
        mapping: utkarchMapping,
        headers
    };
}

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
// ==========================================================
// META AGARWAL DRUG DISTRIBUTORS
// STRICT PHYSICAL-COLUMN STOCK & SALE FORMAT
// ==========================================================
//
// IMPORTANT:
// This format has header labels positioned one column before
// some of their actual numeric data columns.
//
// Therefore DO NOT use generic selectBest() mapping.
//
// This branch is activated ONLY when the exact META signature
// is present.
//
// ==========================================================

const metaHeaders =
    headers.map(header =>
        compact(header)
    );

    const isMetaMonthHeader = (value) => {
    const month = normalize(value);

    return [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC"
    ].includes(month);
};

const metaSignature = [

    "",              // 0
    "ITEMNAME",      // 1
    "",              // 2
    "",              // 3
    "",              // 4
    "",              // 5
    "",              // 6
    "",              // 7
    "",              // 8
    "PACKING",       // 9
    "",              // 10
    "",              // 11
    "OP",            // 12
    "",              // 13
    "PURQTY",        // 14
    "",              // 15
    "",              // 16
    "",              // 17
    "",              // 18
    "",              // 19
    "",              // 20
    "CURMONQTY",     // 21
    "",              // 22
    "",              // 23
    "",              // 24
    "",              // 25
    "SALEVAL",       // 26
    "CR",            // 27
    "",              // 28
    "",              // 29
    "",              // 30
    "DBNTQTY",       // 31
    "",              // 32
    "",              // 33
    "",              // 34
    "",              // 35
    "CLSQTY",        // 36
    "",              // 37
    "CLSVAL"         // 38

];

const isMetaFormat =
    metaHeaders.length >= metaSignature.length &&
    metaSignature.every((expected, index) =>
        expected === "" || normalize(metaHeaders[index]) === expected
    ) &&
    isMetaMonthHeader(metaHeaders[17]) &&
    isMetaMonthHeader(metaHeaders[20]);

if (isMetaFormat) {

    console.log("");
    console.log(
        "===== META AGARWAL STOCK & SALE FORMAT DETECTED ====="
    );

    // ------------------------------------------------------
    // Product
    // ------------------------------------------------------

    mapping.product = 1;
    mapping.productDescription = 1;

    // ------------------------------------------------------
    // Pack
    // ------------------------------------------------------

    mapping.pack = 9;

    // ------------------------------------------------------
    // IMPORTANT:
    // Header and actual value columns are different.
    //
    // Header OP       = 12
    // Actual OP value = 13
    //
    // Header PURQTY   = 14
    // Actual PURQTY   = 15
    // ------------------------------------------------------

    mapping.opening = 13;

    mapping.purchase = 15;

    // ------------------------------------------------------
    // Current Month Sales Quantity
    // ------------------------------------------------------

    mapping.sales = 21;

    // ------------------------------------------------------
    // Sales Value
    // ------------------------------------------------------

    mapping.salesValue = 25;

    // ------------------------------------------------------
    // Credit
    // ------------------------------------------------------

    mapping.credit = 27;

    // ------------------------------------------------------
    // Debit
    // ------------------------------------------------------

    mapping.debit = 33;

    // ------------------------------------------------------
    // Closing Quantity
    // ------------------------------------------------------

    mapping.closing = 36;

    // ------------------------------------------------------
    // Closing Value
    // ------------------------------------------------------

    mapping.closingValue = 38;

    // ------------------------------------------------------
    // Fields not present in this META structure
    // ------------------------------------------------------

    mapping.openingValue = null;

    mapping.purchaseFree = null;
    mapping.purchaseReturn = null;
    mapping.purchaseReturnFree = null;

    mapping.salesFree = null;
    mapping.salesReturn = null;
    mapping.salesReturnFree = null;

    mapping.replacement = null;
    mapping.salesReplacement = null;

    mapping.adjustment = null;

    mapping.rate = null;
    mapping.purchaseValue = null;

    mapping.total = null;

    mapping.trnInQty = null;
    mapping.trnOutQty = null;

    // ------------------------------------------------------
    // META special format identifier
    // ------------------------------------------------------

    mapping.specialFormat =
        "META_AGARWAL_STOCK_SALES";

    console.log("META FINAL MAPPING:");
    console.log({
        product: mapping.product,
        productDescription:
            mapping.productDescription,
        pack: mapping.pack,
        opening: mapping.opening,
        purchase: mapping.purchase,
        sales: mapping.sales,
        salesValue: mapping.salesValue,
        credit: mapping.credit,
        debit: mapping.debit,
        closing: mapping.closing,
        closingValue: mapping.closingValue,
        specialFormat:
            mapping.specialFormat
    });

    console.log(
        "===================================================="
    );

    // IMPORTANT:
    // Stop generic mapping from overriding META.
    return {
        success: true,
        mapping,
        headers
    };
}

//======================================================
// INTEGRA TWO-ROW EXCEL STOCK & SALES FORMAT
//======================================================
//
// Physical columns:
//
// 0  ITEM DESCRIPTION
// 1  OPENING QTY
// 2  OPENING VALUE
// 3  PURCHASE QTY
// 4  PURCHASE FREE
// 5  PURCHASE VALUE
// 6  SALES RETURN QTY
// 7  SALES RETURN FREE
// 8  SALES RETURN VALUE
// 9  OTHER
// 10 TOTAL QTY
// 11 SALES QTY
// 12 SALES FREE
// 13 SALES VALUE
// 14 SAMPLE QTY
// 15 STOCK QTY
// 16 T/F
// 17 PURCHASE RETURN QTY
// 18 PURCHASE RETURN VALUE
// 19 ADJUSTMENT
// 20 CLOSING QTY
// 21 CLOSING VALUE
//
// IMPORTANT:
// This is a dedicated physical-position mapping.
// Do NOT use generic selectBest() for this format.
//======================================================

const integraTwoRowHeaderRow =
    Array.isArray(headers[0])
        ? headers[0]
        : headers;

const integraTwoRowHeaders =
    integraTwoRowHeaderRow.map(header =>
        compact(header)
    );

const integraTwoRowSignature = [

    "ITEMDESCRIPTION",
    "OPENING",
    "STOCK",
    "<",
    "PURCHASE",
    ">",
    "<",
    "SALESRETURN",
    ">",
    "OTHER",
    "TOTAL",
    "<",
    "SALES",
    ">",
    "SAMPLE",
    "STOCK",
    "TF",
    "PURCHASE",
    "RETURN",
    "OTHER",
    "CLOSING",
    "STOCK"

];

const isIntegraTwoRowFormat =
    integraTwoRowHeaders.length >=
    integraTwoRowSignature.length &&

    integraTwoRowSignature.every(
        (expected, index) =>
            integraTwoRowHeaders[index] ===
            expected
    );

if (isIntegraTwoRowFormat) {

    console.log("");
    console.log(
        "===== INTEGRA TWO-ROW STOCK & SALES FORMAT DETECTED ====="
    );

    mapping.product = 0;
    mapping.productDescription = 0;

    mapping.opening = 1;
    mapping.openingValue = 2;

    mapping.purchase = 3;
    mapping.purchaseFree = 4;
    mapping.purchaseValue = 5;

    mapping.salesReturn = 6;
    mapping.salesReturnFree = 7;

    mapping.salesReturnValue = 8;

    mapping.salesReplacement = 9;

    mapping.total = 10;

    mapping.sales = 11;
    mapping.salesFree = 12;
    mapping.salesValue = 13;

    mapping.sample = 14;
    mapping.stock = 15;
    mapping.trnOutQty = 16;

    // Purchase Return
    mapping.purchaseReturn = 17;

    // Purchase Return Value
    mapping.purchaseReturnValue = 18;

    // Adjustment
    mapping.replacement = 19;

    mapping.closing = 20;
    mapping.closingValue = 21;

    mapping.specialFormat =
        "INTEGRA_TWO_ROW_EXCEL_STOCK_SALES";

    console.log(
        "INTEGRA TWO-ROW FINAL MAPPING:"
    );

    console.log({
        product: mapping.product,
        opening: mapping.opening,
        openingValue: mapping.openingValue,
        purchase: mapping.purchase,
        purchaseFree: mapping.purchaseFree,
        purchaseValue: mapping.purchaseValue,
        salesReturn: mapping.salesReturn,
        salesReturnFree: mapping.salesReturnFree,
        salesReturnValue: mapping.salesReturnValue,
        total: mapping.total,
        sales: mapping.sales,
        salesFree: mapping.salesFree,
        salesValue: mapping.salesValue,
        sample: mapping.sample,
        stock: mapping.stock,
        tf: mapping.tf,
        purchaseReturn: mapping.purchaseReturn,
        purchaseReturnValue:
            mapping.purchaseReturnValue,
        adjustment: mapping.adjustment,
        closing: mapping.closing,
        closingValue: mapping.closingValue,
        specialFormat:
            mapping.specialFormat
    });

    console.log(
        "=========================================================="
    );

    // IMPORTANT:
    // Stop generic mapping from overriding INTEGRA.
    return {
        success: true,
        mapping,
        headers
    };
}

//======================================================
// DERMASCIENCE DAF MEDICINE AGENCIES
// STRICT TWO-ROW STOCK FORMAT
//======================================================

const dafHeaders = headers
    .slice(0, 16)
    .map(header => compact(header));

const dafSignature = [
    "CODE",
    "PRODUCTNAME",
    "UNIT",
    "CURRENTSTOCK",
    "SALESSCHEMEDEAL",
    "SALESSCHEMEFREE",
    "PURCSCHEMEDEAL",
    "PURCSCHEMEFREE",
    "COSTPRICE",
    "VALUE",
    "MRP",
    "PURCHASEPRICE",
    "SALESPRICE",
    "COMPANY",
    "MANUFACTURER",
    "RACKNO"
];

const isDafFormat =
    dafHeaders.length === 16 &&
    dafSignature.every(
        (expected, index) =>
            dafHeaders[index] === expected
    );

console.log("");
console.log("===== DAF HEADER CHECK =====");
console.log("DAF HEADERS :", dafHeaders);
console.log("DAF EXPECTED:", dafSignature);
console.log("DAF FORMAT  :", isDafFormat);
console.log("============================");

if (isDafFormat) {

    console.log("");
    console.log(
        "===== DAF MEDICINE AGENCIES MAPPING APPLIED ====="
    );

    // Physical column 0
    mapping.productCode = 0;

    // Physical column 1
    mapping.product = 1;
    mapping.productDescription = 1;

    // Physical column 2
    mapping.pack = 2;

    // Physical column 3
    mapping.closing = 3;

    // Physical column 8
    mapping.rate = 8;

    // Physical column 9
    mapping.closingValue = 9;

    // These fields do NOT exist in this statement
    mapping.opening = null;
    mapping.openingValue = null;

    mapping.purchase = 6;
    mapping.purchaseFree = 7;
    mapping.purchaseReturn = null;
    mapping.purchaseReturnFree = null;

    mapping.sales = 4;
    mapping.salesFree = 5;
    mapping.salesReturn = null;
    mapping.salesReturnFree = null;
    mapping.replacement = null;
    mapping.salesReplacement = null;

    mapping.credit = null;
    mapping.debit = null;
    mapping.adjustment = null;

    mapping.total = null;
    mapping.purchaseValue = null;
    mapping.salesValue = null;

    mapping.specialFormat =
        "DERMASCIENCE_DAF_MEDICINE_AGENCIES";

    console.log("DAF FINAL MAPPING:");
    console.log({
        productCode: mapping.productCode,
        product: mapping.product,
        productDescription: mapping.productDescription,
        pack: mapping.pack,
        closing: mapping.closing,
        rate: mapping.rate,
        closingValue: mapping.closingValue,
        specialFormat: mapping.specialFormat
    });

    // IMPORTANT:
    // Stop generic mapping from overriding DAF.
    return {
        success: true,
        mapping,
        headers
    };
}

//======================================================
// META MAYO PHARMA - STRUCTURED STOCK FORMAT
//======================================================
//
// Physical columns:
//
// 0  NAME
// 1  CODE
// 2  PRODUCT
// 3  PACKING
// 4  LMS
// 5  OP.STOCK
// 6  RCPTS
// 7  SALES
// 8  SL.VALUE
// 9  HO SALE(INCL)
// 10 HO SALE VAL
// 11 FREE
// 12 CL.STK
// 13 CL.VALUE
// 14 TRANSIT
// 15 TRANSIT.VAL
//
// This branch is activated ONLY for this exact
// 16-column header structure.
//
//======================================================

const metaMayoHeaders =
    headers.map(header => compact(header));

const metaMayoSignature = [
    "NAME",
    "CODE",
    "PRODUCT",
    "PACKING",
    "LMS",
    "OPSTOCK",
    "RCPTS",
    "SALES",
    "SLVALUE",
    "HOSALEINCL",
    "HOSALEVAL",
    "FREE",
    "CLSTK",
    "CLVALUE",
    "TRANSIT",
    "TRANSITVAL"
];

const isMetaMayoFormat =
    metaMayoHeaders.length === 16 &&
    metaMayoSignature.every(
        (expected, index) =>
            metaMayoHeaders[index] === expected
    );

if (isMetaMayoFormat) {

    console.log("");
    console.log(
        "===== META MAYO PHARMA FORMAT DETECTED ====="
    );

    mapping.product = 2;
    mapping.productDescription = 2;
    mapping.productCode = 1;
    mapping.pack = 3;

    mapping.opening = 5;
    mapping.purchase = 6;
    mapping.sales = 7;
    mapping.salesValue = 8;
    mapping.salesFree = 11;


    mapping.closing = 12;
    mapping.closingValue = 13;

    mapping.trnInQty = 14;

    mapping.specialFormat =
        "META_MAYO_PHARMA_STOCK_SALES";

    console.log("META MAYO FINAL MAPPING:");
    console.log({
        product: mapping.product,
        productCode: mapping.productCode,
        pack: mapping.pack,
        opening: mapping.opening,
        purchase: mapping.purchase,
        sales: mapping.sales,
        salesValue: mapping.salesValue,
        closing: mapping.closing,
        closingValue: mapping.closingValue,
        trnInQty: mapping.trnInQty,
        specialFormat: mapping.specialFormat
    });

    console.log(
        "================================================"
    );

    return {
        success: true,
        mapping,
        headers
    };
}


 //======================================================
 // HYGIA TWO-ROW STOCK & SALES MAPPING
 //======================================================

 const hygiaHeaders = headers.map(header => compact(header));

 const isHygiaStockSalesFormat =
     hygiaHeaders.length === 12 &&
     hygiaHeaders[0] === "ITEMDESCRIPTION" &&
     hygiaHeaders[1] === "" &&
     hygiaHeaders[2] === "" &&
     hygiaHeaders[3] === "OPENING" &&
     hygiaHeaders[4] === "RECEIPT" &&
     hygiaHeaders[5] === "" &&
     hygiaHeaders[6] === "" &&
     hygiaHeaders[7] === "ISSUE" &&
     hygiaHeaders[8] === "CLOSING" &&
     hygiaHeaders[9] === "" &&
     hygiaHeaders[10] === "DUMP" &&
     hygiaHeaders[11] === "";

 if (isHygiaStockSalesFormat) {

     console.log("");
     console.log("===== HYGIA TWO-ROW STOCK & SALES MAPPING APPLIED =====");

     mapping.product = 0;
     mapping.productDescription = 0;
     mapping.pack = 1;

     // Quantity columns
     mapping.opening = 2;
     mapping.purchase = 4;
     mapping.sales = 6;
     mapping.closing = 8;

     // Corresponding value columns
     mapping.openingValue = 3;
     mapping.purchaseValue = 5;
     mapping.salesValue = 7;
     mapping.closingValue = 9;

     // Fields not represented by this mapping
     mapping.purchaseFree = null;
     mapping.purchaseReturn = null;
     mapping.purchaseReturnFree = null;
     mapping.salesFree = null;
     mapping.salesReturn = null;
     mapping.salesReturnFree = null;
     mapping.replacement = null;
     mapping.salesReplacement = null;
     mapping.credit = null;
     mapping.debit = null;
     mapping.adjustment = null;
     mapping.total = null;
     mapping.rate = null;

     mapping.specialFormat =
         "HYGIA_TWO_ROW_STOCK_SALES";

     console.log("HYGIA FINAL MAPPING:", {
         product: mapping.product,
         pack: mapping.pack,
         opening: mapping.opening,
         openingValue: mapping.openingValue,
         purchase: mapping.purchase,
         purchaseValue: mapping.purchaseValue,
         sales: mapping.sales,
         salesValue: mapping.salesValue,
         closing: mapping.closing,
         closingValue: mapping.closingValue,
         specialFormat: mapping.specialFormat
     });

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

mapping.code =
    selectBest(
        headers,
        codeScore
    ).index;

//--------------------------------------------------
// NORMAL PRODUCT MAPPING
//--------------------------------------------------

mapping.pack =
    selectBest(
        headers,
        packScore
    ).index;

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

//--------------------------------------------------
// META INTERNATIONAL PURCHASE HEADER ALIASES
//--------------------------------------------------

headers.forEach((header, index) => {

    const normalized =
        String(header || "")
            .toUpperCase()
            .replace(/\s+/g, "");

    if (normalized === "PURCH.QTY") {
        mapping.purchase = index;
    }

});

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


// ============================================================
// META INTERNATIONAL - SALES RETURN OVERRIDE
// Header: Sl.Ret.Qty
// Do not affect existing formats
// ============================================================

const metaInternationalSalesReturnIndex =
    headers.findIndex(header =>
        String(header || "")
            .toUpperCase()
            .replace(/\s+/g, "") ===
        "SL.RET.QTY"
    );

if (metaInternationalSalesReturnIndex >= 0) {

    mapping.salesReturn =
        metaInternationalSalesReturnIndex;

} else {

    // EXISTING GENERIC SALES RETURN MAPPING
    mapping.salesReturn =
        selectBest(
            headers,
            salesReturnScore
        ).index;

}

mapping.salesReturnFree =
        selectBest(
            headers,
            salesReturnFreeScore
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
item.header === "RETRN QTY" ||
item.header === "RET QTY" ||
item.header === "RETURN"
)
.map(item => item.index);

if (retrnQtyIndexes.length >= 2) {

mapping.salesReturn =
    retrnQtyIndexes[0];

mapping.purchaseReturn =
    retrnQtyIndexes[1];

}




//--------------------------------------------------
// META SHREE SIMBA - TOTAL RETURN QUANTITY OVERRIDE
// Only this exact 40-column structure.
// Total Purchase Return Quantity = column 22
// Total Sale Return Quantity     = column 34
//--------------------------------------------------

const isMetaShreeSimbaReturnFormat =
    headers.length === 40 &&
    normalize(headers[0]) === "DIVISION" &&
    normalize(headers[1]) === "PRODUCT CODE" &&
    normalize(headers[2]) === "PRODUCT NAME" &&
    normalize(headers[16]) === "TOTAL PURCHASE QUANTITY" &&
    normalize(headers[22]) === "TOTAL PURCHASE RETURN QUANTITY" &&
    normalize(headers[28]) === "TOTAL SALE QUANTITY" &&
    normalize(headers[34]) === "TOTAL SALE RETURN QUANTITY";

if (isMetaShreeSimbaReturnFormat) {

    mapping.purchaseReturn = 22;

    mapping.salesReturn = 34;

}


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
    item.header === "FREE" ||
    item.header === "FREEQTYFREEQTY"
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


}

//--------------------------------------------------
// Free OCCURRENCE FORMAT
// First Free Qty  = Purchase Free
// Second Free Qty = Sales Free
//--------------------------------------------------

const freeQtyIndexes = headers
.map((header, index) => ({
header: normalize(header),
index
}))
.filter(item =>
item.header === "FREE" ||
item.header === "FREE QTY" ||
item.header === "SCM"
)
.map(item => item.index);

if (freeQtyIndexes.length >= 2) {

mapping.purchaseFree =
    freeQtyIndexes[0];

mapping.salesFree =
    freeQtyIndexes[1];

}

//==================================================
// TRANSACTION-BASED FREE HEADER RULE
//==================================================
// Applies ONLY to this exact structure:
//
// Sl# | Product | Pack | Purch | Free | S.Retu | Free |
// P.Retu | Free | Sales | Free | Stock
//
// Physical mapping:
//
// Purch  -> Purchase Free
// S.Retu -> Sales Return Free
// P.Retu -> Purchase Return Free
// Sales  -> Sales Free
//
// This exact rule is applied LAST so that
// generic FREE rules cannot overwrite it.
//==================================================

const transactionBasedFreeHeaders =
    headers.map(header => compact(header));

const isTransactionBasedFreeStructure =
    transactionBasedFreeHeaders.length === 12 &&
    transactionBasedFreeHeaders[0] === "SL#" &&
    transactionBasedFreeHeaders[1] === "PRODUCT" &&
    transactionBasedFreeHeaders[2] === "PACK" &&
    transactionBasedFreeHeaders[3] === "PURCH" &&
    transactionBasedFreeHeaders[4] === "FREE" &&
    transactionBasedFreeHeaders[5] === "SRETU" &&
    transactionBasedFreeHeaders[6] === "FREE" &&
    transactionBasedFreeHeaders[7] === "PRETU" &&
    transactionBasedFreeHeaders[8] === "FREE" &&
    transactionBasedFreeHeaders[9] === "SALES" &&
    transactionBasedFreeHeaders[10] === "FREE" &&
    transactionBasedFreeHeaders[11] === "STOCK";

if (isTransactionBasedFreeStructure) {

    mapping.purchaseFree = 4;

    mapping.salesReturnFree = 6;

    mapping.purchaseReturnFree = 8;

    mapping.salesFree = 10;
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

//--------------------------------------------------
// REPLACE+OTHERS OCCURRENCE FORMAT
// First Replace Qty  = Replacement
// Second Replace Qty = Sales Relacement
//--------------------------------------------------

console.log("");
console.log("===== REPLACE+OTHERS MAPPING DEBUG =====");
console.log(
    "HEADERS RECEIVED BY MAPPER:",
    headers
);
console.log(
    "NORMALIZED HEADERS:",
    headers.map(header => normalize(header))
);
console.log("========================================");

const replaceOthersIndexes = headers
.map((header, index) => ({
header: normalize(header),
index
}))
.filter(item =>
item.header === "REPLACE+ OTHERS"
)
.map(item => item.index);

if (replaceOthersIndexes.length >= 2) {

mapping.replacement =
    replaceOthersIndexes[0];

mapping.salesReplacement =
    replaceOthersIndexes[1];

}

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

//--------------------------------------------------
// REPL OTHERS OCCURRENCE FORMAT
// First REPL OTHERS  = Replacement
// Second REPL OTHERS = Sales Replacement
//--------------------------------------------------

const replOthersIndexes = headers
.map((header, index) => ({
header: normalize(header),
index
}))
.filter(item =>
item.header === "REPL OTHERS"
)
.map(item => item.index);

if (replOthersIndexes.length >= 2) {

mapping.replacement =
    replOthersIndexes[0];

mapping.salesReplacement =
    replOthersIndexes[1];

}

mapping.adjustment =
    selectBest(
        headers,
        adjustmentScore
    ).index;

mapping.brkexp =
    selectBest(
        headers,
        brkexpScore
    ).index;


mapping.closing =
    selectBest(
        headers,
        closingScore
    ).index;

//--------------------------------------------------
// CLOSING OCCURRENCE FORMAT
// First CLOSING  = Opening
// Second CLOSING = Closing
//--------------------------------------------------

const closingIndexes = headers
.map((header, index) => ({
header: normalize(header),
index
}))
.filter(item =>
item.header === "CLOSING"
)
.map(item => item.index);

if (closingIndexes.length >= 2) {

mapping.opening =
    closingIndexes[0];

mapping.closing =
    closingIndexes[1];

}

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

mapping.replacement = othersIndexes[0];
mapping.salesReplacement = othersIndexes[1];

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
mapping.salesReplacement = 4;

mapping.total = 5;

mapping.sales = 6;

mapping.purchaseReturn = 7;

// SECOND "REPLACE+ OTHERS"
// = DEBIT
mapping.replacement = 8;

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
// DERMANEX RAPID MEDICO - SERIAL NUMBER OVERRIDE
//==================================================
//
// In this format:
// Column 0 = SR. = Serial Number
//
// IMPORTANT:
// SR must NEVER be treated as Sales Return here.
// This override affects ONLY this exact 2-row structure.
// Other formats using SR as Sales Return are untouched.
//==================================================

const isDermanexRapidMedicoMapping =
    headers.length >= 13 &&

    normalize(headers[0]) === "SR" &&
    normalize(headers[1]) === "PRODUCT NAME" &&
    normalize(headers[2]) === "PACK" &&

    normalize(headers[3]) === "OPEN STCK" &&
    normalize(headers[4]) === "PURCHASE QTY" &&
    normalize(headers[5]) === "PURCHASE F QTY" &&
    normalize(headers[6]) === "TOTAL" &&

    normalize(headers[7]) === "SALES QTY" &&
    normalize(headers[8]) === "SALES F QTY" &&

    normalize(headers[9]) === "CLSG STCK" &&
    normalize(headers[10]) === "EARLY EXPIRY" &&
    normalize(headers[11]) === "REMKS" &&
    normalize(headers[12]) === "AVGSAL 3 MNTH";

if (isDermanexRapidMedicoMapping) {

    console.log("");
    console.log(
        "===== DERMANEX RAPID MEDICO MAPPING OVERRIDE ====="
    );

    // Column 0 = SR. = Serial Number
    // NEVER map this as Sales Return.
    mapping.salesReturn = null;
    mapping.salesReturnFree = null;

    // Exact physical columns
    mapping.product = 1;
    mapping.productDescription = 1;
    mapping.pack = 2;

    mapping.opening = 3;

    mapping.purchase = 4;
    mapping.purchaseFree = 5;
    mapping.total = 6;

    mapping.sales = 7;
    mapping.salesFree = 8;

    mapping.closing = 9;

    // These fields are not present as business movement columns.
    mapping.purchaseReturn = null;
    mapping.purchaseReturnFree = null;
    mapping.salesReplacement = null;
    mapping.replacement = null;
    mapping.credit = null;
    mapping.debit = null;
    mapping.adjustment = null;

    mapping.openingValue = null;
    mapping.purchaseValue = null;
    mapping.salesValue = null;
    mapping.closingValue = null;
    mapping.rate = null;

    mapping.specialFormat =
        "DERMANEX_RAPID_MEDICO_TWO_ROW_EXCEL_STOCK_SALES";

    console.log(
        "DERMANEX RAPID MEDICO FINAL MAPPING:"
    );

    console.log({
        product: mapping.product,
        pack: mapping.pack,
        opening: mapping.opening,
        purchase: mapping.purchase,
        purchaseFree: mapping.purchaseFree,
        sales: mapping.sales,
        salesFree: mapping.salesFree,
        salesReturn: mapping.salesReturn,
        salesReturnFree: mapping.salesReturnFree,
        closing: mapping.closing,
        total: mapping.total,
        specialFormat: mapping.specialFormat
    });

    console.log(
        "================================================="
    );
}

//==================================================
// GENERIC PACKING FALLBACK
//==================================================
//
// Rule:
// 1. Product column must already be identified.
// 2. Existing valid Packing mapping is NEVER overwritten.
// 3. Check the immediate column after Product.
// 4. If that column is already mapped to ANY OTHER field,
//    do NOT use it as Packing.
// 5. Otherwise map it as Packing.
//
// Applies to ALL statement formats.
//==================================================

if (
    Number.isInteger(mapping.product) &&
    mapping.product >= 0 &&
    mapping.product < headers.length
) {

    // Preserve any existing valid Packing mapping.
    if (
        !Number.isInteger(mapping.pack) ||
        mapping.pack < 0 ||
        mapping.pack >= headers.length
    ) {

        const candidatePacking =
            mapping.product + 1;

        if (
            candidatePacking >= 0 &&
            candidatePacking < headers.length
        ) {

            let columnAlreadyMapped =
                false;

            for (
                const [field, value]
                of Object.entries(mapping)
            ) {

                // Packing itself is the field we are trying to fill.
                if (field === "pack") {
                    continue;
                }

                // Product is the reference column.
                if (field === "product") {
                    continue;
                }

                if (
                    Number.isInteger(value) &&
                    value === candidatePacking
                ) {

                    columnAlreadyMapped =
                        true;

                    break;
                }
            }

            if (!columnAlreadyMapped) {

                mapping.pack =
                    candidatePacking;

            }

        }

    }

}

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