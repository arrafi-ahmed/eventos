const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const { query } = require('../src/db');

async function migrate() {
    try {
        console.log('Migrating ticket table for early bird pricing...');

        await query(`ALTER TABLE ticket ADD COLUMN IF NOT EXISTS sale_start_date TIMESTAMP;`);
        await query(`ALTER TABLE ticket ADD COLUMN IF NOT EXISTS sale_end_date TIMESTAMP;`);

        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
