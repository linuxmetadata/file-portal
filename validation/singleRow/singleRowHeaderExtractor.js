/**
 * SINGLE ROW TXT HEADER EXTRACTOR
 * Structure-based. Registry source: ALL_STATEMENT_HEADERS_IDENTIFIERS(3).xlsx
 */
const fs = require("fs");
const path = require("path");
const { readTXT } = require("../readers/txtReader");
const { detectTXTHeader } = require("../detectors/headerDetectorTXT");

const STRUCTURES = [
    {
        "id": "H001",
        "raw": "Product Name               Packing       OP <---Receipts--->  <----Sales---->  <---Closing----> || Qty    Qty     Value    Qty     Value    Qty      Value",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "OP",
            "RECEIPTS",
            "SALES",
            "CLOSING",
            "QTY",
            "VALUE"
        ]
    },
    {
        "id": "H002",
        "raw": "DESCRIPTION/PACKING     Pro.  OPENING    PUR.   SALE   CR.NO.  DR.NO.  CLOSING || Age     QTY.     QTY.    QTY.  ST.[+]  ST.[-]    QTY.",
        "identifiers": [
            "PACKING",
            "OPENING",
            "PUR",
            "SALE",
            "CLOSING",
            "AGE",
            "QTY",
            "ST"
        ]
    },
    {
        "id": "H003",
        "raw": "PRODUCT NAME               OPEN  REC-  ADJ   ADJ TOTAL SALES CLOSE   ORD.QTY  EXCES    JUN      MAY || STOCK  EIPT  (-)   (+) STOCK   QTY STOCK  (  1.00)  VALUE  SALES    SALES",
        "identifiers": [
            "PRODUCT_NAME",
            "OPEN",
            "REC",
            "ADJ",
            "TOTAL",
            "SALES",
            "CLOSE",
            "QTY",
            "VALUE"
        ]
    },
    {
        "id": "H004",
        "raw": "Product Name              Packing  Opening Stock       Purchases        Sales      Closing Stock || Qty      Value  Qty      Value  Qty      Value  Qty      Value",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "OPENING_STOCK",
            "PURCHASE",
            "SALES",
            "CLOSING_STOCK",
            "QTY",
            "VALUE"
        ]
    },
    {
        "id": "H005",
        "raw": "Product Name                 Packing  O.Stk    Purc      Tot    Sale     Qoh        Value  Age",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "O_STK",
            "PURC",
            "TOT",
            "SALE",
            "QOH",
            "VALUE",
            "AGE"
        ]
    },
    {
        "id": "H006",
        "raw": "ITEMCODE  ITEMNAME                   CLSTOCK     CLVALUE     SALES          SALESVALUE    LM 1    LM 2",
        "identifiers": [
            "ITEMCODE",
            "ITEMNAME",
            "CLSTOCK",
            "VALUE",
            "SALE",
            "SALES",
            "SVALUE",
            "LM_1",
            "LM_2"
        ]
    },
    {
        "id": "H007",
        "raw": "ITEM NAME               BOX    PACK    OPQTY  P_QTY  REPL   S_QTY  B_QTY",
        "identifiers": [
            "ITEM_NAME",
            "PACK",
            "OPQTY",
            "QTY",
            "REPL"
        ]
    },
    {
        "id": "H008",
        "raw": "Code     Name                Prate OpStock       Purchase    Preturn     Sales       SValue SReturn Excess Short   ClStock     Cl Value || Qty    Free            Qty   Free                   /T IN  /TOUT Qty   Free",
        "identifiers": [
            "CODE",
            "NAME",
            "PRATE",
            "OP",
            "PURCHASE",
            "PRETURN",
            "SALES",
            "SVALUE",
            "VALUE",
            "SRETURN",
            "EXCESS",
            "SHORT",
            "CLSTOCK",
            "QTY",
            "FREE"
        ]
    },
    {
        "id": "H009",
        "raw": "No   Product Name              Pack        Opstk           Pur      Sale        CurStk    StkVal",
        "identifiers": [
            "PRODUCT_NAME",
            "PACK",
            "OPSTK",
            "PUR",
            "SALE",
            "CURSTK",
            "STKVAL"
        ]
    },
    {
        "id": "H010",
        "raw": "Product Name              Pack   LstSL  Open Recd. Sales Close  Order  Pend Stk.Value",
        "identifiers": [
            "PRODUCT_NAME",
            "PACK",
            "LSTSL",
            "OPEN",
            "RECD",
            "SALES",
            "CLOSE",
            "ORDER",
            "PEND",
            "VALUE"
        ]
    },
    {
        "id": "H011",
        "raw": "Code   Product Name             Packing  Opening  Receipts    Total    Sales  Closing    Closing || Stock                                Stock      Value",
        "identifiers": [
            "CODE",
            "PRODUCT_NAME",
            "PACKING",
            "OPENING",
            "RECEIPTS",
            "TOTAL",
            "SALES",
            "CLOSING",
            "VALUE"
        ]
    },
    {
        "id": "H012",
        "raw": "Code   Product Name             Packing  LM   Opening  Receipts    Total    Sales  Closing    Closing AGE || SALE   Stock                                Stock      Value",
        "identifiers": [
            "CODE",
            "PRODUCT_NAME",
            "PACKING",
            "LM",
            "OPENING",
            "RECEIPTS",
            "TOTAL",
            "SALE",
            "SALES",
            "CLOSING",
            "CLOSING_AGE",
            "VALUE"
        ]
    },
    {
        "id": "H013",
        "raw": "ProductName                   Pack  OpStk   Rcpt PrvSa Sale Cl.St StockVal  SaleValue Orde",
        "identifiers": [
            "PRODUCTNAME",
            "PACK",
            "OPSTK",
            "SALE",
            "STOCKVAL",
            "SALEVALUE"
        ]
    },
    {
        "id": "H014",
        "raw": "Product Name                 Packing  O.Stk    Purc      Tot    LM2    LM1    Sale     Qoh        Value  Age",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "O_STK",
            "PURC",
            "TOT",
            "LM",
            "SALE",
            "QOH",
            "VALUE",
            "AGE"
        ]
    },
    {
        "id": "H015",
        "raw": "Divison\tItem Code\tItem Name\tPacksize\tP. Rate\tPTR\tOpening\tOpening Value\tPur. Qty\tPur. FQty\tRpl. Qty\tPur. Value\tPur. Ret. Qty\tPur. Ret. FQty\tSale Qty\tSale FQty\tSale Value\tSale Qty 1\tSale Qty 2\tSale Ret. Qty\tSale Ret. FQty\tOther Qty\tClosing\tClosing Amount(PTR)\tStock Amount(Pur. Rate)\tStatus",
        "identifiers": [
            "DIVISON",
            "ITEM_CODE",
            "ITEM_NAME",
            "PACKSIZE",
            "P_RATE",
            "PTR",
            "OPENING",
            "OPENING_VALUE",
            "PUR_QTY",
            "PUR_FQTY",
            "RPL_QTY",
            "PUR_VALUE",
            "PUR_RET_QTY",
            "PUR_RET_FQTY",
            "SALE_QTY",
            "SALE_FQTY",
            "SALE_VALUE",
            "SALE_QTY_1",
            "SALE_QTY_2",
            "SALE_RET_QTY",
            "SALE_RET_FQTY",
            "OTHER_QTY",
            "CLOSING",
            "CLOSING_AMOUNT_PTR",
            "STOCK_AMOUNT_PUR_RATE",
            "STATUS"
        ]
    },
    {
        "id": "H016",
        "raw": "Opening              -------- Sales Qty --------  Exp. Closing   Trans   Unit  --- Value -- || Product Name           Packing    Stock  Purch Free  Prev.   Last  Current  Free  Bro.   Stock    Qty    Rate  Sales  Stock",
        "identifiers": [
            "OPENING",
            "SALES",
            "QTY",
            "CLOSING",
            "VALUE",
            "PRODUCT_NAME",
            "PACKING",
            "PURC",
            "FREE"
        ]
    },
    {
        "id": "H017",
        "raw": "MEDICINE NAME      PACK    O.B  PURC TOTAL  PRTN L_SLE ADJ SALES FREE REPL    SAL.VAL CL.ST   CLST.VAL Ord.1 Ord.2",
        "identifiers": [
            "NAME",
            "PACK",
            "O_B",
            "PURC",
            "TOTAL",
            "ADJ",
            "SALES",
            "FREE",
            "REPL",
            "SAL_VAL"
        ]
    },
    {
        "id": "H018",
        "raw": "MEDICINE NAME      PACK    O.B  PURC TOTAL L_SLE ADJ SALES    SAL.VAL CL.ST   CLST.VAL",
        "identifiers": [
            "NAME",
            "PACK",
            "O_B",
            "PURC",
            "TOTAL",
            "ADJ",
            "SALES",
            "SAL_VAL"
        ]
    },
    {
        "id": "H019",
        "raw": "PRODUCT NAME      PACKG OPENING   RECEIPT  SALES RETAIL  CASH   CLO.STK    CLOSING   AGE || QTY    QTY  FREE  LAST  SALES SALES  QTY  FREE    VALUE   DAYS",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKG",
            "OPENING",
            "RECEIPT",
            "SALES",
            "O_STK",
            "CLOSING",
            "AGE",
            "QTY",
            "FREE",
            "VALUE",
            "DAY"
        ]
    },
    {
        "id": "H020",
        "raw": "Product Name         Packing  Op.Stk    P.Qtye    Tot    S.Qty    Qoh       Value  Age",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "OP_STK",
            "P_QTYE",
            "TOT",
            "S_QTY",
            "QOH",
            "VALUE",
            "AGE"
        ]
    },
    {
        "id": "H021",
        "raw": "PRODUCT NAME       PACKG OPENING  RECEIPT   <-----SALES---->  ADJMT   CLOSING  CLOSING AGE || QTY   QTY  FREE  LAST   QTY  FREE  STOCK  QTY  FREE  VALUE DAYS",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKG",
            "OPENING",
            "RECEIPT",
            "SALES",
            "ADJMT",
            "CLOSING",
            "CLOSING_AGE",
            "QTY",
            "FREE",
            "VALUE",
            "DAY"
        ]
    },
    {
        "id": "H022",
        "raw": "Description         Pack  hsncode Opening       Purchase       Sale       P.Re     S.Re         Adj.    Closing",
        "identifiers": [
            "PACK",
            "CODE",
            "OPENING",
            "PURCHASE",
            "SALE",
            "ADJ",
            "CLOSING"
        ]
    },
    {
        "id": "H024",
        "raw": "Product Name                Packing      O.Bal  Rcpts  Sal.Ret   Total   Sales  Pur.Ret    Total Cl.Bal Cl.Value  Age",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "O_BAL",
            "TOTAL",
            "SALES",
            "PUR_RET",
            "CL_BAL",
            "CL_VALUE",
            "AGE"
        ]
    },
    {
        "id": "H026",
        "raw": "SNo Particulars                OPstk   Pur StkIn Sale  UCS.  StkOt ClStk SaleValue  Stock Value",
        "identifiers": [
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
            "STOCK_VALUE"
        ]
    },
    {
        "id": "H027",
        "raw": "Code     Name                Prate OpStock       Purchase    Preturn     Sales       SValue SReturn Excess Short   ClStock     Cl Value || Qty    Free            Qty   Free                                Qty   Free",
        "identifiers": [
            "CODE",
            "NAME",
            "PRATE",
            "OP",
            "PURCHASE",
            "PRETURN",
            "SALES",
            "SVALUE",
            "VALUE",
            "SRETURN",
            "EXCESS",
            "SHORT",
            "CLSTOCK",
            "QTY",
            "FREE"
        ]
    },
    {
        "id": "H028",
        "raw": "PRODUCT NAME       PACKG SALES CLOSING DAY",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKG",
            "SALES",
            "CLOSING",
            "DAY"
        ]
    },
    {
        "id": "H029",
        "raw": "Product Name              Pack      O.Stk    Purc     Tot    Sale     Qoh        Value  Age",
        "identifiers": [
            "PRODUCT_NAME",
            "PACK",
            "O_STK",
            "PURC",
            "TOT",
            "SALE",
            "QOH",
            "VALUE",
            "AGE"
        ]
    },
    {
        "id": "H030",
        "raw": "Particulars               Pkg.       Op.Qty. Pr.Qty. Sl Ret  Sale    M.Out   Cl.Stk  Sal.Val Cl.Val",
        "identifiers": [
            "PARTICULARS",
            "PKG",
            "OP",
            "QTY",
            "PR_QTY",
            "SL_RET",
            "SALE",
            "M_OUT",
            "SAL_VAL"
        ]
    },
    {
        "id": "H031",
        "raw": "Product Name;Packing;Opening;Purchase;Sales;C.Stock;Expiry;Pr.Sale;",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "OPENING",
            "PURCHASE",
            "SALES",
            "C_STOCK",
            "EXPIRY",
            "PR_SALE"
        ]
    },
    {
        "id": "H032",
        "raw": "Product name             Packing   Opng.Bal <---Receipts---->   Totals <----------Issued--------->   <---Clos.Bal---->  Expirable Dump Q || Purchase  Others              Sales   Qty*Rate    Others      Qty Qty*Rate  180days   60Dys",
        "identifiers": [
            "PRODUCT_NAME",
            "PACKING",
            "OP",
            "RECEIPTS",
            "TOTAL",
            "PURCHASE",
            "SALES",
            "QTY",
            "DAY"
        ]
    },
    {
        "id": "H033",
        "raw": "Opening              -------- Sales Qty --------  Exp. Closing   Trans   Unit  --- Value -- || Product Name           Packing    Stock  Purch Free  Prev.   Last  Current  Free  Bro.   Stock    Qty    Rate  Sales  Stock || OPENING STOCK VALUE :   23245.64    PURCHASE..... VALUE :     737.00",
        "identifiers": [
            "OPENING",
            "SALES",
            "QTY",
            "CLOSING",
            "VALUE",
            "PRODUCT_NAME",
            "PACKING",
            "PURC",
            "FREE",
            "OPENING_STOCK",
            "PURCHASE"
        ]
    },
        {
        "id": "H034",
        "raw": "Product Name | Unit | Op.St | St-In | St-Out | Bal | Value",
        "identifiers": [
            "PRODUCT_NAME",
            "UNIT",
            "OP_ST",
            "ST_IN",
            "ST_OUT",
            "BAL",
            "VALUE"
        ]
    }    
];

function normalizeHeader(value) {
    return String(value || "").replace(/\u00A0/g," ").replace(/\r/g,"").replace(/\t/g," ").replace(/\s+/g," ").trim().toUpperCase();
}
function compactHeader(value) { return normalizeHeader(value).replace(/[^A-Z0-9;]+/g,""); }
function normalizeIdentifier(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g,""); }
function isSeparatorLine(line) { const t=String(line||"").trim(); return t!=="" && /^[-=_]{5,}$/.test(t); }
function isNoiseHeaderLine(line) {
    const t=String(line||"").trim();
    if(!t || isSeparatorLine(t)) return true;
    if(/^(STOCK\s*&\s*SALES|STOCK\s*&\s*SALES\s+STATEMENT|SALES\s+REPORT)\b/i.test(t)) return true;
    if(/^COMPANY\s+NAME\s*:/i.test(t)) return true;
    return false;
}

function identifierAliases(identifier) {
    const n=normalizeIdentifier(identifier), a=new Set([n]);
    const explicit={
        PRODUCT_NAME:["PRODUCTNAME","PRODUCT NAME"], PRODUCTNAME:["PRODUCTNAME","PRODUCT NAME"],
        PACKING:["PACKING","PACK"], PACKG:["PACKG"], PACK:["PACK"],
        OPENING_STOCK:["OPENING STOCK"], CLOSING_STOCK:["CLOSING STOCK"],
        O_STK:["O.STK","O STK","OSTK"], OP_STK:["OP.STK","OP STK","OPSTK"], OPSTK:["OPSTK","OP STK"],
        CURSTK:["CURSTK","CUR STK"], STKVAL:["STKVAL","STK VAL"],
        OPENING_VALUE:["OPENING VALUE"], CLOSING_AMOUNT_PTR:["CLOSING AMOUNT(PTR)","CLOSING AMOUNT PTR"],
        STOCK_AMOUNT_PUR_RATE:["STOCK AMOUNT(PUR. RATE)","STOCK AMOUNT PUR RATE"],
        C_STOCK:["C.STOCK","C STOCK"], PR_SALE:["PR.SALE","PR SALE"],
        LM_1:["LM 1","LM1"], LM_2:["LM 2","LM2"], ITEM_CODE:["ITEM CODE","ITEMCODE"],
        ITEM_NAME:["ITEM NAME","ITEMNAME"], CLSTOCK:["CLSTOCK","CL STOCK"],
        SALESVALUE:["SALESVALUE","SALES VALUE"], SALEVALUE:["SALEVALUE","SALE VALUE"],
        SAL_VAL:["SAL.VAL","SAL VAL"], STOCK_VALUE:["STOCK VALUE"], P_RATE:["P. RATE","P RATE"],
        PUR_QTY:["PUR. QTY","PUR QTY"], PUR_FQTY:["PUR. FQTY","PUR FQTY"],
        PUR_RET_QTY:["PUR. RET. QTY","PUR RET QTY"], PUR_RET_FQTY:["PUR. RET. FQTY","PUR RET FQTY"],
        SALE_QTY:["SALE QTY"], SALE_FQTY:["SALE FQTY"], SALE_VALUE:["SALE VALUE"],
        SALE_QTY_1:["SALE QTY 1"], SALE_QTY_2:["SALE QTY 2"],
        SALE_RET_QTY:["SALE RET. QTY","SALE RET QTY"], SALE_RET_FQTY:["SALE RET. FQTY","SALE RET FQTY"],
        CLOSING_AGE:["CLOSING AGE"], SNO:["SNO","SNO."], PARTICULARS:["PARTICULARS"]
    };
    for(const x of (explicit[identifier]||[])) a.add(normalizeIdentifier(x));
    return [...a];
}

function countIdentifierMatches(line, identifiers) {
    const c=compactHeader(line), n=normalizeIdentifier(line);
    let matched=0, matches=[];
    for(const id of identifiers) {
        let found=false;
        for(const alias of identifierAliases(id)) {
            if(alias && (c.includes(alias)||n.includes(alias))) { found=true; break; }
        }
        if(found) { matched++; matches.push(id); }
    }
    return {matched,matches};
}

function scoreStructure(line, structure) {

    const actual = normalizeHeader(line);
    const raw = normalizeHeader(structure.raw);

    /*
     * FIRST PRIORITY:
     * The Unique Structures sheet contains the physical raw
     * header for the structure. If the normalized physical header
     * is identical, this is a definitive match.
     */
    if (actual === raw) {
        return {
            score: 100000 + structure.identifiers.length * 100,
            exact: true,
            matched: structure.identifiers.slice(),
            ratio: 1,
            reason: "RAW_HEADER_EXACT"
        };
    }

    /*
     * SECOND PRIORITY:
     * Compare the header after removing all formatting
     * characters. This handles:
     *
     *   Product Name;Packing;Opening...
     *
     * versus the same header with different spacing/punctuation.
     */
    const actualCompact =
        normalizeIdentifier(line);

    const rawCompact =
        normalizeIdentifier(structure.raw);

    if (
        actualCompact &&
        rawCompact &&
        actualCompact === rawCompact
    ) {
        return {
            score: 95000 + structure.identifiers.length * 100,
            exact: true,
            matched: structure.identifiers.slice(),
            ratio: 1,
            reason: "RAW_HEADER_COMPACT_EXACT"
        };
    }

    /*
     * THIRD PRIORITY:
     * Identifier-level matching.
     *
     * Never use substring matching on the entire line for short
     * identifiers. Match aliases as complete header words/tokens.
     */
    const r =
        countIdentifierMatches(
            line,
            structure.identifiers
        );

    const total =
        structure.identifiers.length;

    const ratio =
        total
            ? r.matched / total
            : 0;

    let score =
        r.matched * 100;

    if (r.matched >= 4) {
        score += 100;
    }

    if (r.matched >= 6) {
        score += 200;
    }

    if (
        /PRODUCT\s*NAME|PRODUCTNAME|ITEM\s*NAME|ITEMNAME|DESCRIPTION|PARTICULARS|MEDICINE\s*NAME/i
            .test(line)
    ) {
        score += 150;
    }

    if (
        String(line).includes(";") &&
        String(structure.raw).includes(";")
    ) {
        score += 500;
    }

    /*
     * Automatic assignment must be conservative.
     */
    if (
        ratio < 0.50 ||
        r.matched < Math.min(4, total)
    ) {
        score = 0;
    }

    return {
        score,
        exact: false,
        matched: r.matches,
        ratio,
        reason: "IDENTIFIER_MATCH"
    };
}

function findPhysicalHeader(lines,detection) {
    const candidates=[];
    const ds =
        Math.max(
            0,
            Number(
                detection &&
                detection.headerStart ||
                1
            ) - 1
        );

    const de =
        Math.min(
            lines.length,
            Number(
                detection &&
                detection.headerEnd ||
                ds + 1
            )
        );

    const detectorDataStart =
        Number(
            detection &&
            (
                detection.dataStartsAt ??
                detection.dataStarts ??
                detection.dataStart
            )
        );

    /*
     * The detector's header block is authoritative as the search
     * window, but we allow a few following lines because some
     * existing detector variants end immediately before the
     * physical field header.
     */
    const end =
        Math.min(
            lines.length,
            Math.max(
                de,
                Number.isFinite(detectorDataStart) &&
                detectorDataStart > 0
                    ? detectorDataStart - 1
                    : de + 6
            )
        );
    for(let i=ds;i<end;i++) {
        const line=String(lines[i]||"");
        if(isNoiseHeaderLine(line)) continue;
        for(const structure of STRUCTURES) {
            const m=scoreStructure(line,structure);
            if(m.score>0) candidates.push({lineIndex:i,lineNumber:i+1,text:line,structure,...m});
        }
    }
    /*
     * CONSERVATIVE FALLBACK FOR REGISTERED MULTI-LINE HEADERS
     * ---------------------------------------------------------
     * Do not relax the existing structure matching rules.
     *
     * Some already-registered statements (notably H002) have a
     * physical header split across two consecutive lines. The
     * detector may identify the general report area correctly but
     * stop its physical-header window on the first line. In that
     * case the existing single-line comparison cannot see the
     * complete registered header.
     *
     * Only when the normal search produced no candidate do we make
     * this fallback. We scan adjacent physical lines and compare
     * their combined text against the EXISTING registered structure
     * header. No new structure, threshold relaxation, or generic
     * numeric inference is introduced.
     */
    if(!candidates.length) {
        for(let i=0; i<lines.length-1; i++) {
            const first=String(lines[i]||"");
            const second=String(lines[i+1]||"");
            if(isNoiseHeaderLine(first) && isNoiseHeaderLine(second)) continue;

            const combined = first + " " + second;

            for(const structure of STRUCTURES) {
                // This fallback is intentionally limited to structures
                // whose registered raw header explicitly contains the
                // multi-line separator used by the registry.
                if(!String(structure.raw||"").includes("||")) continue;

                const actualCompact = normalizeIdentifier(combined);
                const rawCompact = normalizeIdentifier(structure.raw);

                if(
                    actualCompact &&
                    rawCompact &&
                    actualCompact === rawCompact
                ) {
                    candidates.push({
                        lineIndex:i,
                        lineNumber:i+1,
                        text:combined,
                        structure,
                        score:95000 + structure.identifiers.length * 100,
                        exact:true,
                        matched:structure.identifiers.slice(),
                        ratio:1,
                        reason:"RAW_HEADER_MULTI_LINE_COMPACT_EXACT"
                    });
                }
            }

            if(candidates.length) break;
        }
    }

    candidates.sort((a,b)=>b.score-a.score||a.lineNumber-b.lineNumber);
    if(!candidates.length) return {success:false,message:"No registered single-row structure matched the physical header.",candidates:[]};
    const best=candidates[0];
    if(!best.exact && (best.ratio<0.75 || best.matched.length<4)) return {success:false,message:"Header candidate was not strong enough for a safe structure assignment.",candidates:candidates.slice(0,10)};
    return {success:true,...best,candidates:candidates.slice(0,10)};
}

function extractColumns(headerLine,structure) {
    const line=String(headerLine||"");

        // H034 - ARHAM PHARMACEUTICALS pipe-delimited header.
    // The product rows are fixed-width, without pipe delimiters.
    if (
        structure &&
        String(structure.id || "") === "H034"
    ) {
        const labels = [
            "Product Name",
            "Unit",
            "Op.St",
            "St-In",
            "St-Out",
            "Bal",
            "Value"
        ];

        const barPositions = [
            ...line.matchAll(/\|/g)
        ].map(match => match.index);

        if (barPositions.length !== 7) {
            return [];
        }

        const starts = [
            0,
            ...barPositions
                .slice(0, 6)
                .map(position => position + 1)
        ];

        return labels.map((label, index) => ({
            index,
            header: label,
            normalized: normalizeIdentifier(label),
            position: starts[index],
            end: starts[index + 1] ?? null
        }));
    }
    
    /*
     * H010 is a fixed-width header whose labels are separated by
     * single spaces. The generic whitespace parser cannot safely
     * identify all fields.
     *
     * IMPORTANT:
     * We use the actual physical positions in the H010 header.
     * Script 2 can then slice each data row using these boundaries.
     */
    if (
        structure &&
        String(structure.id || "") === "H010"
    ) {
        const labels = [
            "Product Name",
            "Pack",
            "LstSL",
            "Open",
            "Recd.",
            "Sales",
            "Close",
            "Order",
            "Pend",
            "Stk.Value"
        ];

        const columns = [];
        let cursor = 0;

        for (const label of labels) {
            const position = line.indexOf(label, cursor);

            if (position < 0) {
                return [];
            }

            columns.push({
                index: columns.length,
                header: label,
                normalized: normalizeIdentifier(label),
                position,
                end: position + label.length
            });

            cursor = position + label.length;
        }

        return columns;
    }

    /*
     * TAB-SEPARATED HEADERS
     * ---------------------
     * A TAB is a real physical column boundary in TXT statements.
     * Preserve each TAB-delimited field as its own physical column.
     * This branch must run before the generic whitespace parser.
     */
    if(line.includes("\t")) {
        const columns=[]; let cursor=0;
        const parts=line.split("\t");

        for(const part of parts) {
            const text=part.trim();
            const start=cursor;
            const end=start+part.length;

            columns.push({
                index:columns.length,
                header:text,
                normalized:normalizeIdentifier(text),
                position:start,
                end
            });

            cursor=end+1;
        }

        return columns;
    }

    if(line.includes(";")) {
        const columns=[]; let cursor=0;
        for(const part of line.split(";")) {
            const text=part.trim(); if(!text){cursor+=part.length+1;continue;}
            const start=line.indexOf(part,cursor), position=start>=0?start:cursor;
            columns.push({index:columns.length,header:text,normalized:normalizeIdentifier(text),position,end:position+part.length});
            cursor=position+part.length+1;
        }
        return columns;
    }

    const columns=[]; const re=/\S(?:.*?\S)?(?=\s{2,}|$)/g; let m;
    while((m=re.exec(line))!==null) {
        const text=m[0].trim(); if(!text) continue;
        columns.push({index:columns.length,header:text,normalized:normalizeIdentifier(text),position:m.index,end:m.index+text.length});
    }
    return columns;
}

function determineDataStart(lines,headerLineNumber,detection) {
    const detected=Number(detection&&(detection.dataStartsAt??detection.dataStarts??detection.dataStart));
    if(Number.isInteger(detected)&&detected>headerLineNumber&&detected<=lines.length+1) return detected;
    for(let i=headerLineNumber;i<lines.length;i++) {
        const t=String(lines[i]||"").trim();
        if(!t||isSeparatorLine(t)) continue;
        if(/[A-Za-z]/.test(t)&&/[-+]?\d+(?:\.\d+)?/.test(t)) return i+1;
    }
    return headerLineNumber+1;
}

function extractSingleRowHeader(filePath) {
    try {
        const absolutePath=path.resolve(filePath);
        if(!fs.existsSync(absolutePath)) return {success:false,message:"TXT file not found.",filePath:absolutePath};
        const reader=readTXT(absolutePath);
        if(!reader||!reader.success) return {success:false,message:"TXT Reader failed.",reader};
        const detection=detectTXTHeader(reader);
        if(!detection||!detection.success) return {success:false,message:"TXT Header Detector failed.",detection};
        const physical=findPhysicalHeader(reader.lines,detection);
        if(!physical.success) return {success:false,message:physical.message,detection,candidates:physical.candidates};
        const columns=extractColumns(physical.text,physical.structure);
        const dataStart=determineDataStart(reader.lines,physical.lineNumber,detection);
        return {
            success:true,file:path.basename(absolutePath),structure:physical.structure.id,
            header:{lineNumber:physical.lineNumber,text:physical.text,score:physical.score,exact:physical.exact,structure:physical.structure.id,columns},
            dataStart,
            detection:{detection:detection.detection,headerStart:detection.headerStart,headerEnd:detection.headerEnd,detectorDataStart:detection.dataStartsAt??detection.dataStarts??detection.dataStart,confidence:detection.confidence},
            mapping:{structureId:physical.structure.id,identifiers:physical.structure.identifiers.slice(),matchedIdentifiers:(physical.matchedIdentifiers || physical.matched || []).slice()}
        };
    } catch(error) { return {success:false,message:error.message,error:error.stack}; }
}

module.exports={extractSingleRowHeader,normalizeHeader,compactHeader,normalizeIdentifier,findPhysicalHeader,extractColumns,determineDataStart,STRUCTURES};
