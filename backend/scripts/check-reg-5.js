const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.development") });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
});

async function checkOrder() {
    const res = await pool.query("SELECT id, registration_id, items_ticket, items_product FROM orders WHERE registration_id = 5;");
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
}

checkOrder();
