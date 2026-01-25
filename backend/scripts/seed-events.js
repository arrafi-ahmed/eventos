// To run the script in prod server:
// NODE_ENV=production node /home/ticketi-api/htdocs/api.ticketi.online/backend/scripts/seed-events.js

const { Pool } = require("pg");
const path = require("path");
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
const envPath = path.join(__dirname, "..", envFile);
console.log(`Loading environment from: ${envPath}`);

const result = require("dotenv").config({ path: envPath });
if (result.error) {
    console.warn(`Warning: Could not load ${envFile}. Falling back to default environment variables. Error:`, result.error.message);
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASS || ""),
});

const eventNames = [
    "Global Tech Summit", "Music & Arts Festival", "Startup Pitch Night", "Marathon 2026",
    "Cooking Workshop", "Yoga Retreat", "AI Revolution Conference", "Digital Marketing Expo",
    "Blockchain Weekend", "Coding Bootcamp Live", "Photography Masterclass", "E-commerce Expo",
    "Health & Wellness Forum", "Future of Work Seminar", "Indie Game Awards", "Jazz Night Live",
    "Wine Tasting Experience", "Fitness Challenge 2026", "Robotics Competition", "Sustainability Summit",
    "Cosplay Convention", "Night Market Extravaganza"
];

const locations = [
    "New York, USA", "London, UK", "Tokyo, Japan", "Paris, France", "Berlin, Germany",
    "Sydney, Australia", "Singapore", "Dubai, UAE", "Toronto, Canada", "Amsterdam, Netherlands"
];

function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 1000);
}

async function seed() {
    const client = await pool.connect();
    try {
        console.log("Starting seeding...");

        // 1. Ensure an organization exists
        let orgResult = await client.query("SELECT id FROM organization LIMIT 1");
        let organizationId;
        if (orgResult.rows.length === 0) {
            console.log("Creating default organization...");
            const newOrg = await client.query(
                "INSERT INTO organization (name, location) VALUES ($1, $2) RETURNING id",
                ["Default Organization", "Global Headquarters"]
            );
            organizationId = newOrg.rows[0].id;
        } else {
            organizationId = orgResult.rows[0].id;
        }

        // 2. Clear existing events with these names to avoid duplication or mixed creators
        await client.query("DELETE FROM event WHERE name = ANY($1)", [eventNames]);

        // 3. Find the first organizer account (role 30)
        const organizerResult = await client.query("SELECT id FROM app_user WHERE role = 30 ORDER BY id ASC LIMIT 1");

        if (organizerResult.rows.length === 0) {
            throw new Error("No organizer account (role 30) found in app_user table. Please create/set an organizer first.");
        }

        const creatorId = organizerResult.rows[0].id;
        console.log(`Using organizer ID: ${creatorId} for all events.`);

        for (let i = 0; i < eventNames.length; i++) {
            const name = eventNames[i];
            const description = `This is a dummy description for ${name}. Join us for an amazing experience!`;
            const location = locations[Math.floor(Math.random() * locations.length)];
            const slug = generateSlug(name);
            const currency = "USD";

            // Dates in future: 1 to 12 months from now
            const startDays = 30 + (i * 15);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + startDays);

            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 4); // 4 hours duration

            const defaultConfig = {
                maxTicketsPerRegistration: 10,
                allowMultipleRegistrations: true,
                saveAllAttendeesDetails: true,
                isSingleDayEvent: false,
                enableAbandonedCartEmails: false,
                enableMerchandiseShop: false
            };

            const status = (i >= eventNames.length - 2) ? 'draft' : 'published';

            const sql = `
                INSERT INTO event (
                    name, description, location, slug, currency, 
                    start_datetime, end_datetime, status, 
                    organization_id, created_by, registration_count, config
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `;

            await client.query(sql, [
                name, description, location, slug, currency,
                startDate.toISOString(), endDate.toISOString(), status,
                organizationId, creatorId, 0, JSON.stringify(defaultConfig)
            ]);

            console.log(`Inserted event: ${name} (${status})`);
        }

        console.log("Seeding completed successfully!");
    } catch (err) {
        console.error("Error during seeding:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
