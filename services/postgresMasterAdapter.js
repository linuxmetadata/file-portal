
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { Client } = require("pg");

const {
    MASTER_COLUMNS,
    VALUE_COLUMNS,
    MATCH_COLUMNS,
    createEmptyMasterRow
} = require("./masterSchema");

const TABLE_NAME = "statement_extraction_master";

const SOURCE_COLUMNS = [
    "Source File",
    "Source Row",
    "Statement Structure",
    "Raw Source Values",
    "Header Mapping",
    "Unidentified Headers"
];

function clean(value) {
    return String(value ?? "").trim();
}

function normalizeFileName(value) {
    return path.basename(clean(value)).toUpperCase();
}

function dbValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

function quoteIdentifier(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function createRecordId(sourceRow, metadata) {
    const identity = {
        division: clean(metadata.division).toUpperCase(),
        code: clean(metadata.code).toUpperCase(),
        sourceFile: normalizeFileName(sourceRow["Source File"]),
        sourceRow: clean(sourceRow["Source Row"]),
        statementStructure: clean(
            sourceRow["Statement Structure"]
        ).toUpperCase(),
        rawSourceValues: clean(
            sourceRow["Raw Source Values"]
        ),
        headerMapping: clean(
            sourceRow["Header Mapping"]
        )
    };

    return crypto
        .createHash("sha256")
        .update(JSON.stringify(identity))
        .digest("hex");
}

function readWorkbookRows(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Extraction master not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames.length) {
        return [];
    }

    return XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { defval: "" }
    );
}

function normalizeRawRow(sourceRow, metadata) {
    const row = createEmptyMasterRow();

    row["Division"] = clean(metadata.division);
    row["BM HQ"] = clean(metadata.bmHQ);
    row["Code"] = clean(metadata.code);
    row["Stockist Name"] = clean(metadata.stockistName);

    for (const column of SOURCE_COLUMNS) {
        row[column] = sourceRow[column] ?? "";
    }

    row["Source Sheet"] = "";

    for (const column of MASTER_COLUMNS) {
        if (
            column.startsWith("Common ") &&
            !VALUE_COLUMNS.includes(column) &&
            Object.prototype.hasOwnProperty.call(sourceRow, column)
        ) {
            row[column] = sourceRow[column] ?? "";
        }
    }

    // Raw extraction never calculates value fields.
    for (const column of VALUE_COLUMNS) {
        row[column] = "";
    }

    row["Record ID"] = createRecordId(sourceRow, metadata);
    row["Match Status"] = "PENDING";

    for (const column of MATCH_COLUMNS.slice(1)) {
        row[column] = "";
    }

    return row;
}

function validateSchema() {
    if (new Set(MASTER_COLUMNS).size !== MASTER_COLUMNS.length) {
        throw new Error("MASTER_COLUMNS contains duplicate names.");
    }

    if (!MASTER_COLUMNS.includes("Record ID")) {
        throw new Error("Record ID is missing from MASTER_COLUMNS.");
    }

    if (!MASTER_COLUMNS.includes("Division") ||
        !MASTER_COLUMNS.includes("Code")) {
        throw new Error("Required portal columns are missing.");
    }
}

async function updatePostgresMaster({
    sourceMasterPath,
    originalName,
    sourceFileName = originalName,
    metadata,
    connectionString = process.env.DATABASE_URL
}) {
    validateSchema();

    if (!sourceMasterPath) {
        throw new Error("sourceMasterPath is required.");
    }

    if (!originalName) {
        throw new Error("originalName is required.");
    }

    if (!connectionString) {
        throw new Error("DATABASE_URL is not set.");
    }

    if (
        !metadata ||
        !clean(metadata.division) ||
        !clean(metadata.code)
    ) {
        throw new Error("Portal Division and Code are required.");
    }

    const expectedFileName = normalizeFileName(sourceFileName);

    const sourceRows = readWorkbookRows(sourceMasterPath);

    const currentFileRows = sourceRows.filter(
        row =>
            normalizeFileName(row["Source File"]) === expectedFileName
    );

    if (!currentFileRows.length) {
        throw new Error(
            `No records for "${originalName}" were found in ${sourceMasterPath}.`
        );
    }

    const normalizedRows = currentFileRows.map(
        row => normalizeRawRow(row, metadata)
    );

    const columns = MASTER_COLUMNS.map(quoteIdentifier);
    const placeholders = MASTER_COLUMNS.map(
        (_, index) => `$${index + 1}`
    );

    const updateColumns = MASTER_COLUMNS.filter(
        column => column !== "Record ID"
    );

    const updateAssignments = updateColumns.map(column => {
        const quoted = quoteIdentifier(column);

        // Preserve all existing calculated values on re-import.
        if (VALUE_COLUMNS.includes(column)) {
            return `${quoted} = COALESCE(NULLIF(current_row.${quoted}, ''), EXCLUDED.${quoted})`;
        }

        // Preserve existing match results and explicit statuses.
        if (MATCH_COLUMNS.includes(column)) {
            return `${quoted} = COALESCE(NULLIF(current_row.${quoted}, ''), EXCLUDED.${quoted})`;
        }

        // Raw evidence and portal metadata follow the latest source row.
        return `${quoted} = EXCLUDED.${quoted}`;
    });

    const sql = `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} AS current_row
            (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (${quoteIdentifier("Record ID")})
        DO UPDATE SET ${updateAssignments.join(", ")}
        RETURNING (xmax = 0) AS inserted
    `;

    const client = new Client({
        connectionString,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false }
    });

    let inserted = 0;
    let updated = 0;

    try {
        await client.connect();
        await client.query("BEGIN");

        for (const row of normalizedRows) {
            const values = MASTER_COLUMNS.map(
                column => dbValue(row[column])
            );

            const result = await client.query(sql, values);

            if (result.rows[0].inserted) {
                inserted++;
            } else {
                updated++;
            }
        }

        await client.query("COMMIT");

        return {
            success: true,
            table: TABLE_NAME,
            sourceFile: originalName,
            sourceRecordsFound: normalizedRows.length,
            inserted,
            updated
        };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // Preserve the original error.
        }

        throw error;
    } finally {
        await client.end();
    }
}

module.exports = {
    updatePostgresMaster
};
