
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.warn(
        "DATABASE_URL is not set. PostgreSQL queries will fail until it is configured."
    );
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Matches the SSL configuration used by the existing
    // PostgreSQL connection and adapter tests.
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : undefined,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
