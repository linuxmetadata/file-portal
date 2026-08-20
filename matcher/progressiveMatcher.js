/**
 * =====================================================
 * PROGRESSIVE MATCHER
 * =====================================================
 *
 * Scores candidates instead of repeatedly filtering.
 * The best scoring candidate(s) are returned.
 */

function normalizeToken(token) {

    return String(token || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/MG$/, "")
        .replace(/GM$/, "")
        .replace(/ML$/, "");

}

function tokenMatches(statementToken, candidateToken) {

    return (
        normalizeToken(statementToken) ===
        normalizeToken(candidateToken)
    );

}

function progressiveMatch(statementParts, candidates) {

    const scored = candidates.map(candidate => {

        let matched = 0;

        candidate.parsed.parts.forEach(candidatePart => {

            const found = statementParts.some(statementPart =>

                tokenMatches(statementPart, candidatePart)

            );

            if (found)
                matched++;

        });

        const total = candidate.parsed.parts.length;

        return {

            ...candidate,

            matched,

            total,

            score: total === 0 ? 0 : matched / total

        };

    });

    //--------------------------------------------------
    // Highest Score
    //--------------------------------------------------

    const maxScore = Math.max(

        ...scored.map(x => x.score),

        0

    );

    const remaining = scored.filter(

        x => x.score === maxScore

    );

    //--------------------------------------------------
    // Trace
    //--------------------------------------------------

    const trace = remaining.map(r => ({

        product:

            r.product["Product Description"],

        matched: r.matched,

        total: r.total,

        score: r.score

    }));

    return {

        success: remaining.length > 0,

        remaining,

        trace

    };

}

module.exports = {

    progressiveMatch

};