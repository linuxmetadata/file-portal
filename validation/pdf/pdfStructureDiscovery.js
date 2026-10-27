/**
 * PDF STRUCTURE DISCOVERY — COMPONENT A
 *
 * Purpose:
 *   Scan PDF files directly inside the configured source folder, extract
 *   layout information using the existing pdfLayoutReader.js, generate
 *   structural fingerprints, group likely matching layouts, and write a
 *   timestamped Excel discovery report.
 *
 * Important:
 *   - This script does not modify PDFs or pdfLayoutReader.js.
 *   - Candidate group IDs are temporary; they are not permanent structure IDs.
 *   - This is a discovery aid. Candidate groups must be reviewed before use.
 *
 * Placement:
 *   Save this file in the SAME directory as pdfLayoutReader.js.
 *   Expected dependency: xlsx (SheetJS) available to the Node.js project.
 */

const fs = require('fs');
const path = require('path');
const { readPDFLayout } = require('./pdfLayoutReader');

let XLSX;
try {
    XLSX = require('xlsx');
} catch (error) {
    console.error('DEPENDENCY ERROR: The "xlsx" package is not available. Install it in the project before running this script.');
    console.error('Expected command: npm install xlsx');
    process.exit(1);
}

const SOURCE_FOLDER = String.raw`D:\Monthly Workings\2026\SEP 2026\Statements\All Division Formatted statements\PDF`;
const OUTPUT_FOLDER_NAME = 'PDF Structure Discovery';

const HEADER_TERMS = [
    'product', 'product name', 'item', 'item name', 'description', 'particular',
    'pack', 'packing', 'batch', 'batch no', 'expiry', 'exp', 'qty', 'quantity',
    'free', 'rate', 'value', 'amount', 'stock', 'opening', 'closing', 'sale',
    'sales', 'purchase', 'purch', 'received', 'receipt', 'issue', 'return',
    'mrp', 'ptr', 'pts', 'bill', 'invoice', 'scheme', 'discount'
];

const PRODUCT_TERMS = [
    'product', 'product name', 'item', 'item name',
    'description', 'particular', 'drug', 'medicine'
];

const IMPORTANT_SEMANTICS = [
    'product', 'quantity', 'rate', 'value', 'batch',
    'pack', 'stock', 'free', 'amount', 'expiry'
];

const Y_TOLERANCE = 2.5;
const MAX_HEADER_SEARCH_LINES = 100;

function normalizeText(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[\u00a0\s]+/g, ' ')
        .replace(/[^a-z0-9%./ -]/g, '')
        .trim();
}

function compactText(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function hasTerm(text, term) {
    const normalized = normalizeText(text);
    const needle = normalizeText(term);

    if (!normalized || !needle) return false;

    return new RegExp(
        `(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
        'i'
    ).test(normalized) || normalized.includes(needle);
}

function semanticOf(text) {
    const t = normalizeText(text);

    if (!t) return 'unknown';

    if (PRODUCT_TERMS.some(term => hasTerm(t, term))) {
        return 'product';
    }

    if (/(^|\b)(qty|quantity|sale qty|purchase qty|qnty)(\b|$)/.test(t)) {
        return 'quantity';
    }

    if (/(^|\b)(rate|mrp|ptr|pts|price)(\b|$)/.test(t)) {
        return 'rate';
    }

    if (/(^|\b)(value|amount|net amount|total amount|val)(\b|$)/.test(t)) {
        return 'value';
    }

    if (/(^|\b)(batch|batch no|batch number)(\b|$)/.test(t)) {
        return 'batch';
    }

    if (/(^|\b)(pack|packing)(\b|$)/.test(t)) {
        return 'pack';
    }

    if (/(^|\b)(opening|opn|opstk|op stk|op qty|op val)(\b|$)/.test(t)) {
        return 'opening';
    }

    if (/(^|\b)(receipt|received|rec|purch|purchase|p qty|p val)(\b|$)/.test(t)) {
        return 'receipt';
    }

    if (/(^|\b)(issue|issued|sale|sales|s qty|s val)(\b|$)/.test(t)) {
        return 'issue';
    }

    if (/(^|\b)(closing|closed|cls|cl stk|cls qty|cls val|balance|bal)(\b|$)/.test(t)) {
        return 'closing';
    }

    if (/(^|\b)(dump|damage|damaged)(\b|$)/.test(t)) {
        return 'dump';
    }

    if (/(^|\b)(free|free qty|fqnty)(\b|$)/.test(t)) {
        return 'free';
    }

    if (/(^|\b)(exp|expiry|expiry date)(\b|$)/.test(t)) {
        return 'expiry';
    }

    if (/(^|\b)(stock|stk)(\b|$)/.test(t)) {
        return 'stock';
    }

    return 'other';
}

function groupItemsByY(items, tolerance = Y_TOLERANCE) {
    const sorted = [...items].sort((a, b) => {
        if (Math.abs((b.y ?? 0) - (a.y ?? 0)) > tolerance) {
            return (b.y ?? 0) - (a.y ?? 0);
        }

        return (a.x ?? 0) - (b.x ?? 0);
    });

    const lines = [];

    for (const item of sorted) {
        const y = Number(item.y) || 0;

        let line = lines.find(
            candidate => Math.abs(candidate.y - y) <= tolerance
        );

        if (!line) {
            line = { y, items: [] };
            lines.push(line);
        }

        line.items.push(item);

        line.y = line.items.reduce(
            (sum, part) => sum + (Number(part.y) || 0),
            0
        ) / line.items.length;
    }

    for (const line of lines) {
        line.items.sort(
            (a, b) => (Number(a.x) || 0) - (Number(b.x) || 0)
        );

        line.text = line.items
            .map(item => String(item.text ?? '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        line.left = Math.min(
            ...line.items.map(item => Number(item.x) || 0)
        );

        line.right = Math.max(
            ...line.items.map(
                item => (Number(item.x) || 0) + (Number(item.width) || 0)
            )
        );

        line.itemCount = line.items.length;
    }

    return lines.sort((a, b) => b.y - a.y);
}

function isSeparatorLine(text) {
    const raw = String(text ?? '').replace(/\s+/g, ' ').trim();

    if (!raw) return true;

    // Common PDF table rules use repeated dashes, underscores or box characters.
    const withoutSpaces = raw.replace(/\s/g, '');

    if (
        withoutSpaces.length >= 5 &&
        /^[\-‐‑‒–—―_=·.─━┄┅┈┉]+$/.test(withoutSpaces)
    ) {
        return true;
    }

    const ruleChars = (
        raw.match(/[\-‐‑‒–—―_=·.─━┄┅┈┉]/g) || []
    ).length;

    return raw.length >= 8 && ruleChars / raw.length >= 0.75;
}

function isLikelyNonTableLine(text) {
    const t = normalizeText(text);

    if (!t || isSeparatorLine(text)) return true;

    if (
        /^(page\s*(no|number)?\s*[:.]?|from\s+\d|to\s+\d|gstin\b|phone\b|email\b|grand total\b|total\b|purchase detail\b)/i.test(t)
    ) {
        return true;
    }

    return false;
}

function headerLineScore(text) {
    const t = normalizeText(text);

    if (!t || isSeparatorLine(text) || isLikelyNonTableLine(text)) {
        return 0;
    }

    let score = 0;
    const matched = new Set();

    for (const term of HEADER_TERMS) {
        if (hasTerm(t, term)) {
            const semantic = semanticOf(term);
            const key = semantic === 'other' ? term : semantic;

            if (!matched.has(key)) {
                score += PRODUCT_TERMS.includes(term) ? 3 : 1;
                matched.add(key);
            }
        }
    }

    if (PRODUCT_TERMS.some(term => hasTerm(t, term))) {
        score += 3;
    }

    if (/(qty|quantity|rate|value|amount|batch|pack|stock|free|expiry)/i.test(t)) {
        score += 1;
    }

    if (t.split(' ').length > 22) {
        score -= 2;
    }

    return Math.max(0, score);
}

function isSubheaderLine(text) {
    const t = normalizeText(text);

    if (!t || isSeparatorLine(text)) return false;

    const compact = t.replace(/\s+/g, '');

    return /\b(qnty|fqnty|qty|val|value|amount)\b/i.test(t)
        || /q\+f/i.test(compact)
        || /q\/f/i.test(compact);
}

function lineHasHeaderEvidence(line) {
    if (!line || isLikelyNonTableLine(line.text)) {
        return false;
    }

    const score = headerLineScore(line.text);
    const terms = HEADER_TERMS.filter(
        term => hasTerm(line.text, term)
    );

    return (
        score >= 2 &&
        (
            terms.length >= 2 ||
            PRODUCT_TERMS.some(term => hasTerm(line.text, term))
        )
    ) || isSubheaderLine(line.text);
}

function combineHeaderCandidates(lines) {
    const candidates = [];
    const limit = Math.min(lines.length, MAX_HEADER_SEARCH_LINES);

    for (let i = 0; i < limit; i++) {
        const one = lines[i];

        if (!isLikelyNonTableLine(one.text)) {
            const oneScore = headerLineScore(one.text);

            if (oneScore >= 3) {
                candidates.push({
                    startIndex: i,
                    endIndex: i,
                    lines: [one],
                    text: one.text,
                    score: oneScore
                });
            }
        }
                // Consider combining the current line with the following lines.
        // This supports headers split over multiple rows, such as:
        // ITEM DESCRIPTION | OPENING | RECEIPT | ISSUE | CLOSING
        //                  | QTY | VALUE | QTY | VALUE ...
        for (let count = 2; count <= 3 && i + count <= limit; count++) {
            const combinedLines = lines.slice(i, i + count);

            if (combinedLines.some(line => isSeparatorLine(line.text))) {
                continue;
            }

            const combinedText = combinedLines
                .map(line => line.text)
                .filter(Boolean)
                .join(' | ');

            const combinedScore = combinedLines.reduce(
                (sum, line) => sum + headerLineScore(line.text),
                0
            );

            const evidenceCount = combinedLines.filter(
                lineHasHeaderEvidence
            ).length;

            if (
                combinedScore >= 4 &&
                evidenceCount >= 1 &&
                combinedLines.some(line =>
                    PRODUCT_TERMS.some(term => hasTerm(line.text, term))
                )
            ) {
                candidates.push({
                    startIndex: i,
                    endIndex: i + count - 1,
                    lines: combinedLines,
                    text: combinedText,
                    score: combinedScore + evidenceCount
                });
            }
        }
    }

    // Remove duplicate candidates that cover the same rows and have
    // equivalent normalized header text.
    const unique = [];
    const seen = new Set();

    for (const candidate of candidates) {
        const key = [
            candidate.startIndex,
            candidate.endIndex,
            compactText(candidate.text)
        ].join('::');

        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(candidate);
    }

    return unique.sort((a, b) =>
        b.score - a.score ||
        a.lines.length - b.lines.length ||
        a.startIndex - b.startIndex
    );
}

function splitTextItemIntoHeaderSegments(item) {
    const text = String(item.text ?? '').trim();

    if (!text) return [];

    const x = Number(item.x) || 0;
    const width = Number(item.width) || 0;

    // Keep the original item intact. PDF text items do not reliably
    // provide exact character-level positions, so splitting text by
    // spaces must not be treated as authoritative column geometry.
    return [{
        text,
        x,
        width,
        xEnd: x + width,
        originalItem: item
    }];
}

function makeHeaderCells(candidate) {
    const cells = [];

    for (let rowIndex = 0; rowIndex < candidate.lines.length; rowIndex++) {
        const line = candidate.lines[rowIndex];

        for (const item of line.items) {
            const segments = splitTextItemIntoHeaderSegments(item);

            for (const segment of segments) {
                const text = String(segment.text ?? '').trim();

                if (!text) continue;

                cells.push({
                    rowIndex,
                    y: line.y,
                    text,
                    normalized: normalizeText(text),
                    semantic: semanticOf(text),
                    x: segment.x,
                    width: segment.width,
                    xEnd: segment.xEnd
                });
            }
        }
    }

    return cells.sort((a, b) =>
        a.rowIndex - b.rowIndex ||
        a.x - b.x
    );
}

function mergeNearbyHeaderCells(cells, gapTolerance = 12) {
    const sorted = [...cells].sort((a, b) =>
        a.rowIndex - b.rowIndex ||
        a.x - b.x
    );

    const merged = [];

    for (const cell of sorted) {
        const previous = merged[merged.length - 1];

        if (
            previous &&
            previous.rowIndex === cell.rowIndex &&
            cell.x - previous.xEnd <= gapTolerance &&
            cell.x >= previous.x
        ) {
            previous.text = `${previous.text} ${cell.text}`.trim();
            previous.normalized = normalizeText(previous.text);
            previous.semantic = semanticOf(previous.text);
            previous.xEnd = Math.max(previous.xEnd, cell.xEnd);
            previous.width = previous.xEnd - previous.x;
        } else {
            merged.push({ ...cell });
        }
    }

    return merged;
}

function extractHeaderColumns(candidate) {
    if (!candidate || !Array.isArray(candidate.lines)) {
        return {
            cells: [],
            columns: [],
            headerRowCount: 0,
            productColumnIndex: -1,
            semantics: []
        };
    }

    const rawCells = makeHeaderCells(candidate);
    const cells = mergeNearbyHeaderCells(rawCells);

    // Estimate columns from the x positions of text items.
    // This is a candidate layout signature, not a guarantee that each
    // text item equals a complete logical table column.
    const anchors = [];

    for (const cell of cells) {
        const nearest = anchors.find(anchor =>
            Math.abs(anchor.x - cell.x) <= 10
        );

        if (nearest) {
            nearest.samples += 1;
            nearest.x = (
                nearest.x * (nearest.samples - 1) + cell.x
            ) / nearest.samples;
            nearest.texts.push(cell.text);
        } else {
            anchors.push({
                x: cell.x,
                samples: 1,
                texts: [cell.text]
            });
        }
    }

    anchors.sort((a, b) => a.x - b.x);

    const columns = anchors.map((anchor, index) => {
        const texts = anchor.texts;
        const combinedText = texts.join(' ');
        const semantics = texts
            .map(semanticOf)
            .filter(value => value !== 'other' && value !== 'unknown');

        return {
            index,
            x: Number(anchor.x.toFixed(2)),
            texts,
            combinedText,
            semantic: semanticOf(combinedText),
            semantics: [...new Set(semantics)]
        };
    });

    let productColumnIndex = columns.findIndex(column =>
        PRODUCT_TERMS.some(term => hasTerm(column.combinedText, term))
    );

    if (productColumnIndex < 0) {
        productColumnIndex = -1;
    }

    const semantics = [
        ...new Set(
            columns
                .flatMap(column => column.semantics)
                .filter(Boolean)
        )
    ];

    return {
        cells,
        columns,
        headerRowCount: candidate.lines.length,
        productColumnIndex,
        semantics
    };
}

function isLikelyProductDataLine(text) {
    const raw = String(text ?? '').replace(/\s+/g, ' ').trim();
    const t = normalizeText(raw);

    if (!t || isSeparatorLine(raw) || isLikelyNonTableLine(raw)) {
        return false;
    }

    if (
        /\b(grand total|sub total|subtotal|total|purchase detail|sales detail|opening balance|closing balance)\b/i.test(t)
    ) {
        return false;
    }

    if (
        /\b(supplier name|stockist name|customer name|invoice no|invoice number|statement date|report date)\b/i.test(t)
    ) {
        return false;
    }

    if (/^linux labs$/.test(t) || /^indiabulls derma \d+\/?\d*$/.test(t)) {
        return false;
    }

    const hasLetters = /[a-z]/i.test(raw);

    // A candidate product row should contain a description plus at least
    // two quantity/value-like tokens. This is a heuristic for discovery.
    const numericTokens = raw.match(
        /(?:^|\s)(?:\d+(?:[,.]\d+)*|\d+\/\d+|[-–—])(?=\s|$)/g
    ) || [];

    if (!hasLetters || numericTokens.length < 2) {
        return false;
    }

    const words = t.split(/\s+/).filter(Boolean);

    if (words.length < 2 && numericTokens.length < 3) {
        return false;
    }

    return true;
}

function validateHeaderCandidate(candidate, lines) {
    const start = candidate.endIndex + 1;
    const end = Math.min(lines.length, start + 25);

    let productRowSupport = 0;
    const examples = [];

    for (let i = start; i < end; i++) {
        const line = lines[i];

        if (!line || !line.text) continue;
        if (isSeparatorLine(line.text)) continue;

        if (isLikelyProductDataLine(line.text)) {
            productRowSupport += 1;
            examples.push(line.text);

            if (productRowSupport >= 3) break;
        }
    }

    const validated = productRowSupport >= 2;

    return {
        ...candidate,
        validated,
        productRowSupport,
        validationNote: validated
            ? `Passed product-row validation (${productRowSupport} supporting rows).`
            : `Failed product-row validation (${productRowSupport} supporting rows; at least 2 required).`,
        productRowExamples: examples
    };
}

function makeFingerprint(layout) {
    const firstPage = layout?.pages?.[0];

    if (!firstPage || !Array.isArray(firstPage.items)) {
        return {
            headerFound: false,
            headerRowCount: 0,
            headerText: '',
            columns: [],
            columnCount: 0,
            productColumnIndex: -1,
            semantics: [],
            fingerprint: '',
            notes: 'First page has no readable positioned text items.'
        };
    }

    const lines = groupItemsByY(firstPage.items);
    const candidates = combineHeaderCandidates(lines)
        .map(candidate => validateHeaderCandidate(candidate, lines))
        .filter(candidate => candidate.validated)
        .sort((a, b) =>
            b.score - a.score ||
            b.productRowSupport - a.productRowSupport ||
            a.lines.length - b.lines.length ||
            a.startIndex - b.startIndex
        );

    const best = candidates[0] || null;

    if (!best) {
        return {
            headerFound: false,
            headerRowCount: 0,
            headerText: '',
            columns: [],
            columnCount: 0,
            productColumnIndex: -1,
            semantics: [],
            fingerprint: '',
            notes: 'No header candidate passed product-row validation on the first page.'
        };
    }

    const extracted = extractHeaderColumns(best);

    const columnSignature = extracted.columns.map(column => ({
        semantic: column.semantic,
        semantics: column.semantics,
        x: column.x,
        text: normalizeText(column.combinedText)
    }));

    const fingerprint = JSON.stringify({
        headerRows: best.lines.map(line => compactText(line.text)),
        columns: columnSignature.map(column => ({
            semantic: column.semantic,
            semantics: column.semantics
        }))
    });

    return {
        headerFound: true,
        headerRowCount: best.lines.length,
        headerText: best.text,
        headerStartIndex: best.startIndex,
        headerEndIndex: best.endIndex,
        headerScore: best.score,
        productRowSupport: best.productRowSupport,
        validationNote: best.validationNote,
        productRowExamples: best.productRowExamples,
        columns: extracted.columns,
        columnCount: extracted.columns.length,
        productColumnIndex: extracted.productColumnIndex,
        semantics: extracted.semantics,
        fingerprint,
        notes: best.validationNote
    };
}
function sequenceCompatible(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];

    if (!left.length || !right.length) {
        return false;
    }

    const normalizeSemantic = value => {
        const v = String(value || 'unknown').toLowerCase();

        if (['opening', 'receipt', 'issue', 'closing'].includes(v)) {
            return v;
        }

        return v;
    };

    const leftSemantics = left.map(column =>
        normalizeSemantic(column.semantic)
    );

    const rightSemantics = right.map(column =>
        normalizeSemantic(column.semantic)
    );

    // The number of inferred columns is significant. A different number
    // may indicate a different table structure.
    if (leftSemantics.length !== rightSemantics.length) {
        return false;
    }

    let matches = 0;

    for (let i = 0; i < leftSemantics.length; i++) {
        if (leftSemantics[i] === rightSemantics[i]) {
            matches++;
            continue;
        }

        const x = leftSemantics[i];
        const y = rightSemantics[i];

        if (
            x === 'unknown' ||
            x === 'other' ||
            y === 'unknown' ||
            y === 'other'
        ) {
            continue;
        }

        return false;
    }

    return matches >= Math.max(1, Math.ceil(leftSemantics.length * 0.6));
}

function compareFingerprints(a, b) {
    if (!a || !b || !a.headerFound || !b.headerFound) {
        return {
            compatible: false,
            score: 0,
            reason: 'One or both files have no validated header candidate.'
        };
    }

    if (a.columnCount !== b.columnCount) {
        return {
            compatible: false,
            score: 0,
            reason: `Different estimated column counts (${a.columnCount} vs ${b.columnCount}).`
        };
    }

    if (!sequenceCompatible(a.columns, b.columns)) {
        return {
            compatible: false,
            score: 0,
            reason: 'Column semantic sequences are incompatible.'
        };
    }

    const leftHeader = compactText(a.headerText);
    const rightHeader = compactText(b.headerText);

    let headerSimilarity = 0;

    if (leftHeader && rightHeader) {
        if (leftHeader === rightHeader) {
            headerSimilarity = 1;
        } else {
            const leftTokens = new Set(normalizeText(a.headerText).split(' '));
            const rightTokens = new Set(normalizeText(b.headerText).split(' '));

            const intersection = [...leftTokens].filter(token =>
                rightTokens.has(token)
            ).length;

            const union = new Set([...leftTokens, ...rightTokens]).size;

            headerSimilarity = union ? intersection / union : 0;
        }
    }

    const semanticMatches = a.columns.filter((column, index) =>
        column.semantic === b.columns[index]?.semantic
    ).length;

    const semanticSimilarity = a.columnCount
        ? semanticMatches / a.columnCount
        : 0;

    const score = Math.round(
        (semanticSimilarity * 0.75 + headerSimilarity * 0.25) * 100
    );

    return {
        compatible: true,
        score,
        reason: `Compatible column sequence; semantic similarity ${Math.round(semanticSimilarity * 100)}%; header similarity ${Math.round(headerSimilarity * 100)}%.`
    };
}

function makeGroupSignature(fingerprint) {
    if (!fingerprint || !fingerprint.headerFound) {
        return 'UNMATCHED';
    }

    const semantics = fingerprint.columns.map(column =>
        column.semantic || 'unknown'
    );

    return [
        `COLS:${fingerprint.columnCount}`,
        `HEADER_ROWS:${fingerprint.headerRowCount}`,
        `SEM:${semantics.join('>')}`
    ].join('|');
}

function buildCandidateGroups(fileRecords) {
    const groups = [];
    const ungrouped = [];

    const validRecords = fileRecords.filter(record =>
        record.fingerprint && record.fingerprint.headerFound
    );

    for (const record of validRecords) {
        let bestGroup = null;
        let bestScore = -1;
        let bestReason = '';

        for (const group of groups) {
            const comparison = compareFingerprints(
                record.fingerprint,
                group.representative.fingerprint
            );

            if (
                comparison.compatible &&
                comparison.score > bestScore
            ) {
                bestGroup = group;
                bestScore = comparison.score;
                bestReason = comparison.reason;
            }
        }

        if (bestGroup) {
            bestGroup.files.push(record);
            record.candidateGroupId = bestGroup.candidateGroupId;
            record.groupMatchScore = bestScore;
            record.groupMatchReason = bestReason;
        } else {
            const group = {
                candidateGroupId: '',
                representative: record,
                files: [record],
                signature: makeGroupSignature(record.fingerprint)
            };

            groups.push(group);
        }
    }

    for (const record of fileRecords) {
        if (!record.fingerprint || !record.fingerprint.headerFound) {
            ungrouped.push(record);
        }
    }

    groups.sort((a, b) => b.files.length - a.files.length);

    groups.forEach((group, index) => {
        group.candidateGroupId =
            `CANDIDATE_${String(index + 1).padStart(3, '0')}`;

        group.files.forEach(record => {
            record.candidateGroupId = group.candidateGroupId;

            if (record === group.representative) {
                record.groupMatchScore = 100;
                record.groupMatchReason = 'Representative file for this candidate group.';
            }
        });
    });

    ungrouped.forEach(record => {
        record.candidateGroupId = 'UNGROUPED';
        record.groupMatchScore = 0;
        record.groupMatchReason =
            record.fingerprint?.notes ||
            'No validated header candidate was detected.';
    });

    return { groups, ungrouped };
}

function safeCell(value) {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') {
        // Avoid interpreting values beginning with formula markers as Excel formulas.
        if (/^[=+\-@]/.test(value)) {
            return `'${value}`;
        }

        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    return String(value);
}

function createWorksheet(rows, columnWidths = []) {
    const worksheet = XLSX.utils.json_to_sheet(rows);

    if (columnWidths.length) {
        worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
    }

    return worksheet;
}

function writeWorkbook(fileRecords, groups, ungrouped, summary, outputFolder) {
    fs.mkdirSync(outputFolder, { recursive: true });

    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, '')
        .replace('T', '_');

    const outputPath = path.join(
        outputFolder,
        `PDF_Structure_Discovery_Report_${timestamp}.xlsx`
    );

    const workbook = XLSX.utils.book_new();

    const summaryRows = [
        { Metric: 'Source Folder', Value: SOURCE_FOLDER },
        { Metric: 'PDF Files Found', Value: summary.totalFiles },
        { Metric: 'Successfully Analyzed', Value: summary.successCount },
        { Metric: 'Read Failures', Value: summary.failureCount },
        { Metric: 'Files Without Readable Text', Value: summary.noTextCount },
        { Metric: 'Files Without Validated Header', Value: ungrouped.length },
        { Metric: 'Candidate Groups', Value: groups.length },
        {
            Metric: 'Files Assigned to Candidate Groups',
            Value: fileRecords.filter(record =>
                record.candidateGroupId &&
                record.candidateGroupId !== 'UNGROUPED'
            ).length
        },
        {
            Metric: 'Status',
            Value: 'DISCOVERY ONLY — ALL GROUPS REQUIRE REVIEW'
        },
        {
            Metric: 'Generated At',
            Value: new Date().toLocaleString()
        }
    ];

    XLSX.utils.book_append_sheet(
        workbook,
        createWorksheet(summaryRows, [42, 90]),
        'Scan Summary'
    );

    const groupRows = groups.map(group => {
        const fingerprint = group.representative.fingerprint;

        return {
            'Candidate Group ID': group.candidateGroupId,
            'File Count': group.files.length,
            'Representative File': group.representative.fileName,
            'Header Found': fingerprint.headerFound ? 'YES' : 'NO',
            'Header Row Count': fingerprint.headerRowCount,
            'Estimated Column Count': fingerprint.columnCount,
            'Product Column Index': fingerprint.productColumnIndex,
            'Header Text': fingerprint.headerText,
            'Column Semantics': fingerprint.columns
                .map(column => column.semantic)
                .join(' | '),
            'Column Positions': fingerprint.columns
                .map(column => column.x)
                .join(' | '),
            'Product Row Support': fingerprint.productRowSupport || 0,
            'Validation Note': fingerprint.validationNote || fingerprint.notes,
            'Group Signature': group.signature,
            'Review Status': 'PENDING REVIEW'
        };
    });

    XLSX.utils.book_append_sheet(
        workbook,
        createWorksheet(groupRows, [
            22, 12, 55, 14, 15, 18, 18, 65, 45, 35, 18, 55, 65, 20
        ]),
        'Candidate Groups'
    );

    const detailRows = fileRecords.map(record => {
        const fingerprint = record.fingerprint || {};

        return {
            'File Name': record.fileName,
            'Full Path': record.fullPath,
            'Read Status': record.readStatus,
            'Page Count': record.pageCount || 0,
            'Text Item Count': record.textItemCount || 0,
            'Candidate Group ID': record.candidateGroupId || 'UNGROUPED',
            'Group Match Score': record.groupMatchScore ?? 0,
            'Group Match Reason': record.groupMatchReason || '',
            'Header Found': fingerprint.headerFound ? 'YES' : 'NO',
            'Header Row Count': fingerprint.headerRowCount || 0,
            'Estimated Column Count': fingerprint.columnCount || 0,
            'Product Column Index': fingerprint.productColumnIndex ?? -1,
            'Header Text': fingerprint.headerText || '',
            'Column Semantics': (fingerprint.columns || [])
                .map(column => column.semantic)
                .join(' | '),
            'Column Positions': (fingerprint.columns || [])
                .map(column => column.x)
                .join(' | '),
            'Product Row Support': fingerprint.productRowSupport || 0,
            'Validation Note': fingerprint.validationNote || fingerprint.notes || '',
            'Error': record.error || ''
        };
    });

    XLSX.utils.book_append_sheet(
        workbook,
        createWorksheet(detailRows, [
            55, 90, 18, 12, 16, 22, 18, 55, 14, 15, 18, 18,
            65, 45, 35, 18, 55, 55
        ]),
        'File Details'
    );

    XLSX.writeFile(workbook, outputPath);

    return outputPath;
}
async function analyzePDF(filePath) {
    const fileName = path.basename(filePath);

    const record = {
        fileName,
        fullPath: filePath,
        readStatus: 'PENDING',
        pageCount: 0,
        textItemCount: 0,
        fingerprint: null,
        candidateGroupId: '',
        groupMatchScore: 0,
        groupMatchReason: '',
        error: ''
    };

    try {
        const layout = await readPDFLayout(filePath);

        if (!layout || layout.error) {
            record.readStatus = 'READ_FAILED';
            record.error = layout?.error
                ? String(layout.error)
                : 'PDF reader returned no usable layout.';
            return record;
        }

        const pages = Array.isArray(layout.pages) ? layout.pages : [];

        record.pageCount = pages.length;
        record.textItemCount = pages.reduce(
            (total, page) =>
                total + (Array.isArray(page.items) ? page.items.length : 0),
            0
        );

        if (record.textItemCount === 0) {
            record.readStatus = 'NO_TEXT';
            record.error = 'No positioned text items were returned.';
            record.fingerprint = makeFingerprint(layout);
            return record;
        }

        record.fingerprint = makeFingerprint(layout);
        record.readStatus = 'SUCCESS';

        return record;
    } catch (error) {
        record.readStatus = 'READ_FAILED';
        record.error = error?.stack || String(error);
        return record;
    }
}

async function main() {
    console.log('==============================================');
    console.log('PDF STRUCTURE DISCOVERY — COMPONENT A');
    console.log('==============================================');
    console.log(`Source folder: ${SOURCE_FOLDER}`);

    if (!fs.existsSync(SOURCE_FOLDER)) {
        console.error('SOURCE FOLDER ERROR: The configured source folder does not exist.');
        console.error(SOURCE_FOLDER);
        process.exitCode = 1;
        return;
    }

    const outputFolder = path.join(
        SOURCE_FOLDER,
        OUTPUT_FOLDER_NAME
    );

    // Scan PDFs directly in the source folder only.
    // Do not recursively scan subfolders or previously generated output.
    const pdfFiles = fs.readdirSync(SOURCE_FOLDER, {
        withFileTypes: true
    })
        .filter(entry =>
            entry.isFile() && /\.pdf$/i.test(entry.name)
        )
        .map(entry => path.join(SOURCE_FOLDER, entry.name))
        .sort((a, b) => a.localeCompare(b));

    console.log(`PDF files found: ${pdfFiles.length}`);

    if (pdfFiles.length === 0) {
        console.log('No PDF files were found directly inside the source folder.');

        const outputPath = writeWorkbook(
            [],
            [],
            [],
            {
                totalFiles: 0,
                successCount: 0,
                failureCount: 0,
                noTextCount: 0
            },
            outputFolder
        );

        console.log(`Empty discovery report created: ${outputPath}`);
        return;
    }

    const fileRecords = [];

    for (let i = 0; i < pdfFiles.length; i++) {
        const filePath = pdfFiles[i];

        console.log(
            `[${i + 1}/${pdfFiles.length}] ${path.basename(filePath)}`
        );

        const record = await analyzePDF(filePath);
        fileRecords.push(record);
    }

    const successCount = fileRecords.filter(
        record => record.readStatus === 'SUCCESS'
    ).length;

    const failureCount = fileRecords.filter(
        record => record.readStatus === 'READ_FAILED'
    ).length;

    const noTextCount = fileRecords.filter(
        record => record.readStatus === 'NO_TEXT'
    ).length;

    const { groups, ungrouped } = buildCandidateGroups(fileRecords);

    const summary = {
        totalFiles: pdfFiles.length,
        successCount,
        failureCount,
        noTextCount
    };

    const outputPath = writeWorkbook(
        fileRecords,
        groups,
        ungrouped,
        summary,
        outputFolder
    );

    console.log('');
    console.log('==============================================');
    console.log('PDF STRUCTURE DISCOVERY COMPLETED');
    console.log('==============================================');
    console.log(`PDF files found: ${summary.totalFiles}`);
    console.log(`Successfully analyzed: ${summary.successCount}`);
    console.log(`Read failures: ${summary.failureCount}`);
    console.log(`Files without readable text: ${summary.noTextCount}`);
    console.log(`Candidate groups: ${groups.length}`);
    console.log(`Files without validated headers: ${ungrouped.length}`);
    console.log(`Report: ${outputPath}`);
    console.log('');
    console.log('IMPORTANT: Candidate groups are not permanent structure IDs.');
    console.log('Review the Excel report before using any group for extraction.');
}

main().catch(error => {
    console.error('PDF STRUCTURE DISCOVERY ERROR');
    console.error(error?.stack || error);
    process.exitCode = 1;
});