/**
 * ======================================================
 * HEADER INTERPRETER
 * ======================================================
 *
 * Reads a detected header row and converts it into
 * the standard Extraction Master fields.
 */

function normalize(text) {

    return String(text || "")
        .toUpperCase()
        .replace(/\r?\n/g, " ")
        .replace(/[_\-\/\\.,()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}

function interpretHeaders(headers) {

    if (!Array.isArray(headers)) {
        throw new Error("Headers must be an array.");
    }

    const mapping = {

        product: null,
        pack: null,

        openingQty: null,
        openingValue: null,

        purchaseQty: null,
        purchaseValue: null,

        purchaseFreeQty: null,
        purchaseFreeValue: null,

        purchaseReturnQty: null,
        purchaseReturnValue: null,

        salesQty: null,
        salesValue: null,

        salesReturnQty: null,
        salesReturnValue: null,

        freeQty: null,
        freeValue: null,

        replacementQty: null,
        replacementValue: null,

        branchTransferQty: null,
        branchTransferValue: null,

        creditReturnQty: null,
        creditReturnValue: null,

        debitQty: null,
        debitValue: null,

        adjustmentQty: null,
        adjustmentValue: null,

        closingQty: null,
        closingValue: null,

        rate: null

    };

    const normalizedHeaders = headers.map((header, index) => ({

        index,
        original: header,
        normalized: normalize(header)

    }));

    return {

        success: true,
        headers: normalizedHeaders,
        mapping

    };

}

module.exports = {
    interpretHeaders
};