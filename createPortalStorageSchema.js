const pool = require("./services/postgresPool");

async function createPortalStorageSchema() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            CREATE TABLE IF NOT EXISTS portal_stockist_metadata (
                division TEXT NOT NULL,
                code TEXT NOT NULL,
                stockist_name TEXT NOT NULL DEFAULT '',
                sales TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (division, code)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS portal_uploaded_files (
                file_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                division TEXT NOT NULL,
                code TEXT NOT NULL,
                statement_type TEXT NOT NULL
                    CHECK (statement_type IN ('AWS', 'SSS')),
                original_filename TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
                file_size_bytes BIGINT NOT NULL
                    CHECK (file_size_bytes >= 0),
                file_data BYTEA NOT NULL,
                state TEXT NOT NULL DEFAULT 'General',
                uploaded_by TEXT NOT NULL DEFAULT '',
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_portal_uploaded_files_stockist
                    FOREIGN KEY (division, code)
                    REFERENCES portal_stockist_metadata (division, code)
                    ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_portal_uploaded_files_stockist_type
            ON portal_uploaded_files (division, code, statement_type)
        `);

        await client.query("COMMIT");

        console.log("Portal storage schema created successfully.");
        console.log("Existing statement_extraction_master was not modified.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("PORTAL STORAGE SCHEMA ERROR:", error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createPortalStorageSchema().catch(() => {
    process.exitCode = 1;
});
