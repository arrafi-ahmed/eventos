const dotenv = require("dotenv");
const path = require("path");

// Load env variables BEFORE requiring db
dotenv.config({ path: path.join(__dirname, "../.env.development") });

const { pool } = require("../src/db");

async function checkDuplicates() {
    try {
        console.log("Checking for duplicate emails in app_user...");
        const res = await pool.query(`
            SELECT email, COUNT(*) 
            FROM app_user 
            GROUP BY email 
            HAVING COUNT(*) > 1
        `);

        if (res.rows.length > 0) {
            console.log("DUPLICATES FOUND:");
            console.table(res.rows);

            for (const row of res.rows) {
                const details = await pool.query(`SELECT id, email, role, organization_id, full_name FROM app_user WHERE email = $1`, [row.email]);
                console.log(`Details for ${row.email}:`);
                console.table(details.rows);
            }
        } else {
            console.log("No duplicate emails found in app_user table.");
        }

        const constraintRes = await pool.query(`
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = 'app_user'::regclass AND contype IN ('u', 'p')
        `);
        console.log("\nConstraints on app_user:");
        console.table(constraintRes.rows);

    } catch (err) {
        console.error("Error checking duplicates:", err);
    } finally {
        await pool.end();
    }
}

checkDuplicates();
