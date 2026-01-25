const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const { query } = require('../src/db');

async function migrate() {
    try {
        console.log('Migrating orders table columns...');
        // Add columns if they don't exist
        await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50);`);
        await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(20, 2) DEFAULT 0;`);
        await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(20, 2) DEFAULT 0;`);

        // Alter existing columns to higher precision (safe to run multiple times)
        console.log('Updating column precision...');
        await query(`ALTER TABLE orders ALTER COLUMN total_amount TYPE DECIMAL(20, 2);`);
        await query(`ALTER TABLE orders ALTER COLUMN discount_amount TYPE DECIMAL(20, 2);`);
        await query(`ALTER TABLE orders ALTER COLUMN tax_amount TYPE DECIMAL(20, 2);`);

        // Check if shipping_cost exists before altering (it should, but safety first)
        try {
            await query(`ALTER TABLE orders ALTER COLUMN shipping_cost TYPE DECIMAL(20, 2);`);
        } catch (e) { console.log('shipping_cost column update skipped or failed', e.message); }

        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
