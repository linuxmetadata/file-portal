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

    if (!text) {

        return 0;

    }

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : 0;

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
//
// Each numeric field ends immediately before the next
// known field.
//
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
    position
) {

    const start =
        position === null ||
        position === undefined

            ? 0

            : Number(position);

    return getPositionValue(
        line,
        start,
        27
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
        "COMPUTER GENERATED"

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
        positions.opening !== null &&
        positions.opening !== undefined

            ? Number(
                positions.opening
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
// FIXED WIDTH ROW
//======================================================

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

    //--------------------------------------------------
    // PRODUCT
    //--------------------------------------------------

    const product =
        getProduct(
            line,
            positions.product
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
            positions.packing,
            positions.opening
        );

    //--------------------------------------------------
    // OPENING
    //--------------------------------------------------

    const opening =
        toNumber(
            getField(
                line,
                positions.opening,
                positions.purchase
            )
        );

    //--------------------------------------------------
    // PURCHASE
    //--------------------------------------------------

    const purchase =
        toNumber(
            getField(
                line,
                positions.purchase,
                positions.purchaseValue
            )
        );

    //--------------------------------------------------
    // PURCHASE VALUE
    //--------------------------------------------------

    const purchaseValue =
        toNumber(
            getField(
                line,
                positions.purchaseValue,
                positions.sales
            )
        );

    //--------------------------------------------------
    // SALES
    //--------------------------------------------------

    const sales =
        toNumber(
            getField(
                line,
                positions.sales,
                positions.salesValue
            )
        );

    //--------------------------------------------------
    // SALES VALUE
    //--------------------------------------------------

    const salesValue =
        toNumber(
            getField(
                line,
                positions.salesValue,
                positions.closing
            )
        );

    //--------------------------------------------------
    // CLOSING
    //--------------------------------------------------

    const closing =
        toNumber(
            getField(
                line,
                positions.closing,
                positions.closingValue
            )
        );

    //--------------------------------------------------
    // CLOSING VALUE
    //--------------------------------------------------

    const closingValue =
        toNumber(
            getField(
                line,
                positions.closingValue,
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
        detection.dataStartsAt !==
            undefined &&
        detection.dataStartsAt !==
            null
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
    // RESULT
    //--------------------------------------------------

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

        const product =
            getProduct(
                line,
                mapping.positions &&
                mapping.positions.product !==
                    undefined

                    ? mapping.positions.product

                    : mapping.product
            );

        //------------------------------------------------
        // FOOTER
        //------------------------------------------------

        if (
            shouldStop(product)
        ) {

            /*
             * Once actual records have started,
             * a footer means extraction is complete.
             */

            if (
                records.length > 0
            ) {

                break;

            }

            continue;

        }

        //------------------------------------------------
        // RECORD
        //------------------------------------------------

        const record =
            extractFixedWidthRow(
                line,
                mapping,
                i + 1
            );

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