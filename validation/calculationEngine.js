/**
 * ======================================================
 * CALCULATION ENGINE
 * ======================================================
 *
 * Converts extracted quantities into
 * Extraction Master format.
 *
 * Every quantity is multiplied by PRICE (PTS)
 * to derive the corresponding value.
 */

function n(value) {

    const num = Number(value);

    return Number.isFinite(num) ? num : 0;

}

function calculate(record, product) {

    const price = n(product?.PTS);

    const result = {

        //--------------------------------------------------
        // MASTER INFORMATION
        //--------------------------------------------------

        DIVISION: product?.DIVISION || "",

        BRAND_GRP: product?.BRAND_GRP || "",

        PRDCODE:
            product?.PRODUCT_CODE ||
            product?.PRDCODE ||
            "",

        PRICE: price,

        SKUNAME: record.product,

        //--------------------------------------------------
        // PREVIOUS MONTH
        //--------------------------------------------------

        PRE_MTH_C: 0,

        PRE_MTH_V: 0

    };

    //------------------------------------------------------
    // Quantity Fields
    //------------------------------------------------------

    const qtyFields = {

        OPENING_Q: record.opening,
        PURCHASE_Q: record.purchase,

        PUR_FREE: record.purchaseFree,

        P_RET_QTY: record.purchaseReturn,

        SALES_Q: record.sales,

        SAL_RET_Q: record.salesReturn,

        FREE: record.free,

        REPL: record.replacement,

        BRANCH: record.branch,

        CREDIT: record.credit,

        DEBIT: record.debit,

        ADJUSTMENT: record.adjustment,

        CLOSING_Q: record.closing

    };

    //------------------------------------------------------
    // Generate Quantity & Value
    //------------------------------------------------------

    Object.entries(qtyFields).forEach(([field, value]) => {

        const qty = n(value);

        result[field] = qty;

        const valueField = field
            .replace("_Q", "_V")
            .replace("_QTY", "_VAL");

        result[valueField] = qty * price;

    });

    return result;

}

module.exports = {

    calculate

};