/**
 * =====================================================
 * PROGRESSIVE MATCHER
 * =====================================================
 *
 * Filters candidates using statement parts.
 *
 * No normalization.
 * No business rules.
 * No scoring.
 */

function progressiveMatch(statementParts, candidates) {

    let remaining = [...candidates];

    const trace = [];

    for (const part of statementParts) {

        const filtered = remaining.filter(candidate => {

            return candidate.parsed.parts.includes(part);

        });

        trace.push({

            searched: part,

            before: remaining.length,

            after: filtered.length

        });

        // Keep filtered list only if something matched
        if (filtered.length > 0) {

            remaining = filtered;

        }

    }

    return {

        success: remaining.length > 0,

        remaining,

        trace

    };

}

module.exports = {

    progressiveMatch

};