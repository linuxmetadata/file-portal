const fs = require("fs");
const pdf = require("pdf-parse");
const XLSX = require("xlsx");

/**
 * ----------------------------------------------------
 * Utilities
 * ----------------------------------------------------
 */

function isNumber(value) {

    return /^-?\d+(\.\d+)?$/.test(value);

}

function isMonth(value) {

    return /^\d{1,2}\/\d{2}$/.test(value);

}

function normalize(line) {

    return String(line || "")
        .replace(/\s+/g, " ")
        .trim();

}

/**
 * ----------------------------------------------------
 * Ignore Non Product Lines
 * ----------------------------------------------------
 */

function shouldIgnore(text) {

    const upper = text.toUpperCase();

    // Blank
    if (!upper)
        return true;

    // Separator
    if (/^-+$/.test(upper))
        return true;

    // Company Header
    if (
        upper.includes("LINUX LAB") ||
        upper.includes("PVT LTD")
    )
        return true;

    // Address
    if (
        upper.includes("SHOP NO") ||
        upper.includes("MARKET") ||
        upper.includes("ODISHA") ||
        upper.includes("ROURKELA")
    )
        return true;

    // Report Heading
    if (
        upper.includes("STOCK & SALES") ||
        upper.includes("ANALYSIS")
    )
        return true;

    // Footer
    if (
        upper.startsWith("TOTAL")
    )
        return true;

    return false;

}

/**
 * ----------------------------------------------------
 * Parse One Line
 * ----------------------------------------------------
 */

function parseLine(line) {

    const text = normalize(line);

    //--------------------------------------------
    // Ignore
    //--------------------------------------------

    if (shouldIgnore(text))
        return [];

    //--------------------------------------------
    // Header
    //--------------------------------------------

    const upper = text.toUpperCase();

    if (

        upper.includes("ITEM DESCRIPTION") &&

        upper.includes("OPENING")

    ) {

        return [

            "ITEM DESCRIPTION",

            "OPENING",

            "RECEIPT",

            "ISSUE",

            "CLOSING",

            "MONTH",

            "EXPIRY"

        ];

    }

    //--------------------------------------------
    // Product Row
    //--------------------------------------------

    const parts = text.split(/\s+/);

    if (parts.length < 7)
        return [];

    const expiry = parts.pop();

    if (!isMonth(expiry))
        return [];

    const month = parts.pop();

    const closing = parts.pop();

    const issue = parts.pop();

    const receipt = parts.pop();

    const opening = parts.pop();

    if (

        !isNumber(opening) ||

        !isNumber(receipt) ||

        !isNumber(issue) ||

        !isNumber(closing)

    ) {

        return [];

    }

    const product = parts.join(" ");

    return [

        product,

        Number(opening),

        Number(receipt),

        Number(issue),

        Number(closing),

        Number(month),

        expiry

    ];

}

/**
 * ----------------------------------------------------
 * Read PDF
 * ----------------------------------------------------
 */

async function readWorkbook(filePath) {

    try {

        const buffer = fs.readFileSync(filePath);

        const result = await pdf(buffer);

        if (

            !result.text ||

            result.text.trim().length === 0

        ) {

            return null;

        }

        const rows = result.text

            .split(/\r?\n/)

            .map(parseLine)

            .filter(r => r.length > 0);

        const worksheet = XLSX.utils.aoa_to_sheet(rows);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(

            workbook,

            worksheet,

            "Sheet1"

        );

        return workbook;

    }

    catch (err) {

        console.error(

            "PDF Reader Error:",

            err.message

        );

        return null;

    }

}

module.exports = {

    readWorkbook

};