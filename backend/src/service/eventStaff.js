const { query } = require("../db");
const CustomError = require("../model/CustomError");
const appUserService = require("./appUser");

exports.assignStaff = async ({ eventId, userId, role, organizationId }) => {
    if (!eventId || !userId || !role) {
        throw new CustomError("Event ID, User ID, and Role are required", 400);
    }

    if (![50, 60].includes(parseInt(role))) {
        throw new CustomError("Invalid role. Must be 50 (Cashier) or 60 (Check-in)", 400);
    }

    const sql = `
        INSERT INTO event_staff (event_id, user_id, role, organization_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (event_id, user_id) DO UPDATE SET 
            role = EXCLUDED.role,
            organization_id = EXCLUDED.organization_id
        RETURNING *;
    `;
    const result = await query(sql, [eventId, userId, role, organizationId]);
    return result.rows[0];
};

exports.createAndAssignStaff = async ({ email, password, fullName, role, eventId, organizationId }) => {
    if (!email || !password || !role || !eventId || !organizationId) {
        throw new CustomError("Email, Password, Role, Event ID, and Organization ID are required", 400);
    }

    // 1. Check if user exists
    let user = await appUserService.getUserByEmail({ email });

    if (!user) {
        // 2. Create user if doesn't exist
        user = await appUserService.save({
            payload: {
                email,
                password, // appUserService.save handles hashing
                fullName: fullName || email.split('@')[0],
                role: parseInt(role),
                organizationId
            }
        });
    }

    // 3. Assign to event
    return await exports.assignStaff({
        eventId,
        userId: user.id,
        role: parseInt(role),
        organizationId
    });
};

exports.removeStaff = async ({ eventId, userId, role }) => {
    const sql = `
        DELETE FROM event_staff
        WHERE event_id = $1 AND user_id = $2 AND role = $3
        RETURNING *;
    `;
    const result = await query(sql, [eventId, userId, role]);
    return result.rows[0];
};

exports.getStaffByEventId = async ({ eventId }) => {
    const sql = `
        SELECT es.*, u.full_name, u.email, u.role as user_role
        FROM event_staff es
        JOIN app_user u ON es.user_id = u.id
        WHERE es.event_id = $1;
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

exports.getEventsByStaffId = async ({ userId, role }) => {
    let sql = `
        SELECT e.*, es.role as assigned_role
        FROM event e
        JOIN event_staff es ON e.id = es.event_id
        WHERE es.user_id = $1
    `;
    const params = [userId];
    if (role) {
        sql += ` AND es.role = $2`;
        params.push(role);
    }
    const result = await query(sql, params);
    return result.rows;
};

exports.isStaffAssignedToEvent = async ({ userId, eventId, role }) => {
    let sql = `
        SELECT id FROM event_staff
        WHERE user_id = $1 AND event_id = $2
    `;
    const params = [userId, eventId];
    if (role) {
        sql += ` AND role = $3`;
        params.push(role);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
};
exports.updateStaff = async ({ eventId, userId, fullName, email, role }) => {
    const { pool } = require("../db");
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Update app_user table
        const updateUserSql = `
            UPDATE app_user 
            SET full_name = $1, email = $2 
            WHERE id = $3
            RETURNING *;
        `;
        const userResult = await client.query(updateUserSql, [fullName, email, userId]);
        if (userResult.rows.length === 0) {
            throw new CustomError("User not found", 404);
        }

        // 2. Update event_staff table
        const updateStaffSql = `
            UPDATE event_staff 
            SET role = $1 
            WHERE event_id = $2 AND user_id = $3
            RETURNING *;
        `;
        const staffResult = await client.query(updateStaffSql, [role, eventId, userId]);
        if (staffResult.rows.length === 0) {
            throw new CustomError("Staff assignment not found", 404);
        }

        await client.query("COMMIT");
        return {
            user: userResult.rows[0],
            staff: staffResult.rows[0]
        };
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
            throw new CustomError("Email already in use", 400);
        }
        throw err;
    } finally {
        client.release();
    }
};
