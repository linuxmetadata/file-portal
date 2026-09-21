/**
 * ======================================================
 * COLUMN PROFILER
 * ======================================================
 *
 * Analyses ONE statement column and predicts
 * its business meaning.
 */

function profileColumn(column) {

    return {

        movement: null,

        type: null,

        confidence: 0

    };

}

module.exports = {

    profileColumn

};