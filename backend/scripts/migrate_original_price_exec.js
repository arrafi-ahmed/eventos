const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const { query } = require('../src/db');

async function migrate() {
    try {
        console.log('Migrating ticket table for original_price...');

        await query(`ALTER TABLE ticket ADD COLUMN IF NOT EXISTS original_price DECIMAL(20, 2) DEFAULT NULL;`);

        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
