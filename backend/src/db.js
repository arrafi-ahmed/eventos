const {Pool} = require("pg");

const {DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, NODE_ENV} = process.env;

const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: DB_NAME,
    password: DB_PASS,
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map((item) => toCamelCase(item));
    }
    if (obj !== null && typeof obj === "object") {
        // Handle Date objects specially
        if (obj instanceof Date) {
            return obj;
        }
        const newObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const camelKey = key.replace(/_([a-z])/g, (match, letter) =>
                    letter.toUpperCase(),
                );
                newObj[camelKey] = toCamelCase(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};

// Wrapper function that automatically converts results
const query = async (text, params) => {
    const result = await pool.query(text, params);
    return {
        ...result,
        rows: toCamelCase(result.rows),
        rowCount: result.rowCount,
    };
};

// Test the connection
pool.on("connect", (client) => {
    // Ensure all timestamps in this session use UTC
    client.query("SET TIME ZONE 'UTC'").catch(() => {
    });
});

pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
});

module.exports = {pool, query};
