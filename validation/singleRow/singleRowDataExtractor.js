/**
 * ============================================================
 * SINGLE ROW TXT DATA EXTRACTOR
 * ============================================================
 *
 * SCRIPT 2
 *
 * Depends on:
 *   singleRowHeaderExtractor.js
 *
 * Purpose:
 *   - Detect header using Script 1
 *   - Extract product/packing text
 *   - Extract numeric values directly from each data row
 *   - Preserve exact numeric meaning/order from source
 *   - Do NOT calculate values
 *   - Do NOT map common fields yet
 *   - H007/OM Distributor headers are mapped from all detected source labels,
 *     including ITEM NAME, BOX, PACK, OPQTY, P_QTY, REPL, S_QTY and B_QTY.
 *
 * IMPORTANT:
 *   Header establishes the column ORDER.
 *   Data rows provide the actual values.
 *
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const {
    extractSingleRowHeader,
    STRUCTURES
} = require("./singleRowHeaderExtractor");

// ============================================================
// NUMERIC TOKEN
// ============================================================

function isNumericToken(value) {

    const text =
        String(value ?? "")
            .trim()
            .replace(/,/g, "");

    return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text);
}

// ============================================================
// PARSE NUMERIC
// ============================================================

function parseNumeric(value) {

    const text =
        String(value ?? "")
            .trim()
            .replace(/,/g, "");

    if (!isNumericToken(text)) {
        return null;
    }

    return Number(text);
}

// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(value) {

    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/\u0000/g, "")
        .trim();
}

// ============================================================
// GET NON-BLANK TOKENS
// ============================================================

function tokenizeDataLine(line) {

    const text =
        String(line ?? "");

    const tokens = [];

    const regex = /\S+/g;

    let match;

    while ((match = regex.exec(text)) !== null) {

        tokens.push({
            text: match[0],
            start: match.index,
            end:
                match.index +
                match[0].length
        });
    }

    return tokens;
}

// ============================================================
// FIND NUMERIC TOKENS
// ============================================================

function getNumericTokens(line) {

    return tokenizeDataLine(line)
        .filter(token =>
            isNumericToken(token.text)
        )
        .map(token => ({
            ...token,
            value:
                parseNumeric(token.text)
        }));
}

// ============================================================
// HEADER FORMAT HELPERS
// ============================================================

function normalizeHeaderName(value) {
    return String(value ?? "")
        .toUpperCase()
        .replace(/[.,:;()[\]{}]/g, "")
        .replace(/\s+/g, "")
        .trim();
}

/*
 * ============================================================
 * STRUCTURE-BASED DISPATCH
 * ============================================================
 *
 * Script 1 is now the authority for structure selection.
 * Do not depend on generic header tokenization for dispatch.
 *
 * H009/H028 contain adjacent header labels whose whitespace
 * cannot reliably be used to split the physical header.
 * Their known structure definitions therefore supply the
 * authoritative field positions when required.
 * ============================================================
 */

function getDetectedStructureId(headerResult) {
    return String(
        headerResult?.structure ||
        headerResult?.mapping?.structureId ||
        headerResult?.header?.structure ||
        ""
    ).trim();
}

function getStructureDefinition(structureId) {
    if (!Array.isArray(STRUCTURES)) {
        return null;
    }

    return (
        STRUCTURES.find(
            structure =>
                String(structure?.id || "") === structureId
        ) || null
    );
}

function buildStructureColumns(structureId, header) {
    const definition =
        getStructureDefinition(structureId);

    if (!definition || !definition.raw) {
        return Array.isArray(header?.columns)
            ? header.columns
            : [];
    }

    const raw =
        String(definition.raw);

    const identifiers =
        Array.isArray(definition.identifiers)
            ? definition.identifiers
            : [];

    const aliases = {
        // Generic / common structures
        PRODUCT_NAME: ["PRODUCT NAME", "PRODUCTNAME"],
        ITEMNAME: ["ITEM NAME", "ITEMNAME"],
        ITEM_NAME: ["ITEM NAME", "ITEMNAME"],
        BOX: ["BOX"],
        PACK: ["PACK"],
        PACKG: ["PACKG"],
        OPQTY: ["OPQTY", "OP QTY"],
        P_QTY: ["P_QTY", "P QTY"],
        REPL: ["REPL"],
        S_QTY: ["S.QTY", "S QTY", "S_QTY", "SQTY"],
        B_QTY: ["B_QTY", "B QTY"],

        // H010 fixed-width stock/sales fields
        LSTSL: ["LSTSL"],
        OPEN: ["OPEN"],
        RECD: ["RECD"],
        CLOSE: ["CLOSE"],
        ORDER: ["ORDER"],
        PEND: ["PEND"],

        OPSTK: ["OPSTK"],
        PUR: ["PUR"],
        SALE: ["SALE"],
        CURSTK: ["CURSTK"],
        STKVAL: ["STKVAL"],
        SALES: ["SALES"],
        CLOSING: ["CLOSING"],
        DAY: ["DAY"],
        PACKING: ["PACKING"],
        OPENING: ["OPENING"],
        PURCHASE: ["PURCHASE"],
        O_STK: ["O.STK", "O STK", "OSTK"],
        OP_STK: ["OP.STK", "OP STK", "OPSTK", "O.PSTK"],
        P_QTYE: ["P.QTYE", "P QTYE", "PQTYE"],
        PURC: ["PURC"],
        TOT: ["TOT"],
        QOH: ["QOH"],
        VALUE: ["VALUE"],
        AGE: ["AGE"],
        C_STOCK: ["C.STOCK"],
        EXPIRY: ["EXPIRY"],
        PR_SALE: ["PR.SALE"],

        // H017 fixed-width fields
        MEDICINENAME: ["MEDICINE NAME", "MEDICINENAME"],
        OB: ["O.B", "OB"],
        TOTAL: ["TOTAL"],
        PRTN: ["PRTN"],
        LSLE: ["L_SLE", "L SLE"],
        ADJ: ["ADJ"],
        FREE: ["FREE"],
        SALVAL: ["SAL.VAL", "SAL VAL"],
        CLST: ["CL.ST", "CL ST"],
        CLSTVAL: ["CLST.VAL", "CLST VAL"],
        ORD1: ["Ord.1", "ORD.1"],
        ORD2: ["Ord.2", "ORD.2"]
    };

    const columns = [];
    const usedRanges = [];

    for (let index = 0; index < identifiers.length; index++) {
        const identifier =
            identifiers[index];

        const candidates =
            aliases[identifier] || [];

        let position = -1;
        let matchedText = "";

        for (const candidate of candidates) {
            const candidatePosition =
                raw.toUpperCase().indexOf(
                    candidate.toUpperCase()
                );

            if (
                candidatePosition >= 0 &&
                (
                    position < 0 ||
                    candidatePosition < position
                )
            ) {
                position = candidatePosition;
                matchedText = candidate;
            }
        }

        if (position < 0) {
            continue;
        }

        /*
         * If the same token text can occur more than once,
         * choose the next unused occurrence.
         */
        const prior =
            usedRanges.filter(
                range =>
                    range.position === position
            );

        if (prior.length) {
            continue;
        }

        usedRanges.push({
            position
        });

        columns.push({
            index,
            header:
                matchedText || identifier,
            normalized:
                normalizeHeaderName(
                    matchedText || identifier
                ),
            position,
            end:
                position +
                String(
                    matchedText || identifier
                ).length
        });
    }

    /*
     * Keep the actual header text supplied by Script 1 for
     * the product field where possible.
     */
    if (
        Array.isArray(header?.columns) &&
        header.columns.length
    ) {
        const product =
            header.columns.find(
                column =>
                    normalizeHeaderName(column.header) ===
                    "PRODUCTNAME"
            );

        const generatedProduct =
            columns.find(
                column =>
                    normalizeHeaderName(column.header) ===
                    "PRODUCTNAME"
            );

        if (product && generatedProduct) {
            generatedProduct.header =
                product.header;
            generatedProduct.normalized =
                product.normalized;
        }
    }

    return columns.sort(
        (a, b) =>
            a.position - b.position
    );
}

function prepareHeaderForStructure(
    headerResult
) {
    const structureId =
        getDetectedStructureId(
            headerResult
        );

    const header =
        headerResult?.header;

    const structureColumns =
        buildStructureColumns(
            structureId,
            header
        );

    return {
        ...(header || {}),
        structure: structureId,
        columns:
            structureColumns.length
                ? structureColumns
                : (header?.columns || [])
    };
}


// ============================================================
// H006 - ITEMCODE / ITEMNAME / CLOSING STOCK FORMAT
// ============================================================
//
// H006 source header:
//
// ITEMCODE  ITEMNAME                   CLSTOCK     CLVALUE
// SALES          SALESVALUE    LM 1 LM 2
//
// Actual H006 data rows contain no ITEMCODE value. The product text
// occupies the left side of the row, followed by six numeric source
// fields:
//
//   CLSTOCK | CLVALUE | SALES | SALESVALUE | LM 1 | LM 2
//
// IMPORTANT:
// - Do NOT tokenize the product name to find numeric fields.
// - Product text is isolated using the known H006 data boundary.
// - The four trailing LM characters are parsed only inside the LM
//   field area, never from the product text.
// - TOTAL / summary rows are excluded.
// ============================================================

function buildH006Header(headerResult) {

    const sourceHeader =
        String(
            headerResult?.header?.text ||
            "ITEMCODE  ITEMNAME                   CLSTOCK     CLVALUE     SALES          SALESVALUE    LM 1 LM 2"
        );

    return {
        success: true,
        sourceHeader,
        lineNumber:
            headerResult?.header?.lineNumber ??
            null,
        structure: "H006",
        columns: [
            {
                index: 0,
                header: "ITEMCODE",
                normalized: "ITEMCODE",
                position: 0,
                end: 8
            },
            {
                index: 1,
                header: "ITEMNAME",
                normalized: "ITEMNAME",
                position: 10,
                end: 18
            },
            {
                index: 2,
                header: "CLSTOCK",
                normalized: "CLSTOCK",
                position: 37,
                end: 44
            },
            {
                index: 3,
                header: "CLVALUE",
                normalized: "CLVALUE",
                position: 49,
                end: 56
            },
            {
                index: 4,
                header: "SALES",
                normalized: "SALES",
                position: 61,
                end: 66
            },
            {
                index: 5,
                header: "SALESVALUE",
                normalized: "SALESVALUE",
                position: 76,
                end: 86
            },
            {
                index: 6,
                header: "LM 1",
                normalized: "LM1",
                position: 90,
                end: 94
            },
            {
                index: 7,
                header: "LM 2",
                normalized: "LM2",
                position: 95,
                end: 99
            }
        ]
    };
}


function buildH006ItemCodeHeader(headerResult) {
    return {
        success: true,
        sourceHeader:
            String(
                headerResult?.header?.text ||
                "ITEMCODE  ITEMNAME                   CLSTOCK     CLVALUE     SALES SALESVALUE       LM 1    LM 2"
            ),
        lineNumber:
            headerResult?.header?.lineNumber ??
            null,
        structure: "H006",
        columns: [
            {
                index: 0,
                header: "ITEMCODE",
                normalized: "ITEMCODE",
                position: 0,
                end: 10
            },
            {
                index: 1,
                header: "ITEMNAME",
                normalized: "ITEMNAME",
                position: 10,
                end: 42
            },
            {
                index: 2,
                header: "CLSTOCK",
                normalized: "CLSTOCK",
                position: 42,
                end: 49
            },
            {
                index: 3,
                header: "CLVALUE",
                normalized: "CLVALUE",
                position: 49,
                end: 61
            },
            {
                index: 4,
                header: "SALES",
                normalized: "SALES",
                position: 61,
                end: 70
            },
            {
                index: 5,
                header: "SALESVALUE",
                normalized: "SALESVALUE",
                position: 70,
                end: 84
            },
            {
                index: 6,
                header: "LM 1",
                normalized: "LM1",
                position: 84,
                end: 92
            },
            {
                index: 7,
                header: "LM 2",
                normalized: "LM2",
                position: 92,
                end: 99
            }
        ]
    };
}

function isH006ItemCodeDataRow(line) {
    const text = String(line ?? "");

    if (!text.trim()) {
        return false;
    }

    /*
     * US PHARMA H006 rows have a populated seven-digit ITEMCODE.
     * The ITEMCODE occupies the physical left-side source column.
     */
    return /^\s*\d{7}\s{2,}/.test(text);
}

function extractH006ItemCodeRow(
    line,
    header,
    rowNumber
) {
    const text = String(line ?? "");

    if (!isH006ItemCodeDataRow(text)) {
        return null;
    }

    const itemCode =
        cleanText(text.slice(0, 10));

    const itemName =
        cleanText(text.slice(10, 42));

    const clStockRaw =
        cleanText(text.slice(42, 49));

    const clValueRaw =
        cleanText(text.slice(49, 61));

    const salesRaw =
        cleanText(text.slice(61, 70));

    const salesValueRaw =
        cleanText(text.slice(70, 84));

    const lm1Raw =
        cleanText(text.slice(84, 92));

    const lm2Raw =
        cleanText(text.slice(92));

    if (
        !itemCode ||
        !itemName ||
        !isNumericToken(clStockRaw) ||
        !isNumericToken(clValueRaw) ||
        !isNumericToken(salesRaw) ||
        !isNumericToken(salesValueRaw) ||
        !isNumericToken(lm1Raw) ||
        !isNumericToken(lm2Raw)
    ) {
        return null;
    }

    const rawValues = {
        "ITEMCODE": itemCode,
        "ITEMNAME": itemName,
        "CLSTOCK": clStockRaw,
        "CLVALUE": clValueRaw,
        "SALES": salesRaw,
        "SALESVALUE": salesValueRaw,
        "LM 1": lm1Raw,
        "LM 2": lm2Raw
    };

    const values = {
        "ITEMCODE": itemCode,
        "ITEMNAME": itemName,
        "CLSTOCK": parseSourceValue(clStockRaw),
        "CLVALUE": parseSourceValue(clValueRaw),
        "SALES": parseSourceValue(salesRaw),
        "SALESVALUE": parseSourceValue(salesValueRaw),
        "LM 1": parseSourceValue(lm1Raw),
        "LM 2": parseSourceValue(lm2Raw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 6,
        expectedNumericCount: 6,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function extractH006ItemCodeWrappedRow(
    firstLine,
    continuationLine,
    header,
    rowNumber
) {
    const first =
        String(firstLine ?? "");

    const continuation =
        String(continuationLine ?? "");

    if (!isH006ItemCodeDataRow(first)) {
        return null;
    }

    /*
     * US PHARMA can wrap a long ITEMNAME onto the following physical
     * line. In that case the continuation line contains the Packing
     * portion at the normal ITEMNAME boundary and all numeric fields
     * at their normal source positions.
     *
     * Merge only the source fields. Do not concatenate the physical
     * lines because that would shift the numeric column positions.
     */
    const itemCode =
        cleanText(first.slice(0, 10));

    const firstItemNamePart =
        cleanText(first.slice(10));

    const continuationItemNamePart =
        cleanText(continuation.slice(31, 42));

    const itemName =
        cleanText(
            [
                firstItemNamePart,
                continuationItemNamePart
            ]
                .filter(Boolean)
                .join(" ")
        );

    const clStockRaw =
        cleanText(continuation.slice(42, 49));

    const clValueRaw =
        cleanText(continuation.slice(49, 61));

    const salesRaw =
        cleanText(continuation.slice(61, 70));

    const salesValueRaw =
        cleanText(continuation.slice(70, 84));

    const lm1Raw =
        cleanText(continuation.slice(84, 92));

    const lm2Raw =
        cleanText(continuation.slice(92));

    if (
        !itemCode ||
        !itemName ||
        !isNumericToken(clStockRaw) ||
        !isNumericToken(clValueRaw) ||
        !isNumericToken(salesRaw) ||
        !isNumericToken(salesValueRaw) ||
        !isNumericToken(lm1Raw) ||
        !isNumericToken(lm2Raw)
    ) {
        return null;
    }

    const rawValues = {
        "ITEMCODE": itemCode,
        "ITEMNAME": itemName,
        "CLSTOCK": clStockRaw,
        "CLVALUE": clValueRaw,
        "SALES": salesRaw,
        "SALESVALUE": salesValueRaw,
        "LM 1": lm1Raw,
        "LM 2": lm2Raw
    };

    const values = {
        "ITEMCODE": itemCode,
        "ITEMNAME": itemName,
        "CLSTOCK": parseSourceValue(clStockRaw),
        "CLVALUE": parseSourceValue(clValueRaw),
        "SALES": parseSourceValue(salesRaw),
        "SALESVALUE": parseSourceValue(salesValueRaw),
        "LM 1": parseSourceValue(lm1Raw),
        "LM 2": parseSourceValue(lm2Raw)
    };

    return {
        rowNumber,
        rawLine: `${firstLine}\n${continuationLine}`,
        numericTokenCount: 6,
        expectedNumericCount: 6,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function isH006TotalOrSummary(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return false;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^CLVALUE\b/.test(text) ||
        /^SALESVALUE\b/.test(text) ||
        /^LM\s*1\b/.test(text)
    );
}

function isH006DataRow(line) {

    const text =
        String(line ?? "");

    if (!text.trim()) {
        return false;
    }

    if (isH006TotalOrSummary(text)) {
        return false;
    }

    /*
     * H006 product text occupies the left side of the report.
     * A genuine product row therefore has non-blank content before
     * the first numeric source field.
     *
     * This boundary is deliberately fixed for this known structure.
     * It prevents numeric values embedded in Product Name from being
     * interpreted as data columns.
     */
    const productArea =
        cleanText(
            text.slice(0, 42)
        );

    if (!productArea) {
        return false;
    }

    /*
     * Require the first four numeric source fields in their known
     * physical regions. This rejects footer/summary lines while
     * keeping Product Name completely outside numeric parsing.
     */
    const clStock =
        cleanText(text.slice(42, 48));

    const clValue =
        cleanText(text.slice(48, 61));

    const sales =
        cleanText(text.slice(61, 76));

    const salesValue =
        cleanText(text.slice(76, 92));

    return (
        isNumericToken(clStock) &&
        isNumericToken(clValue) &&
        isNumericToken(sales) &&
        isNumericToken(salesValue)
    );
}

function extractH006Row(
    line,
    header,
    rowNumber
) {

    const text =
        String(line ?? "");

    /*
     * Product is isolated before the known CLSTOCK data boundary.
     * This is the critical protection against numbers inside names
     * such as 15GM / 30GM being treated as stock data.
     */
    const product =
        cleanText(
            text.slice(0, 42)
        );

    if (!product) {
        return null;
    }

    const clStockRaw =
        cleanText(
            text.slice(42, 48)
        );

    const clValueRaw =
        cleanText(
            text.slice(48, 61)
        );

    const salesRaw =
        cleanText(
            text.slice(61, 76)
        );

    const salesValueRaw =
        cleanText(
            text.slice(76, 92)
        );

    if (
        !isNumericToken(clStockRaw) ||
        !isNumericToken(clValueRaw) ||
        !isNumericToken(salesRaw) ||
        !isNumericToken(salesValueRaw)
    ) {
        return null;
    }

    /*
     * LM 1 and LM 2 occupy the final four-character source area.
     *
     * Some rows print them adjacent:
     *   1014
     *   3231
     *
     * while other rows print them with whitespace:
     *   7 1
     *
     * Parse only this already-isolated LM area.
     */
    const lmArea =
        text.slice(92).trim();

    let lm1Raw = "";
    let lm2Raw = "";

    const lmTokens =
        lmArea
            .split(/\s+/)
            .filter(Boolean);

    if (lmTokens.length >= 2) {

        lm1Raw = lmTokens[0];
        lm2Raw = lmTokens[1];

    } else if (
        lmArea.length >= 4
    ) {

        lm1Raw =
            lmArea.slice(
                0,
                2
            );

        lm2Raw =
            lmArea.slice(
                2,
                4
            );

    } else {

        return null;
    }

    if (
        !isNumericToken(lm1Raw) ||
        !isNumericToken(lm2Raw)
    ) {
        return null;
    }

    const rawValues = {
        "ITEMCODE": null,
        "ITEMNAME": product,
        "CLSTOCK": clStockRaw,
        "CLVALUE": clValueRaw,
        "SALES": salesRaw,
        "SALESVALUE": salesValueRaw,
        "LM 1": lm1Raw,
        "LM 2": lm2Raw
    };

    const values = {
        "ITEMCODE": null,
        "ITEMNAME": product,
        "CLSTOCK": parseSourceValue(clStockRaw),
        "CLVALUE": parseSourceValue(clValueRaw),
        "SALES": parseSourceValue(salesRaw),
        "SALESVALUE": parseSourceValue(salesValueRaw),
        "LM 1": parseSourceValue(lm1Raw),
        "LM 2": parseSourceValue(lm2Raw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 6,
        expectedNumericCount: 6,
        numericCountMatches: true,
        rawValues,
        values
    };
}


// ============================================================

// ============================================================
// H013 - SRI VENKATESWARA PHARMA / TN485
// ============================================================
//
// IMPORTANT:
// - H013 is a fixed-width / physically structured statement.
// - The source row already contains its columns in fixed positions.
// - Product Name is isolated before any numeric parsing.
// - Numbers inside Product Name or Pack are NEVER treated as data.
// - Blank source numeric cells are valid and are preserved as null.
// - No values are calculated or inferred.
// - This branch is H013-only and is intentionally kept separate from
//   the existing generic extractor and all existing structure branches.
//
// Physical source fields:
//
// ProductName | Pack | OpStk | Rcpt | PrvSa | Sale | Cl.St |
// StockVal | SaleValue | Orde
//
// Physical positions established from the H013 source header:
//   ProductName : variable; separated from Pack using source spacing
//   Pack        : variable within the first 36 columns
//   OpStk       : 36 - 44
//   Rcpt        : 44 - 49
//   PrvSa       : 49 - 55
//   Sale        : 55 - 60
//   Cl.St       : 60 - 66
//   StockVal    : 66 - 76
//   SaleValue   : 76 - 86
//   Orde        : 86 - end
//
// ============================================================

function buildH013Header(headerResult) {

    const detectedHeader =
        String(
            headerResult?.header?.text ||
            "ProductName                   Pack  OpStk   Rcpt PrvSa Sale Cl.St StockVal  SaleValue Orde"
        );

    return {
        success: true,
        sourceHeader: detectedHeader,
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H013",
        columns: [
            {
                index: 0,
                header: "ProductName",
                normalized: "PRODUCTNAME",
                position: 0,
                end: 30
            },
            {
                index: 1,
                header: "Pack",
                normalized: "PACK",
                position: 30,
                end: 36
            },
            {
                index: 2,
                header: "OpStk",
                normalized: "OPSTK",
                position: 36,
                end: 44
            },
            {
                index: 3,
                header: "Rcpt",
                normalized: "RCPT",
                position: 44,
                end: 49
            },
            {
                index: 4,
                header: "PrvSa",
                normalized: "PRVSA",
                position: 49,
                end: 55
            },
            {
                index: 5,
                header: "Sale",
                normalized: "SALE",
                position: 55,
                end: 60
            },
            {
                index: 6,
                header: "Cl.St",
                normalized: "CLST",
                position: 60,
                end: 66
            },
            {
                index: 7,
                header: "StockVal",
                normalized: "STOCKVAL",
                position: 66,
                end: 76
            },
            {
                index: 8,
                header: "SaleValue",
                normalized: "SALEVALUE",
                position: 76,
                end: 86
            },
            {
                index: 9,
                header: "Orde",
                normalized: "ORDE",
                position: 86,
                end: null
            }
        ]
    };
}

function isH013SummaryRow(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^OP\.STK\.VAL\b/.test(text) ||
        /^PAGE\s*[:\-]?\s*\d+\b/.test(text)
    );
}

function isH013Separator(line) {

    const text =
        String(line ?? "")
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();

    return /^[=\-_*]{5,}$/.test(text);
}

function h013SourceValue(value) {

    const text =
        cleanText(value);

    if (!text) {
        return null;
    }

    return isNumericToken(text)
        ? parseSourceValue(text)
        : text;
}

function splitH013SourceColumns(line) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return null;
    }

    /*
     * H013 is a fixed-width / physically structured statement.
     *
     * IMPORTANT:
     * - Do NOT tokenize the complete row.
     * - ProductName and Pack are separated from the source layout.
     * - Numeric-looking text inside ProductName is NEVER treated as
     *   a numeric data field.
     * - The numeric source columns remain at their established
     *   physical positions.
     *
     * H013 source header:
     *
     * ProductName                   Pack  OpStk   Rcpt PrvSa Sale Cl.St
     * StockVal  SaleValue Orde
     *
     * The ProductName -> Pack boundary can vary slightly between rows.
     * Examples:
     *
     *   ACNESTAL 5.5 SOAP             75GM
     *   PSORAXIB  CLEANSER          150 ML
     *   PSORAXIB LOTION              150ML
     *
     * Therefore ProductName/Pack are located from the whitespace
     * separator immediately before the Pack field, while the numeric
     * fields continue to use the known H013 physical positions.
     */

    const numericStart = 36;
    const prefix = text.slice(0, numericStart);

    /*
     * Find candidate ProductName -> Pack separators.
     *
     * We use the LAST suitable separator before the numeric area.
     * This is intentional: the ProductName itself may contain multiple
     * spaces, e.g. "PSORAXIB  CLEANSER".
     *
     * The candidate Pack must contain text and must end before the
     * numeric area begins.
     */
    const separators =
        [...prefix.matchAll(/\s{2,}/g)];

    let packStart = -1;

    for (let i = separators.length - 1; i >= 0; i--) {

        const separator = separators[i];

        const separatorStart =
            Number(separator.index);

        const separatorEnd =
            separatorStart +
            String(separator[0]).length;

        const candidatePack =
            prefix
                .slice(separatorEnd)
                .trim();

        if (!candidatePack) {
            continue;
        }

        /*
         * Pack may itself contain one internal space, for example
         * "150 ML" or "30 GM".
         *
         * Reject a candidate if it would consume the numeric area.
         */
        const candidatePackStart =
            separatorEnd;

        const candidatePackEnd =
            candidatePackStart +
            candidatePack.length;

        if (candidatePackEnd > numericStart) {
            continue;
        }

        packStart = separatorStart;
        break;
    }

    if (packStart < 0) {
        return null;
    }

    const productName =
        cleanText(
            text.slice(0, packStart)
        );

    const pack =
        cleanText(
            text.slice(
                packStart,
                numericStart
            )
        );

    if (!productName || !pack) {
        return null;
    }

    return {
        productName,
        pack,

        /*
         * Existing H013 numeric source positions are preserved exactly.
         */
        opStk: cleanText(
            text.slice(36, 44)
        ),
        rcpt: cleanText(
            text.slice(44, 49)
        ),
        prvSa: cleanText(
            text.slice(49, 55)
        ),
        sale: cleanText(
            text.slice(55, 60)
        ),
        clSt: cleanText(
            text.slice(60, 66)
        ),
        stockVal: cleanText(
            text.slice(66, 76)
        ),
        saleValue: cleanText(
            text.slice(76, 86)
        ),
        orde: cleanText(
            text.slice(86)
        )
    };
}

function isH013DataRow(line) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return false;
    }

    if (
        isH013SummaryRow(text) ||
        isH013Separator(text)
    ) {
        return false;
    }

    const fields =
        splitH013SourceColumns(text);

    if (!fields || !fields.productName || !fields.pack) {
        return false;
    }

    /*
     * Empty source cells are legitimate in H013.
     *
     * Only a non-empty source field is required to be numeric.
     * This is what allows rows such as:
     *
     *   ACTIVE MF CREAM             100GM      4                       4
     *
     * to remain valid records instead of being discarded.
     */
    const numericFields = [
        fields.opStk,
        fields.rcpt,
        fields.prvSa,
        fields.sale,
        fields.clSt,
        fields.stockVal,
        fields.saleValue,
        fields.orde
    ];

    return numericFields.every(
        value =>
            value === "" ||
            isNumericToken(value)
    );
}

function extractH013Row(
    line,
    header,
    rowNumber
) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (
        !text.trim() ||
        isH013SummaryRow(text) ||
        isH013Separator(text)
    ) {
        return null;
    }

    const fields =
        splitH013SourceColumns(text);

    if (!fields || !fields.productName || !fields.pack) {
        return null;
    }

    const numericFields = [
        fields.opStk,
        fields.rcpt,
        fields.prvSa,
        fields.sale,
        fields.clSt,
        fields.stockVal,
        fields.saleValue,
        fields.orde
    ];

    if (
        !numericFields.every(
            value =>
                value === "" ||
                isNumericToken(value)
        )
    ) {
        return null;
    }

    const rawValues = {
        "ProductName": fields.productName,
        "Pack": fields.pack,
        "OpStk": fields.opStk,
        "Rcpt": fields.rcpt,
        "PrvSa": fields.prvSa,
        "Sale": fields.sale,
        "Cl.St": fields.clSt,
        "StockVal": fields.stockVal,
        "SaleValue": fields.saleValue,
        "Orde": fields.orde
    };

    const values = {
        "ProductName": fields.productName,
        "Pack": fields.pack,
        "OpStk": h013SourceValue(fields.opStk),
        "Rcpt": h013SourceValue(fields.rcpt),
        "PrvSa": h013SourceValue(fields.prvSa),
        "Sale": h013SourceValue(fields.sale),
        "Cl.St": h013SourceValue(fields.clSt),
        "StockVal": h013SourceValue(fields.stockVal),
        "SaleValue": h013SourceValue(fields.saleValue),
        "Orde": h013SourceValue(fields.orde)
    };

    const numericTokenCount =
        numericFields.filter(
            value => value !== ""
        ).length;

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount,
        expectedNumericCount: 8,
        numericCountMatches: true,
        rawValues,
        values
    };
}

// H014 - VASU MEDICAL ENTERPRISES FIXED-WIDTH STOCK / SALES
// ============================================================
//
// Source header:
//
// Product Name                 Packing  O.Stk    Purc      Tot    LM2    LM1    Sale     Qoh        ValueAge
//
// Physical source fields:
//
// Product Name | Packing | O.Stk | Purc | Tot | LM2 | LM1 |
// Sale | Qoh | Value | Age
//
// IMPORTANT:
// - H014 is a fixed-width source format.
// - The physical source positions are authoritative.
// - Do NOT tokenize the whole row to locate numeric values.
// - Numbers inside Product Name or Packing remain part of those fields.
// - LM2 / LM1 are source fields and are preserved exactly.
// - Value and Age are separate source fields even though the header
//   visually appears as "ValueAge".
// - No values are calculated or inferred.
// - Summary rows such as Opening Value / Purchase Value / Sale Value
//   are not product records.
// ============================================================

function buildH014Header(headerResult) {

    const sourceHeader =
        String(
            headerResult?.header?.text ||
            "Product Name                 Packing  O.Stk    Purc      Tot    LM2    LM1    Sale     Qoh        ValueAge"
        );

    return {
        success: true,
        sourceHeader,
        lineNumber:
            headerResult?.header?.lineNumber ??
            null,
        structure: "H014",
        columns: [
            {
                index: 0,
                header: "Product Name",
                normalized: "PRODUCTNAME",
                position: 0,
                end: 29
            },
            {
                index: 1,
                header: "Packing",
                normalized: "PACKING",
                position: 29,
                end: 38
            },
            {
                index: 2,
                header: "O.Stk",
                normalized: "OSTK",
                position: 38,
                end: 47
            },
            {
                index: 3,
                header: "Purc",
                normalized: "PURC",
                position: 47,
                end: 57
            },
            {
                index: 4,
                header: "Tot",
                normalized: "TOT",
                position: 57,
                end: 64
            },
            {
                index: 5,
                header: "LM2",
                normalized: "LM2",
                position: 64,
                end: 71
            },
            {
                index: 6,
                header: "LM1",
                normalized: "LM1",
                position: 71,
                end: 78
            },
            {
                index: 7,
                header: "Sale",
                normalized: "SALE",
                position: 78,
                end: 87
            },
            {
                index: 8,
                header: "Qoh",
                normalized: "QOH",
                position: 87,
                end: 98
            },
            {
                index: 9,
                header: "Value",
                normalized: "VALUE",
                position: 98,
                end: 105
            },
            {
                index: 10,
                header: "Age",
                normalized: "AGE",
                position: 105,
                end: 108
            }
        ]
    };
}

function isH014SummaryRow(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text)
    );
}

function isH014DataRow(line) {

    const text =
        String(line ?? "");

    if (!text.trim()) {
        return false;
    }

    if (isH014SummaryRow(text)) {
        return false;
    }

    /*
     * Product and Packing are isolated first. Numeric-looking text
     * inside either field is never inspected as a numeric data token.
     */
    const product =
        cleanText(
            text.slice(0, 29)
        );

    const packing =
        cleanText(
            text.slice(29, 38)
        );

    if (!product || !packing) {
        return false;
    }

    const numericFields = [
        text.slice(38, 47),  // O.Stk
        text.slice(47, 57),  // Purc
        text.slice(57, 64),  // Tot
        text.slice(64, 71),  // LM2
        text.slice(71, 78),  // LM1
        text.slice(78, 87),  // Sale
        text.slice(87, 98),  // Qoh
        text.slice(98, 105), // Value
        text.slice(105)      // Age
    ].map(cleanText);

    return numericFields.every(
        value =>
            isNumericToken(value)
    );
}

function extractH014Row(
    line,
    header,
    rowNumber
) {

    const text =
        String(line ?? "");

    if (!text.trim()) {
        return null;
    }

    const product =
        cleanText(
            text.slice(0, 29)
        );

    const packing =
        cleanText(
            text.slice(29, 38)
        );

    const oStkRaw =
        cleanText(
            text.slice(38, 47)
        );

    const purcRaw =
        cleanText(
            text.slice(47, 57)
        );

    const totRaw =
        cleanText(
            text.slice(57, 64)
        );

    const lm2Raw =
        cleanText(
            text.slice(64, 71)
        );

    const lm1Raw =
        cleanText(
            text.slice(71, 78)
        );

    const saleRaw =
        cleanText(
            text.slice(78, 87)
        );

    const qohRaw =
        cleanText(
            text.slice(87, 98)
        );

    const valueRaw =
        cleanText(
            text.slice(98, 105)
        );

    const ageRaw =
        cleanText(
            text.slice(105)
        );

    if (
        !product ||
        !packing ||
        !isNumericToken(oStkRaw) ||
        !isNumericToken(purcRaw) ||
        !isNumericToken(totRaw) ||
        !isNumericToken(lm2Raw) ||
        !isNumericToken(lm1Raw) ||
        !isNumericToken(saleRaw) ||
        !isNumericToken(qohRaw) ||
        !isNumericToken(valueRaw) ||
        !isNumericToken(ageRaw)
    ) {
        return null;
    }

    const rawValues = {
        "Product Name": product,
        "Packing": packing,
        "O.Stk": oStkRaw,
        "Purc": purcRaw,
        "Tot": totRaw,
        "LM2": lm2Raw,
        "LM1": lm1Raw,
        "Sale": saleRaw,
        "Qoh": qohRaw,
        "Value": valueRaw,
        "Age": ageRaw
    };

    const values = {
        "Product Name": product,
        "Packing": packing,
        "O.Stk": parseSourceValue(oStkRaw),
        "Purc": parseSourceValue(purcRaw),
        "Tot": parseSourceValue(totRaw),
        "LM2": parseSourceValue(lm2Raw),
        "LM1": parseSourceValue(lm1Raw),
        "Sale": parseSourceValue(saleRaw),
        "Qoh": parseSourceValue(qohRaw),
        "Value": parseSourceValue(valueRaw),
        "Age": parseSourceValue(ageRaw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 9,
        expectedNumericCount: 9,
        numericCountMatches: true,
        rawValues,
        values
    };
}


// ============================================================

// ============================================================
// H024 - FIXED-WIDTH STOCK & SALES STATEMENT
// ============================================================
//
// Source header:
// Product Name                Packing      O.Bal  Rcpts  Sal.Ret   Total   Sales  Pur.Ret    Total Cl.Bal Cl.Value  Age
//
// Physical source fields:
// Product Name | Packing | O.Bal | Rcpts | Sal.Ret | Total |
// Sales | Pur.Ret | Total | Cl.Bal | Cl.Value | Age
//
// IMPORTANT:
// - H024 is a fixed-width source format.
// - Preserve the existing physical source-column boundaries.
// - Do NOT tokenize the complete row to locate numeric values.
// - Numbers inside Product Name or Packing remain part of those fields.
// - The two source columns named "Total" are kept separately as
//   "Total" and "Total 2" in rawValues/values.
// - Do NOT calculate or infer any value.
// ============================================================

function buildH024Header(headerResult) {

    const sourceHeader =
        String(
            headerResult?.header?.text ||
            "Product Name                Packing      O.Bal  Rcpts  Sal.Ret   Total   Sales  Pur.Ret    Total Cl.Bal Cl.Value  Age"
        );

    return {
        success: true,
        sourceHeader,
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H024",
        columns: [
            {
                index: 0,
                header: "Product Name",
                normalized: "PRODUCTNAME",
                position: 0,
                end: 28
            },
            {
                index: 1,
                header: "Packing",
                normalized: "PACKING",
                position: 28,
                end: 41
            },
            {
                index: 2,
                header: "O.Bal",
                normalized: "OBAL",
                position: 41,
                end: 48
            },
            {
                index: 3,
                header: "Rcpts",
                normalized: "RCPTS",
                position: 48,
                end: 55
            },
            {
                index: 4,
                header: "Sal.Ret",
                normalized: "SALRET",
                position: 55,
                end: 65
            },
            {
                index: 5,
                header: "Total",
                normalized: "TOTAL",
                position: 65,
                end: 73
            },
            {
                index: 6,
                header: "Sales",
                normalized: "SALES",
                position: 73,
                end: 80
            },
            {
                index: 7,
                header: "Pur.Ret",
                normalized: "PURRET",
                position: 80,
                end: 91
            },
            {
                index: 8,
                header: "Total 2",
                normalized: "TOTAL2",
                position: 91,
                end: 97
            },
            {
                index: 9,
                header: "Cl.Bal",
                normalized: "CLBAL",
                position: 97,
                end: 104
            },
            {
                index: 10,
                header: "Cl.Value",
                normalized: "CLVALUE",
                position: 104,
                end: 114
            },
            {
                index: 11,
                header: "Age",
                normalized: "AGE",
                position: 114,
                end: 117
            }
        ]
    };
}

function isH024SummaryRow(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^PUR\.RETVAL\b/.test(text) ||
        /^SALRET\s+VAL\b/.test(text) ||
        /^PAGE\s*:\s*\d+\b/.test(text)
    );
}

function isH024Separator(line) {

    const text =
        String(line ?? "")
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();

    return /^[\s=\-_*]{5,}$/.test(text);
}

function isH024DataRow(line) {

    const text = String(line ?? "").replace(/\r/g, "");

    if (!text.trim()) {
        return false;
    }

    if (
        isH024SummaryRow(text) ||
        isH024Separator(text)
    ) {
        return false;
    }

    /*
     * Product and Packing are isolated before any numeric validation.
     * Therefore values such as "12.5MG", "200", "10 S", etc. inside
     * the product/packing area are never interpreted as source numbers.
     */
    const product =
        cleanText(text.slice(0, 28));

    const packing =
        cleanText(text.slice(28, 41));

    if (!product || !packing) {
        return false;
    }

    /*
     * Validate only the known numeric source-column regions.
     */
    const numericFields = [
        text.slice(41, 48),   // O.Bal
        text.slice(48, 55),   // Rcpts
        text.slice(55, 65),   // Sal.Ret
        text.slice(65, 73),   // Total
        text.slice(73, 80),   // Sales
        text.slice(80, 91),   // Pur.Ret
        text.slice(91, 97),   // Total 2
        text.slice(97, 104),  // Cl.Bal
        text.slice(104, 114), // Cl.Value
        text.slice(114)       // Age
    ].map(cleanText);

    return (
        numericFields.length === 10 &&
        numericFields.every(
            value => isNumericToken(value)
        )
    );
}


// ============================================================
// H026 - INFINA / STOCK & SALE STATEMENT
// ============================================================
//
// Physical source layout:
//
// SNo | Particulars | OPstk | Pur | StkIn | Sale | UCS. |
// StkOt | ClStk | SaleValue | Stock Value
//
// IMPORTANT:
// - H026 is fixed-width.
// - Isolate Particulars before reading numeric source fields.
// - Numbers inside Particulars are never tokenized.
// - SNo is read separately and is never treated as SALE.
// - All nine stock/value source columns are preserved.
// - No values are calculated or inferred.
// - The H026 footer is not a product row.
// ============================================================

function buildH026Header(headerResult) {
    const detectedHeader =
        String(
            headerResult?.header?.text || ""
        );

    return {
        success: true,
        sourceHeader: detectedHeader,
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H026",
        columns: [
            {
                index: 0,
                header: "SNo",
                normalized: "SNO",
                position: 1,
                end: 5
            },
            {
                index: 1,
                header: "Particulars",
                normalized: "PARTICULARS",
                position: 5,
                end: 31
            },
            {
                index: 2,
                header: "OPstk",
                normalized: "OPSTK",
                position: 31,
                end: 39
            },
            {
                index: 3,
                header: "Pur",
                normalized: "PUR",
                position: 39,
                end: 43
            },
            {
                index: 4,
                header: "StkIn",
                normalized: "STKIN",
                position: 43,
                end: 49
            },
            {
                index: 5,
                header: "Sale",
                normalized: "SALE",
                position: 49,
                end: 55
            },
            {
                index: 6,
                header: "UCS.",
                normalized: "UCS",
                position: 55,
                end: 61
            },
            {
                index: 7,
                header: "StkOt",
                normalized: "STKOT",
                position: 61,
                end: 67
            },
            {
                index: 8,
                header: "ClStk",
                normalized: "CLSTK",
                position: 67,
                end: 73
            },
            {
                index: 9,
                header: "SaleValue",
                normalized: "SALEVALUE",
                position: 73,
                end: 84
            },
            {
                index: 10,
                header: "Stock Value",
                normalized: "STOCK_VALUE",
                position: 84,
                end: null
            }
        ]
    };
}

function isH026DashValue(value) {
    return /^-+$/.test(
        cleanText(value)
    );
}

function isH026NumericSourceValue(value) {
    const text =
        cleanText(value);

    return (
        isNumericToken(text) ||
        isH026DashValue(text)
    );
}

function isH026SummaryRow(line) {
    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    return (
        /^VALUE\s+OF\s*::/.test(text) ||
        /^TOTAL\b/.test(text) ||
        text.includes("*** END OF REPORT ***")
    );
}

function extractH026Row(
    line,
    header,
    rowNumber
) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return null;
    }

    if (isH026SummaryRow(text)) {
        return null;
    }

    /*
     * The H026 physical positions are fixed by the supplied
     * statement format. Do not tokenize the complete row.
     */
    const serialRaw =
        cleanText(
            text.slice(1, 5)
        );

    const particulars =
        cleanText(
            text.slice(5, 31)
        );

    const opstkRaw =
        cleanText(
            text.slice(31, 39)
        );

    const purRaw =
        cleanText(
            text.slice(39, 43)
        );

    const stkinRaw =
        cleanText(
            text.slice(43, 49)
        );

    const saleRaw =
        cleanText(
            text.slice(49, 55)
        );

    const ucsRaw =
        cleanText(
            text.slice(55, 61)
        );

    const stkotRaw =
        cleanText(
            text.slice(61, 67)
        );

    const clstkRaw =
        cleanText(
            text.slice(67, 73)
        );

    const saleValueRaw =
        cleanText(
            text.slice(73, 84)
        );

    const stockValueRaw =
        cleanText(
            text.slice(84)
        );

    /*
     * A genuine H026 row must have:
     * - numeric SNo
     * - non-empty Particulars
     * - all nine source numeric/value columns present
     *
     * "-" is accepted as an exact source value.
     */
    if (
        !isNumericToken(serialRaw) ||
        !particulars ||
        !isH026NumericSourceValue(opstkRaw) ||
        !isH026NumericSourceValue(purRaw) ||
        !isH026NumericSourceValue(stkinRaw) ||
        !isH026NumericSourceValue(saleRaw) ||
        !isH026NumericSourceValue(ucsRaw) ||
        !isH026NumericSourceValue(stkotRaw) ||
        !isH026NumericSourceValue(clstkRaw) ||
        !isH026NumericSourceValue(saleValueRaw) ||
        !isH026NumericSourceValue(stockValueRaw)
    ) {
        return null;
    }

    const rawValues = {
        "SNo": serialRaw,
        "Particulars": particulars,
        "OPstk": opstkRaw,
        "Pur": purRaw,
        "StkIn": stkinRaw,
        "Sale": saleRaw,
        "UCS.": ucsRaw,
        "StkOt": stkotRaw,
        "ClStk": clstkRaw,
        "SaleValue": saleValueRaw,
        "Stock Value": stockValueRaw
    };

    const values = {
        "SNo": parseSourceValue(serialRaw),
        "Particulars": particulars,
        "OPstk": parseSourceValue(opstkRaw),
        "Pur": parseSourceValue(purRaw),
        "StkIn": parseSourceValue(stkinRaw),
        "Sale": parseSourceValue(saleRaw),
        "UCS.": parseSourceValue(ucsRaw),
        "StkOt": parseSourceValue(stkotRaw),
        "ClStk": parseSourceValue(clstkRaw),
        "SaleValue": parseSourceValue(saleValueRaw),
        "Stock Value": parseSourceValue(stockValueRaw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 10,
        expectedNumericCount: 10,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function extractH024Row(line, header, rowNumber) {

    const text =
        String(line ?? "").replace(/\r/g, "");

    if (
        !text.trim() ||
        isH024SummaryRow(text) ||
        isH024Separator(text)
    ) {
        return null;
    }

    /*
     * Fixed-width extraction. Product and Packing are completely
     * separated before numeric source fields are parsed.
     */
    const product =
        cleanText(text.slice(0, 28));

    const packing =
        cleanText(text.slice(28, 41));

    const obalRaw =
        cleanText(text.slice(41, 48));

    const rcptsRaw =
        cleanText(text.slice(48, 55));

    const salRetRaw =
        cleanText(text.slice(55, 65));

    const totalRaw =
        cleanText(text.slice(65, 73));

    const salesRaw =
        cleanText(text.slice(73, 80));

    const purRetRaw =
        cleanText(text.slice(80, 91));

    const total2Raw =
        cleanText(text.slice(91, 97));

    const clBalRaw =
        cleanText(text.slice(97, 104));

    const clValueRaw =
        cleanText(text.slice(104, 114));

    const ageRaw =
        cleanText(text.slice(114));

    if (
        !product ||
        !packing ||
        !isNumericToken(obalRaw) ||
        !isNumericToken(rcptsRaw) ||
        !isNumericToken(salRetRaw) ||
        !isNumericToken(totalRaw) ||
        !isNumericToken(salesRaw) ||
        !isNumericToken(purRetRaw) ||
        !isNumericToken(total2Raw) ||
        !isNumericToken(clBalRaw) ||
        !isNumericToken(clValueRaw) ||
        !isNumericToken(ageRaw)
    ) {
        return null;
    }

    const rawValues = {
        "Product Name": product,
        "Packing": packing,
        "O.Bal": obalRaw,
        "Rcpts": rcptsRaw,
        "Sal.Ret": salRetRaw,
        "Total": totalRaw,
        "Sales": salesRaw,
        "Pur.Ret": purRetRaw,
        "Total 2": total2Raw,
        "Cl.Bal": clBalRaw,
        "Cl.Value": clValueRaw,
        "Age": ageRaw
    };

    const values = {
        "Product Name": product,
        "Packing": packing,
        "O.Bal": parseSourceValue(obalRaw),
        "Rcpts": parseSourceValue(rcptsRaw),
        "Sal.Ret": parseSourceValue(salRetRaw),
        "Total": parseSourceValue(totalRaw),
        "Sales": parseSourceValue(salesRaw),
        "Pur.Ret": parseSourceValue(purRetRaw),
        "Total 2": parseSourceValue(total2Raw),
        "Cl.Bal": parseSourceValue(clBalRaw),
        "Cl.Value": parseSourceValue(clValueRaw),
        "Age": parseSourceValue(ageRaw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 10,
        expectedNumericCount: 10,
        numericCountMatches: true,
        rawValues,
        values
    };
}


// ============================================================
// H017 - IMPERIA FRIENDS PHARMA AGENCY / TN966
// ============================================================
//
// H017 is a fixed-width source format.
//
// Source fields in the supplied statement:
// MEDICINE NAME | PACK | O.B | PURC | TOTAL | L_SLE | ADJ |
// SALES | SAL.VAL | CL.ST | CLST.VAL
//
// IMPORTANT:
// - Read the row by physical source-column boundaries.
// - Do NOT scan the whole row for numeric tokens.
// - Numbers inside MEDICINE NAME or PACK remain part of those fields.
// - SALES and CL.ST are separate source columns.
// - SAL.VAL and CLST.VAL are separate value columns.
// - Do NOT calculate or infer TOTAL, SALES, CL.ST, etc.
// - Preserve source values and source order exactly.
// ============================================================

function buildH017Header(headerResult) {

    const detectedHeader =
        String(
            headerResult?.header?.text || ""
        );

    /*
     * H017 has two known physical header variants.
     *
     * IMPORTANT:
     * Keep the existing 11-column H017 definition for the older
     * format. The 16-column layout is selected only when Script 1
     * actually detects its additional physical labels.
     */
    const normalizedHeader =
        normalizeHeaderName(detectedHeader);

    const isExpandedH017 =
        normalizedHeader.includes("PRTN") &&
        normalizedHeader.includes("FREE") &&
        normalizedHeader.includes("REPL") &&
        normalizedHeader.includes("SALVAL") &&
        normalizedHeader.includes("CLSTVAL") &&
        normalizedHeader.includes("ORD1") &&
        normalizedHeader.includes("ORD2");

    /*
     * Isolated 11-column physical variant:
     *
     * MEDICINE NAME      PACK    O.B  PURC TOTAL L_SLE ADJ SALES    SAL.VAL CL.ST   CLST.VAL
     *
     * Some statements with this exact physical layout are detected by
     * Script 1 as H017. Their physical boundaries are:
     *   Medicine 0-19
     *   Pack     19-27
     *   O.B      27-32
     *   PURC     32-37
     *   TOTAL    37-43
     *   L_SLE    43-49
     *   ADJ      49-53
     *   SALES    53-62
     *   SAL.VAL  62-70
     *   CL.ST    70-78
     *   CLST.VAL 78-86
     *
     * Keep this variant isolated so the existing H017 11-column format
     * below remains unchanged.
     */
    const isH017MedicineStockSalesCompact =
        detectedHeader.includes("MEDICINE NAME") &&
        detectedHeader.includes("PACK") &&
        detectedHeader.includes("O.B") &&
        detectedHeader.includes("PURC") &&
        detectedHeader.includes("TOTAL") &&
        detectedHeader.includes("L_SLE") &&
        detectedHeader.includes("ADJ") &&
        detectedHeader.includes("SALES") &&
        detectedHeader.includes("SAL.VAL") &&
        detectedHeader.includes("CL.ST") &&
        detectedHeader.includes("CLST.VAL") &&
        detectedHeader.includes("SALES    SAL.VAL");

    if (isH017MedicineStockSalesCompact) {
        return {
            success: true,
            sourceHeader: detectedHeader,
            lineNumber:
                headerResult?.header?.lineNumber ?? null,
            structure: "H017",
            columns: [
                { index: 0, header: "MEDICINE NAME", normalized: "MEDICINENAME", position: 0, end: 19 },
                { index: 1, header: "PACK", normalized: "PACK", position: 19, end: 27 },
                { index: 2, header: "O.B", normalized: "OB", position: 27, end: 32 },
                { index: 3, header: "PURC", normalized: "PURC", position: 32, end: 37 },
                { index: 4, header: "TOTAL", normalized: "TOTAL", position: 37, end: 43 },
                { index: 5, header: "L_SLE", normalized: "LSLE", position: 43, end: 49 },
                { index: 6, header: "ADJ", normalized: "ADJ", position: 49, end: 53 },
                { index: 7, header: "SALES", normalized: "SALES", position: 53, end: 62 },
                { index: 8, header: "SAL.VAL", normalized: "SALVAL", position: 62, end: 70 },
                { index: 9, header: "CL.ST", normalized: "CLST", position: 70, end: 78 },
                { index: 10, header: "CLST.VAL", normalized: "CLSTVAL", position: 78, end: 86 }
            ]
        };
    }

    if (isExpandedH017) {
        return {
            success: true,
            sourceHeader: detectedHeader,
            lineNumber:
                headerResult?.header?.lineNumber ?? null,
            structure: "H017",
            columns: [
                { index: 0, header: "MEDICINE NAME", normalized: "MEDICINENAME", position: 0, end: 19 },
                { index: 1, header: "PACK", normalized: "PACK", position: 19, end: 27 },
                { index: 2, header: "O.B", normalized: "OB", position: 27, end: 32 },
                { index: 3, header: "PURC", normalized: "PURC", position: 32, end: 37 },
                { index: 4, header: "TOTAL", normalized: "TOTAL", position: 37, end: 44 },
                { index: 5, header: "PRTN", normalized: "PRTN", position: 44, end: 49 },
                { index: 6, header: "L_SLE", normalized: "LSLE", position: 49, end: 55 },
                { index: 7, header: "ADJ", normalized: "ADJ", position: 55, end: 59 },
                { index: 8, header: "SALES", normalized: "SALES", position: 59, end: 65 },
                { index: 9, header: "FREE", normalized: "FREE", position: 65, end: 70 },
                { index: 10, header: "REPL", normalized: "REPL", position: 70, end: 78 },
                { index: 11, header: "SAL.VAL", normalized: "SALVAL", position: 78, end: 86 },
                { index: 12, header: "CL.ST", normalized: "CLST", position: 86, end: 94 },
                { index: 13, header: "CLST.VAL", normalized: "CLSTVAL", position: 94, end: 103 },
                { index: 14, header: "Ord.1", normalized: "ORD1", position: 103, end: 109 },
                { index: 15, header: "Ord.2", normalized: "ORD2", position: 109, end: null }
            ]
        };
    }

    return {
        success: true,
        sourceHeader:
            String(
                headerResult?.header?.text ||
                "MEDICINE NAME        PACK    O.B  PURC TOTAL L_SLE ADJ SALES SAL.VAL CL.ST CLST.VAL"
            ),
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H017",
        columns: [
            { index: 0, header: "MEDICINE NAME", normalized: "MEDICINENAME", position: 0, end: 19 },
            { index: 1, header: "PACK", normalized: "PACK", position: 19, end: 28 },
            { index: 2, header: "O.B", normalized: "OB", position: 28, end: 34 },
            { index: 3, header: "PURC", normalized: "PURC", position: 34, end: 40 },
            { index: 4, header: "TOTAL", normalized: "TOTAL", position: 40, end: 47 },
            { index: 5, header: "L_SLE", normalized: "LSLE", position: 47, end: 51 },
            { index: 6, header: "ADJ", normalized: "ADJ", position: 51, end: 56 },
            { index: 7, header: "SALES", normalized: "SALES", position: 56, end: 63 },
            { index: 8, header: "SAL.VAL", normalized: "SALVAL", position: 63, end: 73 },
            { index: 9, header: "CL.ST", normalized: "CLST", position: 73, end: 79 },
            { index: 10, header: "CLST.VAL", normalized: "CLSTVAL", position: 79, end: 89 }
        ]
    };
}

function isH017SummaryRow(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^PAGE\s+\d+\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^\*{3,}/.test(text)
    );
}

function isH017Separator(line) {

    const text =
        String(line || "")
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();

    return /^[\s=\-_*]{5,}$/.test(text);
}

function extractH017Row(line, header, rowNumber) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (
        !text.trim() ||
        isH017SummaryRow(text) ||
        isH017Separator(text)
    ) {
        return null;
    }

    /*
     * Printer-control sequences are present at the beginning of the
     * physical H017 rows, e.g. ESC/t1/0x0F/ESC-E.
     *
     * Remove control characters BEFORE fixed-width slicing.
     * This changes no printable source characters or spaces and is
     * therefore safe for the physical column layout.
     */
    const source =
        text.replace(/[\u0000-\u001F\u007F]/g, "");

    const normalizedHeader =
        normalizeHeaderName(
            header?.sourceHeader || ""
        );

    const isExpandedH017 =
        normalizedHeader.includes("PRTN") &&
        normalizedHeader.includes("FREE") &&
        normalizedHeader.includes("REPL") &&
        normalizedHeader.includes("SALVAL") &&
        normalizedHeader.includes("CLSTVAL") &&
        normalizedHeader.includes("ORD1") &&
        normalizedHeader.includes("ORD2");

    const isH017MedicineStockSalesCompact =
        String(header?.sourceHeader || "").includes("MEDICINE NAME") &&
        String(header?.sourceHeader || "").includes("PACK") &&
        String(header?.sourceHeader || "").includes("O.B") &&
        String(header?.sourceHeader || "").includes("PURC") &&
        String(header?.sourceHeader || "").includes("TOTAL") &&
        String(header?.sourceHeader || "").includes("L_SLE") &&
        String(header?.sourceHeader || "").includes("ADJ") &&
        String(header?.sourceHeader || "").includes("SALES") &&
        String(header?.sourceHeader || "").includes("SAL.VAL") &&
        String(header?.sourceHeader || "").includes("CL.ST") &&
        String(header?.sourceHeader || "").includes("CLST.VAL") &&
        String(header?.sourceHeader || "").includes("SALES    SAL.VAL");

    /*
     * Exact 11-column MEDICINE NAME / PACK / O.B / PURC / TOTAL /
     * L_SLE / ADJ / SALES / SAL.VAL / CL.ST / CLST.VAL layout.
     *
     * This branch is isolated from the existing H017 branch below.
     */
    if (isH017MedicineStockSalesCompact) {

        const medicineName =
            cleanText(source.slice(0, 19));

        const pack =
            cleanText(source.slice(19, 27));

        if (!medicineName) {
            return null;
        }

        const obRaw = cleanText(source.slice(27, 32));
        const purcRaw = cleanText(source.slice(32, 37));
        const totalRaw = cleanText(source.slice(37, 43));
        const lSleRaw = cleanText(source.slice(43, 49));
        const adjRaw = cleanText(source.slice(49, 53));
        const salesRaw = cleanText(source.slice(53, 62));
        const salValRaw = cleanText(source.slice(62, 70));
        const clStRaw = cleanText(source.slice(70, 78));
        const clstValRaw = cleanText(source.slice(78, 86));

        const sourceFields = [
            obRaw,
            purcRaw,
            totalRaw,
            lSleRaw,
            adjRaw,
            salesRaw,
            salValRaw,
            clStRaw,
            clstValRaw
        ];

        if (
            sourceFields.some(
                value =>
                    value !== "" &&
                    !isNumericToken(value) &&
                    !/^[-]+$/.test(value)
            )
        ) {
            return null;
        }

        const toSourceValue =
            value => {
                if (!value || /^[-]+$/.test(value)) {
                    return value || null;
                }

                return isNumericToken(value)
                    ? parseSourceValue(value)
                    : value;
            };

        const rawValues = {
            "MEDICINE NAME": medicineName,
            "PACK": pack,
            "O.B": obRaw,
            "PURC": purcRaw,
            "TOTAL": totalRaw,
            "L_SLE": lSleRaw,
            "ADJ": adjRaw,
            "SALES": salesRaw,
            "SAL.VAL": salValRaw,
            "CL.ST": clStRaw,
            "CLST.VAL": clstValRaw
        };

        const values = {
            "MEDICINE NAME": medicineName,
            "PACK": pack,
            "O.B": toSourceValue(obRaw),
            "PURC": toSourceValue(purcRaw),
            "TOTAL": toSourceValue(totalRaw),
            "L_SLE": toSourceValue(lSleRaw),
            "ADJ": toSourceValue(adjRaw),
            "SALES": toSourceValue(salesRaw),
            "SAL.VAL": toSourceValue(salValRaw),
            "CL.ST": toSourceValue(clStRaw),
            "CLST.VAL": toSourceValue(clstValRaw)
        };

        return {
            rowNumber,
            rawLine: text,
            rawValues,
            values
        };
    }

    /*
     * Expanded 16-column H017 layout.
     *
     * Boundaries are taken from the actual TN966 statement rows:
     *
     * 0-19   Medicine
     * 19-27  Pack
     * 27-33  O.B
     * 33-39  Purc
     * 39-45  Total
     * 45-51  Prtn
     * 51-57  L_Sle
     * 57-61  Adj
     * 61-66  Sales
     * 66-71  Free
     * 71-78  Repl
     * 78-89  Sal.Val
     * 89-95  Cl.St
     * 95-107 Clst.Val
     * 107-113 Ord.1
     * 113+   Ord.2
     */
    if (isExpandedH017) {

        const medicineName =
            cleanText(source.slice(0, 19));

        const pack =
            cleanText(source.slice(19, 27));

        if (!medicineName) {
            return null;
        }

        const obRaw = cleanText(source.slice(27, 32));
        const purcRaw = cleanText(source.slice(32, 37));
        const totalRaw = cleanText(source.slice(37, 44));
        const prtnRaw = cleanText(source.slice(44, 49));
        const lSleRaw = cleanText(source.slice(49, 55));
        const adjRaw = cleanText(source.slice(55, 59));
        const salesRaw = cleanText(source.slice(59, 65));
        const freeRaw = cleanText(source.slice(65, 70));
        const replRaw = cleanText(source.slice(70, 78));
        const salValRaw = cleanText(source.slice(78, 86));
        const clStRaw = cleanText(source.slice(86, 94));
        const clstValRaw = cleanText(source.slice(94, 103));
        const ord1Raw = cleanText(source.slice(103, 109));
        const ord2Raw = cleanText(source.slice(109));

        const toSourceValue =
            value => {
                if (!value) {
                    return null;
                }

                return isNumericToken(value)
                    ? parseSourceValue(value)
                    : value;
            };

        const rawValues = {
            "MEDICINE NAME": medicineName,
            "PACK": pack,
            "O.B": obRaw,
            "PURC": purcRaw,
            "TOTAL": totalRaw,
            "PRTN": prtnRaw,
            "L_SLE": lSleRaw,
            "ADJ": adjRaw,
            "SALES": salesRaw,
            "FREE": freeRaw,
            "REPL": replRaw,
            "SAL.VAL": salValRaw,
            "CL.ST": clStRaw,
            "CLST.VAL": clstValRaw,
            "Ord.1": ord1Raw,
            "Ord.2": ord2Raw
        };

        const values = {
            "MEDICINE NAME": medicineName,
            "PACK": pack,
            "O.B": toSourceValue(obRaw),
            "PURC": toSourceValue(purcRaw),
            "TOTAL": toSourceValue(totalRaw),
            "PRTN": toSourceValue(prtnRaw),
            "L_SLE": toSourceValue(lSleRaw),
            "ADJ": toSourceValue(adjRaw),
            "SALES": toSourceValue(salesRaw),
            "FREE": toSourceValue(freeRaw),
            "REPL": toSourceValue(replRaw),
            "SAL.VAL": toSourceValue(salValRaw),
            "CL.ST": toSourceValue(clStRaw),
            "CLST.VAL": toSourceValue(clstValRaw),
            "Ord.1": toSourceValue(ord1Raw),
            "Ord.2": toSourceValue(ord2Raw)
        };

        return {
            rowNumber,
            rawLine: text,
            rawValues,
            values
        };
    }

    /*
     * Existing 11-column H017 layout.
     * This branch is intentionally preserved so existing H017
     * statements are not changed by the expanded-format fix.
     */
    const medicineName =
        cleanText(source.slice(0, 19));

    const pack =
        cleanText(source.slice(19, 28));

    if (!medicineName) {
        return null;
    }

    const obRaw = cleanText(source.slice(28, 34));
    const purcRaw = cleanText(source.slice(34, 40));
    const totalRaw = cleanText(source.slice(40, 47));
    const lSleRaw = cleanText(source.slice(47, 51));
    const adjRaw = cleanText(source.slice(51, 56));
    const salesRaw = cleanText(source.slice(56, 63));
    const salValRaw = cleanText(source.slice(63, 73));
    const clStRaw = cleanText(source.slice(73, 79));
    const clstValRaw = cleanText(source.slice(79));

    const sourceFields = [
        obRaw,
        purcRaw,
        totalRaw,
        lSleRaw,
        adjRaw,
        salesRaw,
        salValRaw,
        clStRaw,
        clstValRaw
    ];

    if (
        sourceFields.some(
            value => value === ""
        )
    ) {
        return null;
    }

    const toSourceValue =
        value => {
            if (!value) {
                return null;
            }

            return isNumericToken(value)
                ? parseSourceValue(value)
                : value;
        };

    const rawValues = {
        "MEDICINE NAME": medicineName,
        "PACK": pack,
        "O.B": obRaw,
        "PURC": purcRaw,
        "TOTAL": totalRaw,
        "L_SLE": lSleRaw,
        "ADJ": adjRaw,
        "SALES": salesRaw,
        "SAL.VAL": salValRaw,
        "CL.ST": clStRaw,
        "CLST.VAL": clstValRaw
    };

    const values = {
        "MEDICINE NAME": medicineName,
        "PACK": pack,
        "O.B": toSourceValue(obRaw),
        "PURC": toSourceValue(purcRaw),
        "TOTAL": toSourceValue(totalRaw),
        "L_SLE": toSourceValue(lSleRaw),
        "ADJ": toSourceValue(adjRaw),
        "SALES": toSourceValue(salesRaw),
        "SAL.VAL": toSourceValue(salValRaw),
        "CL.ST": toSourceValue(clStRaw),
        "CLST.VAL": toSourceValue(clstValRaw)
    };

    return {
        rowNumber,
        rawLine: text,
        rawValues,
        values
    };
}

function isPalaniappaHeader(header) {
    const names =
        (header.columns || []).map(
            column => normalizeHeaderName(column.header)
        );

    return (
        names.includes("PRODUCTNAME") &&
        names.includes("PACKG") &&
        names.includes("SALES") &&
        names.includes("CLOSING") &&
        names.includes("DAY")
    );
}

function isSemicolonStockHeader(header) {
    const names =
        (header?.columns || []).map(
            column => normalizeHeaderName(column.header)
        );

    // Script 1 is authoritative for H031.
    if (String(header?.structure || "") === "H031") {
        return true;
    }

    return (
        names.includes("PRODUCTNAME") &&
        names.includes("PACKING") &&
        names.includes("OPENING") &&
        names.includes("PURCHASE") &&
        names.includes("SALES") &&
        names.includes("CSTOCK") &&
        names.includes("EXPIRY") &&
        names.includes("PRSALE")
    );
}

// ============================================================
// SEMICOLON DATA TOKENS
// ============================================================

function tokenizeSemicolonDataLine(line) {

    const text =
        String(line ?? "");

    return text
        .split(";")
        .map(
            (value, index, parts) => {

                const raw =
                    String(value ?? "");

                const trimmed =
                    raw.trim();

                return {
                    text: trimmed,
                    rawText: raw,
                    index,
                    start:
                        parts
                            .slice(0, index)
                            .reduce(
                                (total, part) =>
                                    total +
                                    String(part ?? "").length +
                                    1,
                                0
                            ),
                    end:
                        parts
                            .slice(0, index + 1)
                            .reduce(
                                (total, part) =>
                                    total +
                                    String(part ?? "").length,
                                0
                            )
                };
            }
        );
}

// ============================================================
// PARSE SOURCE VALUE
//
// Numeric source values become numbers.
// Numeric addition values are summed after extraction.
// Non-numeric values remain exact text.
// Empty source values remain null.
//
// Examples:
// "74"       -> 74
// "74+6"     -> 80
// "7+0"      -> 7
// "10+5+2"   -> 17
// "7+0+0"    -> 7
// ============================================================

function parseSourceValue(value) {

    const text =
        cleanText(value);

    if (!text) {
        return null;
    }

    /*
     * IMPORTANT:
     * This function receives an already-extracted source column.
     *
     * Therefore "+" processing happens ONLY after the physical
     * column has already been isolated by the structure extractor.
     *
     * Do not process "+" on the complete TXT row.
     */

    if (text.includes("+")) {

        const parts =
            text
                .split("+")
                .map(part => cleanText(part));

        /*
         * Only treat the value as an addition expression when
         * EVERY component is a valid numeric token.
         *
         * This prevents text such as:
         * "ABC+DEF"
         * from being converted.
         */

        if (
            parts.length > 1 &&
            parts.every(
                part => isNumericToken(part)
            )
        ) {

            return parts.reduce(
                (sum, part) =>
                    sum + parseNumeric(part),
                0
            );
        }
    }

    /*
     * Existing single-number behavior remains unchanged.
     */

    if (isNumericToken(text)) {
        return parseNumeric(text);
    }

    /*
     * Existing non-numeric behavior remains unchanged.
     */

    return text;
}

// ============================================================
// PALANIAPPA FIXED-WIDTH ROW
// ============================================================

function extractPalaniappaRow(
    line,
    header,
    rowNumber
) {

    const columns =
        [...header.columns]
            .sort(
                (a, b) =>
                    a.position - b.position
            );

    const productColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "PRODUCTNAME"
        );

    const packingColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "PACKG"
        );

    const salesColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "SALES"
        );

    const closingColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "CLOSING"
        );

    const dayColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "DAY"
        );

    if (
        !productColumn ||
        !packingColumn ||
        !salesColumn ||
        !closingColumn ||
        !dayColumn
    ) {
        return null;
    }

    /*
     * Fixed-width boundaries come directly from the detected
     * header positions.
     *
     * Product: 0 -> PACKG position
     * Packing: PACKG position -> SALES position
     * Sales: SALES position -> CLOSING position
     * Closing: CLOSING position -> DAY position
     * Day: DAY position -> end
     */

    // PALANIAPPA fixed-width product field.
    // Product starts at column 0 and ends immediately before PACKG.
    // Do not depend on numeric tokens because rows may contain "-".
    const product =
        cleanText(
            line.slice(
                productColumn.position,
                packingColumn.position
            )
        );

    // PALANIAPPA fixed-width packing field.
    const packing =
        cleanText(
            line.slice(
                packingColumn.position,
                salesColumn.position
            )
        );

    const salesRaw =
        cleanText(
            line.slice(
                salesColumn.position,
                closingColumn.position
            )
        );

    const closingRaw =
        cleanText(
            line.slice(
                closingColumn.position,
                dayColumn.position
            )
        );

    const dayRaw =
        cleanText(
            line.slice(
                dayColumn.position
            )
        );

    /*
     * Preserve "-" exactly in raw values.
     * Common mapping can decide later whether "-" means null.
     */

    const rawValues = {
        "Product Name": product,
        "PACKG": packing,
        "SALES": salesRaw,
        "CLOSING": closingRaw,
        "DAY": dayRaw
    };

    const values = {
        "Product Name": product,
        "PACKG": packing,
        "SALES":
            salesRaw === "-"
                ? null
                : parseSourceValue(salesRaw),
        "CLOSING":
            closingRaw === "-"
                ? null
                : parseSourceValue(closingRaw),
        "DAY":
            dayRaw === "-"
                ? null
                : parseSourceValue(dayRaw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount:
            [salesRaw, closingRaw, dayRaw]
                .filter(
                    value =>
                        value !== ""
                )
                .length,
        expectedNumericCount: 3,
        numericCountMatches:
            true,
        rawValues,
        values
    };
}

// ============================================================
// META / SEMICOLON STOCK ROW
// ============================================================

function extractSemicolonStockRow(
    line,
    header,
    rowNumber
) {

    const tokens =
        tokenizeSemicolonDataLine(line);

    const sourceColumns =
        Array.isArray(header?.columns)
            ? header.columns
            : [];

    const columns =
        sourceColumns.length >= 8
            ? [...sourceColumns].sort(
                (a, b) =>
                    (a.index ?? 0) - (b.index ?? 0)
            )
            : [
                { index: 0, header: "Product Name", normalized: "PRODUCTNAME" },
                { index: 1, header: "Packing", normalized: "PACKING" },
                { index: 2, header: "Opening", normalized: "OPENING" },
                { index: 3, header: "Purchase", normalized: "PURCHASE" },
                { index: 4, header: "Sales", normalized: "SALES" },
                { index: 5, header: "C.Stock", normalized: "CSTOCK" },
                { index: 6, header: "Expiry", normalized: "EXPIRY" },
                { index: 7, header: "Pr.Sale", normalized: "PRSALE" }
            ];

    const rawValues = {};
    const values = {};

    /*
     * Map by header column order, not by whitespace.
     * This is essential because blank fields are meaningful.
     */

    for (
        let index = 0;
        index < columns.length;
        index++
    ) {

        const column =
            columns[index];

        const token =
            tokens[index];

        const raw =
            token
                ? token.text
                : "";

        rawValues[column.header] =
            raw;

        values[column.header] =
            parseSourceValue(raw);
    }

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount:
            tokens.filter(
                token =>
                    isNumericToken(token.text)
            ).length,
        expectedNumericCount:
            columns.length,
        numericCountMatches:
            true,
        rawValues,
        values
    };
}

// ============================================================
// DETERMINE PRODUCT / PACKING SPLIT
// ============================================================

function findFirstNumericToken(line) {

    const tokens =
        tokenizeDataLine(line);

    for (const token of tokens) {

        if (
            isNumericToken(token.text)
        ) {
            return token;
        }
    }

    return null;
}

// ============================================================
// EXTRACT PRODUCT + PACKING
// ============================================================

function extractLeadingText(
    line,
    firstNumericToken
) {

    const beforeNumeric =
        firstNumericToken
            ? line.slice(
                0,
                firstNumericToken.start
            )
            : line;

    /*
     * The first numeric token belongs to O.Stk
     *
     * Everything before it contains:
     *
     *   Product Name
     *   Packing
     *
     * We use the known header's packing position to
     * identify the boundary when possible.
     */

    return cleanText(beforeNumeric);
}

// ============================================================
// SPLIT PRODUCT AND PACKING
// ============================================================

function splitProductPacking(
    line,
    header,
    firstNumericToken
) {

    const beforeNumeric =
        extractLeadingText(
            line,
            firstNumericToken
        );

    /*
     * Product Name is the first column.
     * Packing is the second column.
     *
     * Script 1 detected the packing header at position 29
     * for the current structure.
     *
     * We use that as the starting reference, but do NOT
     * use it to extract numeric values.
     */

    const packingColumn =
        header.columns.find(
            column =>
                String(column.header)
                    .toUpperCase()
                    .replace(/\s+/g, "") ===
                "PACKING"
        );

    if (packingColumn) {

        const position =
            packingColumn.position;

        if (
            position >= 0 &&
            position < line.length
        ) {

            const productPart =
                cleanText(
                    line.slice(
                        0,
                        position
                    )
                );

            const packingPart =
                cleanText(
                    beforeNumeric.slice(
                        Math.max(
                            0,
                            position
                        )
                    )
                );

            if (
                productPart &&
                packingPart
            ) {
                return {
                    product:
                        productPart,

                    packing:
                        packingPart
                };
            }
        }
    }

    /*
     * Fallback:
     *
     * Product and packing are separated by the first
     * large whitespace boundary before the first numeric.
     */

    const leading =
        beforeNumeric;

    const match =
        leading.match(
            /^(.+?)\s{2,}(\S+)\s*$/
        );

    if (match) {

        return {
            product:
                cleanText(match[1]),

            packing:
                cleanText(match[2])
        };
    }

    return {
        product:
            leading,

        packing:
            ""
    };
}

// ============================================================
// CHECK DATA ROW
// ============================================================


// ============================================================
// H015 - AMAR DRUGS DISTRIBUTORS / TAB-SEPARATED STATEMENT
// ============================================================
//
// IMPORTANT:
// - This branch is ONLY for the exact 26-column TAB-separated
//   statement layout represented by the H015 source header.
// - The existing generic whitespace/numeric tokenizer is NOT used.
// - Product Name is taken from its complete TAB field, so numbers
//   inside product names can never become numeric data.
// - Item Code, Item Name, Packsize and every following source field
//   remain in their original source-column order.
// - No values are calculated or inferred.
// - Raw source text is preserved in rawValues.
// - Numeric source cells are converted individually with parseNumeric.
// - This branch is additive and does not alter any existing structure.
// ============================================================

const H015_SOURCE_HEADERS = [
    "Divison",
    "Item Code",
    "Item Name",
    "Packsize",
    "P. Rate",
    "PTR",
    "Opening",
    "Opening Value",
    "Pur. Qty",
    "Pur. FQty",
    "Rpl. Qty",
    "Pur. Value",
    "Pur. Ret. Qty",
    "Pur. Ret. FQty",
    "Sale Qty",
    "Sale FQty",
    "Sale Value",
    "Sale Qty 1",
    "Sale Qty 2",
    "Sale Ret. Qty",
    "Sale Ret. FQty",
    "Other Qty",
    "Closing",
    "Closing Amount(PTR)",
    "Stock Amount(Pur. Rate)",
    "Status"
];

function normalizeH015HeaderCell(value) {
    return String(value ?? "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toUpperCase()
        .replace(/[.,:;()[\]{}]/g, "")
        .replace(/\s+/g, " ");
}

function isH015TabularHeaderLine(line) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "")
            .replace(/^\uFEFF/, "");

    if (!text.includes("\t")) {
        return false;
    }

    const parts =
        text.split("\t");

    if (parts.length < H015_SOURCE_HEADERS.length) {
        return false;
    }

    for (
        let index = 0;
        index < H015_SOURCE_HEADERS.length;
        index++
    ) {
        if (
            normalizeH015HeaderCell(parts[index]) !==
            normalizeH015HeaderCell(H015_SOURCE_HEADERS[index])
        ) {
            return false;
        }
    }

    /*
     * If extra columns exist, they must be blank. This prevents an
     * unrelated wider TAB statement from being classified as H015.
     */
    for (
        let index = H015_SOURCE_HEADERS.length;
        index < parts.length;
        index++
    ) {
        if (String(parts[index] ?? "").trim()) {
            return false;
        }
    }

    return true;
}

function findH015HeaderIndex(lines) {
    if (!Array.isArray(lines)) {
        return -1;
    }

    for (
        let index = 0;
        index < lines.length;
        index++
    ) {
        if (
            isH015TabularHeaderLine(
                lines[index]
            )
        ) {
            return index;
        }
    }

    return -1;
}

function buildH015Header(
    headerResult,
    headerLine
) {
    const sourceHeader =
        String(
            headerLine ??
            headerResult?.header?.text ??
            H015_SOURCE_HEADERS.join("\t")
        ).replace(/\r/g, "");

    return {
        success: true,

        sourceHeader,

        lineNumber:
            headerResult?.header?.lineNumber ??
            null,

        structure: "H015",

        columns:
            H015_SOURCE_HEADERS.map(
                (headerName, index) => ({
                    index,

                    header:
                        headerName,

                    normalized:
                        normalizeHeaderName(
                            headerName
                        ),

                    /*
                     * H015 is TAB-separated, so position is the
                     * physical TAB-column index rather than a
                     * character offset.
                     */
                    position:
                        index,

                    end:
                        index + 1,

                    source:
                        "H015_TAB_SEPARATED"
                })
            )
    };
}

function isH015SummaryRow(line) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    /*
     * H015 product rows always begin with a Division value.
     * These are defensive footer checks only and do not affect
     * the existing global isEndOfData() behavior.
     */
    return (
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text)
    );
}

function isH015DataRow(line) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return false;
    }

    if (
        isH015SummaryRow(text)
    ) {
        return false;
    }

    if (!text.includes("\t")) {
        return false;
    }

    const parts =
        text.split("\t");

    if (
        parts.length <
        H015_SOURCE_HEADERS.length
    ) {
        return false;
    }

    /*
     * Any columns beyond the authoritative 26 must be blank.
     */
    for (
        let index = H015_SOURCE_HEADERS.length;
        index < parts.length;
        index++
    ) {
        if (
            String(parts[index] ?? "").trim()
        ) {
            return false;
        }
    }

    /*
     * Division and Item Name are required text fields for a product row.
     * Everything else is validated only after its TAB column has been
     * isolated. No word-level numeric tokenization is performed.
     */
    const division =
        cleanText(parts[0]);

    const itemName =
        cleanText(parts[2]);

    const packsize =
        cleanText(parts[3]);

    if (
        !division ||
        !itemName ||
        !packsize
    ) {
        return false;
    }

    /*
     * Columns 5-26 are source numeric fields for this structure.
     * Empty cells are allowed and remain null.
     *
     * Item Code is deliberately NOT forced numeric because the source
     * contains both numeric codes and PRODxxxxx-style codes.
     */
    for (
        let index = 4;
        index < H015_SOURCE_HEADERS.length;
        index++
    ) {
        const value =
            cleanText(parts[index]);

        if (
            value &&
            !isNumericToken(value)
        ) {
            return false;
        }
    }

    return true;
}

function extractH015Row(
    line,
    header,
    rowNumber
) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (
        !isH015DataRow(text)
    ) {
        return null;
    }

    const parts =
        text.split("\t");

    /*
     * Keep exactly the authoritative source columns.
     */
    const sourceValues =
        H015_SOURCE_HEADERS.map(
            (_headerName, index) =>
                cleanText(
                    parts[index]
                )
        );

    const rawValues = {};
    const values = {};

    for (
        let index = 0;
        index < H015_SOURCE_HEADERS.length;
        index++
    ) {
        const headerName =
            H015_SOURCE_HEADERS[index];

        const raw =
            sourceValues[index];

        rawValues[headerName] =
            raw || null;

        /*
         * Do not use parseSourceValue() here.
         *
         * H015 extraction must not perform "+" arithmetic or any
         * other calculation. Each isolated numeric source cell is
         * parsed only as its own source number.
         */
        if (!raw) {
            values[headerName] = null;
        } else if (
            index >= 4 &&
            isNumericToken(raw)
        ) {
            values[headerName] =
                parseNumeric(raw);
        } else {
            values[headerName] =
                raw;
        }
    }

    const numericSourceCount =
        sourceValues
            .slice(4)
            .filter(
                value =>
                    value !== "" &&
                    isNumericToken(value)
            )
            .length;

    const numericSourceValid =
        sourceValues
            .slice(4)
            .every(
                value =>
                    value === "" ||
                    isNumericToken(value)
            );

    return {
        rowNumber,

        rawLine:
            line,

        numericTokenCount:
            numericSourceCount,

        expectedNumericCount:
            H015_SOURCE_HEADERS.length - 4,

        numericCountMatches:
            numericSourceValid,

        rawValues,

        values
    };
}

function extractH015Data(
    absolutePath,
    lines,
    headerResult,
    headerIndex
) {
    const actualHeaderIndex =
        Number.isInteger(headerIndex) &&
        headerIndex >= 0
            ? headerIndex
            : findH015HeaderIndex(lines);

    if (actualHeaderIndex < 0) {
        return {
            success: false,
            file: absolutePath,
            structure: "H015",
            header:
                buildH015Header(
                    headerResult,
                    null
                ),
            message:
                "H015 TAB-separated header could not be identified.",
            records: []
        };
    }

    const headerLine =
        String(
            lines[actualHeaderIndex] || ""
        );

    const h015Header =
        buildH015Header(
            headerResult,
            headerLine
        );

    const h015DataStart =
        actualHeaderIndex + 2;

    const h015Records = [];

    for (
        let index = actualHeaderIndex + 1;
        index < lines.length;
        index++
    ) {
        const line =
            String(
                lines[index] || ""
            );

        if (
            isH015SummaryRow(line)
        ) {
            break;
        }

        if (
            !isH015DataRow(line)
        ) {
            continue;
        }

        const record =
            extractH015Row(
                line,
                h015Header,
                index + 1
            );

        if (record) {
            h015Records.push(record);
        }
    }

    return {
        success: true,
        file: absolutePath,
        structure: "H015",
        header: h015Header,
        dataStart: h015DataStart,
        recordCount: h015Records.length,
        records: h015Records
    };
}


function isDataRow(line, header) {

    const text =
        String(line ?? "");

    if (!text.trim()) {
        return false;
    }

    const trimmed =
        text.trim();

    const upper =
        trimmed.toUpperCase();

    // --------------------------------------------------------
    // PALANIAPPA SPECIAL FORMAT
    // --------------------------------------------------------

    if (isPalaniappaHeader(header)) {

        if (
            /^[-=_]{5,}$/.test(trimmed) ||
            upper.startsWith("SALES:") ||
            upper.startsWith("CLOSING:") ||
            upper.startsWith("* --->")
        ) {
            return false;
        }

        /*
         * A PALANIAPPA row has:
         *
         * Product + Packing + Sales + Closing + Day
         *
         * Values may be "-" when no movement exists.
         */

        const columns =
            [...header.columns]
                .sort(
                    (a, b) =>
                        a.position - b.position
                );

        const pack =
            columns.find(
                column =>
                    normalizeHeaderName(
                        column.header
                    ) === "PACKG"
            );

        const sales =
            columns.find(
                column =>
                    normalizeHeaderName(
                        column.header
                    ) === "SALES"
            );

        if (!pack || !sales) {
            return false;
        }

        const packing =
            cleanText(
                text.slice(
                    pack.position,
                    sales.position
                )
            );

        const transaction =
            cleanText(
                text.slice(
                    sales.position
                )
            );

        return (
            text.slice(0, pack.position).trim().length > 0 &&
            packing.length > 0 &&
            /(?:^|\s)(?:-|-?\d+(?:,\d{3})*(?:\.\d+)?)\s+(?:-|-?\d+(?:,\d{3})*(?:\.\d+)?)(?:\s+(?:-|-?\d+(?:,\d{3})*(?:\.\d+)?))?\s*$/
                .test(transaction)
        );
    }

    // --------------------------------------------------------
    // META SEMICOLON FORMAT
    // --------------------------------------------------------

    if (isSemicolonStockHeader(header)) {

        if (
            /^[-=_]{5,}$/.test(trimmed) ||
            /^TOTAL\s*:/i.test(trimmed)
        ) {
            return false;
        }

        const parts =
            text.split(";");

        const product =
            String(
                parts[0] ?? ""
            ).trim();

        if (!product) {
            return false;
        }

        if (
            /^TOTAL\s*:/i.test(product)
        ) {
            return false;
        }

        /*
         * The report contains a trailing semicolon, so the
         * actual source fields are the header field count.
         */

        return parts.length >= 8;
    }

    // --------------------------------------------------------
    // H010 - SHUBHAM AGENCIES
    // --------------------------------------------------------

    if (
        String(header?.structure || "") === "H010"
    ) {
        if (
            /^[-=_]{5,}$/.test(trimmed) ||
            /^TOTAL\b/i.test(trimmed) ||
            /^GRAND\s+TOTAL\b/i.test(trimmed) ||
            /^SUB\s*TOTAL\b/i.test(trimmed) ||
            /^LAST\s+MONTH\s+SALES\b/i.test(trimmed) ||
            /^RECEIPT\s+VALUE\b/i.test(trimmed)
        ) {
            return false;
        }

        const productColumn =
            getColumn(
                header,
                "PRODUCTNAME"
            );

        const valueColumn =
            getColumn(
                header,
                "VALUE"
            );

        if (!productColumn || !valueColumn) {
            return false;
        }

        const product =
            cleanText(
                text.slice(
                    productColumn.position,
                    valueColumn.position
                )
            );

        /*
         * The product field must contain actual text. We intentionally
         * do not inspect numeric tokens inside it.
         */
        return Boolean(product);
    }

    // --------------------------------------------------------
    // OM DISTRIBUTORS
    // --------------------------------------------------------

    if (isOmDistributorHeader(header)) {
        if (
            /^[-=_]{5,}$/.test(trimmed) ||
            /^DIVISION NAME\s*:/i.test(trimmed) ||
            /^TOTAL AMOUNT/i.test(trimmed) ||
            /^OP_VAL\s+/i.test(trimmed)
        ) {
            return false;
        }

        /*
         * H007 is fixed-width. The generic detector may not expose all
         * eight source columns, so row recognition must use the actual
         * physical H007 boundaries instead of whole-row tokenization.
         */
        const itemName = cleanText(
            text.slice(0, 24)
        );

        if (!itemName) {
            return false;
        }

        const quantityFields = [
            cleanText(text.slice(39, 46)), // OPQTY
            cleanText(text.slice(46, 53)), // P_QTY
            cleanText(text.slice(53, 60)), // REPL
            cleanText(text.slice(60, 67)), // S_QTY
            cleanText(text.slice(67))      // B_QTY
        ];

        /*
         * At least one quantity field must contain a numeric value.
         * Other source fields may legitimately be "---", "-", or blank.
         */
        return quantityFields.some(
            value => isNumericToken(value)
        );
    }

    // --------------------------------------------------------
    // TN845
    // --------------------------------------------------------

    if (isTn845Header(header)) {
        if (/^[-=_]{5,}$/.test(trimmed) ||
            /^TOTAL\b/i.test(trimmed) ||
            /^OPENING VALUE/i.test(trimmed) ||
            /^PURCHASE VALUE/i.test(trimmed) ||
            /^CLOSING VALUE/i.test(trimmed)) {
            return false;
        }

        const product = getColumn(header, "PRODUCTNAME");
        const pack = getColumn(header, "PACK");
        const opstk = getColumn(header, "OPSTK");
        const pur = getColumn(header, "PUR");
        const sale = getColumn(header, "SALE");
        const curStk = getColumn(header, "CURSTK");
        const stkVal = getColumn(header, "STKVAL");

        if (!product || !pack || !opstk || !pur ||
            !sale || !curStk || !stkVal) {
            return false;
        }

        const tokens = trimmed.split(/\s+/);

        if (tokens.length < 8) {
            return false;
        }

        const stockStart = tokens.length - 5;

        if (stockStart < 3) {
            return false;
        }

        const noValue = tokens[0];
        const packValue = tokens[stockStart - 1];
        const productTokens = tokens.slice(1, stockStart - 1);

        if (!/^\d+$/.test(noValue) ||
            !packValue ||
            productTokens.length === 0) {
            return false;
        }

        return true;
    }

        
    // --------------------------------------------------------
    // H005 - FIXED-WIDTH PRODUCT ROW VALIDATION
    // --------------------------------------------------------
    //
    // IMPORTANT:
    // Do not use the generic numeric-token-count test for H005.
    // H005 product rows may contain only zero stock values and may
    // have product/packing text containing no extra numeric tokens.
    // The existing H005 row extractor already knows the physical
    // Product/Packing boundary and validates the seven source values.
    //
    // This branch is intentionally limited to H005 and does not alter
    // any other structure's row detection. It also allows the repeated
    // Start -> End block scanner to find rows such as:
    //   ACNESTAL 5.5 | 75GMS | 0 | 0 | 0 | 0 | 0 | 0.00 | 1932
    // where the generic numeric-token counter can otherwise reject the
    // row because product/packing text is not data.
    // --------------------------------------------------------

    if (
        String(header?.structure || "") === "H005"
    ) {

        if (
            /^[-=_]{5,}$/.test(trimmed) ||
            /^COMPANY\s*:/i.test(trimmed) ||
            /^OPENING\s+VALUE\s*:/i.test(trimmed) ||
            /^PURCHASE\s+VALUE\s*:/i.test(trimmed) ||
            /^CLOSING\s+VALUE\s*:/i.test(trimmed) ||
            /^TOTAL\b/i.test(trimmed) ||
            /^PAGE\s*:/i.test(trimmed) ||
            /^PRODUCT\s+NAME\b/i.test(trimmed)
        ) {
            return false;
        }

        // Reuse the existing H005 extractor as the authoritative
        // fixed-width row validator. No generic token parsing is used.
        return !!extractH005Row(
            text,
            header,
            0
        );
    }

    // --------------------------------------------------------
    // ORIGINAL GENERIC SINGLE-ROW LOGIC
    // --------------------------------------------------------

    if (
        /^[-=_]{5,}$/.test(trimmed)
    ) {
        return false;
    }

    if (
        upper.startsWith("COMPANY :") ||
        upper.startsWith("COMPANY:") ||
        upper.startsWith("DIVISION :") ||
        upper.startsWith("DIVISON :") ||
        upper.startsWith("OPENING VALUE") ||
        upper.startsWith("PURCHASE VALUE") ||
        upper.startsWith("CLOSING VALUE")
    ) {
        return false;
    }

    const numericTokens =
        getNumericTokens(text);

    return numericTokens.length >= 3;
}

// ============================================================
// H005 FIXED-WIDTH STOCK & SALES ROW
// ============================================================
//
// H005 source layout:
// Product Name                 Packing  O.Stk    Purc      Tot    Sale     Qoh        Value  Age
//
// The header's physical character positions are authoritative.
// Do NOT find numeric fields by token position because the product
// name itself may contain numeric-looking text, punctuation, or
// symbols.
//
// Boundaries are derived from Script 1's detected H005 header:
// Product  : 0 -> Packing
// Packing  : Packing -> O.Stk
// O.Stk    : O.Stk -> Purc
// Purc     : Purc -> Tot
// Tot      : Tot -> Sale
// Sale     : Sale -> Qoh
// Qoh      : Qoh -> Value
// Value    : Value -> Age
// Age      : Age -> end
// ============================================================

// ============================================================
// H020 - RADHAKRISHNA PHARMA FIXED-WIDTH STOCK & SALES
// ============================================================
//
// Product Name | Packing | Op.Stk | P.Qtye | Tot |
// S.Qty | Qoh | Value | Age
//
// Physical positions are taken from Script 1's detected header.
// The seven numeric fields remain in exact source order.
// ============================================================

function extractH020Row(
    line,
    header,
    rowNumber
) {

    const columns =
        Array.isArray(header?.columns)
            ? [...header.columns].sort(
                (a, b) =>
                    (a.position ?? 0) -
                    (b.position ?? 0)
            )
            : [];

    const get = normalized =>
        columns.find(
            column =>
                normalizeHeaderName(column.header) ===
                normalized
        );

    const productColumn = get("PRODUCTNAME");
    const packingColumn = get("PACKING");

    if (!productColumn || !packingColumn) {
        return null;
    }

    const text = String(line ?? "");

    /*
     * Product Name is isolated using the physical position
     * of the Packing column.
     */
    const product =
        cleanText(
            text.slice(
                Number(productColumn.position ?? 0),
                Number(packingColumn.position ?? 0)
            )
        );

    /*
     * Everything after Packing is read in source order.
     *
     * Packing | Op.Stk | P.Qtye | Tot | S.Qty | Qoh | Value | Age
     */
    const tail =
        text.slice(
            Number(packingColumn.position ?? 0)
        );

    const tailTokens =
        tokenizeDataLine(tail);

    if (tailTokens.length < 8) {
        return null;
    }

    const packing =
        cleanText(tailTokens[0].text);

    const valueTokens =
        tailTokens.slice(1, 8);

    if (
        valueTokens.length !== 7 ||
        valueTokens.some(
            token => !isNumericToken(token.text)
        )
    ) {
        return null;
    }

    const headers = [
        "Op.Stk",
        "P.Qtye",
        "Tot",
        "S.Qty",
        "Qoh",
        "Value",
        "Age"
    ];

    const rawValues = {
        "Product Name": product,
        "Packing": packing
    };

    const values = {
        "Product Name": product,
        "Packing": packing
    };

    for (let index = 0; index < headers.length; index++) {

        const headerName = headers[index];
        const raw = valueTokens[index].text;

        rawValues[headerName] = raw;
        values[headerName] = parseSourceValue(raw);
    }

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: valueTokens.length,
        expectedNumericCount: 7,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function extractH005Row(
    line,
    header,
    rowNumber
) {

    const columns =
        Array.isArray(header?.columns)
            ? [...header.columns].sort(
                (a, b) =>
                    (a.position ?? 0) -
                    (b.position ?? 0)
            )
            : [];

    const get = normalized =>
        columns.find(
            column =>
                normalizeHeaderName(column.header) ===
                normalized
        );

    const productColumn = get("PRODUCTNAME");
    const packingColumn = get("PACKING");

    if (!productColumn || !packingColumn) {
        return null;
    }

    const text = String(line ?? "");

    /*
     * H005 is a fixed-width report for the first two fields, but the
     * numeric values are right-aligned differently from the short
     * header labels. Therefore the header positions are used to lock
     * the Product/Packing boundary, while the remaining seven fields
     * are read in their source order from the already-isolated tail.
     *
     * This is intentionally NOT a whole-line numeric-token parser.
     * A value such as "30GM" inside Product Name can never become a
     * stock value because Product Name is isolated first.
     */
    const product =
        cleanText(
            text.slice(
                Number(productColumn.position ?? 0),
                Number(packingColumn.position ?? 0)
            )
        );

    const tail =
        text.slice(
            Number(packingColumn.position ?? 0)
        );

    const tailTokens =
        tokenizeDataLine(tail);

    /*
     * The first token after the Packing column is Packing itself.
     * The next seven tokens are, in exact source order:
     * O.Stk | Purc | Tot | Sale | Qoh | Value | Age
     */
    if (tailTokens.length < 8) {
        return null;
    }

    const packing =
        cleanText(tailTokens[0].text);

    const valueTokens =
        tailTokens.slice(1, 8);

    if (
        valueTokens.length !== 7 ||
        valueTokens.some(
            token => !isNumericToken(token.text)
        )
    ) {
        return null;
    }

    const headers = [
        "O.Stk",
        "Purc",
        "Tot",
        "Sale",
        "Qoh",
        "Value",
        "Age"
    ];

    const rawValues = {
        "Product Name": product,
        "Packing": packing
    };

    const values = {
        "Product Name": product,
        "Packing": packing
    };

    for (let index = 0; index < headers.length; index++) {
        const headerName = headers[index];
        const raw = valueTokens[index].text;

        rawValues[headerName] = raw;
        values[headerName] = parseSourceValue(raw);
    }

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: valueTokens.length,
        expectedNumericCount: 7,
        numericCountMatches: true,
        rawValues,
        values
    };
}

// ============================================================
// H010 - SHUBHAM AGENCIES FIXED-WIDTH STOCK / SALES
// ============================================================
//
// Source header:
//
// Product Name              Pack   LstSL  Open Recd. Sales Close  Order  Pend Stk.Value
//
// Physical source fields:
//
// Product Name | Pack | LstSL | Open | Recd. | Sales | Close |
// Order | Pend | Stk.Value
//
// IMPORTANT:
// - Use physical column boundaries derived from the registered H010
//   structure/header, not whitespace tokenization.
// - Numbers inside Product Name or Pack (for example 20MG, 100 GM,
//   60 ML, 10'S) must remain part of those source fields.
// - "-" is preserved as source text.
// - No values are calculated or inferred.
// ============================================================

function extractH010Row(
    line,
    header,
    rowNumber
) {

    const columns =
        Array.isArray(header?.columns)
            ? [...header.columns].sort(
                (a, b) =>
                    Number(a.position ?? 0) -
                    Number(b.position ?? 0)
            )
            : [];

    const findColumn = normalized =>
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === normalized
        );

    const productColumn =
        findColumn("PRODUCTNAME");

    const packColumn =
        findColumn("PACK");

    const lstslColumn =
        findColumn("LSTSL");

    const openColumn =
        findColumn("OPEN");

    const recdColumn =
        findColumn("RECD");

    const salesColumn =
        findColumn("SALES");

    const closeColumn =
        findColumn("CLOSE");

    const orderColumn =
        findColumn("ORDER");

    const pendColumn =
        findColumn("PEND");

    const valueColumn =
        findColumn("VALUE");

    if (
        !productColumn ||
        !packColumn ||
        !lstslColumn ||
        !openColumn ||
        !recdColumn ||
        !salesColumn ||
        !closeColumn ||
        !orderColumn ||
        !pendColumn ||
        !valueColumn
    ) {
        return null;
    }

    const text =
        String(line ?? "");

    if (!text.trim()) {
        return null;
    }

    const ordered = [
        productColumn,
        packColumn,
        lstslColumn,
        openColumn,
        recdColumn,
        salesColumn,
        closeColumn,
        orderColumn,
        pendColumn,
        valueColumn
    ].sort(
        (a, b) =>
            Number(a.position ?? 0) -
            Number(b.position ?? 0)
    );

    const readColumn = (
        column,
        nextColumn
    ) => {

        const normalized =
            normalizeHeaderName(
                column.header
            );

        const nextNormalized =
            nextColumn
                ? normalizeHeaderName(
                    nextColumn.header
                )
                : "";

        const start =
            Number(column.position ?? 0);

        let actualStart = start;

        let end =
            nextColumn
                ? Number(
                    nextColumn.position ?? text.length
                )
                : text.length;

        /*
         * H010 physical data boundary:
         *
         * The header label "Stk.Value" begins at a later visual
         * position, but the actual numeric VALUE data begins at
         * character 77 in the product rows.
         *
         * Therefore:
         *
         *   PEND  -> ends at 77
         *   VALUE -> starts at 77
         *
         * This prevents the first digits of VALUE from being
         * incorrectly included in PEND.
         */
        if (
            normalized === "PEND" &&
            nextNormalized === "VALUE"
        ) {
            end = 77;
        }

        if (
            normalized === "VALUE"
        ) {
            actualStart = 77;
        }

        if (
            actualStart < 0 ||
            actualStart > text.length
        ) {
            return "";
        }

        return cleanText(
            text.slice(
                actualStart,
                Math.min(
                    end,
                    text.length
                )
            )
        );
    };

    const rawValues = {};

    for (
        let index = 0;
        index < ordered.length;
        index++
    ) {

        const column =
            ordered[index];

        const nextColumn =
            ordered[index + 1];

        const normalized =
            normalizeHeaderName(
                column.header
            );

        const value =
            readColumn(
                column,
                nextColumn
            );

        if (normalized === "PRODUCTNAME") {
            rawValues["Product Name"] = value;
        } else if (normalized === "PACK") {
            rawValues["PACK"] = value;
        } else if (normalized === "LSTSL") {
            rawValues["LSTSL"] = value;
        } else if (normalized === "OPEN") {
            rawValues["OPEN"] = value;
        } else if (normalized === "RECD") {
            rawValues["RECD"] = value;
        } else if (normalized === "SALES") {
            rawValues["SALES"] = value;
        } else if (normalized === "CLOSE") {
            rawValues["CLOSE"] = value;
        } else if (normalized === "ORDER") {
            rawValues["ORDER"] = value;
        } else if (normalized === "PEND") {
            rawValues["PEND"] = value;
        } else if (normalized === "VALUE") {
            rawValues["VALUE"] = value;
        }
    }

    if (!rawValues["Product Name"]) {
        return null;
    }

    const rawValuesForReturn = {
        "Product Name":
            rawValues["Product Name"],

        "PACK":
            rawValues["PACK"],

        "LSTSL":
            rawValues["LSTSL"],

        "OPEN":
            rawValues["OPEN"],

        "RECD":
            rawValues["RECD"],

        "SALES":
            rawValues["SALES"],

        "CLOSE":
            rawValues["CLOSE"],

        "ORDER":
            rawValues["ORDER"],

        "PEND":
            rawValues["PEND"],

        "VALUE":
            rawValues["VALUE"]
    };

    const values = {
        "Product Name":
            rawValuesForReturn["Product Name"],

        "PACK":
            parseSourceValue(
                rawValuesForReturn["PACK"]
            ),

        "LSTSL":
            parseSourceValue(
                rawValuesForReturn["LSTSL"]
            ),

        "OPEN":
            parseSourceValue(
                rawValuesForReturn["OPEN"]
            ),

        "RECD":
            parseSourceValue(
                rawValuesForReturn["RECD"]
            ),

        "SALES":
            parseSourceValue(
                rawValuesForReturn["SALES"]
            ),

        "CLOSE":
            parseSourceValue(
                rawValuesForReturn["CLOSE"]
            ),

        "ORDER":
            parseSourceValue(
                rawValuesForReturn["ORDER"]
            ),

        "PEND":
            parseSourceValue(
                rawValuesForReturn["PEND"]
            ),

        "VALUE":
            parseSourceValue(
                rawValuesForReturn["VALUE"]
            )
    };

    return {
        rowNumber,
        rawLine: line,

        numericTokenCount: 0,
        expectedNumericCount: 0,
        numericCountMatches: true,

        rawValues:
            rawValuesForReturn,

        values
    };
}

// ============================================================
// H018 - MULTI-COMPANY FIXED-WIDTH STOCK / SALES
// ============================================================
//
// H018 is a fixed-width source format with the following physical
// source fields:
//
// MEDICINE NAME | PACK | O.B | PURC | TOTAL | L_SLE | ADJ |
// SALES | SAL.VAL | CL.ST | CLST.VAL
//
// IMPORTANT:
// - H018 is extracted by physical source-column boundaries.
// - Do NOT tokenize the complete row to locate numeric values.
// - Numbers inside MEDICINE NAME / PACK remain part of those fields.
// - SALES and CL.ST are separate source columns.
// - SAL.VAL and CLST.VAL are separate source columns.
// - Blank/--- values are valid source data and must not discard a row.
// - H018 can contain multiple company sections in one TXT file.
// - A separator, company heading, or repeated table header does NOT
//   end the complete H018 extraction.
// - Summary/footer lines are skipped, but extraction continues so
//   later company sections are still captured.
// - No values are calculated or inferred.
// ============================================================

function buildH018Header(headerResult) {

    const sourceHeader =
        String(
            headerResult?.header?.text ||
            "MEDICINE NAME      PACK    O.B  PURC TOTAL L_SLE ADJ SALES    SAL.VAL CL.ST   CLST.VAL"
        );

    /*
     * H018 is a known fixed-width source format.
     * Do NOT depend on STRUCTURES for these positions because the
     * current Script 1 header result may identify the structure as
     * MEDICINE_STOCK_SALES without exposing the physical boundaries.
     *
     * Positions are zero-based and end positions are exclusive.
     * These boundaries are taken directly from the supplied H018
     * statement header/data layout.
     */
    const columns = [
        {
            index: 0,
            header: "MEDICINE NAME",
            normalized: "MEDICINENAME",
            position: 0,
            end: 19
        },
        {
            index: 1,
            header: "PACK",
            normalized: "PACK",
            position: 19,
            end: 27
        },
        {
            index: 2,
            header: "O.B",
            normalized: "OB",
            position: 27,
            end: 32
        },
        {
            index: 3,
            header: "PURC",
            normalized: "PURC",
            position: 32,
            end: 37
        },
        {
            index: 4,
            header: "TOTAL",
            normalized: "TOTAL",
            position: 37,
            end: 43
        },
        {
            index: 5,
            header: "L_SLE",
            normalized: "LSLE",
            position: 43,
            end: 49
        },
        {
            index: 6,
            header: "ADJ",
            normalized: "ADJ",
            position: 49,
            end: 53
        },
        {
            index: 7,
            header: "SALES",
            normalized: "SALES",
            position: 53,
            end: 60
        },
        {
            index: 8,
            header: "SAL.VAL",
            normalized: "SALVAL",
            position: 61,
            end: 70
        },
        {
            index: 9,
            header: "CL.ST",
            normalized: "CLST",
            position: 70,
            end: 78
        },
        {
            index: 10,
            header: "CLST.VAL",
            normalized: "CLSTVAL",
            position: 78,
            end: 86
        }
    ];

    return {
        success: true,
        sourceHeader,
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H018",
        columns
    };
}

function isH018HeaderLine(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return false;
    }

    return (
        text.includes("MEDICINE NAME") &&
        (
            text.includes("PURC") ||
            text.includes("SALES")
        )
    );
}

function isH018NonDataLine(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    if (isH018HeaderLine(text)) {
        return true;
    }

    if (
        /^COMPANY\s+NAME\b/.test(text) ||
        /^STOCK\s*&\s*SALES\s+REPORT\b/.test(text) ||
        /^NO\s+MEDICINE\s+NAME\b/.test(text)
    ) {
        return true;
    }

    if (
        /^PAGE\s*[:\-]?\s*\d+\b/.test(text) ||
        /^REPLACEMENT\s+VALUE\b/.test(text) ||
        /^FREE\s+PRODUCT\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^TOTAL\s*:/.test(text) ||
        /^TOTAL\b/.test(text)
    ) {
        return true;
    }

    if (isH017Separator(text)) {
        return true;
    }

    return false;
}

function getH018Columns(header) {

    const columns =
        Array.isArray(header?.columns)
            ? [...header.columns]
            : [];

    return columns
        .filter(
            column =>
                Number.isFinite(
                    Number(column?.position)
                )
        )
        .sort(
            (a, b) =>
                Number(a.position) -
                Number(b.position)
        );
}

function extractH018Row(line, header, rowNumber) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (isH018NonDataLine(text)) {
        return null;
    }

    const columns =
        getH018Columns(header);

    /*
     * H018 requires the complete known structure. If Script 1 / the
     * structure definition cannot provide all source columns, do not
     * fall back to token parsing. That would risk corrupting product
     * names containing numbers.
     */
    if (columns.length < 11) {
        return null;
    }

    const rawValues = {};
    const values = {};

    for (
        let index = 0;
        index < columns.length;
        index++
    ) {

        const column =
            columns[index];

        const start =
            Number(column.position);

        const next =
            columns[index + 1];

        const end =
            next
                ? Number(next.position)
                : text.length;

        const raw =
            cleanText(
                text.slice(start, end)
            );

        const headerName =
            String(
                column.header ||
                column.normalized ||
                `COLUMN_${index + 1}`
            );

        rawValues[headerName] =
            raw || null;

        values[headerName] =
            raw
                ? parseSourceValue(raw)
                : null;
    }

    /*
     * Locate the product column by normalized source name.
     */
    const productColumn =
        columns.find(
            column =>
                normalizeHeaderName(
                    column.header
                ) === "MEDICINENAME"
        );

    if (!productColumn) {
        return null;
    }

    const productIndex =
        columns.indexOf(productColumn);

    const productName =
        cleanText(
            text.slice(
                Number(productColumn.position),
                productIndex + 1 < columns.length
                    ? Number(
                        columns[
                            productIndex + 1
                        ].position
                    )
                    : text.length
            )
        );

    if (!productName) {
        return null;
    }

    /*
     * Prevent obvious non-product text from becoming records.
     * A valid H018 row must contain at least one source value after
     * the product field. "---" and "-" count as valid source values.
     */
    const dataColumns =
        columns.slice(productIndex + 1);

    const hasSourceContent =
        dataColumns.some(
            column => {
                const value =
                    rawValues[
                        String(
                            column.header ||
                            column.normalized
                        )
                    ];

                return Boolean(
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                );
            }
        );

    if (!hasSourceContent) {
        return null;
    }

    return {
        rowNumber,
        rawLine: text,
        rawValues,
        values
    };
}

function extractH018Data(
    absolutePath,
    lines,
    headerResult
) {

    const h018DataStart =
        headerResult.dataStart;

    const h018Header =
        buildH018Header(
            headerResult
        );

    if (
        h018DataStart === null ||
        h018DataStart === undefined
    ) {
        return {
            success: false,
            file: absolutePath,
            structure: "H018",
            header: h018Header,
            message:
                "H018 data start could not be identified.",
            records: []
        };
    }

    /*
     * If the authoritative structure definition did not provide the
     * complete 11-column layout, stop rather than using generic
     * numeric-token extraction.
     */
    if (
        h018Header.columns.length < 11
    ) {
        return {
            success: false,
            file: absolutePath,
            structure: "H018",
            header: h018Header,
            message:
                "H018 physical source columns could not be established.",
            records: []
        };
    }

    const h018Records = [];

    for (
        let index =
            Number(h018DataStart) - 1;
        index < lines.length;
        index++
    ) {

        const line =
            String(
                lines[index] || ""
            );

        const record =
            extractH018Row(
                line,
                h018Header,
                index + 1
            );

        if (record) {
            h018Records.push(record);
        }
    }

    return {
        success: true,
        file: absolutePath,
        structure: "H018",
        header: h018Header,
        dataStart: h018DataStart,
        recordCount:
            h018Records.length,
        records:
            h018Records
    };
}

// ============================================================
// EXTRACT DATA ROW
// ============================================================


// ============================================================
// H029 - ROSHCHEM / COMPANY-WISE STOCK & SALES
// ============================================================
//
// Physical source layout established from the supplied statement:
//
// Product Name              Pack      O.Stk    Purc     Tot    Sale     Qoh        Value  Age
//
// Product Name / Pack are protected text fields.
// Numeric source fields are discovered character-by-character
// after Pack and mapped in header order:
// O.Stk | Purc | Tot | Sale | Qoh | Value | Age
//
// IMPORTANT:
// - H029 is fixed-width.
// - Do NOT tokenize the complete row.
// - Numbers inside Product Name / Pack remain part of those fields.
// - Do NOT calculate or infer values.
// - Preserve source order.
// - This is H029-only; existing structures are untouched.
// ============================================================

// ============================================================
// H029 - SANDEEP PHARMA COMPANY-WISE STOCK & SALES
// ============================================================
//
// H029 source columns:
//
// Product Name | Pack | O.Stk | Purc | Tot | Sale | Qoh | Value | Age
//
// Product Name / Pack are isolated from the H029 header.
// Numeric source values are then identified from the row itself.
// Header order establishes the destination field order:
// O.Stk | Purc | Tot | Sale | Qoh | Value | Age.
//
// IMPORTANT:
// - H029 is handled only in its own structure branch.
// - Preserve physical source columns.
// - Do not tokenize Product Name.
// - Numbers inside Product Name / Pack remain text.
// - Do not calculate or infer any value.
// - Blank source fields and "-" are preserved.
// - Other statement structures are not changed.
// ============================================================

function isH029Header(header) {

    const names =
        Array.isArray(header?.columns)
            ? header.columns.map(
                column =>
                    normalizeHeaderName(
                        column.header
                    )
            )
            : [];

    return (
        names.includes("PRODUCTNAME") &&
        names.includes("PACK") &&
        names.includes("OSTK") &&
        names.includes("PURC") &&
        names.includes("TOT") &&
        names.includes("SALE") &&
        names.includes("QOH") &&
        names.includes("VALUE") &&
        names.includes("AGE")
    );
}

function isH029SummaryOrSeparator(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return true;
    }

    return (
        /^COMPANY\s*:/i.test(text) ||
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^PAGE\s*[:\-]?\s*\d+\b/.test(text) ||
        /^[=\-_*]{5,}$/.test(text)
    );
}

function h029SourceValue(value) {

    const text =
        cleanText(value);

    if (!text) {
        return null;
    }

    return isNumericToken(text)
        ? parseSourceValue(text)
        : text;
}

function h029BuildRecord(
    line,
    rowNumber,
    fields
) {

    const product =
        cleanText(fields[0]);

    if (!product) {
        return null;
    }

    const rawValues = {
        "Product Name": cleanText(fields[0]),
        "Pack": cleanText(fields[1]),
        "O.Stk": cleanText(fields[2]),
        "Purc": cleanText(fields[3]),
        "Tot": cleanText(fields[4]),
        "Sale": cleanText(fields[5]),
        "Qoh": cleanText(fields[6]),
        "Value": cleanText(fields[7]),
        "Age": cleanText(fields[8])
    };

    const values = {
        "Product Name": rawValues["Product Name"],
        "Pack": rawValues["Pack"],
        "O.Stk": h029SourceValue(rawValues["O.Stk"]),
        "Purc": h029SourceValue(rawValues["Purc"]),
        "Tot": h029SourceValue(rawValues["Tot"]),
        "Sale": h029SourceValue(rawValues["Sale"]),
        "Qoh": h029SourceValue(rawValues["Qoh"]),
        "Value": h029SourceValue(rawValues["Value"]),
        "Age": h029SourceValue(rawValues["Age"])
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 7,
        expectedNumericCount: 7,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function extractH029Row(
    line,
    header,
    rowNumber
) {

    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (
        !text.trim() ||
        isH029SummaryOrSeparator(text)
    ) {
        return null;
    }

    /*
     * H029 source rule:
     *
     * 1. Product Name and Pack are protected text fields.
     * 2. Do NOT use numeric character positions for the data columns.
     * 3. After the protected Product Name / Pack area, scan the source
     *    character-by-character.
     * 4. Every continuous numeric sequence is one source value.
     * 5. A standalone "-" is also preserved as one source value.
     * 6. A decimal value such as 1304.76 is ONE continuous value.
     * 7. The detected source order is mapped to:
     *
     *    O.Stk | Purc | Tot | Sale | Qoh | Value | Age
     *
     * Numbers in Product Name / Pack are never considered data values.
     */

    /*
     * Keep the Product Name / Pack boundary supplied by the H029
     * structure/header. Only the numeric source fields are discovered
     * dynamically below.
     *
     * The current H029 header has O.Stk immediately after Pack.
     * Therefore the end of Pack is the start of O.Stk.
     */
    const columns =
        Array.isArray(header?.columns)
            ? header.columns
            : [];

    const productColumn =
        columns.find(
            column =>
                normalizeHeaderName(column.header) ===
                "PRODUCTNAME"
        );

    const packColumn =
        columns.find(
            column =>
                normalizeHeaderName(column.header) ===
                "PACK"
        );

    const firstNumericColumn =
        columns.find(
            column =>
                normalizeHeaderName(column.header) ===
                "OSTK"
        );

    /*
     * If the structure metadata is unavailable, retain the known H029
     * Product/Pack source boundary as a fallback. This fallback is only
     * used to protect text fields; numeric columns are still discovered
     * character-by-character and are never sliced by fixed positions.
     */
    const packEnd =
        Number.isFinite(
            Number(firstNumericColumn?.position)
        )
            ? Number(firstNumericColumn.position)
            : (
                Number.isFinite(
                    Number(packColumn?.end)
                )
                    ? Number(packColumn.end)
                    : 38
            );

    const productEnd =
        Number.isFinite(
            Number(packColumn?.position)
        )
            ? Number(packColumn.position)
            : (
                Number.isFinite(
                    Number(productColumn?.end)
                )
                    ? Number(productColumn.end)
                    : 26
            );

    const product =
        cleanText(
            text.slice(
                0,
                productEnd
            )
        );

    const pack =
        cleanText(
            text.slice(
                productEnd,
                packEnd
            )
        );

    if (!product) {
        return null;
    }

    /*
     * Character-by-character source scanner.
     *
     * A numeric value is accepted only as one continuous sequence:
     *   9
     *   1304.76
     *   -12.50
     *   .75
     *
     * Spaces terminate a value. A standalone "-" is preserved.
     *
     * This intentionally scans ONLY after Product Name / Pack so that
     * "16" in "VERTIREST 16 TAB." and "10" in "10`S" cannot become
     * stock/sales values.
     */
    const sourceArea =
        text.slice(
            packEnd
        );

    const sourceValues = [];
    let index = 0;

    while (index < sourceArea.length) {

        const character =
            sourceArea[index];

        if (/\s/.test(character)) {
            index++;
            continue;
        }

        /*
         * Standalone "-" source value.
         */
        if (
            character === "-" &&
            (
                index + 1 >= sourceArea.length ||
                /\s/.test(
                    sourceArea[index + 1]
                )
            )
        ) {
            sourceValues.push({
                raw: "-",
                start: index,
                end: index + 1
            });

            index++;
            continue;
        }

        /*
         * Numeric sequence.
         *
         * Scan each character rather than splitting the row into
         * whitespace tokens. A decimal point belongs to the same
         * continuous numeric value.
         */
        let cursor = index;

        if (
            sourceArea[cursor] === "-" &&
            /\d|\./.test(
                sourceArea[cursor + 1] || ""
            )
        ) {
            cursor++;
        }

        let digitCount = 0;
        let decimalCount = 0;

        while (cursor < sourceArea.length) {

            const current =
                sourceArea[cursor];

            if (/\d/.test(current)) {
                digitCount++;
                cursor++;
                continue;
            }

            if (
                current === "." &&
                decimalCount === 0
            ) {
                decimalCount++;
                cursor++;
                continue;
            }

            break;
        }

        const candidate =
            sourceArea.slice(
                index,
                cursor
            );

        if (
            digitCount > 0 &&
            isNumericToken(candidate)
        ) {
            sourceValues.push({
                raw: candidate,
                start: index,
                end: cursor
            });

            index = cursor;
            continue;
        }

        /*
         * Anything other than whitespace, "-", or a valid continuous
         * numeric sequence is not a numeric source field. Move one
         * character only so the next numeric sequence is still found.
         */
        index++;
    }

    /*
     * H029 has exactly seven source values after Product/Pack:
     *
     * O.Stk, Purc, Tot, Sale, Qoh, Value, Age
     *
     * Do not silently take an arbitrary numeric value. Require the
     * expected seven source values.
     */
    if (sourceValues.length !== 7) {
        return null;
    }

    const fields = [
        product,
        pack,
        sourceValues[0].raw,
        sourceValues[1].raw,
        sourceValues[2].raw,
        sourceValues[3].raw,
        sourceValues[4].raw,
        sourceValues[5].raw,
        sourceValues[6].raw
    ];

    return h029BuildRecord(
        line,
        rowNumber,
        fields
    );
}



// ============================================================
// H022 - DESCRIPTION / PACK / HSN / STOCK & SALES
// ============================================================
//
// IMPORTANT - H022 ONLY:
//
// This branch is intentionally isolated from the existing generic
// extractor. It does NOT modify any existing structure.
//
// Physical source order:
//
// Description | Pack | HSNCode | Opening | Purchase | Sale |
// P.Re | S.Re | Adj. | Closing
//
// RULE:
// 1. Preserve the source row's physical columns.
// 2. Isolate Description, Pack and HSN first.
// 3. Only then validate numeric source columns.
// 4. Never scan the complete row for numeric tokens.
// 5. Never allow HSN to become Purchase.
// 6. Never treat numbers embedded in Description/Pack as data.
// 7. Do not calculate or infer values.
// 8. Total/footer rows are not products.
// ============================================================

function buildH022Header(headerResult) {
    const detectedHeader =
        String(
            headerResult?.header?.text ||
            ""
        );

    return {
        success: true,
        sourceHeader: detectedHeader,
        lineNumber:
            headerResult?.header?.lineNumber ?? null,
        structure: "H022",
        columns: [
            {
                index: 0,
                header: "Description",
                normalized: "DESCRIPTION",
                position: 0,
                end: 20
            },
            {
                index: 1,
                header: "Pack",
                normalized: "PACK",
                position: 20,
                end: 26
            },
            {
                index: 2,
                header: "hsncode",
                normalized: "HSNCODE",
                position: 26,
                end: 34
            },
            {
                index: 3,
                header: "Opening",
                normalized: "OPENING",
                position: 34,
                end: 48
            },
            {
                index: 4,
                header: "Purchase",
                normalized: "PURCHASE",
                position: 48,
                end: 63
            },
            {
                index: 5,
                header: "Sale",
                normalized: "SALE",
                position: 63,
                end: 74
            },
            {
                index: 6,
                header: "P.Re",
                normalized: "PRE",
                position: 74,
                end: 83
            },
            {
                index: 7,
                header: "S.Re",
                normalized: "SRE",
                position: 83,
                end: 96
            },
            {
                index: 8,
                header: "Adj.",
                normalized: "ADJ",
                position: 96,
                end: 104
            },
            {
                index: 9,
                header: "Closing",
                normalized: "CLOSING",
                position: 104,
                end: null
            }
        ]
    };
}

function isH022HeaderLine(line) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "")
            .toUpperCase()
            .replace(/\s+/g, " ")
            .trim();

    if (!text) {
        return false;
    }

    const normalized =
        text.replace(/[^A-Z0-9]/g, "");

    return (
        normalized.includes("DESCRIPTION") &&
        normalized.includes("PACK") &&
        normalized.includes("HSNCODE") &&
        normalized.includes("OPENING") &&
        normalized.includes("PURCHASE") &&
        normalized.includes("SALE") &&
        normalized.includes("PRE") &&
        normalized.includes("SRE") &&
        normalized.includes("ADJ") &&
        normalized.includes("CLOSING")
    );
}

function isH022SummaryRow(line) {
    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return false;
    }

    return (
        /^TOTAL\b/.test(text) ||
        /^GRAND\s+TOTAL\b/.test(text) ||
        /^SUB\s*TOTAL\b/.test(text) ||
        /^OPENING\s+VALUE\b/.test(text) ||
        /^PURCHASE\s+VALUE\b/.test(text) ||
        /^SALE\s+VALUE\b/.test(text) ||
        /^CLOSING\s+VALUE\b/.test(text) ||
        /^VALUE\s+OF\s*::/.test(text) ||
        text.includes("*** END OF REPORT ***")
    );
}

function isH022NumericField(value) {
    return isNumericToken(value);
}

function extractH022Row(
    line,
    header,
    rowNumber
) {
    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return null;
    }

    if (isH022HeaderLine(text) || isH022SummaryRow(text)) {
        return null;
    }

    /*
     * H022 ONLY - SOURCE COLUMN EXTRACTION
     *
     * IMPORTANT:
     * The H022 header labels are NOT physically aligned with the
     * numeric data positions in this statement. Therefore do not use
     * header label character positions as data boundaries.
     *
     * The source row itself establishes the boundaries:
     *
     *   Description | Pack | HSNCode | Opening | Purchase | Sale |
     *   P.Re | S.Re | Adj. | Closing
     *
     * Description is isolated first, then Pack, then the HSN field.
     * Only after those three source columns are separated are the seven
     * remaining numeric source fields read.
     *
     * This is deliberately NOT whole-row numeric-token extraction.
     * Numbers such as 100MG / 25MG / 12.5MG in Description remain text.
     */
    const match =
        text.match(
            /^\s*(.*?)\s{2,}(\S+)\s{2,}(\d{4,8})\s+(.+?)\s*$/
        );

    if (!match) {
        return null;
    }

    const description =
        cleanText(match[1]);

    const pack =
        cleanText(match[2]);

    const hsnCode =
        cleanText(match[3]);

    const numericArea =
        cleanText(match[4]);

    if (
        !description ||
        !pack ||
        !hsnCode ||
        !numericArea
    ) {
        return null;
    }

    /*
     * The seven numeric source columns occur after HSN in source order.
     * Splitting ONLY this already-isolated numeric area prevents HSN and
     * numbers inside Description/Pack from entering the numeric fields.
     */
    const numericFields =
        numericArea
            .split(/\s+/)
            .filter(Boolean);

    if (numericFields.length !== 7) {
        return null;
    }

    const [
        openingRaw,
        purchaseRaw,
        saleRaw,
        preRaw,
        sreRaw,
        adjustmentRaw,
        closingRaw
    ] = numericFields;

    if (
        !numericFields.every(
            value => isH022NumericField(value)
        )
    ) {
        return null;
    }

    const rawValues = {
        "Description": description,
        "Pack": pack,
        "hsncode": hsnCode,
        "Opening": openingRaw,
        "Purchase": purchaseRaw,
        "Sale": saleRaw,
        "P.Re": preRaw,
        "S.Re": sreRaw,
        "Adj.": adjustmentRaw,
        "Closing": closingRaw
    };

    const values = {
        "Description": description,
        "Pack": pack,
        "hsncode": hsnCode,
        "Opening": parseSourceValue(openingRaw),
        "Purchase": parseSourceValue(purchaseRaw),
        "Sale": parseSourceValue(saleRaw),
        "P.Re": parseSourceValue(preRaw),
        "S.Re": parseSourceValue(sreRaw),
        "Adj.": parseSourceValue(adjustmentRaw),
        "Closing": parseSourceValue(closingRaw)
    };

    return {
        rowNumber,
        rawLine: line,
        numericTokenCount: 7,
        expectedNumericCount: 7,
        numericCountMatches: true,
        rawValues,
        values
    };
}

function extractRow(
    line,
    header,
    rowNumber
) {

        // --------------------------------------------------------
    // H034 - ARHAM PHYSICAL STOCK COLUMNS
    // --------------------------------------------------------
    if (structureId === "H034") {
        const columns = Array.isArray(header?.columns)
            ? header.columns
            : [];

        if (columns.length !== 7) {
            return null;
        }

        const text = String(line ?? "");
        const rawValues = {};
        const values = {};

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const start = Number(column.position);
            const end = columns[i + 1]
                ? Number(columns[i + 1].position)
                : text.length;

            const raw = text
                .slice(start, end)
                .trim();

            rawValues[column.header] = raw;

            if (i < 2) {
                // Product Name and Unit are text fields.
                values[column.header] = raw;
                continue;
            }

            // Preserve empty cells; do not convert them to zero.
            if (raw === "") {
                values[column.header] = null;
                continue;
            }

            const numericValue = Number(
                raw.replace(/,/g, "")
            );

            values[column.header] =
                Number.isFinite(numericValue)
                    ? numericValue
                    : raw;
        }

        const numericFields = columns
            .slice(2)
            .map(column => rawValues[column.header]);

        return {
            rowNumber,
            rawLine: text,
            numericTokenCount: 5,
            expectedNumericCount: 5,
            numericCountMatches:
                numericFields.length === 5 &&
                numericFields.every(
                    value =>
                        value !== "" &&
                        Number.isFinite(
                            Number(value.replace(/,/g, ""))
                        )
                ),
            rawValues,
            values
        };
    }

    // --------------------------------------------------------
    // PALANIAPPA
    // --------------------------------------------------------

    const structureId =
        String(
            header?.structure || ""
        );

    
    // --------------------------------------------------------
    // H015 - AMAR DRUGS DISTRIBUTORS / TAB-SEPARATED
    // --------------------------------------------------------
    //
    // H015 must never enter the generic whitespace/numeric tokenizer.
    // Its TAB columns are authoritative.
    // --------------------------------------------------------

    if (
        structureId === "H015"
    ) {
        return extractH015Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H028 - PALANIAPPA
    // --------------------------------------------------------

    if (
        structureId === "H028" ||
        isPalaniappaHeader(header)
    ) {
        return extractPalaniappaRow(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H031 - META / SEMICOLON STOCK
    // --------------------------------------------------------

    if (
        structureId === "H031" ||
        isSemicolonStockHeader(header)
    ) {
        return extractSemicolonStockRow(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H010 - SHUBHAM AGENCIES
    // --------------------------------------------------------

    if (
        structureId === "H010"
    ) {
        return extractH010Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H013 - SRI VENKATESWARA PHARMA / TN485
    // --------------------------------------------------------
    //
    // H013 is intentionally routed before generic numeric extraction.
    // This protects ProductName / Pack from token-level numeric parsing
    // and preserves rows where numeric source cells are blank.
    // --------------------------------------------------------

    if (
        structureId === "H013"
    ) {
        return extractH013Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H014 - VASU MEDICAL ENTERPRISES
    // --------------------------------------------------------

    if (
        structureId === "H014"
    ) {
        return extractH014Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H007 / OM DISTRIBUTORS
    // --------------------------------------------------------

    if (
        structureId === "H007" ||
        isOmDistributorHeader(header)
    ) {
        return extractOmDistributorRow(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H006 - ITEMCODE / ITEMNAME / CLOSING STOCK FORMAT
    // --------------------------------------------------------

    if (
        structureId === "H006"
    ) {
        return extractH006Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
// H020 - RADHAKRISHNA PHARMA FIXED-WIDTH STOCK & SALES
// --------------------------------------------------------

if (
    structureId === "H020"
) {
    return extractH020Row(
        line,
        header,
        rowNumber
    );
}

    // --------------------------------------------------------
    // H005 - FIXED-WIDTH STOCK & SALES
    // --------------------------------------------------------

    if (
        structureId === "H005"
    ) {
        return extractH005Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H009 - TN845
    // --------------------------------------------------------

    if (
        structureId === "H009" ||
        isTn845Header(header)
    ) {
        if (isTn845PlusRow(line)) {
            return extractTn845PlusRow(
                line,
                header,
                rowNumber
            );
        }

        return extractTn845Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H029 - ROSHCHEM / COMPANY-WISE STOCK & SALES
    // --------------------------------------------------------

    if (
        structureId === "H029" ||
        isH029Header(header)
    ) {
        return extractH029Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // H022 - DESCRIPTION / PACK / HSN / STOCK & SALES
    // --------------------------------------------------------
    //
    // H022 is intentionally handled before generic numeric extraction.
    // The generic path is not allowed to tokenize H022 because HSN and
    // numeric-looking text inside Description/Pack must remain in their
    // original physical columns.
    //
    if (
        structureId === "H022"
    ) {
        return extractH022Row(
            line,
            header,
            rowNumber
        );
    }

    // --------------------------------------------------------
    // ORIGINAL GENERIC EXTRACTION
    // --------------------------------------------------------

    const numericTokens =
        getNumericTokens(line);

    if (!numericTokens.length) {
        return null;
    }

    /*
     * Find the first numeric token.
     *
     * For the original structure this is O.Stk.
     */

    const firstNumeric =
        numericTokens[0];

    const leading =
        splitProductPacking(
            line,
            header,
            firstNumeric
        );

    /*
     * The remaining numeric values stay in SOURCE ORDER.
     *
     * No arithmetic.
     * No recalculation.
     * No inferred values.
     */

    const numericValues =
        numericTokens.map(
            token => token.value
        );

    const rawNumericValues =
        numericTokens.map(
            token => token.text
        );

    /*
     * Determine numeric header columns.
     */

    const numericHeaders =
        header.columns
            .slice(2)
            .map(
                column =>
                    column.header
            );

    const rawValues = {};
    const values = {};

    /*
     * Product and packing
     */

    rawValues["Product Name"] =
        leading.product;

    rawValues["Packing"] =
        leading.packing;

    values["Product Name"] =
        leading.product;

    values["Packing"] =
        leading.packing;

    /*
     * Numeric values
     */

    for (
        let index = 0;
        index < numericHeaders.length;
        index++
    ) {

        const headerName =
            numericHeaders[index];

        const raw =
            rawNumericValues[index];

        const value =
            numericValues[index];

        rawValues[headerName] =
            raw !== undefined
                ? raw
                : null;

        values[headerName] =
            value !== undefined
                ? value
                : null;
    }

    return {

        rowNumber,

        rawLine:
            line,

        numericTokenCount:
            numericTokens.length,

        expectedNumericCount:
            numericHeaders.length,

        numericCountMatches:
            numericTokens.length ===
            numericHeaders.length,

        rawValues,

        values
    };
}


// ============================================================
// SPECIAL STRUCTURE SUPPORT
// ============================================================

function isOmDistributorHeader(header) {
    const names = (header.columns || []).map(
        column => normalizeHeaderName(column.header)
    );

    /*
     * The generic header detector may expose only some H007 labels
     * because adjacent fixed-width labels are close together.
     *
     * The complete physical header is still authoritative.
     * Therefore recognize H007 from either:
     *   1. all expected detected columns, OR
     *   2. the actual header text containing the complete H007 label set.
     */
    const completeDetected =
        names.includes("ITEMNAME") &&
        names.includes("BOX") &&
        names.includes("PACK") &&
        names.includes("OPQTY") &&
        names.includes("P_QTY") &&
        names.includes("REPL") &&
        names.includes("S_QTY") &&
        names.includes("B_QTY");

    const headerText = String(
        header?.sourceHeader ??
        header?.text ??
        ""
    ).replace(/\\u000f/g, "").replace(/\\u0000/g, "");

    const completePhysicalHeader =
        /ITEM\\s+NAME/i.test(headerText) &&
        /\\bBOX\\b/i.test(headerText) &&
        /\\bPACK\\b/i.test(headerText) &&
        /\\bOPQTY\\b/i.test(headerText) &&
        /\\bP_QTY\\b/i.test(headerText) &&
        /\\bREPL\\b/i.test(headerText) &&
        /\\bS_QTY\\b/i.test(headerText) &&
        /\\bB_QTY\\b/i.test(headerText);

    return completeDetected || completePhysicalHeader;
}

function isTn845Header(header) {
    const names = (header.columns || []).map(column => normalizeHeaderName(column.header));

    /*
     * TN845 source header is:
     * No | Product Name | Pack | Opstk | Pur | Sale | CurStk | StkVal
     *
     * The header extractor correctly exposes Sale and CurStk
     * as separate columns, so detect the actual source structure.
     */
    return names.includes("NO") &&
        names.includes("PRODUCTNAME") &&
        names.includes("PACK") &&
        names.includes("OPSTK") &&
        names.includes("PUR") &&
        names.includes("SALE") &&
        names.includes("CURSTK") &&
        names.includes("STKVAL");
}

function splitTn845SourceColumns(line) {
    /*
     * TN845 is a structured/fixed-width statement.
     *
     * IMPORTANT:
     * - Preserve the source row's existing column boundaries.
     * - Do NOT classify individual words/tokens as numeric.
     * - Numbers inside Product Name remain part of Product Name.
     * - The separator between Product Name and Pack is the source
     *   column spacing (2 or more whitespace characters).
     *
     * Source columns:
     *
     *   No | Product Name | Pack | Opstk | Pur | Sale | CurStk | StkVal
     *
     * Product names may contain:
     *   100MG
     *   50 TAB
     *   75 MG
     *   100/10MG
     *   15`S
     *   other numeric-looking text
     *
     * The final six source columns are isolated from the right by
     * their existing column separators. This is column extraction,
     * not word-level numeric-token extraction.
     */
    const text =
        String(line ?? "")
            .replace(/\r/g, "");

    if (!text.trim()) {
        return null;
    }

    /*
     * A valid TN845 row uses the statement's visible spacing to
     * separate source columns. Single spaces are therefore preserved
     * inside Product Name.
     */
    const match =
        text.match(
            /^\s*(\d+)\s{2,}(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(\S+)\s*$/
        );

    if (!match) {
        return null;
    }

    return {
        no: cleanText(match[1]),
        productName: cleanText(match[2]),
        pack: cleanText(match[3]),
        opstk: cleanText(match[4]),
        pur: cleanText(match[5]),
        sale: cleanText(match[6]),
        curStk: cleanText(match[7]),
        stkVal: cleanText(match[8])
    };
}

function isTn845PlusRow(line) {
    /*
     * Detect the PLUS variant only after the source columns have been
     * separated using the statement's physical spacing.
     *
     * PLUS quantities such as 5+0 and 149+4 are source values.
     * They are never treated as ordinary numeric tokens.
     */
    const columns =
        splitTn845SourceColumns(line);

    if (!columns) {
        return false;
    }

    return [
        columns.opstk,
        columns.pur,
        columns.sale,
        columns.curStk,
        columns.stkVal
    ].some(
        value =>
            /^\d+(?:\.\d+)?\+\d+(?:\.\d+)?$/.test(
                String(value || "")
            )
    );
}

function getColumn(header, normalizedName) {
    return (header.columns || []).find(
        column => normalizeHeaderName(column.header) === normalizedName
    );
}

function extractOmDistributorRow(line, header, rowNumber) {

    const columns =
        Array.isArray(header?.columns)
            ? [...header.columns]
                .sort(
                    (a, b) =>
                        Number(a.position ?? 0) -
                        Number(b.position ?? 0)
                )
            : [];

    /*
     * H007 / OM DISTRIBUTORS
     *
     * The source is a fixed-width report.
     *
     * IMPORTANT:
     * - Header positions define the physical column boundaries.
     * - Do NOT tokenize the whole row to find numeric values.
     * - Do NOT search for numeric tokens inside ITEM NAME.
     * - A value such as 60ML, 08X60M or 100GM remains part of
     *   ITEM NAME when it is physically inside the ITEM NAME field.
     *
     * Source order:
     *
     *   ITEM NAME | BOX | PACK | OPQTY | P_QTY | REPL | S_QTY | B_QTY
     */

    const getColumnByNames = names =>
        columns.find(
            column =>
                names.includes(
                    normalizeHeaderName(column.header)
                )
        );

    let item = getColumnByNames([
        "ITEMNAME",
        "ITEM_NAME"
    ]);

    let box = getColumnByNames(["BOX"]);
    let pack = getColumnByNames(["PACK"]);
    let opQty = getColumnByNames(["OPQTY"]);
    let pQty = getColumnByNames(["P_QTY"]);
    let repl = getColumnByNames(["REPL"]);
    let sQty = getColumnByNames(["S_QTY"]);
    let bQty = getColumnByNames(["B_QTY"]);

    /*
     * H007 header detection can expose only a subset of the physical
     * columns. When that happens, use the known H007 fixed-width layout
     * from the actual source header.
     *
     * This fallback is H007-only and does not alter any other structure.
     */
    if (
        !item ||
        !box ||
        !pack ||
        !opQty ||
        !pQty ||
        !repl ||
        !sQty ||
        !bQty
    ) {
        const h007Positions = [
            ["ITEM NAME", "ITEMNAME", 0],
            ["BOX", "BOX", 24],
            ["PACK", "PACK", 31],
            ["OPQTY", "OPQTY", 39],
            ["P_QTY", "P_QTY", 46],
            ["REPL", "REPL", 53],
            ["S_QTY", "S_QTY", 60],
            ["B_QTY", "B_QTY", 67]
        ];

        const makeColumn = (headerName, normalized, position) => ({
            header: headerName,
            normalized,
            position,
            end: position
        });

        item = makeColumn("ITEM NAME", "ITEMNAME", 0);
        box = makeColumn("BOX", "BOX", 24);
        pack = makeColumn("PACK", "PACK", 31);
        opQty = makeColumn("OPQTY", "OPQTY", 39);
        pQty = makeColumn("P_QTY", "P_QTY", 46);
        repl = makeColumn("REPL", "REPL", 53);
        sQty = makeColumn("S_QTY", "S_QTY", 60);
        bQty = makeColumn("B_QTY", "B_QTY", 67);
    }

    const text = String(line ?? "");

    if (!text.trim()) {
        return null;
    }

    /*
     * Read each source column by its physical header position.
     *
     * The next detected column position is the end boundary.
     * The final column extends to the end of the source row.
     */
    const ordered = [
        item,
        box,
        pack,
        opQty,
        pQty,
        repl,
        sQty,
        bQty
    ].sort(
        (a, b) =>
            Number(a.position ?? 0) -
            Number(b.position ?? 0)
    );

    const readColumn = (column, nextColumn) => {

        const start =
            Number(column.position ?? 0);

        const end =
            nextColumn
                ? Number(nextColumn.position ?? text.length)
                : text.length;

        if (start < 0 || start > text.length) {
            return "";
        }

        return cleanText(
            text.slice(
                start,
                Math.min(end, text.length)
            )
        );
    };

    const rawValues = {};

    for (let index = 0; index < ordered.length; index++) {

        const column = ordered[index];
        const nextColumn = ordered[index + 1];

        const normalized =
            normalizeHeaderName(column.header);

        const value =
            readColumn(
                column,
                nextColumn
            );

        if (normalized === "ITEMNAME" || normalized === "ITEM_NAME") {
            rawValues["ITEM NAME"] = value;
        } else if (normalized === "BOX") {
            rawValues["BOX"] = value;
        } else if (normalized === "PACK") {
            rawValues["PACK"] = value;
        } else if (normalized === "OPQTY") {
            rawValues["OPQTY"] = value;
        } else if (normalized === "P_QTY") {
            rawValues["P_QTY"] = value;
        } else if (normalized === "REPL") {
            rawValues["REPL"] = value;
        } else if (normalized === "S_QTY") {
            rawValues["S_QTY"] = value;
        } else if (normalized === "B_QTY") {
            rawValues["B_QTY"] = value;
        }
    }

    /*
     * A valid H007 row must have the source columns available.
     * Blank numeric source values remain blank/null rather than
     * being inferred from another field.
     */
    const values = {
        "ITEM NAME":
            parseSourceValue(
                rawValues["ITEM NAME"]
            ),

        "BOX":
            parseSourceValue(
                rawValues["BOX"]
            ),

        "PACK":
            parseSourceValue(
                rawValues["PACK"]
            ),

        "OPQTY":
            parseSourceValue(
                rawValues["OPQTY"]
            ),

        "P_QTY":
            parseSourceValue(
                rawValues["P_QTY"]
            ),

        "REPL":
            parseSourceValue(
                rawValues["REPL"]
            ),

        "S_QTY":
            parseSourceValue(
                rawValues["S_QTY"]
            ),

        "B_QTY":
            parseSourceValue(
                rawValues["B_QTY"]
            )
    };

    /*
     * ITEM NAME is mandatory for an H007 product record.
     * Numeric-looking text inside ITEM NAME is intentionally
     * untouched because it was extracted by physical column.
     */
    if (!rawValues["ITEM NAME"]) {
        return null;
    }

    return {
        rowNumber,
        rawLine: line,

        numericTokenCount: [
            rawValues["OPQTY"],
            rawValues["P_QTY"],
            rawValues["REPL"],
            rawValues["S_QTY"],
            rawValues["B_QTY"]
        ].filter(
            value =>
                isNumericToken(value)
        ).length,

        expectedNumericCount: 5,

        numericCountMatches:
            [
                rawValues["OPQTY"],
                rawValues["P_QTY"],
                rawValues["REPL"],
                rawValues["S_QTY"],
                rawValues["B_QTY"]
            ].every(
                value =>
                    isNumericToken(value)
            ),

        rawValues,
        values
    };
}

function extractTn845PlusRow(line, header, rowNumber) {

    const no = getColumn(header, "NO");
    const product = getColumn(header, "PRODUCTNAME");
    const pack = getColumn(header, "PACK");
    const opstk = getColumn(header, "OPSTK");
    const pur = getColumn(header, "PUR");
    const sale = getColumn(header, "SALE");
    const curStk = getColumn(header, "CURSTK");
    const stkVal = getColumn(header, "STKVAL");

    if (!no || !product || !pack || !opstk || !pur ||
        !sale || !curStk || !stkVal) {
        return null;
    }

    const columns =
        splitTn845SourceColumns(line);

    if (!columns || !columns.productName) {
        return null;
    }

    /*
     * Source-column extraction is authoritative.
     *
     * Product Name is taken as the complete source field. Therefore
     * values such as 50MG, 15`S, 100/10MG, etc. are never removed
     * simply because they look numeric.
     */
    const rawValues = {
        "No": columns.no,
        "Product Name": columns.productName,
        "Pack": columns.pack,
        "Opstk": columns.opstk,
        "Pur": columns.pur,
        "Sale": columns.sale,
        "CurStk": columns.curStk,
        "StkVal": columns.stkVal
    };

    const values = {};

    for (const key of Object.keys(rawValues)) {
        values[key] =
            parseSourceValue(
                rawValues[key]
            );
    }

    return {
        rowNumber,
        rawLine: line,

        /*
         * Keep the existing TN845 result contract.
         * The five trailing source fields were separated successfully,
         * including N+N values and "-".
         */
        numericTokenCount: 5,
        expectedNumericCount: 5,
        numericCountMatches: true,

        rawValues,
        values
    };
}

function extractTn845Row(line, header, rowNumber) {

    const no = getColumn(header, "NO");
    const product = getColumn(header, "PRODUCTNAME");
    const pack = getColumn(header, "PACK");
    const opstk = getColumn(header, "OPSTK");
    const pur = getColumn(header, "PUR");
    const sale = getColumn(header, "SALE");
    const curStk = getColumn(header, "CURSTK");
    const stkVal = getColumn(header, "STKVAL");

    if (!no || !product || !pack || !opstk || !pur ||
        !sale || !curStk || !stkVal) {
        return null;
    }

    /*
     * TN845 source structure:
     *
     * No | Product Name | Pack | Opstk | Pur | Sale | CurStk | StkVal
     *
     * IMPORTANT:
     * Product Name is a source column, not a collection of numeric
     * and non-numeric tokens.
     *
     * Examples that must remain entirely inside Product Name when
     * physically present there:
     *
     *   BRITAM 100MG TAB
     *   BRITAM 50 TAB
     *   PREGALIFT ER 50 TAB 15`S
     *   PREGALIFT ER75 MG 15`S
     *   VYSOV D 100/10MG TAB
     *
     * Pack is separated from Product Name using the source statement
     * spacing/column boundary.
     */
    const columns =
        splitTn845SourceColumns(line);

    if (!columns || !columns.productName) {
        return null;
    }

    const rawValues = {
        "No": columns.no,
        "Product Name": columns.productName,
        "Pack": columns.pack,
        "Opstk": columns.opstk,
        "Pur": columns.pur,
        "Sale": columns.sale,
        "CurStk": columns.curStk,
        "StkVal": columns.stkVal
    };

    const values = {};

    for (const key of Object.keys(rawValues)) {
        values[key] =
            parseSourceValue(
                rawValues[key]
            );
    }

    return {
        rowNumber,
        rawLine: line,

        /*
         * The TN845 data structure contains five stock/value source
         * columns after Pack.
         *
         * numericTokenCount is retained for compatibility with the
         * existing extractor result format. It does NOT represent
         * word-level tokenization of the row.
         */
        numericTokenCount: 5,
        expectedNumericCount: 5,
        numericCountMatches: true,

        rawValues,
        values
    };
}


// ============================================================
// FIND END OF DATA
// ============================================================

function isEndOfData(line) {

    const text =
        String(line ?? "")
            .trim()
            .toUpperCase();

    if (!text) {
        return false;
    }

    return (
        text.startsWith("OPENING VALUE") ||
        text.startsWith("PURCHASE VALUE") ||
        text.startsWith("CLOSING VALUE") ||
        /^CL\.STK\s+VAL/i.test(text) ||
        /^OPG\.STK\s+VAL/i.test(text) ||
        /^PURC\.VALUE/i.test(text) ||
        /^PUR\.RETVAL/i.test(text) ||
        /^SALRET\s+VAL/i.test(text) ||
        /^TOTAL\s*:/i.test(text) ||
        /^TOTAL\b/i.test(text) ||
        text.includes("*** END OF REPORT ***")
    );
}


function isH031DataLine(line) {
    const text = String(line ?? "").trim();
    if (!text || /^TOTAL\s*:/i.test(text)) return false;
    const parts = text.split(";");
    const product = String(parts[0] ?? "").trim();
    return Boolean(product) && !/^TOTAL\s*:/i.test(product) && parts.length >= 8;
}

// ============================================================
// MAIN EXTRACTION
// ============================================================

function extractSingleRowData(
    filePath
) {

    const absolutePath =
        path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {

        throw new Error(
            `TXT file not found: ${absolutePath}`
        );
    }

    /*
     * Script 1 identifies the header.
     */
    const headerResult =
        extractSingleRowHeader(
            absolutePath
        );

    if (!headerResult.success) {

        /*
         * Additive H015 fallback:
         *
         * Script 1 may not recognize the exact TAB-separated H015
         * layout yet. In that case, read the source only to check for
         * the exact H015 header. If it is not H015, preserve the
         * original failure behavior exactly.
         */
        try {
            const h015ReaderModule =
                require("../readers/txtReader");

            const h015ReaderResult =
                h015ReaderModule.readTXT(
                    absolutePath
                );

            if (
                h015ReaderResult &&
                h015ReaderResult.success &&
                Array.isArray(
                    h015ReaderResult.lines
                )
            ) {
                const h015FallbackLines =
                    h015ReaderResult.lines;

                const h015FallbackHeaderIndex =
                    findH015HeaderIndex(
                        h015FallbackLines
                    );

                if (
                    h015FallbackHeaderIndex >= 0
                ) {
                    return extractH015Data(
                        absolutePath,
                        h015FallbackLines,
                        headerResult,
                        h015FallbackHeaderIndex
                    );
                }
            }
        } catch (_h015FallbackError) {
            /*
             * Preserve the original Script 1 failure response if the
             * additive H015 fallback cannot read the source.
             */
        }

        return {
            success: false,

            file:
                absolutePath,

            message:
                "Single-row header could not be identified.",

            records: []
        };
    }

    // Step 1 returns the detected header metadata, but it does not
    // expose the complete source lines. Read the TXT again here so
    // data extraction always has the actual statement rows.
    const readerModule =
        require("../readers/txtReader");

    const readerResult =
        readerModule.readTXT(
            absolutePath
        );

    if (
        !readerResult ||
        !readerResult.success ||
        !Array.isArray(readerResult.lines)
    ) {
        return {
            success: false,
            file: absolutePath,
            header: headerResult.header,
            message:
                "TXT source lines could not be read for data extraction.",
            records: []
        };
    }

    const lines =
        readerResult.lines;

    // ============================================================
    // H015 - AMAR DRUGS DISTRIBUTORS / TAB-SEPARATED EXTRACTION
    // ============================================================
    //
    // This exact 26-column TAB layout is detected from the raw source
    // header. It is intentionally checked before all existing
    // structure branches so the generic whitespace tokenizer can never
    // split Item Name or shift Item Code/numeric columns.
    //
    // Existing structures are unaffected because this route activates
    // only when the exact H015 source header is present.
    // ============================================================

    const h015HeaderIndex =
        findH015HeaderIndex(lines);

    if (
        h015HeaderIndex >= 0
    ) {
        return extractH015Data(
            absolutePath,
            lines,
            headerResult,
            h015HeaderIndex
        );
    }

    // ============================================================
    // STRUCTURE-BASED H009 EXTRACTION
    // ============================================================
    //
    // H009 header is fixed-width, but the data rows are not safely
    // extracted by copying the header character positions. The
    // existing TN845 row parser already understands the actual row
    // grammar:
    //
    // No | Product Name | Pack | Opstk | Pur | Sale | CurStk | StkVal
    //
    // Use that parser so the first product character is preserved and
    // values such as 5+0, 62+12 and "-" remain intact.
    //
    if (
        headerResult.structure === "H009"
    ) {

        const records = [];

        const startIndex =
            Math.max(
                0,
                Number(
                    headerResult.dataStart || 1
                ) - 1
            );

        for (
            let index = startIndex;
            index < lines.length;
            index++
        ) {

            const line =
                String(
                    lines[index] || ""
                );

            const trimmed =
                line.trim();

            if (!trimmed) {
                continue;
            }

            // A genuine H009/TN845 product row always starts with its serial number.
            // This prevents summary rows such as "Cl.Stk Val:" from being parsed.
            if (!/^\d+\b/.test(trimmed)) {
                continue;
            }

            if (
                /^[=\-_*]{5,}$/.test(
                    trimmed
                )
            ) {
                continue;
            }

            /*
             * Existing TN845 parser is the authoritative row parser
             * for H009. It already handles:
             *
             *   No
             *   Product Name
             *   Pack
             *   Opstk
             *   Pur
             *   Sale
             *   CurStk
             *   StkVal
             */
            /*
             * The existing TN845 row parser expects the complete
             * legacy header object as its second argument. Step 1's
             * structure header is authoritative, but its diagnostic
             * columns may omit the trailing STKVAL column. Build the
             * minimal compatibility header here without changing
             * the existing parser.
             */
            /*
             * H009 compatibility header
             * --------------------------------
             * Script 1 may collapse the physical header text:
             *
             *     Sale CurStk
             *
             * into one diagnostic column and may omit StkVal.
             *
             * The H009 source structure is authoritative here. Build the
             * complete logical header required by extractTn845Row().
             *
             * IMPORTANT:
             * - This change is H009-only.
             * - It does not alter Script 1 output.
             * - It does not alter any other statement structure.
             * - Positions are retained from the known H009 source layout,
             *   but extractTn845Row() uses the row grammar rather than
             *   these positions to read the actual data.
             */
            const h009Header = {
                columns: [
                    {
                        header: "No",
                        normalized: "NO",
                        position: 0,
                        end: 2
                    },
                    {
                        header: "Product Name",
                        normalized: "PRODUCTNAME",
                        position: 5,
                        end: 17
                    },
                    {
                        header: "Pack",
                        normalized: "PACK",
                        position: 31,
                        end: 35
                    },
                    {
                        header: "Opstk",
                        normalized: "OPSTK",
                        position: 39,
                        end: 44
                    },
                    {
                        header: "Pur",
                        normalized: "PUR",
                        position: 51,
                        end: 54
                    },
                    {
                        header: "Sale",
                        normalized: "SALE",
                        position: 60,
                        end: 65
                    },
                    {
                        header: "CurStk",
                        normalized: "CURSTK",
                        position: 65,
                        end: 71
                    },
                    {
                        header: "StkVal",
                        normalized: "STKVAL",
                        position: 71,
                        end: 81
                    }
                ]
            };

            const record =
                extractTn845Row(
                    line,
                    h009Header,
                    index + 1
                );

            if (!record) {
                continue;
            }

            records.push(record);

        }

        return {
            success: true,
            file: absolutePath,
            structure: "H009",
            header: headerResult.header,
            dataStart: headerResult.dataStart,
            recordCount: records.length,
            records
        };

    }


    // ============================================================
    //
    // H009 is a fixed-width structure:
    //
    // PRODUCT_NAME : 5  - 17
    // PACK         : 31 - 35
    // OPSTK        : 43 - 48
    // PUR          : 59 - 62
    // SALE         : 68 - 72
    // CURSTK       : 80 - 86
    // STKVAL       : 90 - 96
    //
    // Positions are zero-based and the end position is exclusive.
    // Values such as 5+0, 62+12 and "-" are preserved exactly.
    //
    if (
        headerResult.structure === "H009"
    ) {

        const H009_COLUMNS = [
            {
                key: "productName",
                identifier: "PRODUCT_NAME",
                start: 5,
                end: 17
            },
            {
                key: "pack",
                identifier: "PACK",
                start: 31,
                end: 35
            },
            {
                key: "opstk",
                identifier: "OPSTK",
                start: 43,
                end: 48
            },
            {
                key: "pur",
                identifier: "PUR",
                start: 59,
                end: 62
            },
            {
                key: "sale",
                identifier: "SALE",
                start: 68,
                end: 72
            },
            {
                key: "curstk",
                identifier: "CURSTK",
                start: 80,
                end: 86
            },
            {
                key: "stkval",
                identifier: "STKVAL",
                start: 90,
                end: 96
            }
        ];

        function h009IsSeparator(line) {

            return /^[\s=\-_*]{5,}$/.test(
                String(line || "").trim()
            );

        }

        function h009IsFooter(line) {

            const text =
                String(line || "")
                    .trim()
                    .toUpperCase();

            return (
                !text ||
                /^TOTAL\b/.test(text) ||
                /^GRAND\s+TOTAL\b/.test(text) ||
                /^SUB\s*TOTAL\b/.test(text) ||
                /^PAGE\s+\d+\b/.test(text)
            );

        }

        function h009Extract(line) {

            const text =
                String(line || "");

            /*
             * H009 serial number is separated from Product Name by
             * variable whitespace. Do NOT use a fixed character slice
             * here because "1   ACNESTAL..." would produce "1   A".
             *
             * Read only the leading numeric serial token.
             */
            const numberMatch =
                text.match(/^\s*(\d+)\b/);

            if (!numberMatch) {
                return null;
            }

            const number =
                numberMatch[1];

            /*
             * A valid H009 record begins with the statement serial
             * number. This prevents footer/summary text from becoming
             * product records.
             */

            const record = {
                no: number
            };

            for (
                const column of H009_COLUMNS
            ) {

                record[column.key] =
                    text
                        .slice(
                            column.start,
                            column.end
                        )
                        .trim();

            }

            /*
             * Product name is mandatory for a genuine H009 row.
             */
            if (!record.productName) {
                return null;
            }

            return record;

        }

        const h009Records = [];

        const h009Start =
            Math.max(
                0,
                Number(
                    headerResult.dataStart || 1
                ) - 1
            );

        for (
            let index = h009Start;
            index < lines.length;
            index++
        ) {

            const line =
                String(
                    lines[index] || ""
                );

            if (h009IsSeparator(line)) {
                continue;
            }

            if (h009IsFooter(line)) {
                continue;
            }

            /*
             * H009 summary lines contain several numeric values and can
             * otherwise pass the row parser. They are not product rows.
             */
            if (
                /^(?:OPG\.STK\s+VAL|CL\.STK\s+VAL|PURC\.VALUE|PUR\.RETVAL|SALRET\s+VAL)/i.test(
                    line.trim()
                )
            ) {
                continue;
            }

            const record =
                h009Extract(line);

            if (!record) {
                continue;
            }

            h009Records.push(record);

        }

        return {
            success: true,
            file: absolutePath,
            structure: "H009",
            header: headerResult.header,
            dataStart: headerResult.dataStart,
            recordCount: h009Records.length,
            records: h009Records
        };

    }


    const structureId =
        getDetectedStructureId(
            headerResult
        );

    // ============================================================
    // H022 - PHYSICAL COLUMN EXTRACTION
    // ============================================================
    //
    // IMPORTANT:
    // - This branch changes ONLY H022 processing.
    // - The existing H022 generic path is bypassed.
    // - Script 1 remains the authority for detecting H022.
    // - The first dataStart remains the beginning of the first H022
    //   product block.
    // - A summary/total closes the current block.
    // - After the end row, search strictly AFTER that row for the next
    //   H022 header. If another H022 block exists, process it.
    // - If no next H022 header exists, finish.
    //
    // No other structure is modified here.
    // ============================================================

    if (structureId === "H022") {

        const h022DataStart =
            headerResult.dataStart;

        const h022Header =
            buildH022Header(headerResult);

        if (
            h022DataStart === null ||
            h022DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H022",
                header: h022Header,
                message:
                    "H022 data start could not be identified.",
                records: []
            };
        }

        const h022Records = [];

        function findNextH022Header(fromIndex) {
            for (
                let index = Math.max(0, fromIndex);
                index < lines.length;
                index++
            ) {
                const line =
                    String(lines[index] || "");

                if (
                    isH022HeaderLine(line)
                ) {
                    return index;
                }
            }

            return -1;
        }

        function findNextH022ProductStart(fromIndex) {
            for (
                let index = Math.max(0, fromIndex);
                index < lines.length;
                index++
            ) {
                const line =
                    String(lines[index] || "");

                if (!line.trim()) {
                    continue;
                }

                if (
                    isH022HeaderLine(line) ||
                    isH022SummaryRow(line)
                ) {
                    continue;
                }

                const record =
                    extractH022Row(
                        line,
                        h022Header,
                        index + 1
                    );

                if (record) {
                    return index;
                }
            }

            return -1;
        }

        function findH022BlockEnd(startIndex) {
            for (
                let index = startIndex;
                index < lines.length;
                index++
            ) {
                const line =
                    String(lines[index] || "");

                if (
                    index > startIndex &&
                    isH022HeaderLine(line)
                ) {
                    return index;
                }

                if (
                    isH022SummaryRow(line)
                ) {
                    return index;
                }
            }

            return lines.length;
        }

        function extractH022Block(
            startIndex,
            endIndex
        ) {
            const blockRecords = [];

            for (
                let index = startIndex;
                index < endIndex &&
                index < lines.length;
                index++
            ) {
                const line =
                    String(lines[index] || "");

                if (!line.trim()) {
                    continue;
                }

                if (
                    isH022HeaderLine(line) ||
                    isH022SummaryRow(line)
                ) {
                    continue;
                }

                const record =
                    extractH022Row(
                        line,
                        h022Header,
                        index + 1
                    );

                if (record) {
                    blockRecords.push(record);
                }
            }

            return blockRecords;
        }

        let blockStartIndex =
            Math.max(
                0,
                Number(h022DataStart) - 1
            );

        while (
            blockStartIndex < lines.length
        ) {

            /*
             * Start at Script 1's dataStart for the first block.
             * For subsequent blocks, locate the next H022 header and
             * then the first actual H022 product row after it.
             */
            const actualStartIndex =
                findNextH022ProductStart(
                    blockStartIndex
                );

            if (
                actualStartIndex < 0
            ) {
                break;
            }

            const blockEndIndex =
                findH022BlockEnd(
                    actualStartIndex
                );

            const blockRecords =
                extractH022Block(
                    actualStartIndex,
                    blockEndIndex
                );

            h022Records.push(
                ...blockRecords
            );

            /*
             * CRITICAL:
             * Continue strictly after the previous END ROW.
             *
             * Do not assume the next block must be immediately adjacent.
             * Look for the next H022 header anywhere after the end row.
             */
            const nextHeaderIndex =
                findNextH022Header(
                    blockEndIndex + 1
                );

            if (
                nextHeaderIndex < 0
            ) {
                break;
            }

            const nextStartIndex =
                findNextH022ProductStart(
                    nextHeaderIndex + 1
                );

            if (
                nextStartIndex < 0
            ) {
                break;
            }

            blockStartIndex =
                nextStartIndex;
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H022",
            header: h022Header,
            dataStart: h022DataStart,
            recordCount: h022Records.length,
            records: h022Records
        };
    }

    // ============================================================
    // H018 - MULTI-COMPANY FIXED-WIDTH EXTRACTION
    // ============================================================
    //
    // H018 is handled before the generic extractor so its complete
    // 11-column physical layout is preserved. Generic numeric-token
    // extraction is intentionally never used for H018.
    //
    if (structureId === "H018") {

        return extractH018Data(
            absolutePath,
            lines,
            headerResult
        );
    }

    /*
     * ============================================================
     * H006 - STRUCTURE-SPECIFIC EXTRACTION
     * ============================================================
     *
     * Script 1 detects H006, but its generic diagnostic header
     * columns can collapse the source labels because ITEMCODE and
     * ITEMNAME are adjacent and LM 1 / LM 2 are split labels.
     *
     * For H006 the known source structure is authoritative.
     * Build the complete header explicitly so Script 3 receives
     * all eight source columns.
     */
    if (
        structureId === "H006"
    ) {

        const h006DataStart =
            headerResult.dataStart;

        /*
         * H006 has two supported physical variants:
         *
         * 1. Legacy variant: ITEMCODE is blank and ITEMNAME occupies
         *    the left side of the report.
         *
         * 2. US PHARMA variant: ITEMCODE is populated and ITEMNAME
         *    starts at physical position 10.
         *
         * Detect the physical variant from the actual data rows.
         * The mapper is not involved here.
         */
        let h006HasItemCode = false;

        if (
            h006DataStart !== null &&
            h006DataStart !== undefined
        ) {
            for (
                let probeIndex =
                    Number(h006DataStart) - 1;
                probeIndex < lines.length;
                probeIndex++
            ) {
                const probeLine =
                    String(lines[probeIndex] || "");

                if (!probeLine.trim()) {
                    continue;
                }

                if (isH006ItemCodeDataRow(probeLine)) {
                    h006HasItemCode = true;
                }

                break;
            }
        }

        const h006Header =
            h006HasItemCode
                ? buildH006ItemCodeHeader(headerResult)
                : buildH006Header(headerResult);

        if (
            h006DataStart === null ||
            h006DataStart === undefined
        ) {

            return {
                success: false,
                file: absolutePath,
                structure: "H006",
                header: h006Header,
                message:
                    "H006 data start could not be identified.",
                records: []
            };
        }

        const h006Records = [];

        for (
            let index =
                Number(h006DataStart) - 1;

            index < lines.length;

            index++
        ) {

            const line =
                String(
                    lines[index] || ""
                );

            const trimmed =
                line.trim();

            if (!trimmed) {
                continue;
            }

            /*
             * Once the report reaches TOTAL / summary output,
             * product extraction is finished.
             */
            if (
                /^TOTAL\b/i.test(trimmed)
            ) {
                break;
            }

            if (
                isEndOfData(line)
            ) {
                break;
            }

            /*
             * US PHARMA H006:
             *
             * Read the source fields from their physical positions.
             * A long ITEMNAME may continue onto the next physical line;
             * in that case merge only the ITEMNAME portion and take all
             * numeric fields from the continuation line at their source
             * positions.
             */
            if (h006HasItemCode) {
                if (isH006ItemCodeDataRow(line)) {
                    let record =
                        extractH006ItemCodeRow(
                            line,
                            h006Header,
                            index + 1
                        );

                    if (!record && index + 1 < lines.length) {
                        const continuationLine =
                            String(
                                lines[index + 1] || ""
                            );

                        if (
                            /^\s{20,}/.test(continuationLine) &&
                            cleanText(
                                continuationLine.slice(31, 42)
                            ) &&
                            isNumericToken(
                                cleanText(
                                    continuationLine.slice(42, 49)
                                )
                            )
                        ) {
                            record =
                                extractH006ItemCodeWrappedRow(
                                    line,
                                    continuationLine,
                                    h006Header,
                                    index + 1
                                );

                            if (record) {
                                h006Records.push(record);
                                index++;
                            }
                        }
                    } else if (record) {
                        h006Records.push(record);
                    }
                }

                continue;
            }

            if (
                !isH006DataRow(line)
            ) {
                continue;
            }

            const record =
                extractH006Row(
                    line,
                    h006Header,
                    index + 1
                );

            if (record) {
                h006Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H006",
            header: h006Header,
            dataStart: h006DataStart,
            recordCount: h006Records.length,
            records: h006Records
        };
    }


    /*
     * ============================================================
     * H013 - STRUCTURE-SPECIFIC EXTRACTION
     * ============================================================
     *
     * H013 must bypass the generic isDataRow() / numeric-token path.
     * The generic path sees "5.5" inside:
     *
     *     ACNESTAL 5.5 SOAP
     *
     * and can incorrectly promote it to SALE.
     *
     * This branch reads the physical source columns directly.
     * Blank numeric source cells remain valid.
     *
     * This is H013-only. No existing extractor is changed.
     * ============================================================
     */
    if (structureId === "H013") {

        const h013DataStart =
            headerResult.dataStart;

        const h013Header =
            buildH013Header(
                headerResult
            );

        if (
            h013DataStart === null ||
            h013DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H013",
                header: h013Header,
                message:
                    "H013 data start could not be identified.",
                records: []
            };
        }

        const h013Records = [];

        for (
            let index =
                Number(h013DataStart) - 1;
            index < lines.length;
            index++
        ) {

            const line =
                String(
                    lines[index] || ""
                );

            if (!line.trim()) {
                continue;
            }

            /*
             * H013 summary/footer marks the end of product rows.
             * Separator lines are skipped without affecting extraction.
             */
            if (
                isH013SummaryRow(line)
            ) {
                break;
            }

            if (
                isEndOfData(line)
            ) {
                break;
            }

            if (
                isH013Separator(line)
            ) {
                continue;
            }

            if (
                !isH013DataRow(line)
            ) {
                continue;
            }

            const record =
                extractH013Row(
                    line,
                    h013Header,
                    index + 1
                );

            if (record) {
                h013Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H013",
            header: h013Header,
            dataStart: h013DataStart,
            recordCount: h013Records.length,
            records: h013Records
        };
    }

    /*
     * ============================================================
     * H014 - STRUCTURE-SPECIFIC EXTRACTION
     * ============================================================
     *
     * Script 1 identifies H014, but its diagnostic header columns
     * can miss adjacent LM2 / LM1 labels and can merge Value + Age.
     *
     * H014 therefore uses an explicit physical source layout.
     * This keeps the extractor independent from generic whitespace
     * tokenization and preserves the complete source column order.
     */
    if (
        structureId === "H014"
    ) {

        const h014DataStart =
            headerResult.dataStart;

        const h014Header =
            buildH014Header(
                headerResult
            );

        if (
            h014DataStart === null ||
            h014DataStart === undefined
        ) {

            return {
                success: false,
                file: absolutePath,
                structure: "H014",
                header: h014Header,
                message:
                    "H014 data start could not be identified.",
                records: []
            };
        }

        const h014Records = [];

        for (
            let index =
                Number(h014DataStart) - 1;
            index < lines.length;
            index++
        ) {

            const line =
                String(
                    lines[index] || ""
                );

            const trimmed =
                line.trim();

            if (!trimmed) {
                continue;
            }

            /*
             * Summary output starts after the product rows.
             * Do not allow summary numeric values to become records.
             */
            if (
                isH014SummaryRow(line) ||
                isEndOfData(line)
            ) {
                /*
                 * For a recognized summary row, the product section is
                 * finished. Separator lines are simply skipped.
                 */
                if (
                    isH014SummaryRow(line)
                ) {
                    break;
                }

                break;
            }

            if (
                !isH014DataRow(line)
            ) {
                continue;
            }

            const record =
                extractH014Row(
                    line,
                    h014Header,
                    index + 1
                );

            if (record) {
                h014Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H014",
            header: h014Header,
            dataStart: h014DataStart,
            recordCount: h014Records.length,
            records: h014Records
        };
    }

    // ============================================================
    // H026 - STRUCTURE-SPECIFIC EXTRACTION
    // ============================================================
    //
    // H026 is a fixed-width source format. The registered detector
    // can expose only a subset of the physical columns, so H026 must
    // use its authoritative source layout here.
    //
    // This branch is intentionally before generic extraction.
    // It prevents SNo and numeric-looking text inside Particulars
    // from entering the generic numeric-token parser.
    // ============================================================
    if (structureId === "H026") {
        const h026DataStart =
            headerResult.dataStart;

        const h026Header =
            buildH026Header(
                headerResult
            );

        if (
            h026DataStart === null ||
            h026DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H026",
                header: h026Header,
                message:
                    "H026 data start could not be identified.",
                records: []
            };
        }

        const h026Records = [];

        /*
         * Do not stop at a repeated page/company header.
         * The source statement can contain multiple H026 header
         * blocks. Only the final Value of :: footer terminates
         * the H026 scan.
         */
        for (
            let index =
                Number(h026DataStart) - 1;
            index < lines.length;
            index++
        ) {
            const line =
                String(
                    lines[index] || ""
                );

            if (
                isH026SummaryRow(line)
            ) {
                break;
            }

            const record =
                extractH026Row(
                    line,
                    h026Header,
                    index + 1
                );

            if (record) {
                h026Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H026",
            header: h026Header,
            dataStart: h026DataStart,
            recordCount: h026Records.length,
            records: h026Records
        };
    }


    // ============================================================
    // H024 - FIXED-WIDTH STOCK & SALES STATEMENT
    // ============================================================
    //
    // H024 is fixed-width. Product/Packing are isolated first;
    // numeric-looking text inside them is never tokenized.
    // ============================================================
    // ============================================================
    // H030 - FIXED-WIDTH PARTICULARS / STOCK & SALES
    // ============================================================
    //
    // IMPORTANT:
    // - H030 is handled only here; all existing structure handlers remain
    //   unchanged.
    // - The source row is read by its physical column boundaries.
    // - Product/Particulars text is isolated before numeric parsing.
    // - "-" is a valid source value and is represented as numeric 0 in
    //   values while rawValues preserves the exact "-".
    // - Repeated H030 statement blocks are scanned independently.
    // - TOTAL/footer rows are never returned as product records.
    //
    // Supplied H030 source layout:
    //
    // Particulars | Pkg. | Op.Qty. | Pr.Qty. | Sl Ret | Sale |
    // M.Out | Cl.Stk | Sal.Val | Cl.Val
    //
    // Physical zero-based boundaries:
    // 0-26 | 26-37 | 37-45 | 45-53 | 53-61 | 61-69 |
    // 69-77 | 77-85 | 85-93 | 93+
    //
    // This branch is intentionally isolated from the original generic
    // numeric-token extractor.
    // ============================================================

    if (structureId === "H030") {

        const h030DataStart =
            headerResult.dataStart;

        const h030Header = {
            ...(headerResult.header || {}),
            structure: "H030",
            columns: [
                {
                    index: 0,
                    header: "Particulars",
                    normalized: "PARTICULARS",
                    position: 0,
                    end: 26
                },
                {
                    index: 1,
                    header: "Pkg.",
                    normalized: "PKG",
                    position: 26,
                    end: 37
                },
                {
                    index: 2,
                    header: "Op.Qty.",
                    normalized: "OPQTY",
                    position: 37,
                    end: 45
                },
                {
                    index: 3,
                    header: "Pr.Qty.",
                    normalized: "PRQTY",
                    position: 45,
                    end: 53
                },
                {
                    index: 4,
                    header: "Sl Ret",
                    normalized: "SLRET",
                    position: 53,
                    end: 61
                },
                {
                    index: 5,
                    header: "Sale",
                    normalized: "SALE",
                    position: 61,
                    end: 69
                },
                {
                    index: 6,
                    header: "M.Out",
                    normalized: "MOUT",
                    position: 69,
                    end: 77
                },
                {
                    index: 7,
                    header: "Cl.Stk",
                    normalized: "CLSTK",
                    position: 77,
                    end: 85
                },
                {
                    index: 8,
                    header: "Sal.Val",
                    normalized: "SALVAL",
                    position: 85,
                    end: 93
                },
                {
                    index: 9,
                    header: "Cl.Val",
                    normalized: "CLVAL",
                    position: 93,
                    end: null
                }
            ]
        };

        if (
            h030DataStart === null ||
            h030DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H030",
                header: h030Header,
                message:
                    "H030 data start could not be identified.",
                records: []
            };
        }

        const h030Records = [];

        function isH030HeaderLine(line) {
            const text =
                String(line ?? "")
                    .replace(/\r/g, "")
                    .toUpperCase()
                    .replace(/\s+/g, " ")
                    .trim();

            if (!text) {
                return false;
            }

            const normalized =
                text.replace(/[^A-Z0-9]/g, "");

            return (
                normalized.includes("PARTICULARS") &&
                normalized.includes("PKG") &&
                normalized.includes("OPQTY") &&
                normalized.includes("PRQTY") &&
                normalized.includes("SLRET") &&
                normalized.includes("SALE") &&
                normalized.includes("MOUT") &&
                normalized.includes("CLSTK") &&
                normalized.includes("SALVAL") &&
                normalized.includes("CLVAL")
            );
        }

        function isH030SummaryOrFooter(line) {
            const text =
                String(line ?? "")
                    .trim()
                    .toUpperCase();

            if (!text) {
                return true;
            }

            return (
                /^TOTAL\b/.test(text) ||
                /^GRAND\s+TOTAL\b/.test(text) ||
                /^SUB\s*TOTAL\b/.test(text) ||
                /^OPENING\s+VALUE\b/.test(text) ||
                /^PURCHASE\s+VALUE\b/.test(text) ||
                /^SALE\s+VALUE\b/.test(text) ||
                /^CLOSING\s+VALUE\b/.test(text) ||
                /^VALUE\s+OF\s*::/.test(text) ||
                /END\s+OF\s+REPORT/.test(text)
            );
        }

        function parseH030Numeric(rawValue) {
            const value =
                String(rawValue ?? "").trim();

            if (!value) {
                return null;
            }

            if (value === "-") {
                return 0;
            }

            return parseSourceValue(value);
        }

        function extractH030Row(line, rowNumber) {
            const text =
                String(line ?? "")
                    .replace(/\r/g, "");

            if (!text.trim()) {
                return null;
            }

            if (
                isH030HeaderLine(text) ||
                isH030SummaryOrFooter(text)
            ) {
                return null;
            }

            const particulars =
                cleanText(
                    text.slice(0, 26)
                );

            const pkgRaw =
                cleanText(
                    text.slice(26, 37)
                );

            if (!particulars || !pkgRaw) {
                return null;
            }

            /*
             * IMPORTANT:
             * Only the already-isolated physical numeric regions are
             * inspected here. Nothing inside Particulars/Pkg. is tokenized.
             */
            const openingRaw =
                cleanText(text.slice(37, 45));

            const purchaseRaw =
                cleanText(text.slice(45, 53));

            const salesReturnRaw =
                cleanText(text.slice(53, 61));

            const saleRaw =
                cleanText(text.slice(61, 69));

            const marketOutRaw =
                cleanText(text.slice(69, 77));

            const closingStockRaw =
                cleanText(text.slice(77, 85));

            const salesValueRaw =
                cleanText(text.slice(85, 93));

            const closingValueRaw =
                cleanText(text.slice(93));

            const numericSourceValues = [
                openingRaw,
                purchaseRaw,
                salesReturnRaw,
                saleRaw,
                marketOutRaw,
                closingStockRaw,
                salesValueRaw,
                closingValueRaw
            ];

            /*
             * H030 source rows use either a numeric value or "-".
             * Reject metadata/footer rows without changing any other
             * structure's validation.
             */
            if (
                !numericSourceValues.every(
                    value =>
                        value === "-" ||
                        isNumericToken(value)
                )
            ) {
                return null;
            }

            const rawValues = {
                "Particulars": particulars,
                "Pkg.": pkgRaw,
                "Op.Qty.": openingRaw,
                "Pr.Qty.": purchaseRaw,
                "Sl Ret": salesReturnRaw,
                "Sale": saleRaw,
                "M.Out": marketOutRaw,
                "Cl.Stk": closingStockRaw,
                "Sal.Val": salesValueRaw,
                "Cl.Val": closingValueRaw
            };

            const values = {
                "Particulars": particulars,
                "Pkg.": pkgRaw,
                "Op.Qty.": parseH030Numeric(openingRaw),
                "Pr.Qty.": parseH030Numeric(purchaseRaw),
                "Sl Ret": parseH030Numeric(salesReturnRaw),
                "Sale": parseH030Numeric(saleRaw),
                "M.Out": parseH030Numeric(marketOutRaw),
                "Cl.Stk": parseH030Numeric(closingStockRaw),
                "Sal.Val": parseH030Numeric(salesValueRaw),
                "Cl.Val": parseH030Numeric(closingValueRaw)
            };

            return {
                rowNumber,
                rawLine: line,
                numericTokenCount: 8,
                expectedNumericCount: 8,
                numericCountMatches: true,
                rawValues,
                values
            };
        }

        /*
         * Scan from Script 1's first dataStart and continue through the
         * entire TXT. This is deliberate: H030 can contain another
         * statement block after a TOTAL/footer and its repeated header.
         */
        const firstStartIndex =
            Math.max(
                0,
                Number(h030DataStart) - 1
            );

        for (
            let index = firstStartIndex;
            index < lines.length;
            index++
        ) {
            const line =
                String(lines[index] || "");

            const record =
                extractH030Row(
                    line,
                    index + 1
                );

            if (record) {
                h030Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H030",
            header: h030Header,
            dataStart: h030DataStart,
            recordCount: h030Records.length,
            records: h030Records
        };
    }

    if (structureId === "H024") {

        const h024DataStart =
            headerResult.dataStart;

        const h024Header =
            buildH024Header(headerResult);

        if (
            h024DataStart === null ||
            h024DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H024",
                header: h024Header,
                message:
                    "H024 data start could not be identified.",
                records: []
            };
        }

        const h024Records = [];

        for (
            let index = Number(h024DataStart) - 1;
            index < lines.length;
            index++
        ) {

            const line =
                String(lines[index] || "");

            const trimmed =
                line.trim();

            if (!trimmed) {
                continue;
            }

            /*
             * A repeated page header/separator can occur between
             * product blocks. Ignore it while no product row has
             * been collected for the current page.
             */
            if (
                isH024SummaryRow(line)
            ) {
                break;
            }

            if (
                isH024Separator(line)
            ) {
                continue;
            }

            /*
             * Repeated H024 header lines after a page break are not
             * data rows and are safely skipped by the fixed-width
             * validation below.
             */
            if (
                !isH024DataRow(line)
            ) {
                continue;
            }

            const record =
                extractH024Row(
                    line,
                    h024Header,
                    index + 1
                );

            if (record) {
                h024Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H024",
            header: h024Header,
            dataStart: h024DataStart,
            recordCount: h024Records.length,
            records: h024Records
        };
    }

    // ============================================================
    // H017 - IMPERIA FRIENDS PHARMA AGENCY / TN966
    // ============================================================
    //
    // H017 is fixed-width. Product and packing are isolated first;
    // numeric-looking text inside those fields is never tokenized.
    // ============================================================
    if (structureId === "H017") {

        const h017DataStart =
            headerResult.dataStart;

        const h017Header =
            buildH017Header(headerResult);

        if (
            h017DataStart === null ||
            h017DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H017",
                header: h017Header,
                message:
                    "H017 data start could not be identified.",
                records: []
            };
        }

        const h017Records = [];

        for (
            let index = Number(h017DataStart) - 1;
            index < lines.length;
            index++
        ) {
            const line = String(lines[index] || "");
            const trimmed = line.trim();

            if (!trimmed) {
                continue;
            }

            if (isH017SummaryRow(line)) {
                break;
            }

            if (isH017Separator(line)) {
                /*
                 * H017 has a separator immediately below the header and
                 * another separator after the product block.
                 *
                 * Before any product record is found, skip the header
                 * separator. Once product records exist, the next
                 * separator marks the end of the H017 product section.
                 * Everything after it belongs to the statement footer
                 * / credit-note section and must not be extracted as
                 * medicine rows.
                 */
                if (h017Records.length > 0) {
                    break;
                }

                continue;
            }

            const record =
                extractH017Row(
                    line,
                    h017Header,
                    index + 1
                );

            if (record) {
                h017Records.push(record);
            }
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H017",
            header: h017Header,
            dataStart: h017DataStart,
            recordCount: h017Records.length,
            records: h017Records
        };
    }

    // ============================================================
    // H029 - STRUCTURE-SPECIFIC EXTRACTION
    // ============================================================
    //
    // H029 must be extracted before the generic whitespace/numeric
    // tokenizer.  The source rows are fixed-width and Product Name
    // may itself contain numbers.
    //
    // This branch is H029-only and leaves all existing structures
    // on their original processing paths.
    // ============================================================
    if (structureId === "H029") {

        const h029DataStart =
            headerResult.dataStart;

        const h029Header = {
            ...(headerResult.header || {}),
            structure: "H029",
            columns: [
                {
                    index: 0,
                    header: "Product Name",
                    normalized: "PRODUCTNAME",
                    position: 0,
                    end: 26
                },
                {
                    index: 1,
                    header: "Pack",
                    normalized: "PACK",
                    position: 26,
                    end: 38
                },
                {
                    index: 2,
                    header: "O.Stk",
                    normalized: "OSTK",
                    position: 38,
                    end: 45
                },
                {
                    index: 3,
                    header: "Purc",
                    normalized: "PURC",
                    position: 45,
                    end: 54
                },
                {
                    index: 4,
                    header: "Tot",
                    normalized: "TOT",
                    position: 54,
                    end: 62
                },
                {
                    index: 5,
                    header: "Sale",
                    normalized: "SALE",
                    position: 62,
                    end: 71
                },
                {
                    index: 6,
                    header: "Qoh",
                    normalized: "QOH",
                    position: 71,
                    end: 80
                },
                {
                    index: 7,
                    header: "Value",
                    normalized: "VALUE",
                    position: 80,
                    end: 88
                },
                {
                    index: 8,
                    header: "Age",
                    normalized: "AGE",
                    position: 88,
                    end: null
                }
            ]
        };

        const h029Records = [];

        /*
         * ============================================================
         * H029 REPEATED START -> END BLOCK SCANNER
         * ============================================================
         *
         * IMPORTANT:
         * - Keep the existing H029 row extractor unchanged.
         * - Keep the first dataStart supplied by Script 1.
         * - Process one product block at a time.
         * - When the block reaches its Total/Summary end, remember that
         *   end row and search ONLY AFTER it for the next H029 header.
         * - If another H029 header exists, start another block.
         * - If no next H029 header exists, extraction is complete.
         *
         * This prevents the first Total/Summary from terminating the
         * complete statement while also preventing unrelated later
         * sections from being treated as H029 data without a new H029
         * start/header.
         */

        function isH029RepeatedHeader(line) {

            const text =
                String(line ?? "")
                    .toUpperCase()
                    .replace(/\r/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

            if (!text) {
                return false;
            }

            const normalized =
                text.replace(/[^A-Z0-9]/g, "");

            return (
                normalized.includes("PRODUCTNAME") &&
                normalized.includes("PACK") &&
                normalized.includes("OSTK") &&
                normalized.includes("PURC") &&
                normalized.includes("TOT") &&
                normalized.includes("SALE") &&
                normalized.includes("QOH") &&
                normalized.includes("VALUE") &&
                normalized.includes("AGE")
            );
        }

        function findNextH029HeaderRow(fromIndex) {

            for (
                let index = Math.max(0, fromIndex);
                index < lines.length;
                index++
            ) {
                if (
                    isH029RepeatedHeader(
                        lines[index]
                    )
                ) {
                    return index;
                }
            }

            return -1;
        }

        function findH029BlockEndRow(startIndex) {

            for (
                let index = startIndex;
                index < lines.length;
                index++
            ) {

                const line =
                    String(
                        lines[index] || ""
                    );

                const trimmed =
                    line.trim();

                if (!trimmed) {
                    continue;
                }

                /*
                 * A summary row closes the CURRENT block.
                 * It does NOT close the complete statement.
                 */
                if (
                    /^TOTAL\b/i.test(trimmed) ||
                    /^GRAND\s+TOTAL\b/i.test(trimmed) ||
                    /^SUB\s*TOTAL\b/i.test(trimmed) ||
                    /^OPENING\s+VALUE\b/i.test(trimmed) ||
                    /^PURCHASE\s+VALUE\b/i.test(trimmed) ||
                    /^SALE\s+VALUE\b/i.test(trimmed) ||
                    /^CLOSING\s+VALUE\b/i.test(trimmed)
                ) {
                    return index;
                }
            }

            /*
             * No explicit summary was found. EOF is the natural end of
             * this final block.
             */
            return lines.length;
        }

        function extractH029Block(
            blockStartIndex,
            blockEndIndex
        ) {

            const blockRecords = [];

            for (
                let index = blockStartIndex;
                index < blockEndIndex && index < lines.length;
                index++
            ) {

                const line =
                    String(
                        lines[index] || ""
                    );

                const trimmed =
                    line.trim();

                if (!trimmed) {
                    continue;
                }

                if (
                    isH029SummaryOrSeparator(line)
                ) {
                    continue;
                }

                /*
                 * A repeated header can occur at a page boundary inside
                 * the same block. It is a control/header row, never a
                 * product row.
                 */
                if (
                    isH029RepeatedHeader(line)
                ) {
                    continue;
                }

                const record =
                    extractH029Row(
                        line,
                        h029Header,
                        index + 1
                    );

                if (record) {
                    blockRecords.push(record);
                }
            }

            return blockRecords;
        }

        /*
         * FIRST BLOCK:
         * Script 1's dataStart remains authoritative for the first
         * product block. No existing header detection is changed.
         */
        let blockStartIndex =
            Math.max(
                0,
                Number(h029DataStart || 1) - 1
            );

        while (
            blockStartIndex < lines.length
        ) {

            const blockEndIndex =
                findH029BlockEndRow(
                    blockStartIndex
                );

            const blockRecords =
                extractH029Block(
                    blockStartIndex,
                    blockEndIndex
                );

            h029Records.push(
                ...blockRecords
            );

            /*
             * Search for the NEXT SAME H029 START/HEADER beginning
             * strictly after the previous block end.
             */
            if (
                blockEndIndex >= lines.length
            ) {
                break;
            }

            const nextHeaderIndex =
                findNextH029HeaderRow(
                    blockEndIndex + 1
                );

            if (
                nextHeaderIndex < 0
            ) {
                break;
            }

            /*
             * The next block begins after its repeated H029 header.
             * Separator/company lines between the header and products
             * are safely skipped by extractH029Block().
             */
            blockStartIndex =
                nextHeaderIndex + 1;
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H029",
            header: h029Header,
            dataStart: h029DataStart,
            recordCount: h029Records.length,
            records: h029Records
        };
    }

    /*
     * ============================================================
     * H005 - REPEATED START -> END BLOCK EXTRACTION
     * ============================================================
     *
     * IMPORTANT:
     * - This branch changes ONLY H005 processing.
     * - The existing H005 row extractor and mapper are untouched.
     * - Script 1's first dataStart remains authoritative.
     * - After one H005 block ends, search strictly AFTER that end
     *   for the next same H005 header/start.
     * - Continue until no next H005 block exists.
     * - TOTAL / summary rows close the CURRENT block only.
     *
     * This is intentionally kept outside the generic extractor so
     * existing structures retain their original processing paths.
     * ============================================================
     */
    if (structureId === "H005") {

        const h005DataStart =
            headerResult.dataStart;

        const h005Header =
            prepareHeaderForStructure(
                headerResult
            );

        if (
            h005DataStart === null ||
            h005DataStart === undefined
        ) {
            return {
                success: false,
                file: absolutePath,
                structure: "H005",
                header: h005Header,
                message:
                    "H005 data start could not be identified.",
                records: []
            };
        }

        const h005Records = [];

        /*
         * ============================================================
         * H005 REPEATED START -> END BLOCK SCAN
         * ============================================================
         *
         * IMPORTANT:
         * - The FIRST block starts from Script 1's detected dataStart.
         * - The block ends at the existing H005 end-row condition.
         * - After that end row, DO NOT require another repeated header.
         * - Search forward for the next VALID H005 PRODUCT START ROW.
         * - From that start row, find its next END ROW.
         * - Extract that block.
         * - Repeat from the previous block's end + 1.
         * - Stop only when no next valid product start is found.
         *
         * This preserves the existing H005 row extractor and all
         * other structures. It changes only how multiple H005
         * product blocks are discovered.
         */

        function isH005RepeatedHeader(line) {

            const text =
                String(line ?? "")
                    .toUpperCase()
                    .replace(/\r/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

            if (!text) {
                return false;
            }

            const normalized =
                text.replace(/[^A-Z0-9]/g, "");

            return (
                normalized.includes("PRODUCTNAME") &&
                normalized.includes("PACKING") &&
                normalized.includes("OSTK") &&
                normalized.includes("PURC") &&
                normalized.includes("TOT") &&
                normalized.includes("SALE") &&
                normalized.includes("QOH") &&
                normalized.includes("VALUE") &&
                normalized.includes("AGE")
            );
        }

        /*
         * Find the next ACTUAL H005 product row.
         *
         * Do not require a repeated header.
         * Do not treat Company / Total / Summary / separator rows
         * as a start row.
         *
         * The existing isDataRow() remains the authority for deciding
         * whether a physical row is an H005 data/product row.
         */
        function findNextH005Start(fromIndex) {

            for (
                let index = Math.max(0, fromIndex);
                index < lines.length;
                index++
            ) {

                const line =
                    String(lines[index] || "");

                if (
                    isH005RepeatedHeader(line)
                ) {
                    continue;
                }

                if (
                    isEndOfData(line)
                ) {
                    continue;
                }

                if (
                    isDataRow(
                        line,
                        h005Header
                    )
                ) {
                    return index;
                }
            }

            return -1;
        }

        /*
         * Find the END ROW belonging to the current block.
         *
         * A repeated H005 header is also treated as a boundary so that
         * an unexpected header cannot be swallowed into the previous
         * block. Normally the existing end-row condition will be met
         * first.
         */
        function findH005BlockEnd(startIndex) {

            for (
                let index = startIndex;
                index < lines.length;
                index++
            ) {

                const line =
                    String(lines[index] || "");

                const trimmed =
                    line.trim();

                if (!trimmed) {
                    continue;
                }

                if (
                    index > startIndex &&
                    isH005RepeatedHeader(line)
                ) {
                    return index;
                }

                if (
                    isEndOfData(line)
                ) {
                    return index;
                }
            }

            return lines.length;
        }

        function extractH005Block(
            startIndex,
            endIndex
        ) {

            const blockRecords = [];

            for (
                let index = startIndex;
                index < endIndex &&
                index < lines.length;
                index++
            ) {

                const line =
                    String(lines[index] || "");

                const trimmed =
                    line.trim();

                if (!trimmed) {
                    continue;
                }

                if (
                    isH005RepeatedHeader(line)
                ) {
                    continue;
                }

                if (
                    isEndOfData(line)
                ) {
                    continue;
                }

                if (
                    !isDataRow(
                        line,
                        h005Header
                    )
                ) {
                    continue;
                }

                const record =
                    extractRow(
                        line,
                        h005Header,
                        index + 1
                    );

                if (record) {
                    blockRecords.push(record);
                }
            }

            return blockRecords;
        }

        /*
         * FIRST BLOCK:
         * Script 1's detected dataStart remains authoritative.
         *
         * dataStart is only the beginning of the FIRST block.
         * It is NOT the end of the complete statement.
         */
        let blockStartIndex =
            Math.max(
                0,
                Number(h005DataStart) - 1
            );

        while (
            blockStartIndex < lines.length
        ) {

            /*
             * If the current starting point is not itself a valid
             * product row (possible after a repeated header/company
             * line), advance to the first valid H005 product row.
             *
             * For the first block, this keeps Script 1's dataStart
             * while safely skipping non-product control rows.
             */
            const actualStartIndex =
                findNextH005Start(
                    blockStartIndex
                );

            if (
                actualStartIndex < 0
            ) {
                break;
            }

            const blockEndIndex =
                findH005BlockEnd(
                    actualStartIndex
                );

            const blockRecords =
                extractH005Block(
                    actualStartIndex,
                    blockEndIndex
                );

            h005Records.push(
                ...blockRecords
            );

            /*
             * CRITICAL:
             * Continue searching from AFTER the previous END ROW.
             *
             * Do NOT require a repeated H005 header.
             * The next product row itself becomes the next block's
             * Start Row.
             */
            const nextStartIndex =
                findNextH005Start(
                    blockEndIndex + 1
                );

            if (
                nextStartIndex < 0
            ) {
                break;
            }

            blockStartIndex =
                nextStartIndex;
        }

        return {
            success: true,
            file: absolutePath,
            structure: "H005",
            header: h005Header,
            dataStart: h005DataStart,
            recordCount: h005Records.length,
            records: h005Records
        };
    }

    const header =
        prepareHeaderForStructure(
            headerResult
        );

    const dataStart =
        headerResult.dataStart;

    if (dataStart === null) {

        return {
            success: false,

            file:
                absolutePath,

            header,

            message:
                "Data start could not be identified.",

            records: []
        };
    }

    const records = [];

    for (
        let index =
            dataStart - 1;

        index < lines.length;

        index++
    ) {

        const line =
            lines[index];

        if (
            structureId === "H031" &&
            /^TOTAL\s*:/i.test(String(line || "").trim())
        ) {
            break;
        }

        /*
         * Summary section ends product data.
         */
        if (
            isEndOfData(line)
        ) {
            break;
        }

        /*
         * Ignore non-data lines.
         */
        if (
            !isDataRow(
                line,
                header
            )
        ) {
            continue;
        }

        const record =
            extractRow(
                line,
                header,
                index + 1
            );

        if (record) {
            records.push(record);
        }
    }

    return {

        success: true,

        file:
            absolutePath,

        structure:
            structureId,

        header: {
            lineNumber:
                header.lineNumber,

            text:
                header.text,

            columns:
                header.columns
        },

        dataStart,

        recordCount:
            records.length,

        records
    };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    extractSingleRowData,
    extractRow,
    getNumericTokens,
    parseNumeric
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {

    const filePath =
        process.argv[2];

    if (!filePath) {

        console.error(
            "Usage:"
        );

        console.error(
            'node validation/singleRow/singleRowDataExtractor.js "path\\file.txt"'
        );

        process.exit(1);
    }

    try {

        const result =
            extractSingleRowData(
                filePath
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
