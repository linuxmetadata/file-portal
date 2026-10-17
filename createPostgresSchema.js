
const { Client } = require("pg");
const { MASTER_COLUMNS } = require("./services/masterSchema");

const TABLE_NAME = "statement_extraction_master";

function quoteIdentifier(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
}

async function createSchema() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set.");
    }

    if (!MASTER_COLUMNS.includes("Record ID")) {
        throw new Error("Record ID is missing from MASTER_COLUMNS.");
    }

    if (new Set(MASTER_COLUMNS).size !== MASTER_COLUMNS.length) {
        throw new Error("MASTER_COLUMNS contains duplicate names.");
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        const definitions = MASTER_COLUMNS.map(column => {
            const name = quoteIdentifier(column);

            if (column === "Record ID") {
                return `${name} TEXT PRIMARY KEY`;
            }

            return `${name} TEXT`;
        });

        const sql = `
            CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
                ${definitions.join(",\n")}
            )
        `;

        await client.query(sql);

        const result = await client.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
             ORDER BY ordinal_position`,
            [TABLE_NAME]
        );

        const actualColumns = result.rows.map(
            row => row.column_name
        );

        const missingColumns = MASTER_COLUMNS.filter(
            column => !actualColumns.includes(column)
        );

        if (missingColumns.length > 0) {
            throw new Error(
                `Schema verification failed. Missing columns: ${missingColumns.join(", ")}`
            );
        }

        console.log("SUCCESS: PostgreSQL table is ready.");
        console.log("Table:", TABLE_NAME);
        console.log("Expected master columns:", MASTER_COLUMNS.length);
        console.log("Actual table columns:", actualColumns.length);
        console.log("Existing records were not imported or modified.");
    } finally {
        await client.end();
    }
}

createSchema().catch(error => {
    console.error("SCHEMA CREATION FAILED:", error.message);
    process.exitCode = 1;
});
