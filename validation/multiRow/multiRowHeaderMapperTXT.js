/*
 * ============================================================
 * MULTI-ROW TXT PHYSICAL POSITION MAPPER
 * ============================================================
 *
 * File:
 * validation/multiRow/multiRowHeaderMapperTXT.js
 *
 * STEP 2 - CORRECTED
 *
 * Purpose:
 *   Convert detected multi-row TXT headers into physical
 *   character-position columns.
 *
 * IMPORTANT:
 *   This script does NOT extract data rows.
 *   This script does NOT modify the existing single-row system.
 *
 * Core rule:
 *   Physical character position is authoritative.
 *
 * Example:
 *
 * Product Name               Packing       OP <---Receipts--->  <----Sales---->  <---Closing---->
 *                                          Qty    Qty     Value    Qty     Value    Qty      Value
 *
 * becomes:
 *
 * Product
 * Packing
 * Opening Qty
 * Purchase Qty
 * Purchase Value
 * Sales Qty
 * Sales Value
 * Closing Qty
 * Closing Value
 *
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeHeader(value) {
    return String(value == null ? "" : value)
        .toUpperCase()
        .replace(/<+|>+/g, " ")
        .replace(/[_./:-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function compactHeader(value) {
    return normalizeHeader(value)
        .replace(/[^A-Z0-9]/g, "");
}

/* ============================================================
 * ALIASES
 * ============================================================
 */

/*
 * ============================================================
 * COMMON HEADER MAPPING EXTENSIONS
 * ============================================================
 *
 * ADDITIVE ONLY:
 * These aliases extend the existing mapper. Existing aliases,
 * structure-specific branches, physical-position logic, and
 * exported APIs are intentionally preserved.
 *
 * The canonical commonField remains the source of truth for
 * Step 3. Physical position remains authoritative for location.
 * ============================================================
 */

const DIRECT_ALIASES = [
    {
        common: "product",
        patterns: [
            "PRODUCT NAME",
            "PRODUCTNAME",
            "PRODUCT DESCRIPTION",
            "DESCRIPTION OF PRODUCT",
            "PRODUCT",
            "PARTICULAR",
            "PARTICULARS",
            "DESCRIPTION",
            "MEDICINE NAME",
            "MEDICINE",
            "ITEM NAME",
            "ITEMNAME",
            "ITEM"
        ]
    },
    {
        common: "pack",
        patterns: [
            "PACKING",
            "PACK",
            "PACKG",
            "PACKING.",
            "PACKING DESCRIPTION",
            "PKG",
            "PACKAGE"
        ]
    },
    {
        common: "opening",
        patterns: [
            "OPENING",
            "OPEN",
            "OPENING QTY",
            "OPENING BAL",
            "OPENING BALANCE",
            "OP QTY",
            "OP BAL",
            "OP",
            "OP STK",
            "OPSTK",
            "OPENING STOCK"
        ]
    },
    {
        common: "purchase",
        patterns: [
            "PURCHASE",
            "PURCHASE QTY",
            "PURCHASES",
            "PURCHASES QTY",
            "PURC",
            "PUR",
            "RECEIPT",
            "RECEIPTS",
            "RECEIPT QTY",
            "RECEIPTS QTY",
            "RCPT"
        ]
    },
    {
        common: "purchaseReturn",
        patterns: [
            "PURCHASE RETURN",
            "PURCHASE RET",
            "PUR RETURN",
            "PUR RET",
            "PUR RETN"
        ]
    },
    {
        common: "sales",
        patterns: [
            "SALES",
            "SALES QTY",
            "SALE",
            "SALE QTY",
            "ISSUE",
            "ISSUES"
        ]
    },
    {
        common: "salesReturn",
        patterns: [
            "SALES RETURN",
            "SALES RET",
            "SALE RETURN",
            "SALE RET",
            "SL RET",
            "S RET"
        ]
    },
    {
        common: "closing",
        patterns: [
            "CLOSING",
            "CLOSING QTY",
            "CLOSING STOCK",
            "CLOSING BAL",
            "CLOSING BALANCE",
            "CL QTY",
            "CL STK",
            "CLSTK",
            "CL ST"
        ]
    },
    {
        common: "salesValue",
        patterns: [
            "SALES VALUE",
            "SALES AMOUNT",
            "SALE VALUE",
            "SALE AMOUNT",
            "SALEVALUE",
            "SALESVALUE",
            "SAL VAL",
            "SAL VALUE"
        ]
    },
    {
        common: "closingValue",
        patterns: [
            "CLOSING VALUE",
            "CLOSING AMOUNT",
            "CLOSE VALUE",
            "CL VALUE",
            "CLVAL",
            "CL STK VALUE",
            "CLOSING STOCK VALUE",
            "CLST VAL"
        ]
    },
    {
        common: "purchaseFree",
        patterns: [
            "FREE",
            "FREE QTY",
            "PURCHASE FREE",
            "PURCH FREE",
            "PUR FREE"
        ]
    },
    {
        common: "purchaseReturn",
        patterns: [
            "PURCHASE RETURN",
            "PURCHASE RET",
            "PUR RETURN",
            "PUR RET",
            "PUR RETN",
            "PURCHASE RETURN QTY",
            "PUR RETURN QTY"
        ]
    },
    {
        common: "salesFree",
        patterns: [
            "SALES FREE",
            "SALE FREE",
            "SALES FREE QTY",
            "SALE FREE QTY"
        ]
    },
    {
        common: "salesPrev",
        patterns: [
            "SALES QTY PREV",
            "SALES PREV",
            "PREV SALES",
            "PREVIOUS SALES"
        ]
    },
    {
        common: "salesLast",
        patterns: [
            "SALES QTY LAST",
            "SALES LAST",
            "LAST SALES",
            "LM SALE",
            "LM SALES",
            "LAST MONTH SALE",
            "LAST MONTH SALES"
        ]
    },
    {
        common: "salesCurrent",
        patterns: [
            "SALES QTY CURRENT",
            "SALES CURRENT",
            "CURRENT SALES"
        ]
    },
    {
        common: "purchaseValue",
        patterns: [
            "PURCHASE VALUE",
            "PURCHASE AMOUNT",
            "PURC VALUE",
            "PUR VALUE",
            "RECEIPT VALUE",
            "RECEIPTS VALUE"
        ]
    },
    {
        common: "openingValue",
        patterns: [
            "OPENING VALUE",
            "OPEN VALUE",
            "OP VALUE",
            "OPENING AMOUNT"
        ]
    },
    {
        common: "salesReturnValue",
        patterns: [
            "SALES RETURN VALUE",
            "SALES RET VALUE",
            "SALE RETURN VALUE",
            "SALE RET VALUE"
        ]
    },
    {
        common: "purchaseReturnValue",
        patterns: [
            "PURCHASE RETURN VALUE",
            "PUR RETURN VALUE",
            "PURCHASE RET VALUE"
        ]
    },
    {
        common: "transQty",
        patterns: [
            "TRANS QTY",
            "TRANSFER QTY",
            "TRANSIT QTY",
            "TRANSFER",
            "TRANSIT"
        ]
    },
    {
        common: "unitRate",
        patterns: [
            "UNIT RATE",
            "RATE",
            "RATE PER UNIT",
            "UNIT PRICE"
        ]
    },
    {
        common: "orderQty",
        patterns: [
            "ORD QTY",
            "ORDER QTY",
            "ORDER QUANTITY"
        ]
    },
    {
        common: "expiry",
        patterns: [
            "EXP BRO",
            "EXPIRY",
            "EXPIRY QTY",
            "EXPIRABLE"
        ]
    },
    {
        common: "adjustmentMinus",
        patterns: [
            "ADJ (-)",
            "ADJ -",
            "ADJUSTMENT (-)",
            "ADJUSTMENT MINUS"
        ]
    },
    {
        common: "adjustmentPlus",
        patterns: [
            "ADJ (+)",
            "ADJ +",
            "ADJUSTMENT (+)",
            "ADJUSTMENT PLUS"
        ]
    },
    {
        common: "totalStock",
        patterns: [
            "TOTAL STOCK",
            "TOTAL STK",
            "TOTAL QTY",
            "TOTAL STOCK QTY"
        ]
    },
    {
        common: "excessValue",
        patterns: [
            "EXCES VALUE",
            "EXCESS VALUE",
            "EXCESS AMOUNT"
        ]
    },
    {
        common: "otherQty",
        patterns: [
            "OTHERS QTY",
            "OTHER QTY",
            "OTHERS QUANTITY",
            "OTHER QUANTITY"
        ]
    },
    {
        common: "otherValue",
        patterns: [
            "OTHERS VALUE",
            "OTHER VALUE",
            "OTHERS AMOUNT",
            "OTHER AMOUNT"
        ]
    },
    {
        common: "cashSales",
        patterns: [
            "CASH SALES",
            "CASHSALE",
            "CASH QTY",
            "CASH SALES QTY"
        ]
    },
    {
        common: "closingFree",
        patterns: [
            "CLOSING FREE",
            "CLOSING FREE QTY",
            "CLO STK FREE",
            "CLOSTK FREE",
            "CLOSING STOCK FREE"
        ]
    },
    {
        common: "age",
        patterns: [
            "AGE",
            "AGE DAYS",
            "DAYS"
        ]
    }
];

/* ============================================================
 * HELPERS
 * ============================================================
 */

function resolveDirectAlias(value) {
    const normalized = normalizeHeader(value);
    const compact = compactHeader(value);

    for (const alias of DIRECT_ALIASES) {
        for (const pattern of alias.patterns) {
            if (
                normalized === normalizeHeader(pattern) ||
                compact === compactHeader(pattern)
            ) {
                return alias.common;
            }
        }
    }

    return null;
}

function isGenericChild(value) {
    const normalized = normalizeHeader(value);

    return (
        normalized === "QTY" ||
        normalized === "QUANTITY" ||
        normalized === "VALUE" ||
        normalized === "VAL"
    );
}

function resolveChildCommon(parentCommon, childText) {
    const child = normalizeHeader(childText);

    if (
        child === "QTY" ||
        child === "QUANTITY"
    ) {
        if (parentCommon === "opening") return "opening";
        if (parentCommon === "purchase") return "purchase";
        if (parentCommon === "purchaseReturn") {
            return "purchaseReturn";
        }
        if (parentCommon === "sales") return "sales";
        if (parentCommon === "salesReturn") {
            return "salesReturn";
        }
        if (parentCommon === "closing") return "closing";

        if (parentCommon === "retailSales") return "sales";
        if (parentCommon === "cashSales") return "cashSales";

        return null;
    }

    if (child === "LAST") {
        if (parentCommon === "sales") return "salesLast";
        return null;
    }

    if (child === "FREE") {
        if (parentCommon === "closing") return "closingFree";
        if (parentCommon === "purchase") return "purchaseFree";
        return null;
    }

    if (child === "DAYS") {
        if (parentCommon === "age") return "age";
        return null;
    }

    if (child === "SALES") {
        if (parentCommon === "retailSales") return "sales";
        if (parentCommon === "cashSales") return "cashSales";
        return null;
    }

    if (
        child === "VALUE" ||
        child === "VAL"
    ) {
        if (parentCommon === "sales") {
            return "salesValue";
        }

        if (parentCommon === "closing") {
            return "closingValue";
        }

        /*
         * Receipts Value is kept identifiable as purchaseValue.
         * It is NOT the Common Purchase quantity field.
         */
        if (parentCommon === "purchase") {
            return "purchaseValue";
        }

        return null;
    }

    return resolveDirectAlias(childText);
}

/* ============================================================
 * HEADER LINE TOKENIZATION
 * ============================================================
 *
 * Tokenization is performed ONLY on header lines.
 * Every token retains its original character position.
 */

function tokenizeHeaderLine(line, rowIndex) {
    const text = String(line == null ? "" : line);
    const tokens = [];
    const regex = /\S+/g;

    let match;

    while ((match = regex.exec(text)) !== null) {
        tokens.push({
            text: match[0],
            normalized: normalizeHeader(match[0]),
            compact: compactHeader(match[0]),
            start: match.index,
            end: match.index + match[0].length,
            rowIndex
        });
    }

    return tokens;
}

/* ============================================================
 * SPECIAL HEADER GEOMETRY
 * ============================================================
 *
 * The important issue in the DERMANEX example is:
 *
 *   Packing       OP
 *                 Qty
 *
 * "OP" is a group header located at the same physical area
 * where the child Qty appears.
 *
 * We therefore identify group headers by their semantic role
 * and physical position, rather than extending Packing until
 * the next visible token.
 */

/*
 * Tokens that are visual group headers. These are not leaf data
 * columns when a child row exists beneath them.
 */
function isGroupHeaderToken(token) {
    const normalized = normalizeHeader(token.text);

    return (
        normalized === "OP" ||
        normalized === "OPENING" ||
        normalized === "RECEIPTS" ||
        normalized === "RECEIPT" ||
        normalized === "PURCHASE" ||
        normalized === "SALES" ||
        normalized === "SALE" ||
        normalized === "RETAIL" ||
        normalized === "CASH" ||
        normalized === "CLO STK" ||
        normalized === "CLOSING" ||
        normalized === "AGE"
    );
}

/*
 * A group token's effective span extends toward the next group
 * header, not merely the next visible token.
 *
 * Product/Packing are special direct columns. For a group
 * header, its left boundary is its own position and its right
 * boundary is the next group/direct column.
 */
function buildGroupTokens(tokens) {
    const groups = [];

    for (const token of tokens) {
        if (isGroupHeaderToken(token)) {
            let common = resolveDirectAlias(token.text);

            /*
             * OP specifically means Opening.
             */
            if (
                normalizeHeader(token.text) === "OP"
            ) {
                common = "opening";
            }

            const groupHeader = normalizeHeader(token.text);

            if (groupHeader === "RETAIL") {
                common = "retailSales";
            }

            if (groupHeader === "CASH") {
                common = "cashSales";
            }

            if (groupHeader === "CLO STK") {
                common = "closing";
            }

            if (groupHeader === "AGE") {
                common = "age";
            }

            if (common) {
                groups.push({
                    ...token,
                    groupCommon: common
                });
            }
        }
    }

    return groups;
}

/* ============================================================
 * ASSIGN CHILD BY PHYSICAL POSITION
 * ============================================================
 */

function assignChildToGroup(
    child,
    groups,
    allTokens
) {
    if (!groups.length) return null;

    /*
     * Multi-row fixed-width reports do not always align the first
     * character of a child label exactly under the first character
     * of its parent group.
     *
     * Example:
     *
     *   OP
     *   Qty
     *
     * In the DERMANEX statement, OP starts at character 41 while
     * Qty starts at character 40.
     *
     * Therefore the parent relationship is determined from the
     * horizontal area occupied by the child, not simply:
     *
     *   child.start >= parent.start
     *
     * A small overlap tolerance is intentional and applies only
     * to header geometry.
     */

    const CHILD_OVERLAP_TOLERANCE = 2;

    const candidates = groups.map(group => {
        const laterGroups = groups
            .filter(
                next =>
                    next.start > group.start
            )
            .sort(
                (a, b) =>
                    a.start - b.start
            );

        const nextGroup = laterGroups[0];

        const groupStart =
            group.start -
            CHILD_OVERLAP_TOLERANCE;

        const groupEnd =
            nextGroup
                ? nextGroup.start
                : Number.MAX_SAFE_INTEGER;

        const overlaps =
            child.end > groupStart &&
            child.start < groupEnd;

        if (!overlaps) {
            return null;
        }

        /*
         * Distance from the child's center to the group start.
         * This is only used to select the nearest valid group.
         */
        /*
         * Parent selection is based on physical coverage first.
         *
         * This is the critical rule for fixed-width multi-row TXT:
         * the child header belongs to the parent group whose physical
         * area covers the greatest portion of the child header.
         *
         * Example:
         *   CASH     CLO.STK
         *              QTY
         *
         * QTY at 63-66 overlaps CASH only at 63-64, but overlaps
         * CLO.STK at 63-66. Therefore CLO.STK wins.
         */
        const groupEndForOverlap =
            nextGroup
                ? nextGroup.start
                : Number.MAX_SAFE_INTEGER;

        const overlapStart =
            Math.max(
                child.start,
                groupStart
            );

        const overlapEnd =
            Math.min(
                child.end,
                groupEndForOverlap
            );

        const overlap =
            Math.max(
                0,
                overlapEnd - overlapStart
            );

        const childCenter =
            (child.start + child.end) / 2;

        const groupCenter =
            nextGroup
                ? (group.start + nextGroup.start) / 2
                : group.start;

        return {
            group,
            overlap,
            distance:
                Math.abs(
                    childCenter -
                    groupCenter
                )
        };
    }).filter(Boolean);

    if (!candidates.length) {
        return null;
    }

    candidates.sort(
        (a, b) =>
            (b.overlap - a.overlap) ||
            (a.distance - b.distance)
    );

    return candidates[0].group;
}

/* ============================================================
 * HEADER-COVERAGE HELPER
 * ============================================================
 *
 * A complete numeric run is mapped by physical overlap with the
 * leaf header column produced by this mapper.
 */
function physicalRunOverlapsColumn(run, column, lineLength) {
    if (!run || !column) return false;

    const runStart = Number(run.start);
    const runEnd = Number(run.end);
    const columnStart = Number(column.physicalStart);
    const columnEnd =
        column.physicalEnd == null
            ? Number(lineLength)
            : Number(column.physicalEnd);

    if (
        !Number.isFinite(runStart) ||
        !Number.isFinite(runEnd) ||
        !Number.isFinite(columnStart) ||
        !Number.isFinite(columnEnd)
    ) {
        return false;
    }

    return (
        runEnd > columnStart &&
        runStart < columnEnd
    );
}

/* ============================================================
 * DIRECT COLUMN BOUNDARIES
 * ============================================================
 *
 * Product and Packing are leaf columns.
 *
 * Their physical ends are determined using the next meaningful
 * group/direct column, not every child token.
 */

function buildDirectColumns(
    parentTokens,
    groups
) {
    const direct = [];

    for (const token of parentTokens) {

        if (isGroupHeaderToken(token)) {
            continue;
        }

        const common =
            resolveDirectAlias(token.text);

        if (!common) {
            continue;
        }

        direct.push({
            header: token.text,
            normalizedHeader: token.normalized,
            commonField: common,
            parentHeader: null,
            childHeader: null,
            headerRow: token.rowIndex,
            position: token.start,
            physicalStart: token.start,
            physicalEnd: null,
            source: "PARENT"
        });
    }

    /*
     * Determine each direct column's end using the next parent
     * direct/group position.
     */
    const boundaries = [
        ...direct.map(column => ({
            start: column.physicalStart,
            type: "DIRECT"
        })),
        ...groups.map(group => ({
            start: group.start,
            type: "GROUP"
        }))
    ].sort(
        (a, b) =>
            a.start - b.start
    );

    for (const column of direct) {
        const next =
            boundaries.find(
                boundary =>
                    boundary.start >
                    column.physicalStart
            );

        column.physicalEnd =
            next
                ? next.start
                : null;

        column.end =
            column.physicalEnd;
    }

    return direct;
}

/* ============================================================
 * CHELLAS MULTI-ROW FIXED-WIDTH STRUCTURE
 * ============================================================
 *
 * This structure has 15 logical headers formed from two physical
 * header rows. Physical character boundaries are authoritative.
 *
 * IMPORTANT:
 * This special handling is activated ONLY when the exact CHELLAS
 * header geometry is detected. Existing multi-row structures remain
 * on the generic mapper below.
 */

function isChellasHeader(headerLines) {
    if (!Array.isArray(headerLines) || headerLines.length < 2) {
        return false;
    }

    const combined = headerLines
        .map(line => normalizeHeader(line))
        .join(" ");

    return (
        combined.includes("PRODUCT NAME") &&
        combined.includes("PACKING") &&
        combined.includes("OPENING") &&
        combined.includes("PURCH") &&
        combined.includes("PREV") &&
        combined.includes("LAST") &&
        combined.includes("CURRENT") &&
        combined.includes("CLOSING") &&
        combined.includes("TRANS") &&
        combined.includes("RATE") &&
        combined.includes("VALUE")
    );
}

function buildChellasPhysicalColumns(headerLines) {
    const boundaries = [
        0, 23, 34, 41, 47, 53, 61, 67,
        76, 82, 89, 98, 105, 111, 118
    ];

    const definitions = [
        { header: "Product Name", commonField: "product" },
        { header: "Packing", commonField: "pack" },
        { header: "Opening Stock", commonField: "opening" },
        { header: "Purch", commonField: "purchase" },
        { header: "Free", commonField: null },
        { header: "Sales Qty Prev", commonField: null },
        { header: "Sales Qty Last", commonField: null },
        { header: "Sales Qty Current", commonField: "sales" },
        { header: "Sales Qty Free", commonField: "salesFree" },
        { header: "Exp Bro", commonField: null },
        { header: "Closing Stock", commonField: "closing" },
        { header: "Trans Qty", commonField: null },
        { header: "Unit Rate", commonField: null },
        { header: "Value Sales", commonField: "salesValue" },
        { header: "Value Stock", commonField: "closingValue" }
    ];

    const childRowIndex = 1;

    const columns = definitions.map((definition, index) => ({
        header: definition.header,
        normalizedHeader: normalizeHeader(definition.header),
        commonField: definition.commonField,
        parentHeader: null,
        childHeader: definition.header,
        headerRow: childRowIndex,
        position: boundaries[index],
        physicalStart: boundaries[index],
        physicalEnd: boundaries[index + 1] || null,
        end: boundaries[index + 1] || null,
        source: definition.commonField
            ? "LOGICAL_POSITION"
            : "CHILD_UNIDENTIFIED"
    }));

    const unidentified = columns.filter(
        column => !column.commonField
    );

    return {
        success: true,
        columns,
        unidentified,
        diagnostics: {
            headerRows: headerLines.length,
            tokenRows: headerLines.map(
                line => tokenizeHeaderLine(line, 0).length
            ),
            structure: "CHELLAS_15_COLUMN_FIXED_WIDTH",
            columnCount: columns.length
        }
    };
}

/* ============================================================
 * BUILD MULTI-ROW PHYSICAL COLUMNS
 * ============================================================
 */


/* ============================================================
 * JYOTI MEDICAL HALL 10-COLUMN FIXED-WIDTH STRUCTURE
 * ============================================================
 *
 * Header:
 *   Product Name | Packing | Opening Stock | Purchases | Sales | Closing Stock
 *                                  Qty Value   Qty Value  Qty Value  Qty Value
 *
 * Physical positions are authoritative. The four parent groups
 * must NOT be allowed to create overlapping Qty ranges.
 */
function isJyotiMedicalHallHeader(headerLines) {
    if (!Array.isArray(headerLines) || headerLines.length < 2) {
        return false;
    }

    const combined = headerLines
        .map(line => normalizeHeader(line))
        .join(" ");

    return (
        combined.includes("PRODUCT NAME") &&
        combined.includes("PACKING") &&
        combined.includes("OPENING STOCK") &&
        combined.includes("PURCHASES") &&
        combined.includes("SALES") &&
        combined.includes("CLOSING STOCK")
    );
}

function buildJyotiMedicalHallPhysicalColumns(headerLines) {
    /*
     * Boundaries taken from the actual JYOTI fixed-width data rows.
     *
     * Product : 0-23
     * Packing : 23-34
     * Opening Qty/Value     : 34-41 / 41-51
     * Purchase Qty/Value    : 51-60 / 60-67
     * Sales Qty/Value       : 67-73 / 73-83
     * Closing Qty/Value     : 83-89 / 89-end
     */
    const boundaries = [
        0, 23, 34, 41, 51, 60, 67, 73, 83, 89
    ];

    const definitions = [
        { header: "Product Name", commonField: "product" },
        { header: "Packing", commonField: "pack" },
        { header: "Opening Qty", commonField: "opening" },
        { header: "Opening Value", commonField: "openingValue" },
        { header: "Purchase Qty", commonField: "purchase" },
        { header: "Purchase Value", commonField: "purchaseValue" },
        { header: "Sales Qty", commonField: "sales" },
        { header: "Sales Value", commonField: "salesValue" },
        { header: "Closing Qty", commonField: "closing" },
        { header: "Closing Value", commonField: "closingValue" }
    ];

    const columns = definitions.map((definition, index) => ({
        header: definition.header,
        normalizedHeader: normalizeHeader(definition.header),
        commonField: definition.commonField,
        parentHeader: null,
        childHeader: definition.header,
        headerRow: index < 2 ? 0 : 1,
        position: boundaries[index],
        physicalStart: boundaries[index],
        physicalEnd: boundaries[index + 1] != null
            ? boundaries[index + 1]
            : null,
        end: boundaries[index + 1] != null
            ? boundaries[index + 1]
            : null,
        source: "LOGICAL_POSITION"
    }));

    /*
     * Closing Value intentionally extends to the end of the row.
     */
    columns[9].physicalEnd = null;
    columns[9].end = null;

    return {
        success: true,
        columns,
        unidentified: [],
        diagnostics: {
            headerRows: headerLines.length,
            structure: "JYOTI_MEDICAL_HALL_10_COLUMN_FIXED_WIDTH",
            columnCount: columns.length
        }
    };
}



/* ============================================================
 * DERMASCIENCE 12-COLUMN FIXED-WIDTH STRUCTURE
 * ============================================================
 *
 * This branch is activated ONLY for the exact DERMASCIENCE
 * main-table header geometry. Existing generic mapping and the
 * existing CHELLAS branch are left untouched.
 *
 * Logical columns:
 *   Product Name
 *   Opening Stock
 *   Receipt
 *   Adj (-)
 *   Adj (+)
 *   Total Stock
 *   Sales Qty
 *   Close Stock
 *   Ord.Qty
 *   Exces Value
 *   Jun Sales
 *   May Sales
 */
function isDermascienceHeader(headerLines) {
    if (
        !Array.isArray(headerLines) ||
        headerLines.length < 2
    ) {
        return false;
    }

    const combined = headerLines
        .map(line => normalizeHeader(line))
        .join(" ");

    return (
        combined.includes("PRODUCT NAME") &&
        combined.includes("OPEN") &&
        combined.includes("STOCK") &&
        combined.includes("REC") &&
        combined.includes("EIPT") &&
        combined.includes("ADJ") &&
        combined.includes("TOTAL") &&
        combined.includes("SALES") &&
        combined.includes("CLOSE") &&
        combined.includes("ORD QTY") &&
        combined.includes("EXCES") &&
        combined.includes("JUN") &&
        combined.includes("MAY")
    );
}

function buildDermasciencePhysicalColumns(headerLines) {
    /*
     * Boundaries are taken from the actual two-row header geometry.
     * Do not infer boundaries from individual words such as
     * PRODUCT / NAME or REC- / EIPT.
     */
    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    /*
     * Locate the logical header starts from the combined physical
     * header. Product starts at the first non-space position.
     * Operational starts are taken from row 0/row 1 fragments.
     */
    const productStart = row0.search(/\S/);
    const openingStart = row0.indexOf("OPEN");
    const receiptStart = row0.indexOf("REC-");
    const adjMinusStart = row0.indexOf("ADJ", receiptStart + 1);
    const adjPlusStart = row0.indexOf("ADJ", adjMinusStart + 1);
    const totalStart = row1.indexOf("STOCK", adjPlusStart + 1);
    const salesStart = row0.indexOf("SALES", totalStart);
    const closeStart = row0.indexOf("CLOSE", salesStart);
    const ordStart = row0.indexOf("ORD.QTY", closeStart);
    const excesStart = row0.indexOf("EXCES", ordStart);
    const junStart = row0.indexOf("JUN", excesStart);
    const mayStart = row0.indexOf("MAY", junStart);

    /*
     * The first product row establishes the final physical widths
     * more reliably when a header word itself is split between rows.
     * These are the observed fixed-width boundaries for this
     * DERMASCIENCE structure.
     */
    const starts = [
        productStart >= 0 ? productStart : 2,
        openingStart >= 0 ? openingStart : 28,
        receiptStart >= 0 ? receiptStart : 35,
        adjMinusStart >= 0 ? adjMinusStart : 41,
        adjPlusStart >= 0 ? adjPlusStart : 47,
        totalStart >= 0 ? totalStart : 51,
        salesStart >= 0 ? salesStart : 59,
        closeStart >= 0 ? closeStart : 63,
        ordStart >= 0 ? ordStart : 70,
        excesStart >= 0 ? excesStart : 80,
        junStart >= 0 ? junStart : 87,
        mayStart >= 0 ? mayStart : 96
    ];

    /*
     * Ensure monotonically increasing physical boundaries. If a
     * visual header fragment does not occur on row 0, retain the
     * known fixed-width fallback rather than corrupting the mapping.
     */
    const fallback = [
        2, 28, 35, 41, 47, 51,
        59, 63, 70, 80, 87, 96
    ];

    for (let i = 0; i < starts.length; i++) {
        if (
            i > 0 &&
            (
                starts[i] <= starts[i - 1] ||
                !Number.isFinite(starts[i])
            )
        ) {
            starts[i] = fallback[i];
        }
    }

    const definitions = [
        { header: "Product Name", commonField: "product" },
        { header: "Opening Stock", commonField: "opening" },
        { header: "Receipt", commonField: "purchase" },
        { header: "Adj (-)", commonField: null },
        { header: "Adj (+)", commonField: null },
        { header: "Total Stock", commonField: null },
        { header: "Sales Qty", commonField: "sales" },
        { header: "Close Stock", commonField: "closing" },
        { header: "Ord.Qty", commonField: null },
        { header: "Exces Value", commonField: null },
        { header: "Jun Sales", commonField: null },
        { header: "May Sales", commonField: null }
    ];

    const columns = definitions.map(
        (definition, index) => ({
            header: definition.header,
            normalizedHeader:
                normalizeHeader(definition.header),
            commonField:
                definition.commonField,
            parentHeader: null,
            childHeader: definition.header,
            headerRow: index === 0 ? 0 : 1,
            position: starts[index],
            physicalStart: starts[index],
            physicalEnd:
                starts[index + 1] != null
                    ? starts[index + 1]
                    : null,
            end:
                starts[index + 1] != null
                    ? starts[index + 1]
                    : null,
            source:
                definition.commonField
                    ? "LOGICAL_POSITION"
                    : "CHILD_UNIDENTIFIED"
        })
    );

    const unidentified =
        columns.filter(
            column =>
                !column.commonField
        );

    return {
        success: true,
        columns,
        unidentified,
        diagnostics: {
            headerRows:
                headerLines.length,
            structure:
                "DERMASCIENCE_12_COLUMN_FIXED_WIDTH",
            columnCount:
                columns.length
        }
    };
}


/* ============================================================
 * CODE / NAME STOCK STATEMENT STRUCTURE
 * ============================================================
 *
 * This structure is intentionally handled from the detected
 * physical header tokens. No fixed character positions are used.
 *
 * Header shape:
 *
 *   Code | Name | Prate | OpStock | Purchase | Preturn | Sales |
 *   SValue | SReturn | Excess | Short | ClStock | Cl Value
 *                 Qty Free             Qty Free       Qty Free
 *
 * Core rule:
 *   A numeric run is mapped later by the physical span of the
 *   corresponding leaf column. Child labels refine only their
 *   parent group; they do not replace unrelated direct columns.
 */

function isCodeNameStockStructure(headerLines) {
    if (!Array.isArray(headerLines) || headerLines.length < 2) {
        return false;
    }

    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    const combined = headerLines
        .map(line => normalizeHeader(line))
        .join(" ");

    /*
     * IMPORTANT:
     * Do not apply word-boundary regexes to a space-stripped header.
     *
     * For this report the first-row text contains adjacent logical
     * headers such as:
     *
     *   ... Name Prate OpStock Purchase Preturn ...
     *
     * After whitespace removal it becomes:
     *
     *   ...NAMEPRATEOPSTOCKPURCHASEPRETURN...
     *
     * Therefore \bPRATE\b, \bOPSTOCK\b, etc. can never match.
     *
     * compactHeader() is already the mapper's normalization mechanism
     * for punctuation/spacing variants, so use exact substring checks
     * against the compact form for these known header words.
     *
     * This changes ONLY recognition of this CODE/NAME stock structure.
     * No existing physical-position or structure-specific mapping is
     * changed.
     */
    const compact = compactHeader(combined);

    return (
        /\bCODE\b/.test(combined) &&
        /\bNAME\b/.test(combined) &&
        compact.includes("PRATE") &&
        compact.includes("OPSTOCK") &&
        compact.includes("PURCHASE") &&
        compact.includes("PRETURN") &&
        compact.includes("SALES") &&
        compact.includes("SVALUE") &&
        compact.includes("SRETURN") &&
        compact.includes("EXCESS") &&
        compact.includes("SHORT") &&
        compact.includes("CLSTOCK") &&
        compact.includes("CLVALUE") &&
        /\bQTY\b/.test(row1.toUpperCase()) &&
        /\bFREE\b/.test(row1.toUpperCase()) &&
        row0.length > 0
    );
}

function findHeaderToken(tokens, value) {
    const target = normalizeHeader(value);

    return tokens.find(
        token => normalizeHeader(token.text) === target
    ) || null;
}

function findHeaderTokenIndex(tokens, value) {
    const target = normalizeHeader(value);

    return tokens.findIndex(
        token => normalizeHeader(token.text) === target
    );
}

function makePhysicalColumn(
    header,
    commonField,
    physicalStart,
    physicalEnd,
    options = {}
) {
    return {
        header,
        normalizedHeader: normalizeHeader(header),
        commonField: commonField || null,
        parentHeader:
            options.parentHeader == null
                ? null
                : options.parentHeader,
        childHeader:
            options.childHeader == null
                ? null
                : options.childHeader,
        headerRow:
            options.headerRow == null
                ? 0
                : options.headerRow,
        position: physicalStart,
        physicalStart,
        physicalEnd:
            physicalEnd == null
                ? null
                : physicalEnd,
        end:
            physicalEnd == null
                ? null
                : physicalEnd,
        source:
            options.source ||
            (commonField
                ? "PHYSICAL_HEADER"
                : "CHILD_UNIDENTIFIED")
    };
}

function buildCodeNameStockPhysicalColumns(headerLines) {
    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    const parentTokens = tokenizeHeaderLine(row0, 0);
    const childTokens = tokenizeHeaderLine(row1, 1);

    if (!parentTokens.length) {
        return {
            success: false,
            columns: [],
            unidentified: [],
            diagnostics: {
                message:
                    "CODE/NAME structure has no parent header tokens."
            }
        };
    }

    /*
     * Build the direct columns from actual first-row token starts.
     * "Cl Value" is reconstructed from the adjacent Cl + Value
     * header tokens and therefore remains one physical column.
     */
    const definitions = [
        {
            header: "Code",
            commonField: "code",
            token: "Code"
        },
        {
            header: "Name",
            commonField: "product",
            token: "Name"
        },
        {
            header: "Prate",
            commonField: "unitRate",
            token: "Prate"
        },
        {
            header: "OpStock",
            commonField: "opening",
            token: "OpStock"
        },
        {
            header: "Purchase",
            commonField: null,
            token: "Purchase",
            group: true
        },
        {
            header: "Preturn",
            commonField: "purchaseReturn",
            token: "Preturn"
        },
        {
            header: "Sales",
            commonField: null,
            token: "Sales",
            group: true
        },
        {
            header: "SValue",
            commonField: "salesValue",
            token: "SValue"
        },
        {
            header: "SReturn",
            commonField: "salesReturn",
            token: "SReturn"
        },
        {
            header: "Excess",
            commonField: "excess",
            token: "Excess"
        },
        {
            header: "Short",
            commonField: "short",
            token: "Short"
        },
        {
            header: "ClStock",
            commonField: null,
            token: "ClStock",
            group: true
        }
    ];

    const resolved = definitions.map(definition => {
        const token = findHeaderToken(
            parentTokens,
            definition.token
        );

        return {
            ...definition,
            token
        };
    });

    /*
     * The first-row "Cl Value" is two adjacent tokens.
     */
    /*
     * Detect the composite "Cl Value" header directly from the
     * original first header row. tokenizeHeaderLine() may represent
     * "Cl Value" either as one token or as separate tokens depending
     * on the TXT spacing. The source text is authoritative.
     */
    const clValueMatch =
        /\bCl\s+Value\b/i.exec(row0);

    const clValueStart =
        clValueMatch
            ? clValueMatch.index
            : null;

    const hasClValue =
        clValueStart != null;

    const clIndex = findHeaderTokenIndex(
        parentTokens,
        "ClStock"
    );

    const directPhysical = [];

    for (const definition of resolved) {
        if (!definition.token) {
            continue;
        }

        if (definition.group) {
            continue;
        }

        /*
         * "Cl Value" belongs to the ClStock group and is created
         * separately below.
         */
        directPhysical.push(
            makePhysicalColumn(
                definition.header,
                definition.commonField,
                definition.token.start,
                null,
                {
                    headerRow: 0,
                    source: "PARENT"
                }
            )
        );
    }

    /*
     * Parent group spans are derived from the next first-row
     * meaningful parent token. These are NOT fixed positions.
     */
    const groupDefinitions = resolved.filter(
        definition =>
            definition.group &&
            definition.token
    );

    const nextParentStart = token => {
        const later = parentTokens
            .filter(
                candidate =>
                    candidate.start > token.start
            )
            .map(candidate => candidate.start);

        return later.length
            ? Math.min(...later)
            : null;
    };

    /*
     * Child groups use their detected child positions. A child
     * belongs to its parent because its physical position lies
     * within the parent's physical span (with the same small
     * header-only tolerance used by the generic mapper).
     */
    const childDefinitions = [
        {
            parent: "Purchase",
            children: [
                { text: "Qty", commonField: "purchase" },
                { text: "Free", commonField: "purchaseFree" }
            ]
        },
        {
            parent: "Sales",
            children: [
                { text: "Qty", commonField: "sales" },
                { text: "Free", commonField: "salesFree" }
            ]
        },
        {
            parent: "ClStock",
            children: [
                { text: "Qty", commonField: "closing" },
                { text: "Free", commonField: "closingFree" }
            ]
        }
    ];

    const childColumns = [];

    for (const groupDefinition of groupDefinitions) {
        const groupToken = groupDefinition.token;
        const groupStart = groupToken.start;
        const groupEnd = nextParentStart(groupToken);

        const children = childDefinitions.find(
            definition =>
                normalizeHeader(definition.parent) ===
                normalizeHeader(groupDefinition.header)
        );

        if (!children) {
            continue;
        }

        const matchingChildren = children.children
            .map(definition => ({
                ...definition,
                token:
                    childTokens.find(
                        token =>
                            normalizeHeader(token.text) ===
                            normalizeHeader(definition.text) &&
                            token.start >=
                                groupStart - 2 &&
                            (
                                groupEnd == null ||
                                token.start < groupEnd
                            )
                    ) || null
            }))
            .filter(item => item.token);

        for (
            let index = 0;
            index < matchingChildren.length;
            index++
        ) {
            const item = matchingChildren[index];
            const next = matchingChildren[index + 1];

            let end =
                next
                    ? next.token.start
                    : groupEnd;

            /*
             * If the child starts slightly before the parent (e.g.
             * Qty at 48 and Purchase at 49), retain the child's
             * actual start. This is precisely the physical-coverage
             * rule and avoids inventing a boundary at the parent.
             */
            childColumns.push(
                makePhysicalColumn(
                    item.text,
                    item.commonField,
                    item.token.start,
                    end,
                    {
                        parentHeader:
                            groupDefinition.header,
                        childHeader:
                            item.text,
                        headerRow: 1,
                        source: "CHILD_POSITION"
                    }
                )
            );
        }
    }

    /*
     * Direct columns outside groups use the next direct/group
     * header's actual position as their physical end.
     */
    const directAndGroups = [
        ...resolved
            .filter(definition => definition.token)
            .map(definition => ({
                start: definition.token.start,
                kind: definition.group
                    ? "GROUP"
                    : "DIRECT"
            })),
        ...(hasClValue
            ? [{
                start: clValueStart,
                kind: "DIRECT"
            }]
            : [])
    ].sort(
        (a, b) =>
            a.start - b.start
    );

    for (const column of directPhysical) {
        const next = directAndGroups.find(
            boundary =>
                boundary.start >
                column.physicalStart
        );

        column.physicalEnd =
            next
                ? next.start
                : null;

        column.end =
            column.physicalEnd;
    }

    /*
     * Add Cl Value as one direct physical column.
     * Its span begins at the actual "Cl" token and extends to
     * the end of the statement row because no later first-row
     * header exists.
     */
    if (hasClValue) {
        /*
         * "Cl Value" is one logical direct column. Its start is the
         * actual position of "Cl" in the source header. Do not use
         * a hard-coded position and do not split it into Cl + Value.
         */
        const clValueColumn =
            makePhysicalColumn(
                "Cl Value",
                "closingValue",
                clValueStart,
                null,
                {
                    headerRow: 0,
                    source: "PARENT"
                }
            );

        /*
         * It is the final first-row logical column in this structure,
         * so its end remains null (the data extractor will use the
         * source row length). The ClStock child columns retain their
         * own detected positions independently.
         */
        directPhysical.push(
            clValueColumn
        );
    }

    const columns = [
        ...directPhysical,
        ...childColumns
    ].sort(
        (a, b) =>
            a.physicalStart -
            b.physicalStart
    );

    /*
     * Remove only visual group headers represented by a child.
     * No actual direct data column is removed.
     */
    const finalColumns = columns;

    /*
     * The /T, IN and /TOUT labels are visual annotations attached
     * to Excess/Short in this statement. They are not independent
     * data columns, so they must not be allowed to steal physical
     * ranges from the actual direct columns.
     */
    const unidentified = [];

    return {
        success:
            finalColumns.length > 0,
        columns:
            finalColumns,
        unidentified,
        diagnostics: {
            headerRows:
                headerLines.length,
            structure:
                "CODE_NAME_STOCK_PHYSICAL_HEADER",
            parentTokenCount:
                parentTokens.length,
            childTokenCount:
                childTokens.length,
            columnCount:
                finalColumns.length,
            rule:
                "Detected header positions are authoritative; child Qty/Free refine only their parent physical group."
        }
    };
}



/* ============================================================
 * SRI VASAVI MEDICAL DISTRIBUTORS
 * 11-COLUMN FIXED-WIDTH STRUCTURE
 * ============================================================
 *
 * ADDITIVE / ISOLATED BRANCH:
 *   This branch is activated only for the Sri Vasavi two-row
 *   header geometry containing LM SALE and AGE.
 *
 * Physical columns:
 *
 *   Code          0-7
 *   Product       7-32
 *   Packing      32-41
 *   LM Sale      41-46
 *   Opening      46-55
 *   Receipts     55-67
 *   Total        67-76
 *   Sales        76-83
 *   Closing      83-94
 *   Closing Val  94-102
 *   AGE         102-end
 *
 * IMPORTANT:
 *   Physical positions are authoritative.
 *   LM SALE is a real leaf data column and MUST NOT be absorbed
 *   into Packing.
 *   AGE is a real leaf data column and MUST NOT be absorbed into
 *   Closing Value.
 *
 * Existing mapper branches are intentionally untouched.
 * ============================================================
 */

function isSriVasaviMedicalDistributorsHeader(headerLines) {
    if (
        !Array.isArray(headerLines) ||
        headerLines.length < 2
    ) {
        return false;
    }

    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    const normalizedRow0 = normalizeHeader(row0);
    const normalizedRow1 = normalizeHeader(row1);

    /*
     * Require the exact semantic combination that distinguishes
     * this structure from the existing generic/Siddartha mapper.
     *
     * LM and SALE are intentionally checked as separate physical
     * header fragments because the source prints:
     *
     *   ... Packing  LM   Opening ...
     *              SALE  Stock ...
     */
    return (
        normalizedRow0.includes("CODE") &&
        normalizedRow0.includes("PRODUCT NAME") &&
        normalizedRow0.includes("PACKING") &&
        normalizedRow0.includes("LM") &&
        normalizedRow0.includes("OPENING") &&
        normalizedRow0.includes("RECEIPTS") &&
        normalizedRow0.includes("TOTAL") &&
        normalizedRow0.includes("SALES") &&
        normalizedRow0.includes("CLOSING") &&
        normalizedRow0.includes("AGE") &&
        normalizedRow1.includes("SALE") &&
        normalizedRow1.includes("STOCK") &&
        normalizedRow1.includes("VALUE")
    );
}

function buildSriVasaviMedicalDistributorsPhysicalColumns(
    headerLines
) {
    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    /*
     * The actual Sri Vasavi header geometry is fixed-width.
     *
     * Do NOT derive Packing's end from the next numeric run.
     * The LM SALE column starts at character 41.
     *
     * Do NOT allow Closing Value to extend through AGE.
     * AGE starts at character 102.
     */
    const fallback = [
        0, 7, 32, 41, 46, 55,
        67, 76, 83, 94, 102
    ];

    /*
     * Resolve the first-row starts from the actual header where
     * possible. Product Name is intentionally reconstructed from
     * the Product token because Name is part of the same logical
     * physical column.
     */
    const codeStart = row0.search(/\S/);
    const productStart = row0.indexOf("Product");
    const packingStart = row0.indexOf("Packing");
    const lmStart = row0.indexOf("LM");
    const openingStart = row0.indexOf("Opening");
    const receiptsStart = row0.indexOf("Receipts");
    const totalStart = row0.indexOf("Total");
    const salesStart = row0.indexOf("Sales");

    /*
     * There are two "Closing" labels. The first is Closing Stock
     * and the second is Closing Value.
     */
    const closingStarts = [];
    const closingRegex = /Closing/g;
    let closingMatch;

    while (
        (closingMatch = closingRegex.exec(row0)) !== null
    ) {
        closingStarts.push(closingMatch.index);
    }

    const firstClosingStart =
        closingStarts.length >= 1
            ? closingStarts[0]
            : -1;

    const secondClosingStart =
        closingStarts.length >= 2
            ? closingStarts[1]
            : -1;

    const ageStart = row0.indexOf("AGE");

    const starts = [
        codeStart >= 0 ? codeStart : fallback[0],
        productStart >= 0 ? productStart : fallback[1],
        packingStart >= 0 ? packingStart : fallback[2],
        lmStart >= 0 ? lmStart : fallback[3],
        openingStart >= 0 ? openingStart : fallback[4],
        receiptsStart >= 0 ? receiptsStart : fallback[5],
        totalStart >= 0 ? totalStart : fallback[6],
        salesStart >= 0 ? salesStart : fallback[7],
        firstClosingStart >= 0
            ? firstClosingStart
            : fallback[8],
        secondClosingStart >= 0
            ? secondClosingStart
            : fallback[9],
        ageStart >= 0
            ? ageStart
            : fallback[10]
    ];

    /*
     * The LM label is at 41, while SALE is on the child row at
     * the same physical region. The child label must refine the
     * LM parent; it must never move the boundary.
     *
     * AGE is on the first row and is the final physical column.
     */
    for (let i = 0; i < starts.length; i++) {
        if (
            !Number.isFinite(starts[i]) ||
            (
                i > 0 &&
                starts[i] <= starts[i - 1]
            )
        ) {
            starts[i] = fallback[i];
        }
    }

    const definitions = [
        {
            header: "Code",
            commonField: "code",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Product Name",
            commonField: "product",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Packing",
            commonField: "pack",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "LM Sale",
            commonField: "salesLast",
            parentHeader: "LM",
            childHeader: "Sale",
            headerRow: 1
        },
        {
            header: "Opening Stock",
            commonField: "opening",
            parentHeader: "Opening",
            childHeader: "Stock",
            headerRow: 1
        },
        {
            header: "Receipts",
            commonField: "purchase",
            parentHeader: "Receipts",
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Total",
            commonField: "totalStock",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Sales",
            commonField: "sales",
            parentHeader: "Sales",
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Closing Stock",
            commonField: "closing",
            parentHeader: "Closing",
            childHeader: "Stock",
            headerRow: 1
        },
        {
            header: "Closing Value",
            commonField: "closingValue",
            parentHeader: "Closing",
            childHeader: "Value",
            headerRow: 1
        },
        {
            header: "AGE",
            commonField: "age",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        }
    ];

    const columns = definitions.map(
        (definition, index) => {
            const physicalEnd =
                starts[index + 1] != null
                    ? starts[index + 1]
                    : null;

            return makePhysicalColumn(
                definition.header,
                definition.commonField,
                starts[index],
                physicalEnd,
                {
                    parentHeader:
                        definition.parentHeader,
                    childHeader:
                        definition.childHeader,
                    headerRow:
                        definition.headerRow,
                    source:
                        "SRI_VASAVI_FIXED_WIDTH"
                }
            );
        }
    );

    /*
     * AGE is the final logical column and therefore extends to the
     * end of each source data row.
     */
    columns[columns.length - 1].physicalEnd = null;
    columns[columns.length - 1].end = null;

    return {
        success: true,
        columns,
        unidentified: [],
        diagnostics: {
            headerRows: headerLines.length,
            row0Length: row0.length,
            row1Length: row1.length,
            structure:
                "SRI_VASAVI_MEDICAL_DISTRIBUTORS_11_COLUMN_FIXED_WIDTH",
            columnCount: columns.length,
            rule:
                "First-row physical positions are authoritative; LM SALE is a separate leaf column at 41-46 and AGE is a separate final leaf column at 102-end."
        }
    };
}


/* ============================================================
 * SIDDARTHA MEDICAL & SURGICAL AGENCIES
 * 9-COLUMN FIXED-WIDTH STRUCTURE
 * ============================================================
 *
 * This branch is intentionally isolated to this exact header
 * geometry. Existing generic mapping and all existing
 * structure-specific branches remain unchanged.
 *
 * Header:
 *   Code   Product Name             Packing  Opening  Receipts    Total    Sales  Closing    Closing
 *                                              Stock                                Stock      Value
 *
 * Logical physical columns:
 *   Code
 *   Product Name
 *   Packing
 *   Opening Stock
 *   Receipts
 *   Total
 *   Sales
 *   Closing Stock
 *   Closing Value
 *
 * IMPORTANT:
 *   Receipts and Sales are parent/group labels but have no child
 *   label beneath them in this statement. They are therefore leaf
 *   data columns and must be retained as physical columns.
 *
 *   Opening/Closing Stock DO have child Stock labels. Their
 *   logical physical boundaries start at the parent positions,
 *   while the child label is retained as semantic metadata.
 */

function isSiddarthaMedicalSurgicalAgenciesHeader(headerLines) {
    if (
        !Array.isArray(headerLines) ||
        headerLines.length < 2
    ) {
        return false;
    }

    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    const normalizedRow0 = normalizeHeader(row0);
    const normalizedRow1 = normalizeHeader(row1);

    return (
        normalizedRow0.includes("CODE") &&
        normalizedRow0.includes("PRODUCT NAME") &&
        normalizedRow0.includes("PACKING") &&
        normalizedRow0.includes("OPENING") &&
        normalizedRow0.includes("RECEIPTS") &&
        normalizedRow0.includes("TOTAL") &&
        normalizedRow0.includes("SALES") &&
        normalizedRow0.includes("CLOSING") &&
        normalizedRow1.includes("STOCK") &&
        normalizedRow1.includes("VALUE")
    );
}

function buildSiddarthaMedicalSurgicalAgenciesPhysicalColumns(
    headerLines
) {
    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    /*
     * Locate the actual first-row physical starts.
     * Product Name is intentionally treated as one logical
     * column even though it is two header tokens.
     */
    const codeStart = row0.search(/\S/);
    const productStart = row0.indexOf("Product");
    const packingStart = row0.indexOf("Packing");
    const openingStart = row0.indexOf("Opening");
    const receiptsStart = row0.indexOf("Receipts");
    const totalStart = row0.indexOf("Total");
    const salesStart = row0.indexOf("Sales");
    const closingStart = row0.indexOf("Closing");

    /*
     * There are two "Closing" labels. The first is Closing Stock;
     * the second is Closing Value. Resolve them by their physical
     * positions rather than using a generic token lookup.
     */
    const closingStarts = [];
    const closingRegex = /Closing/g;
    let closingMatch;

    while ((closingMatch = closingRegex.exec(row0)) !== null) {
        closingStarts.push(closingMatch.index);
    }

    const firstClosingStart =
        closingStarts.length >= 1
            ? closingStarts[0]
            : closingStart;

    const secondClosingStart =
        closingStarts.length >= 2
            ? closingStarts[1]
            : null;

    /*
     * Actual fixed-width geometry for this statement:
     *
     *   Code          0
     *   Product       7
     *   Packing      32
     *   Opening      41
     *   Receipts     50
     *   Total        62
     *   Sales        71
     *   Closing      78
     *   Closing Val  89
     */
    const fallback = [
        0, 7, 32, 41, 50, 62, 71, 78, 89
    ];

    const starts = [
        codeStart >= 0 ? codeStart : fallback[0],
        productStart >= 0 ? productStart : fallback[1],
        packingStart >= 0 ? packingStart : fallback[2],
        openingStart >= 0 ? openingStart : fallback[3],
        receiptsStart >= 0 ? receiptsStart : fallback[4],
        totalStart >= 0 ? totalStart : fallback[5],
        salesStart >= 0 ? salesStart : fallback[6],
        firstClosingStart >= 0
            ? firstClosingStart
            : fallback[7],
        secondClosingStart >= 0
            ? secondClosingStart
            : fallback[8]
    ];

    /*
     * If any visual fragment is missing or produces an invalid
     * order, use the known fixed-width position for that boundary.
     * This branch is isolated to this exact structure.
     */
    for (let i = 0; i < starts.length; i++) {
        if (
            !Number.isFinite(starts[i]) ||
            (
                i > 0 &&
                starts[i] <= starts[i - 1]
            )
        ) {
            starts[i] = fallback[i];
        }
    }

    const definitions = [
        {
            header: "Code",
            commonField: "code",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Product Name",
            commonField: "product",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Packing",
            commonField: "pack",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Opening Stock",
            commonField: "opening",
            parentHeader: "Opening",
            childHeader: "Stock",
            headerRow: 1
        },
        {
            header: "Receipts",
            commonField: "purchase",
            parentHeader: "Receipts",
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Total",
            commonField: "totalStock",
            parentHeader: null,
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Sales",
            commonField: "sales",
            parentHeader: "Sales",
            childHeader: null,
            headerRow: 0
        },
        {
            header: "Closing Stock",
            commonField: "closing",
            parentHeader: "Closing",
            childHeader: "Stock",
            headerRow: 1
        },
        {
            header: "Closing Value",
            commonField: "closingValue",
            parentHeader: "Closing",
            childHeader: "Value",
            headerRow: 1
        }
    ];

    const columns = definitions.map(
        (definition, index) => {
            const physicalEnd =
                starts[index + 1] != null
                    ? starts[index + 1]
                    : null;

            return makePhysicalColumn(
                definition.header,
                definition.commonField,
                starts[index],
                physicalEnd,
                {
                    parentHeader:
                        definition.parentHeader,
                    childHeader:
                        definition.childHeader,
                    headerRow:
                        definition.headerRow,
                    source:
                        "SIDDARTHA_FIXED_WIDTH"
                }
            );
        }
    );

    /*
     * Closing Value is the final logical column and therefore
     * extends to the end of each source data row.
     */
    columns[columns.length - 1].physicalEnd = null;
    columns[columns.length - 1].end = null;

    return {
        success: true,
        columns,
        unidentified: [],
        diagnostics: {
            headerRows: headerLines.length,
            row0Length: row0.length,
            row1Length: row1.length,
            structure:
                "SIDDARTHA_MEDICAL_SURGICAL_AGENCIES_9_COLUMN_FIXED_WIDTH",
            columnCount: columns.length,
            rule:
                "First-row physical positions are authoritative; Opening/Closing Stock child labels refine their parent columns; Receipts and Sales are retained as leaf parent columns because no child row exists beneath them."
        }
    };
}


function buildPhysicalColumns(headerLines) {

    /*
     * SRI VASAVI MEDICAL DISTRIBUTORS is a specific two-row
     * fixed-width structure with a separate LM SALE column and
     * a separate AGE column.
     *
     * Keep this branch isolated so the existing generic mapper and
     * all previously successful structure-specific branches remain
     * unchanged.
     */
    if (isSriVasaviMedicalDistributorsHeader(headerLines)) {
        return buildSriVasaviMedicalDistributorsPhysicalColumns(
            headerLines
        );
    }

    /*
     * SIDDARTHA MEDICAL & SURGICAL AGENCIES is a specific
     * two-row fixed-width structure where Receipts and Sales
     * are leaf parent columns without child labels.
     * Keep this branch isolated so the generic mapper remains
     * unchanged for all other statements.
     */
    if (isSiddarthaMedicalSurgicalAgenciesHeader(headerLines)) {
        return buildSiddarthaMedicalSurgicalAgenciesPhysicalColumns(
            headerLines
        );
    }

    /*
     * CODE / NAME stock statements have a mixed direct-parent
     * and child-header layout. Handle them before generic inference
     * so Code/Name and Cl Value are preserved and duplicate Qty/Free
     * labels are resolved by their actual parent physical region.
     */
    if (isCodeNameStockStructure(headerLines)) {
        return buildCodeNameStockPhysicalColumns(
            headerLines
        );
    }

    /*
     * JYOTI MEDICAL HALL is a known two-row Qty/Value structure.
     * Handle it before generic child/group inference so each Qty
     * and Value column gets its own non-overlapping physical range.
     */
    if (isJyotiMedicalHallHeader(headerLines)) {
        return buildJyotiMedicalHallPhysicalColumns(headerLines);
    }

    /*
     * DERMASCIENCE is a known two-row fixed-width structure.
     * Handle it before generic child/group inference so split
     * fragments such as OPEN/STOCK and REC-/EIPT remain one
     * logical column.
     */
    if (isDermascienceHeader(headerLines)) {
        return buildDermasciencePhysicalColumns(
            headerLines
        );
    }

    /*
     * CHELLAS is a known two-row fixed-width structure with logical
     * headers that must be reconstructed from physical positions.
     * Handle it before generic child/group inference so labels such
     * as Product + Name and Closing + Qty cannot be incorrectly
     * split or inferred.
     */
    if (isChellasHeader(headerLines)) {
        return buildChellasPhysicalColumns(headerLines);
    }

    /*
     * IMPERIA is handled in its own isolated branch. Existing
     * CODE/NAME, JYOTI, DERMASCIENCE, and CHELLAS branches are
     * intentionally left unchanged.
     */
    if (isImperiaStyleHeader(headerLines)) {
        return buildImperiaPhysicalColumns(headerLines);
    }

    if (
        !Array.isArray(headerLines) ||
        headerLines.length < 2
    ) {
        return {
            success: false,
            columns: [],
            unidentified: [],
            diagnostics: {
                message:
                    "At least two header lines are required."
            }
        };
    }

    const tokenRows =
        headerLines.map(
            (line, rowIndex) =>
                tokenizeHeaderLine(
                    line,
                    rowIndex
                )
        );

    /*
     * First physical row is the parent/group row.
     */
    const parentRowIndex =
        tokenRows.findIndex(
            row =>
                row.length > 0
        );

    if (parentRowIndex < 0) {
        return {
            success: false,
            columns: [],
            unidentified: [],
            diagnostics: {
                message:
                    "No header tokens found."
            }
        };
    }

    const parentTokens =
        tokenRows[parentRowIndex];

    const groups =
        buildGroupTokens(
            parentTokens
        );

    const columns =
        buildDirectColumns(
            parentTokens,
            groups
        );

    const unidentified = [];

    /*
     * Process child rows.
     */
    for (
        let rowIndex = 0;
        rowIndex < tokenRows.length;
        rowIndex++
    ) {

        if (
            rowIndex ===
            parentRowIndex
        ) {
            continue;
        }

        const childTokens =
            tokenRows[rowIndex];

        for (const child of childTokens) {

            /*
             * Ignore visual group-like child labels only when
             * they are not leaf columns. Generic Qty/Value are
             * always leaf candidates.
             */
            const parent =
                assignChildToGroup(
                    child,
                    groups,
                    parentTokens
                );

            let commonField = null;

            if (parent) {
                commonField =
                    resolveChildCommon(
                        parent.groupCommon,
                        child.text
                    );
            }

            /*
             * Direct child aliases remain supported.
             */
            if (!commonField) {
                commonField =
                    resolveDirectAlias(
                        child.text
                    );
            }

            const record = {
                header: child.text,
                normalizedHeader:
                    child.normalized,
                commonField:
                    commonField || null,
                parentHeader:
                    parent
                        ? parent.text
                        : null,
                childHeader:
                    child.text,
                headerRow:
                    rowIndex,
                position:
                    child.start,
                physicalStart:
                    child.start,
                physicalEnd:
                    null,
                end:
                    null,
                source:
                    parent
                        ? "CHILD_POSITION"
                        : "CHILD_UNIDENTIFIED"
            };

            if (!commonField) {
                unidentified.push(
                    record
                );
            }

            columns.push(
                record
            );
        }
    }

    /*
     * Sort by physical position.
     */
    columns.sort(
        (a, b) =>
            a.physicalStart -
            b.physicalStart
    );

    /*
     * If a child starts at the same physical position as a parent,
     * prefer the child because it is the leaf/data column.
     */
    const byPosition =
        new Map();

    for (const column of columns) {

        const key =
            String(
                column.physicalStart
            );

        const existing =
            byPosition.get(
                key
            );

        if (!existing) {
            byPosition.set(
                key,
                column
            );
            continue;
        }

        if (
            existing.source === "PARENT" &&
            column.source !== "PARENT"
        ) {
            byPosition.set(
                key,
                column
            );
        }
    }

    const finalColumns =
        Array.from(
            byPosition.values()
        ).sort(
            (a, b) =>
                a.physicalStart -
                b.physicalStart
        );

    /*
     * Physical end is the next leaf column's start.
     */
    for (
        let i = 0;
        i < finalColumns.length;
        i++
    ) {

        const next =
            finalColumns[i + 1];

        finalColumns[i].physicalEnd =
            next
                ? next.physicalStart
                : null;

        finalColumns[i].end =
            finalColumns[i].physicalEnd;
    }

    return {
        success:
            finalColumns.length > 0,
        columns:
            finalColumns,
        unidentified,
        diagnostics: {
            headerRows:
                headerLines.length,
            tokenRows:
                tokenRows.map(
                    row =>
                        row.length
                ),
            groupHeaders:
                groups.map(
                    group => ({
                        header:
                            group.text,
                        commonField:
                            group.groupCommon,
                        start:
                            group.start
                    })
                ),
            columnCount:
                finalColumns.length
        }
    };
}

/* ============================================================
 * IMPERIA-STYLE COMMON HEADER MAPPING
 * ============================================================
 *
 * Geometry/semantics recognizer only. No fixed data-row boundaries.
 */
function isImperiaStyleHeader(headerLines) {
    if (!Array.isArray(headerLines) || headerLines.length < 2) {
        return false;
    }

    const combined = headerLines
        .map(line => normalizeHeader(line))
        .join(" ");

    const row1 = String(headerLines[1] || "");

    /*
     * IMPERIA fixed-width structure used by the LINUX IMPERIA
     * statement family.
     *
     * Example:
     *   PRODUCT NAME       PACKG OPENING  RECEIPT   <-----SALES---->
     *                            QTY   QTY  FREE  LAST   QTY  FREE
     *
     * CASH is intentionally NOT required here. Some IMPERIA reports
     * use SALES directly without a CASH child/group.
     */
    return (
        combined.includes("PRODUCT NAME") &&
        combined.includes("PACKG") &&
        combined.includes("OPENING") &&
        combined.includes("RECEIPT") &&
        combined.includes("SALES") &&
        combined.includes("ADJMT") &&
        combined.includes("CLOSING") &&
        combined.includes("AGE") &&
        combined.includes("DAYS") &&
        /\bQTY\b/i.test(row1) &&
        /\bFREE\b/i.test(row1) &&
        /\bLAST\b/i.test(row1) &&
        /\bSTOCK\b/i.test(row1) &&
        /\bVALUE\b/i.test(row1)
    );
}

/*
 * Build the IMPERIA physical columns from the actual two-row header.
 *
 * IMPORTANT:
 *   - This branch is isolated to IMPERIA-style headers only.
 *   - Product text is never tokenized here. Step 3 receives the raw
 *     product area as one physical column.
 *   - The duplicate FREE labels are resolved by their physical
 *     position and logical parent, so Sales FREE can never become
 *     purchaseFree.
 */
function buildImperiaPhysicalColumns(headerLines) {
    const row0 = String(headerLines[0] || "");
    const row1 = String(headerLines[1] || "");

    const childTokens = tokenizeHeaderLine(row1, 1);

    const findChild = value =>
        childTokens.find(
            token =>
                normalizeHeader(token.text) ===
                normalizeHeader(value)
        ) || null;

    const openingQty = findChild("Qty");
    const qtyTokens = childTokens.filter(
        token => normalizeHeader(token.text) === "QTY"
    );
    const freeTokens = childTokens.filter(
        token => normalizeHeader(token.text) === "FREE"
    );
    const lastToken = findChild("Last");
    const stockToken = findChild("Stock");
    const valueToken = findChild("Value");
    const daysToken = findChild("Days");

    /*
     * Header positions are authoritative. The known IMPERIA header has:
     *   Product 0
     *   Packg 19
     *   Opening Qty 27
     *   Receipt Qty 33
     *   Receipt Free 38
     *   Sales Last 44
     *   Sales Qty 51
     *   Sales Free 56
     *   Adjmt Stock 62
     *   Closing Qty 69
     *   Closing Free 74
     *   Closing Value 80
     *   Age Days 86
     *
     * Fallbacks are used only if a visual label is missing from the
     * header row; they do not affect any other structure.
     */
    const qty1 = qtyTokens[0];
    const qty2 = qtyTokens[1];
    const qty3 = qtyTokens[2];
    const free1 = freeTokens[0];
    const free2 = freeTokens[1];
    const free3 = freeTokens[2];

    const starts = [
        0,
        19,
        qty1 ? qty1.start : 27,
        qty2 ? qty2.start : 33,
        free1 ? free1.start : 38,
        lastToken ? lastToken.start : 44,
        qty3 ? qty3.start : 51,
        free2 ? free2.start : 56,
        stockToken ? stockToken.start : 62,
        69,
        free3 ? free3.start : 74,
        valueToken ? valueToken.start : 80,
        daysToken ? daysToken.start : 86
    ];

    /*
     * Header token positions occasionally have a one-character visual
     * shift. Preserve the observed fixed-width geometry when the
     * detected starts are missing or out of order.
     */
    const fallback = [
        0, 19, 27, 33, 38, 44, 51,
        56, 62, 67, 69, 74, 80, 86
    ];

    for (let i = 0; i < starts.length; i++) {
        if (
            !Number.isFinite(starts[i]) ||
            (i > 0 && starts[i] <= starts[i - 1])
        ) {
            starts[i] = fallback[i];
        }
    }

    const definitions = [
        { header: "Product Name", commonField: "product", parent: null, child: null, row: 0 },
        { header: "Packg", commonField: "pack", parent: null, child: null, row: 0 },
        { header: "Opening Qty", commonField: "opening", parent: "Opening", child: "Qty", row: 1 },
        { header: "Receipt Qty", commonField: "purchase", parent: "Receipt", child: "Qty", row: 1 },
        { header: "Receipt Free", commonField: "purchaseFree", parent: "Receipt", child: "Free", row: 1 },
        { header: "Sales Last", commonField: "salesLast", parent: "Sales", child: "Last", row: 1 },
        { header: "Sales Qty", commonField: "sales", parent: "Sales", child: "Qty", row: 1 },
        { header: "Sales Free", commonField: "salesFree", parent: "Sales", child: "Free", row: 1 },
        { header: "Adjmt Stock", commonField: null, parent: "Adjmt", child: "Stock", row: 1 },
        { header: "Closing Qty", commonField: "closing", parent: "Closing", child: "Qty", row: 1 },
        { header: "Closing Free", commonField: "closingFree", parent: "Closing", child: "Free", row: 1 },
        { header: "Closing Value", commonField: "closingValue", parent: "Closing", child: "Value", row: 1 },
        { header: "Age Days", commonField: "age", parent: "Age", child: "Days", row: 1 }
    ];

    const columns = definitions.map((definition, index) => {
        const end = starts[index + 1] != null
            ? starts[index + 1]
            : null;

        return makePhysicalColumn(
            definition.header,
            definition.commonField,
            starts[index],
            end,
            {
                parentHeader: definition.parent,
                childHeader: definition.child,
                headerRow: definition.row,
                source: definition.commonField
                    ? "IMPERIA_PHYSICAL_POSITION"
                    : "IMPERIA_UNIDENTIFIED"
            }
        );
    });

    /*
     * Product and Packg are leaf columns. Their physical ends are the
     * next known operational boundary. The final Age column extends to
     * the source row length.
     */
    columns[0].physicalEnd = starts[1];
    columns[0].end = starts[1];
    columns[1].physicalEnd = starts[2];
    columns[1].end = starts[2];
    columns[columns.length - 1].physicalEnd = null;
    columns[columns.length - 1].end = null;

    const unidentified = columns.filter(
        column => !column.commonField
    );

    return {
        success: columns.length > 0,
        columns,
        unidentified,
        diagnostics: {
            headerRows: headerLines.length,
            structure: "IMPERIA_SALES_STATEMENT_FIXED_WIDTH",
            row0Length: row0.length,
            row1Length: row1.length,
            childTokenCount: childTokens.length,
            columnCount: columns.length,
            rule:
                "Physical header positions are authoritative; Receipt Free maps to purchaseFree and Sales Free maps to salesFree."
        }
    };
}

function mapDetectedHeader(
    detectionResult
) {

    if (
        !detectionResult ||
        !detectionResult.success
    ) {
        return {
            success: false,
            columns: [],
            unidentified: [],
            diagnostics: {
                message:
                    "A successful multi-row detector result is required."
            }
        };
    }

    return buildPhysicalColumns(
        detectionResult.headerLines
    );
}

/* ============================================================
 * STEP 1 LOADER
 * ============================================================
 */

function loadDetector() {

    const detectorPath =
        path.join(
            __dirname,
            "multiRowHeaderDetectorTXT.js"
        );

    if (
        !fs.existsSync(
            detectorPath
        )
    ) {
        throw new Error(
            `Step 1 detector not found: ${detectorPath}`
        );
    }

    const detector =
        require(
            detectorPath
        );

    if (
        !detector ||
        typeof detector.detectMultiRowTXTHeader !==
            "function"
    ) {
        throw new Error(
            "Step 1 detector API mismatch. Expected detectMultiRowTXTHeader export."
        );
    }

    return detector;
}

/* ============================================================
 * CLI
 * ============================================================
 */

function runCLI(filePath) {

    const detector =
        loadDetector();

    const detection =
        detector.detectMultiRowTXTHeader(
            filePath
        );

    if (
        !detection ||
        !detection.success
    ) {
        console.log(
            "MULTI-ROW HEADER NOT DETECTED"
        );

        console.dir(
            detection,
            { depth: null }
        );

        return;
    }

    const mapping =
        mapDetectedHeader(
            detection
        );

    console.log(
        "\n============================================================"
    );

    console.log(
        "       MULTI-ROW TXT PHYSICAL POSITION MAPPER"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `Header Start : ${detection.headerStart + 1}`
    );

    console.log(
        `Header End   : ${detection.headerEnd + 1}`
    );

    console.log(
        `Data Starts  : ${detection.dataStartsAt + 1}`
    );

    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        "PHYSICAL COLUMNS:"
    );

    console.table(
        mapping.columns.map(
            column => ({
                start:
                    column.physicalStart,
                end:
                    column.physicalEnd,
                header:
                    column.header,
                parent:
                    column.parentHeader,
                child:
                    column.childHeader,
                commonField:
                    column.commonField,
                source:
                    column.source
            })
        )
    );

    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        "UNIDENTIFIED:"
    );

    console.dir(
        mapping.unidentified,
        { depth: null }
    );

    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        "MAPPER DIAGNOSTICS:"
    );

    console.dir(
        mapping.diagnostics,
        { depth: null }
    );

    console.log(
        "============================================================"
    );
}

/* ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    buildPhysicalColumns,
    mapDetectedHeader,
    tokenizeHeaderLine,
    normalizeHeader,
    compactHeader,
    resolveDirectAlias,
    resolveChildCommon,
    assignChildToGroup,
    physicalRunOverlapsColumn,
    buildGroupTokens,
    isChellasHeader,
    buildChellasPhysicalColumns,
    isJyotiMedicalHallHeader,
    buildJyotiMedicalHallPhysicalColumns,
    isDermascienceHeader,
    buildDermasciencePhysicalColumns,
    isImperiaStyleHeader,
    buildImperiaPhysicalColumns,
    isCodeNameStockStructure,
    buildCodeNameStockPhysicalColumns,
    isSriVasaviMedicalDistributorsHeader,
    buildSriVasaviMedicalDistributorsPhysicalColumns,
    isSiddarthaMedicalSurgicalAgenciesHeader,
    buildSiddarthaMedicalSurgicalAgenciesPhysicalColumns
};

/* ============================================================
 * DIRECT EXECUTION
 * ============================================================
 */

if (require.main === module) {

    const input =
        process.argv[2];

    if (!input) {
        console.error("Usage:");
        console.error(
            'node validation/multiRow/multiRowHeaderMapperTXT.js "path\\to\\statement.txt"'
        );
        process.exit(1);
    }

    try {
        runCLI(
            path.resolve(input)
        );
    }
    catch (error) {
        console.error("\nERROR:");
        console.error(
            error &&
            error.stack
                ? error.stack
                : error
        );
        process.exit(1);
    }
}
