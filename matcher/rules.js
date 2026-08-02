const CONFIG = require("./config");

/**
 * =====================================================
 * BUSINESS RULES
 * =====================================================
 * Applies mandatory modifier rules.
 */

function applyRules(statementParts, candidates) {

    let remaining = [...candidates];

    for (const modifier of CONFIG.MANDATORY_MODIFIERS) {

        const statementHas = statementParts.includes(modifier);

        if (statementHas) {

            // Statement has modifier
            remaining = remaining.filter(candidate =>
                candidate.parsed.parts.includes(modifier)
            );

        } else {

            // Statement doesn't have modifier
            remaining = remaining.filter(candidate =>
                !candidate.parsed.parts.includes(modifier)
            );

        }

    }

    return remaining;

}

module.exports = {

    applyRules

};