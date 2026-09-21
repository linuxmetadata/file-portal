/**
 * ======================================================
 * VALIDATION ENGINE
 * ======================================================
 *
 * Validates stock movement.
 */

function n(value) {

    const num = Number(value);

    return Number.isFinite(num)
        ? num
        : 0;

}

function validate(record) {

    const expected =

        n(record.OPENING_Q)

        + n(record.PURCHASE_Q)

        + n(record.PUR_FREE)

        + n(record.SAL_RET_Q)

        + n(record.CREDIT)

        + n(record.BRANCH)

        + n(record.ADJUSTMENT)

        - n(record.P_RET_QTY)

        - n(record.SALES_Q)

        - n(record.FREE)

        - n(record.REPL)

        - n(record.DEBIT);

    const actual =

        n(record.CLOSING_Q);

    return {

        valid:

            expected === actual,

        expectedClosing:

            expected,

        actualClosing:

            actual,

        difference:

            actual - expected

    };

}

module.exports = {

    validate

};