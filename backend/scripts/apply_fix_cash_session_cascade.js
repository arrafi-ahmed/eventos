const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const { query } = require('../src/db');

async function migrate() {
    try {
        console.log('Applying migration: Fix Cash Session Event Cascade...');

        const migrationPath = path.join(__dirname, '../migration/2026-01-21_15:00_fix_cash_session_event_cascade.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await query(sql);

        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
