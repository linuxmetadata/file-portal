/**
 * ======================================================
 * TXT EXTRACTOR
 * ======================================================
 *
 * Extract product records from TXT statements.
 *
 * Flow:
 *
 * TXT Reader
 *      ↓
 * TXT Header Detector
 *      ↓
 * TXT Header Mapper
 *      ↓
 * TXT Extractor
 *
 * One extractor for TXT files.
 *
 * The detected format determines how the mapped
 * positions are interpreted.
 *
 * ======================================================
 */


//======================================================
// NUMBER
//======================================================

function toNumber(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return 0;

    }

    const text =
        String(value)
            .replace(/,/g, "")
            .trim();

    if (
        !text ||
        text === "-" ||
        text === "---"
    ) {

        return 0;

    }

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : 0;

}


//======================================================
// POSITION FROM MAPPING
//======================================================

function getMappedPosition(
    mapping,
    field
) {

    if (!mapping || !field) {
        return null;
    }

    const direct =
        mapping[field];

    if (
        direct &&
        typeof direct === "object" &&
        direct.position !== undefined
    ) {

        return Number(direct.position);

    }

    if (
        mapping.fields &&
        mapping.fields[field] &&
        mapping.fields[field].position !== undefined
    ) {

        return Number(
            mapping.fields[field].position
        );

    }

    if (
        mapping.positions &&
        mapping.positions[field] !== undefined
    ) {

        return Number(
            mapping.positions[field]
        );

    }

    return null;

}


//======================================================
// NUMERIC TOKENS
//======================================================

function getNumericTokens(line) {

    const tokens = [];

    const regex =
        /(^|\s)(-?\d+(?:,\d{3})*(?:\.\d+)?|---|-)(?=\s|$)/g;

    let match;

    while (
        (match = regex.exec(line))
    ) {

        const leading =
            match[1] || "";

        tokens.push({
            value:
                match[2],

            start:
                match.index + leading.length,

            end:
                match.index +
                match[0].length
        });

    }

    return tokens;

}


//======================================================
// PRODUCT / PACK FROM PREFIX
//======================================================

function splitProductAndPack(prefix) {

    const parts =
        String(prefix || "")
            .trim()
            .split(/\s{2,}/)
            .map(value => value.trim())
            .filter(Boolean);

    if (parts.length >= 2) {

        return {

            product:
                parts.slice(0, -1).join(" "),

            pack:
                parts[parts.length - 1]

        };

    }

    return {

        product:
            String(prefix || "").trim(),

        pack:
            ""

    };

}


//======================================================
// BASE RECORD
//======================================================

function createRecord(
    rowNumber,
    product,
    pack = "",
    productCode = null
) {

    return {

        rowNumber,

        product,

        productDescription:
            product,

        productCode,

        pack,

        opening:
            0,

        purchase:
            0,

        purchaseFree:
            0,

        purchaseReturn:
            0,

        purchaseValue:
            0,

        sales:
            0,

        salesReturn:
            0,

        free:
            0,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue:
            0,

        closing:
            0,

        closingValue:
            0,

        rate:
            0

    };

}


//======================================================
// PRODUCT WISE SALES
//======================================================

function extractProductWiseSales(
    lines,
    dataStart
) {

    const records = [];

    let current = null;

    function pushCurrent() {

        if (
            current &&
            (
                current.sales !== 0 ||
                current.salesValue !== 0
            )
        ) {

            records.push(current);

        }

    }

    for (
        let i = dataStart;
        i < lines.length;
        i++
    ) {

        const line =
            String(lines[i] || "");

        const text =
            line.trim();

        if (
            !text ||
            isSeparator(line) ||
            /^[-=\u00C4\s]+$/.test(text)
        ) {

            continue;

        }

        const isTransaction =
            /^\d{2}-\d{2}-\d{4}\s+|\s+[A-Z]{2,}\d{4,}\s+/.test(text);

        if (!isTransaction) {

            pushCurrent();

            current =
                createRecord(
                    i + 1,
                    text
                );

            continue;

        }

        if (!current) {
            continue;
        }

        const values =
            getNumericTokens(line)
                .map(
                    token =>
                        toNumber(token.value)
                );

        if (values.length < 3) {
            continue;
        }

        const qty =
            values[0] || 0;

        const amount =
            values.length >= 4
                ? values[values.length - 2]
                : values[values.length - 1];

        current.sales +=
            qty;

        current.salesValue +=
            amount || 0;

    }

    pushCurrent();

    return records;

}


//======================================================
// SPACED ROW FALLBACK
//======================================================

function extractSpacedRow(
    line,
    mapping,
    rowNumber
) {

    const numericTokens =
        getNumericTokens(line);

    if (
        numericTokens.length < 3
    ) {

        return null;

    }

    const firstNumeric =
        numericTokens[0];

    const prefix =
        line.substring(
            0,
            firstNumeric.start
        );

    const productPack =
        splitProductAndPack(prefix);

    if (
        !isValidProductRow(
            line,
            productPack.product,
            mapping
        )
    ) {

        return null;

    }

    /*
     * Common TXT format:
     *
     * Product Packing OP Receipt Qty Receipt Value
     * Sales Qty Sales Value Closing Qty Closing Value
     */

    const values =
        numericTokens.map(
            token =>
                toNumber(token.value)
        );

    const record = {

        rowNumber,

        product:
            productPack.product,

        productDescription:
            productPack.product,

        productCode:
            null,

        pack:
            productPack.pack,

        opening:
            0,

        purchase:
            0,

        purchaseFree:
            0,

        purchaseReturn:
            0,

        purchaseValue:
            0,

        sales:
            0,

        salesReturn:
            0,

        free:
            0,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue:
            0,

        closing:
            0,

        closingValue:
            0,

        rate:
            0,

        age:
            0

    };

    if (values.length >= 7) {

        record.opening =
            values[0];

        record.purchase =
            values[1];

        record.purchaseValue =
            values[2];

        record.sales =
            values[3];

        record.salesValue =
            values[4];

        record.closing =
            values[5];

        record.closingValue =
            values[6];

        return record;

    }

    if (values.length === 6) {

        record.opening =
            values[0];

        record.purchase =
            values[1];

        record.sales =
            values[2];

        record.salesReturn =
            values[3];

        record.adjustment =
            values[4];

        record.closing =
            values[5];

        return record;

    }

    return null;

}


//======================================================
// ITEM CODE ROW
//======================================================

function extractItemCodeRow(
    line,
    mapping,
    rowNumber
) {

    if (
        getMappedPosition(
            mapping,
            "productCode"
        ) === null
    ) {

        return null;

    }

    const numericTokens =
        getNumericTokens(line);

    if (
        numericTokens.length < 7 ||
        numericTokens[0].start > 2
    ) {

        return null;

    }

    const productCode =
        String(
            numericTokens[0].value
        ).trim();

    const valueTokens =
        numericTokens.slice(-6);

    const firstQuantity =
        valueTokens[0];

    const prefix =
        line.substring(
            numericTokens[0].end,
            firstQuantity.start
        );

    const productPack =
        splitProductAndPack(prefix);

    if (
        !productPack.product ||
        shouldStop(productPack.product)
    ) {

        return null;

    }

    const values =
        valueTokens
            .map(
                token =>
                    toNumber(token.value)
            );

    const record = {

        rowNumber,

        product:
            productPack.product,

        productDescription:
            productPack.product,

        productCode,

        pack:
            productPack.pack,

        opening:
            0,

        purchase:
            0,

        purchaseFree:
            0,

        purchaseReturn:
            0,

        purchaseValue:
            0,

        sales:
            0,

        salesReturn:
            0,

        free:
            0,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue:
            0,

        closing:
            0,

        closingValue:
            0,

        rate:
            0,

        lastMonth1:
            0,

        lastMonth2:
            0

    };

    record.closing =
        values[0] || 0;

    record.closingValue =
        values[1] || 0;

    record.sales =
        values[2] || 0;

    record.salesValue =
        values[3] || 0;

    record.lastMonth1 =
        values[4] || 0;

    record.lastMonth2 =
        values[5] || 0;

    return record;

}


//======================================================
// TAB STOCK ROW
//======================================================

function extractTabStockRow(
    line,
    rowNumber
) {

    if (
        !String(line || "").includes("\t")
    ) {

        return null;

    }

    const cells =
        String(line)
            .split("\t")
            .map(value => value.trim());

    if (
        cells.length < 24 ||
        !cells[1] ||
        !cells[2]
    ) {

        return null;

    }

    if (
        /^ITEM\s+CODE$/i.test(cells[1]) ||
        /^ITEM\s+NAME$/i.test(cells[2])
    ) {

        return null;

    }

    const record =
        createRecord(
            rowNumber,
            cells[2],
            cells[3],
            cells[1]
        );

    record.rate =
        toNumber(cells[4]);

    record.opening =
        toNumber(cells[6]);

    record.openingValue =
        toNumber(cells[7]);

    record.purchase =
        toNumber(cells[8]);

    record.purchaseFree =
        toNumber(cells[9]);

    record.replacement =
        toNumber(cells[10]);

    record.purchaseValue =
        toNumber(cells[11]);

    record.purchaseReturn =
        toNumber(cells[12]);

    record.sales =
        toNumber(cells[14]);

    record.free =
        toNumber(cells[15]);

    record.salesValue =
        toNumber(cells[16]);

    record.salesReturn =
        toNumber(cells[19]);

    record.closing =
        toNumber(cells[22]);

    record.closingValue =
        toNumber(cells[23]);

    return record;

}


//======================================================
// SALES / CLOSING / DAY ROW
//======================================================

function extractSalesClosingDayRow(
    line,
    mapping,
    rowNumber
) {

    const headerText =
        String(
            (
                mapping.headers || []
            ).join(" ")
        ).toUpperCase();

    if (
        !headerText.includes("SALES") ||
        !headerText.includes("CLOSING") ||
        !headerText.includes("DAY")
    ) {

        return null;

    }

    const tokens =
        String(line || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (tokens.length < 4) {
        return null;
    }

    const trailing = [];

    while (
        tokens.length &&
        /^-?\d+$|^-+$/.test(
            tokens[tokens.length - 1]
        ) &&
        trailing.length < 3
    ) {

        trailing.unshift(
            tokens.pop()
        );

    }

    if (trailing.length < 2) {
        return null;
    }

    const pack =
        tokens.pop() || "";

    const product =
        tokens.join(" ")
            .replace(/^\*/, "")
            .trim();

    if (
        !product ||
        shouldStop(product)
    ) {

        return null;

    }

    const record =
        createRecord(
            rowNumber,
            product,
            pack
        );

    if (trailing.length === 2) {

        record.sales =
            toNumber(trailing[0]);

        record.closing =
            toNumber(trailing[1]);

    }
    else {

        record.sales =
            toNumber(trailing[0]);

        record.closing =
            toNumber(trailing[1]);

        record.age =
            toNumber(trailing[2]);

    }

    return record;

}


//======================================================
// STOCK / AGE ROW
//======================================================

function extractStockAgeRow(
    line,
    mapping,
    rowNumber
) {

    const headerText =
        String(
            (
                mapping.headers || []
            ).join(" ")
        ).toUpperCase();

    if (
        !headerText.includes("QOH") ||
        !headerText.includes("AGE")
    ) {

        return null;

    }

    const numericTokens =
        getNumericTokens(line);

    if (
        numericTokens.length < 7
    ) {

        return null;

    }

    const valueTokens =
        numericTokens.slice(-7);

    const prefix =
        line.substring(
            0,
            valueTokens[0].start
        );

    const productPack =
        splitProductAndPack(prefix);

    if (
        !productPack.product ||
        shouldStop(productPack.product)
    ) {

        return null;

    }

    const values =
        valueTokens.map(
            token =>
                toNumber(token.value)
        );

    return {

        rowNumber,

        product:
            productPack.product,

        productDescription:
            productPack.product,

        productCode:
            null,

        pack:
            productPack.pack,

        opening:
            values[0] || 0,

        purchase:
            values[1] || 0,

        purchaseFree:
            0,

        purchaseReturn:
            0,

        purchaseValue:
            0,

        total:
            values[2] || 0,

        sales:
            values[3] || 0,

        salesReturn:
            0,

        free:
            0,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue:
            0,

        closing:
            values[4] || 0,

        closingValue:
            values[5] || 0,

        rate:
            0,

        age:
            values[6] || 0

    };

}


//======================================================
// GET POSITION VALUE
//======================================================

function getPositionValue(
    line,
    position,
    endPosition
) {

    if (
        !line ||
        position === null ||
        position === undefined
    ) {

        return "";

    }

    const start =
        Number(position);

    if (
        !Number.isFinite(start)
    ) {

        return "";

    }

    let end;

    if (
        endPosition !== null &&
        endPosition !== undefined
    ) {

        end =
            Number(endPosition);

    }
    else {

        end =
            line.length;

    }

    if (
        !Number.isFinite(end)
    ) {

        end =
            line.length;

    }

    return line
        .substring(
            start,
            end
        )
        .trim();

}


//======================================================
// GET FIXED WIDTH FIELD
//======================================================

function getField(
    line,
    start,
    nextStart
) {

    if (
        start === null ||
        start === undefined
    ) {

        return "";

    }

    return getPositionValue(
        line,
        start,
        nextStart
    );

}


//======================================================
// GET PRODUCT
//======================================================
//
// Current verified format:
//
// Product = positions 0 → 27
//
//======================================================

function getProduct(
    line,
    position,
    endPosition
) {

    const start =
        position === null ||
        position === undefined

            ? 0

            : Number(position);

    const end =
        endPosition !== null &&
        endPosition !== undefined

            ? Number(endPosition)

            : line.length;

    return getPositionValue(
        line,
        start,
        Number.isFinite(end)
            ? end
            : line.length
    );

}


//======================================================
// GET PACKING
//======================================================

function getPacking(
    line,
    position
) {

    return getField(
        line,
        position,
        41
    );

}


//======================================================
// STOP ROW
//======================================================

function shouldStop(
    product
) {

    const text =
        String(
            product || ""
        )
        .trim()
        .toUpperCase();

    if (!text) {

        return true;

    }

    const stopWords = [

        "TOTAL",
        "GRAND TOTAL",
        "SUB TOTAL",
        "SUBTOTAL",
        "SUMMARY",
        "PAGE",
        "PREPARED",
        "PREPARED BY",
        "AUTHORISED",
        "AUTHORIZED",
        "COMPUTER GENERATED",
        "OPENING VALUE",
        "PURCHASE VALUE",
        "SALE VALUE",
        "SALES VALUE",
        "CLOSING VALUE"

    ];

    return stopWords.some(
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
// SEPARATOR
//======================================================

function isSeparator(
    line
) {

    if (!line) {

        return true;

    }

    return /^[-=_\s]+$/.test(
        String(line)
    );

}


//======================================================
// PRODUCT VALIDATION
//======================================================

function isValidProductRow(
    line,
    product,
    mapping
) {

    if (
        !line ||
        !product
    ) {

        return false;

    }

    //--------------------------------------------------
    // Footer
    //--------------------------------------------------

    if (
        shouldStop(product)
    ) {

        return false;

    }

    //--------------------------------------------------
    // Separator
    //--------------------------------------------------

    if (
        isSeparator(product)
    ) {

        return false;

    }

    //--------------------------------------------------
    // Minimum product length
    //--------------------------------------------------

    if (
        product.length < 2
    ) {

        return false;

    }

    //--------------------------------------------------
    // Check numeric section
    //--------------------------------------------------

    const positions =
        mapping.positions || {};

    const numericStart =
        getMappedPosition(mapping, "opening") !== null &&
        getMappedPosition(mapping, "opening") !== undefined

            ? Number(
                getMappedPosition(mapping, "opening")
            )

            : 0;

    const numericPart =
        line.substring(
            numericStart
        );

    /*
     * Current fixed-width format contains numeric
     * fields after the opening position.
     */

    const numericValues =
        numericPart.match(
            /-?\d+(?:,\d{3})*(?:\.\d+)?/g
        );

    if (
        !numericValues ||
        numericValues.length < 3
    ) {

        return false;

    }

    return true;

}


//======================================================
// CODE_NAME_STOCK - DATA COLUMN EXTRACTION
//======================================================
//
// Uses physical DATA boundaries when they are available.
// This is intentionally isolated to CODE_NAME_STOCK so
// existing TXT extraction formats are not disturbed.
//
//======================================================

function calibrateCodeNameStockColumns(
    mapping,
    sampleLine
) {

    /*
     * CODE_NAME_STOCK ONLY
     *
     * The mapper/analyzer may expose physical boundaries using
     * different property names depending on the stage that produced
     * the mapping. We normalize those boundaries here.
     *
     * IMPORTANT:
     * - Existing valid dataStart/dataEnd values are preserved.
     * - Calibration is used only to fill missing/invalid boundaries.
     * - Other TXT structures never call this function.
     */

    if (
        !mapping ||
        mapping.format !== "CODE_NAME_STOCK" ||
        !Array.isArray(mapping.columns) ||
        !sampleLine
    ) {

        return false;

    }

    const line = String(sampleLine);

    const getColumn = field =>
        mapping.columns.find(
            column =>
                column &&
                column.field === field
        ) || null;

    const getExistingStart = column => {

        if (!column) {
            return NaN;
        }

        const candidates = [
            column.dataStart,
            column.start,
            column.position
        ];

        for (const value of candidates) {

            const number = Number(value);

            if (Number.isFinite(number)) {
                return number;
            }

        }

        return NaN;

    };

    const getExistingEnd = column => {

        if (!column) {
            return NaN;
        }

        const candidates = [
            column.dataEnd,
            column.end
        ];

        for (const value of candidates) {

            const number = Number(value);

            if (Number.isFinite(number)) {
                return number;
            }

        }

        const start =
            getExistingStart(column);

        const width =
            Number(
                column.dataWidth ??
                column.width
            );

        if (
            Number.isFinite(start) &&
            Number.isFinite(width) &&
            width > 0
        ) {

            return start + width;

        }

        return NaN;

    };

    /*
     * Physical DATA order for this structure.
     */

    const orderedFields = [

        "rate",
        "opening",
        "purchase",
        "purchaseFree",
        "purchaseReturn",
        "sales",
        "salesFree",
        "salesValue",
        "salesReturn",
        "excess",
        "short",
        "closing",
        "closingFree",
        "closingValue"

    ];

    /*
     * First try to preserve all valid boundaries already supplied
     * by the mapper/analyzer.
     */

    const hasCompletePhysicalMap =
        orderedFields.every(
            field => {

                const column =
                    getColumn(field);

                const start =
                    getExistingStart(column);

                const end =
                    getExistingEnd(column);

                return (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    end > start
                );

            }
        );

    const productColumn =
        getColumn("product");

    const existingProductStart =
        getExistingStart(productColumn);

    const existingProductEnd =
        getExistingEnd(productColumn);

    /*
     * If the complete physical map already exists, normalize aliases
     * but DO NOT recalibrate it from arbitrary numeric tokens.
     *
     * This prevents product names containing numbers from disturbing
     * an already-correct map.
     */

    if (hasCompletePhysicalMap) {

        if (productColumn) {

            if (
                !Number.isFinite(
                    existingProductStart
                )
            ) {

                productColumn.dataStart = 0;

            }
            else {

                productColumn.dataStart =
                    existingProductStart;

            }

            if (
                !Number.isFinite(
                    existingProductEnd
                )
            ) {

                return false;

            }
            else {

                productColumn.dataEnd =
                    existingProductEnd;

            }

            productColumn.dataWidth =
                Math.max(
                    0,
                    productColumn.dataEnd -
                    productColumn.dataStart
                );

        }

        for (const field of orderedFields) {

            const column =
                getColumn(field);

            if (!column) {
                continue;
            }

            const start =
                getExistingStart(column);

            const end =
                getExistingEnd(column);

            column.dataStart = start;

            column.dataEnd = end;

            column.dataWidth =
                Math.max(
                    0,
                    end - start
                );

        }

        mapping._codeNameStockCalibrated =
            true;

        return true;

    }

    /*
     * We do not have a complete physical map.
     *
     * Find the first numeric token AFTER the mapped product area.
     * This is critical for product names such as:
     *
     *     ACNESTAL FACE WASH 60 ML
     *
     * The 60 and ML must remain part of the product and must never
     * become the rate.
     */

    let numericStart = NaN;

    if (
        Number.isFinite(
            existingProductEnd
        )
    ) {

        numericStart =
            existingProductEnd;

    }
    else {

        const rateColumn =
            getColumn("rate");

        const rateStart =
            getExistingStart(rateColumn);

        if (Number.isFinite(rateStart)) {
            numericStart = rateStart;
        }

    }

    if (
        !Number.isFinite(numericStart) ||
        numericStart < 0
    ) {

        numericStart = 0;

    }

    const numericLine =
        line.substring(
            numericStart
        );

    const numberRegex =
        /[-+]?\d+(?:,\d{3})*(?:\.\d+)?/g;

    const numericTokens = [];

    let match;

    while (
        (match = numberRegex.exec(numericLine)) !== null
    ) {

        numericTokens.push({

            text:
                match[0],

            start:
                numericStart +
                match.index,

            end:
                numericStart +
                match.index +
                match[0].length

        });

    }

    if (
        numericTokens.length <
        orderedFields.length
    ) {

        return false;

    }

    /*
     * Product physical boundary.
     *
     * If the mapper did not supply it, the first numeric token after
     * the product area is the rate boundary.
     */

    if (productColumn) {

        const productStart =
            Number.isFinite(
                existingProductStart
            )

                ? existingProductStart
                : 0;

        const productEnd =
            Number.isFinite(
                existingProductEnd
            )

                ? existingProductEnd
                : numericTokens[0].start;

        productColumn.dataStart =
            productStart;

        productColumn.dataEnd =
            productEnd;

        productColumn.dataWidth =
            Math.max(
                0,
                productEnd -
                productStart
            );

    }

    /*
     * Fill missing/invalid physical boundaries from the numeric
     * sequence. Existing valid boundaries are retained.
     */

    for (
        let index = 0;
        index < orderedFields.length;
        index++
    ) {

        const field =
            orderedFields[index];

        const token =
            numericTokens[index];

        const column =
            getColumn(field);

        if (
            !column ||
            !token
        ) {

            continue;

        }

        const currentStart =
            getExistingStart(column);

        const currentEnd =
            getExistingEnd(column);

        if (
            Number.isFinite(currentStart) &&
            Number.isFinite(currentEnd) &&
            currentEnd > currentStart
        ) {

            column.dataStart =
                currentStart;

            column.dataEnd =
                currentEnd;

        }
        else {

            column.dataStart =
                token.start;

            column.dataEnd =
                token.end;

        }

        column.dataWidth =
            Math.max(
                0,
                column.dataEnd -
                column.dataStart
            );

    }

    /*
     * Mark calibration only when the essential fields now have
     * usable physical boundaries.
     */

    const calibrated =
        [
            "product",
            "rate",
            "opening",
            "purchase",
            "sales",
            "closing",
            "closingValue"
        ].every(
            field => {

                const column =
                    getColumn(field);

                const start =
                    getExistingStart(column);

                const end =
                    getExistingEnd(column);

                return (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    end > start
                );

            }
        );

    mapping._codeNameStockCalibrated =
        calibrated;

    return calibrated;

}


function extractCodeNameStockRow(
    line,
    mapping,
    rowNumber
) {

    if (
        !line ||
        !mapping ||
        mapping.format !== "CODE_NAME_STOCK"
    ) {

        return null;

    }

    /*
     * --------------------------------------------------
     * STRUCTURE-BASED EXTRACTION
     * --------------------------------------------------
     *
     * CODE_NAME_STOCK is extracted ONLY from physical mapped
     * DATA boundaries.
     *
     * No numeric-token order is used to assign stock values.
     * This prevents numbers inside product names such as
     * "60 ML" from shifting the columns.
     */

    const columns =
        Array.isArray(mapping.columns)
            ? mapping.columns
            : [];

    function getColumn(field) {

        return (
            columns.find(
                column =>
                    column &&
                    column.field === field
            ) ||
            null
        );

    }

    function getColumnBounds(column) {

        if (!column) {
            return null;
        }

        let start =
            Number(column.dataStart);

        let end =
            Number(column.dataEnd);

        /*
         * Support older mapper property names.
         */

        if (!Number.isFinite(start)) {
            start = Number(column.start);
        }

        if (!Number.isFinite(end)) {
            end = Number(column.end);
        }

        if (!Number.isFinite(end)) {

            const width =
                Number(
                    column.dataWidth ??
                    column.width
                );

            if (
                Number.isFinite(start) &&
                Number.isFinite(width) &&
                width > 0
            ) {

                end = start + width;

            }

        }

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {

            return null;

        }

        return {
            start,
            end
        };

    }

    function getColumnValue(field) {

        const bounds =
            getColumnBounds(
                getColumn(field)
            );

        if (!bounds) {
            return "";
        }

        return String(
            line.substring(
                bounds.start,
                bounds.end
            )
        ).trim();

    }

    function getColumnNumber(field) {

        return toNumber(
            getColumnValue(field)
        );

    }

    /*
     * --------------------------------------------------
     * REQUIRED STRUCTURE
     * --------------------------------------------------
     */

    const requiredFields = [
        "product",
        "rate",
        "opening",
        "purchase",
        "sales",
        "closing"
    ];

    const hasRequiredStructure =
        requiredFields.every(
            field =>
                Boolean(
                    getColumnBounds(
                        getColumn(field)
                    )
                )
        );

    if (!hasRequiredStructure) {
        return null;
    }

    /*
     * --------------------------------------------------
     * PRODUCT
     * --------------------------------------------------
     */

    const product =
        getColumnValue("product");

    if (
        !product ||
        shouldStop(product)
    ) {

        return null;

    }

    /*
     * --------------------------------------------------
     * RATE VALIDATION
     * --------------------------------------------------
     *
     * CODE_NAME_STOCK data rows must contain a valid
     * numeric rate.
     *
     * This prevents company/group headings such as
     * "LINUX LABORATORIES PVT LTD" from being extracted
     * as product records when their mapped product area
     * happens to contain text such as "LABORATORIES".
     */

    const rateText =
        getColumnValue("rate");

    if (
        !rateText ||
        !/^[-+]?\d+(?:,\d{3})*(?:\.\d+)?$/.test(
            rateText
        )
    ) {

        return null;

    }

    /*
     * --------------------------------------------------
     * PHYSICAL NUMERIC FIELDS
     * --------------------------------------------------
     */

    const rate =
        getColumnNumber("rate");

    const opening =
        getColumnNumber("opening");

    const purchase =
        getColumnNumber("purchase");

    const purchaseFree =
        getColumnNumber("purchaseFree");

    const purchaseReturn =
        getColumnNumber("purchaseReturn");

    const sales =
        getColumnNumber("sales");

    const salesFree =
        getColumnNumber("salesFree");

    const salesValue =
        getColumnNumber("salesValue");

    const salesReturn =
        getColumnNumber("salesReturn");

    const excess =
        getColumnNumber("excess");

    const short =
        getColumnNumber("short");

    const closing =
        getColumnNumber("closing");

    const closingFree =
        getColumnNumber("closingFree");

    const closingValue =
        getColumnNumber("closingValue");

    /*
     * --------------------------------------------------
     * RESULT
     * --------------------------------------------------
     */

    return {

        rowNumber,

        product,

        productDescription:
            product,

        productCode:
            null,

        pack:
            "",

        opening,

        purchase,

        purchaseFree,

        purchaseReturn,

        purchaseValue:
            0,

        sales,

        salesReturn,

        free:
            salesFree,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue,

        closing,

        closingValue,

        rate,

        excess,

        short,

        closingFree

    };

}


function extractFixedWidthRow(
    line,
    mapping,
    rowNumber
) {

    if (
        !line ||
        !mapping
    ) {

        return null;

    }

    const positions =
        mapping.positions || {};

    const getPosition =
        field => {

            const mapped =
                getMappedPosition(
                    mapping,
                    field
                );

            if (
                mapped !== null &&
                Number.isFinite(mapped)
            ) {

                return mapped;

            }

            return positions[field];

        };

    const requiredPositions = [
        "product",
        "opening",
        "purchase",
        "sales",
        "closing"
    ];

    const hasRequiredPositions =
        requiredPositions.every(
            field => {

                const position =
                    getPosition(field);

                return (
                    position !== null &&
                    position !== undefined &&
                    Number.isFinite(Number(position))
                );

            }
        );

    if (!hasRequiredPositions) {
        return null;
    }

    //--------------------------------------------------
    // PRODUCT
    //--------------------------------------------------

    const productPosition =
        getPosition("product");

    const packPosition =
        getPosition("pack") ??
        getPosition("packing");

    const openingPosition =
        getPosition("opening");

    const product =
        getProduct(
            line,
            productPosition,
            packPosition ??
                openingPosition
        );

    //--------------------------------------------------
    // VALIDATE
    //--------------------------------------------------

    if (
        !isValidProductRow(
            line,
            product,
            mapping
        )
    ) {

        return null;

    }

    //--------------------------------------------------
    // PACKING
    //--------------------------------------------------

    const pack =
        getField(
            line,
            packPosition,
            openingPosition
        );

    //--------------------------------------------------
    // OPENING
    //--------------------------------------------------

    const opening =
        toNumber(
            getField(
                line,
                getPosition("opening"),
                getPosition("purchase")
            )
        );

    //--------------------------------------------------
    // PURCHASE
    //--------------------------------------------------

    const purchase =
        toNumber(
            getField(
                line,
                getPosition("purchase"),
                getPosition("purchaseValue")
            )
        );

    //--------------------------------------------------
    // PURCHASE VALUE
    //--------------------------------------------------

    const purchaseValue =
        toNumber(
            getField(
                line,
                getPosition("purchaseValue"),
                getPosition("sales")
            )
        );

    //--------------------------------------------------
    // SALES
    //--------------------------------------------------

    const sales =
        toNumber(
            getField(
                line,
                getPosition("sales"),
                getPosition("salesValue")
            )
        );

    //--------------------------------------------------
    // SALES VALUE
    //--------------------------------------------------

    const salesValue =
        toNumber(
            getField(
                line,
                getPosition("salesValue"),
                getPosition("closing")
            )
        );

    //--------------------------------------------------
    // CLOSING
    //--------------------------------------------------

    const closing =
        toNumber(
            getField(
                line,
                getPosition("closing"),
                getPosition("closingValue")
            )
        );

    //--------------------------------------------------
    // CLOSING VALUE
    //--------------------------------------------------

    const closingValue =
        toNumber(
            getField(
                line,
                getPosition("closingValue"),
                line.length
            )
        );

    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    return {

        rowNumber,

        product,

        productDescription:
            product,

        productCode:
            null,

        pack,

        opening,

        purchase,

        purchaseFree:
            0,

        purchaseReturn:
            0,

        purchaseValue,

        sales,

        salesReturn:
            0,

        free:
            0,

        replacement:
            0,

        branch:
            0,

        credit:
            0,

        debit:
            0,

        adjustment:
            0,

        salesValue,

        closing,

        closingValue,

        rate:
            0

    };

}


//======================================================
// CODE_NAME_STOCK - STRUCTURE-BASED ROW EXTRACTION
//
// Uses mapper/analyzer physical column boundaries directly.
// This path is intentionally isolated from all other TXT
// structures.
//======================================================

function extractCodeNameStockByStructure(
    line,
    mapping,
    rowNumber
) {

    if (!line || !mapping) {
        return null;
    }

    const columns =
        Array.isArray(mapping.columns)
            ? mapping.columns
            : [];

    if (!columns.length) {
        return null;
    }

    const columnMap = {};

    for (const column of columns) {

        if (
            !column ||
            !column.field
        ) {

            continue;

        }

        const start =
            Number(
                column.dataStart ??
                column.start
            );

        const end =
            Number(
                column.dataEnd ??
                column.end
            );

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {

            continue;

        }

        columnMap[column.field] = {
            start,
            end
        };

    }

    const readField = field => {

        const column =
            columnMap[field];

        if (!column) {
            return "";
        }

        return String(
            line.substring(
                column.start,
                Math.min(
                    column.end,
                    line.length
                )
            )
        ).trim();

    };

    const product =
        readField("product");

    if (!product) {
        return null;
    }

    /*
     * CODE_NAME_STOCK data rows must contain a valid
     * numeric rate.
     *
     * This prevents company/group headings such as
     * "LINUX LABORATORIES PVT LTD" from becoming records.
     */

    const rateText =
        readField("rate");

    if (
        !rateText ||
        !/^[-+]?\d+(?:,\d{3})*(?:\.\d+)?$/.test(
            rateText
        )
    ) {

        return null;

    }

    const value = field => {

        const raw =
            readField(field);

        if (!raw) {
            return 0;
        }

        const cleaned =
            String(raw)
                .replace(/,/g, "")
                .trim();

        const n =
            Number(cleaned);

        return Number.isFinite(n)
            ? n
            : 0;

    };

    return {

        rowNumber,

        product,

        productDescription:
            product,

        productCode:
            readField("productCode") || null,

        pack:
            readField("pack"),

        opening:
            value("opening"),

        purchase:
            value("purchase"),

        purchaseFree:
            value("purchaseFree"),

        purchaseReturn:
            value("purchaseReturn"),

        purchaseValue:
            value("purchaseValue"),

        sales:
            value("sales"),

        salesReturn:
            value("salesReturn"),

        free:
            value("free"),

        replacement:
            value("replacement"),

        branch:
            value("branch"),

        credit:
            value("credit"),

        debit:
            value("debit"),

        adjustment:
            value("adjustment"),

        salesValue:
            value("salesValue"),

        closing:
            value("closing"),

        closingValue:
            value("closingValue"),

        rate:
            value("rate"),

        excess:
            value("excess"),

        short:
            value("short"),

        closingFree:
            value("closingFree")

    };

}


//======================================================
// MAIN TXT EXTRACTOR
//======================================================

function extractTXT(
    lines,
    detection,
    mapping
) {

    //--------------------------------------------------
    // SAFETY
    //--------------------------------------------------

    if (
        !Array.isArray(lines)
    ) {

        return {

            success: false,

            totalRecords: 0,

            records: [],

            message:
                "TXT lines must be an array."

        };

    }

    if (
        !mapping
    ) {

        return {

            success: false,

            totalRecords: 0,

            records: [],

            message:
                "TXT mapping is required."

        };

    }

    //--------------------------------------------------
    // DATA START
    //--------------------------------------------------

    let dataStart = 0;

    if (
        detection &&
        (
            detection.dataStartsAt !==
            undefined &&
            detection.dataStartsAt !==
            null
        )
    ) {

        /*
         * Detector reports human-readable line number.
         *
         * Example:
         *
         * Data Starts At: 12
         *
         * Array index:
         *
         * 12 - 1 = 11
         */

        dataStart =
            Number(
                detection.dataStartsAt
            ) - 1;

    }

    else if (
        detection &&
        detection.dataStarts !==
            undefined &&
        detection.dataStarts !==
            null
    ) {

        dataStart =
            Number(
                detection.dataStarts
            ) - 1;

    }

    else if (
        detection &&
        detection.dataStart !==
            undefined &&
        detection.dataStart !==
            null
    ) {

        dataStart =
            Number(
                detection.dataStart
            ) - 1;

    }

    if (
        !Number.isFinite(
            dataStart
        )
    ) {

        dataStart = 0;

    }

    //--------------------------------------------------
    // CLAMP
    //--------------------------------------------------

    dataStart =
        Math.max(
            0,
            Math.min(
                dataStart,
                lines.length
            )
        );

    //--------------------------------------------------
    // CODE_NAME_STOCK DATA COLUMN CALIBRATION
    //--------------------------------------------------

    if (
        mapping.format ===
        "CODE_NAME_STOCK"
    ) {

        let sampleLine = "";

        const productColumn =
            Array.isArray(mapping.columns)
                ? mapping.columns.find(
                    column =>
                        column &&
                        column.field === "product"
                )
                : null;

        const rateColumn =
            Array.isArray(mapping.columns)
                ? mapping.columns.find(
                    column =>
                        column &&
                        column.field === "rate"
                )
                : null;

        let productEnd =
            productColumn
                ? Number(
                    productColumn.dataEnd
                )
                : NaN;

        if (
            !Number.isFinite(productEnd) &&
            productColumn
        ) {

            productEnd =
                Number(
                    productColumn.end
                );

        }

        let rateStart =
            rateColumn
                ? Number(
                    rateColumn.dataStart
                )
                : NaN;

        if (
            !Number.isFinite(rateStart) &&
            rateColumn
        ) {

            rateStart =
                Number(
                    rateColumn.start
                );

        }

        const numericPattern =
            /[-+]?\d+(?:,\d{3})*(?:\.\d+)?/;

        for (
            let sampleIndex = dataStart;
            sampleIndex < lines.length;
            sampleIndex++
        ) {

            const candidate =
                String(
                    lines[sampleIndex] || ""
                );

            if (
                !candidate.trim() ||
                isSeparator(candidate)
            ) {

                continue;

            }

            let numericAreaStart =
                Number.isFinite(rateStart)
                    ? rateStart
                    : NaN;

            if (
                !Number.isFinite(
                    numericAreaStart
                ) &&
                Number.isFinite(
                    productEnd
                )
            ) {

                numericAreaStart =
                    productEnd;

            }

            if (
                !Number.isFinite(
                    numericAreaStart
                )
            ) {

                numericAreaStart = 0;

            }

            if (
                numericAreaStart < 0 ||
                numericAreaStart >= candidate.length
            ) {

                continue;

            }

            if (
                !numericPattern.test(
                    candidate.substring(
                        numericAreaStart
                    )
                )
            ) {

                continue;

            }

            const numericValues =
                candidate
                    .substring(
                        numericAreaStart
                    )
                    .match(
                        /[-+]?\d+(?:,\d{3})*(?:\.\d+)?/g
                    );

            if (
                !numericValues ||
                numericValues.length < 14
            ) {

                continue;

            }

            sampleLine =
                candidate;

            break;

        }

        if (sampleLine) {

            calibrateCodeNameStockColumns(
                mapping,
                sampleLine
            );

        }

    }

    const records = [];

    //--------------------------------------------------
    // LOOP
    //--------------------------------------------------

    for (
        let i = dataStart;
        i < lines.length;
        i++
    ) {

        const line =
            String(
                lines[i] || ""
            );

        //------------------------------------------------
        // BLANK
        //------------------------------------------------

        if (
            !line.trim()
        ) {

            continue;

        }

        //------------------------------------------------
        // SEPARATOR
        //------------------------------------------------

        if (
            isSeparator(line)
        ) {

            continue;

        }

        //------------------------------------------------
        // PRODUCT
        //------------------------------------------------

        /*
         * CODE_NAME_STOCK extracts product directly from its
         * physical mapped column inside extractCodeNameStockRow().
         * Other structures keep the existing product helper.
         */

        let product = "";

        if (
            mapping.format !==
            "CODE_NAME_STOCK"
        ) {

            product =
                getProduct(
                    line,
                    getMappedPosition(
                        mapping,
                        "product"
                    )
                );

        }

        //------------------------------------------------
        // RECORD
        //------------------------------------------------

        /*
         * STRUCTURE-BASED DISPATCH
         *
         * CODE_NAME_STOCK must be handled first and exclusively.
         * Generic extractors use numeric-token order and can
         * mistake numbers inside product names (e.g. "60 ML")
         * for stock columns.
         *
         * Other structures keep the existing extractor chain.
         */

        let record = null;

        if (
            mapping.format ===
            "CODE_NAME_STOCK"
        ) {

            /*
             * Structure-based extraction is authoritative here.
             * It reads the physical boundaries supplied by the
             * mapper/analyzer and never re-tokenizes numeric values.
             */

            record =
                extractCodeNameStockByStructure(
                    line,
                    mapping,
                    i + 1
                );

        }
        else {

            record =
                extractItemCodeRow(
                    line,
                    mapping,
                    i + 1
                ) ||

                extractStockAgeRow(
                    line,
                    mapping,
                    i + 1
                ) ||

                extractFixedWidthRow(
                    line,
                    mapping,
                    i + 1
                ) ||

                extractSpacedRow(
                    line,
                    mapping,
                    i + 1
                );

        }

        //------------------------------------------------
        // INVALID
        //------------------------------------------------

        if (
            !record
        ) {

            continue;

        }

        //------------------------------------------------
        // PUSH
        //------------------------------------------------

        records.push(
            record
        );

    }

    //--------------------------------------------------
    // DEBUG
    //--------------------------------------------------

    console.log("");

    console.log(
        "========== TXT EXTRACTION =========="
    );

    console.log(
        "Format      :",
        mapping.format || "UNKNOWN"
    );

    console.log(
        "Data Start  :",
        dataStart + 1
    );

    console.log(
        "Records     :",
        records.length
    );

    console.log(
        "===================================="
    );

    //--------------------------------------------------
    // FIRST RECORDS
    //--------------------------------------------------

    if (
        records.length > 0
    ) {

        console.log("");

        console.log(
            "========== FIRST 5 RECORDS =========="
        );

        console.table(
            records.slice(
                0,
                5
            )
        );

        console.log(
            "======================================"
        );

    }

    //--------------------------------------------------
    // RESULT
    //--------------------------------------------------

    return {

        success: true,

        totalRecords:
            records.length,

        records,

        message: ""

    };

}


//======================================================
// EXPORT
//======================================================

module.exports = {

    extractTXT,

    extractFixedWidthRow

};