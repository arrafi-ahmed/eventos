const { query } = require("../db");
const CustomError = require("../model/CustomError");
const { hash } = require("bcrypt");

exports.save = async ({ payload }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const { id, ...userData } = payload;

    // Validate required fields (email is always required)
    if (!userData.email || !userData.email.trim()) {
        throw new CustomError("Email is required", 400);
    }

    // Role validation
    const role = userData.role ? parseInt(userData.role, 10) : 30;
    if (![20, 30, 40, 50, 60].includes(role)) {
        throw new CustomError("Invalid role! Supported roles are admin (20), organizer (30), attendee (40), cashier (50), and check-in agent (60).", 400);
    }

    // Organization validation
    if ([30, 50, 60].includes(role)) {
        if (!userData.organizationId) {
            throw new CustomError("Organization ID is required for this role", 400);
        }
    } else {
        userData.organizationId = null;
    }

    userData.role = role;

    try {
        if (id) {
            // Update existing user
            let hashedPassword = null;
            if (userData.password && userData.password.trim()) {
                hashedPassword = await hash(userData.password, 10);
            }

            const fields = [
                'full_name = $2',
                'email = $3',
                'role = $4',
                'organization_id = $5'
            ];
            const values = [
                id,
                userData.fullName,
                userData.email,
                userData.role,
                userData.organizationId
            ];

            let paramIndex = 6;
            if (hashedPassword) {
                fields.push(`password = $${paramIndex}`);
                values.push(hashedPassword);
            }

            const sql = `
                UPDATE app_user
                SET ${fields.join(', ')}
                WHERE id = $1
                RETURNING *
            `;

            const result = await query(sql, values);

            if (!result.rows[0]) {
                throw new CustomError("Failed to update user or user not found", 404); // Changed to 404 if not found
            }

            return result.rows[0];

        } else {
            // Create new user (Password IS required)
            if (!userData.password || !userData.password.trim()) {
                throw new CustomError("Password is required for new users", 400);
            }

            const hashedPassword = await hash(userData.password, 10);

            const sql = `
                INSERT INTO app_user (full_name, email, password, role, organization_id, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
            `;
            const values = [
                userData.fullName,
                userData.email,
                hashedPassword,
                userData.role,
                userData.organizationId,
            ];
            const result = await query(sql, values);

            if (!result.rows[0]) {
                throw new CustomError("Failed to create user", 500);
            }

            return result.rows[0];
        }
    } catch (err) {
        if (err.code === "23505") {
            throw new CustomError("Email already in use", 400);
        }
        throw err;
    }
};

exports.updateUser = async ({ id, userData }) => {
    if (!id) {
        throw new CustomError("User ID is required", 400);
    }

    if (!userData) {
        throw new CustomError("User data is required", 400);
    }

    const sql = `
        UPDATE app_user
        SET full_name = $2,
            email     = $3,
            password  = $4,
            role      = $5,
            organization_id   = $6
        WHERE id = $1 RETURNING *
    `;
    const values = [
        id,
        userData.fullName,
        userData.email,
        userData.password,
        userData.role,
        userData.organizationId,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("User not found", 404);
    }

    return result.rows[0];
};

exports.saveUser = async ({ userData }) => {
    if (!userData) {
        throw new CustomError("User data is required", 400);
    }

    const sql = `
        INSERT INTO app_user (full_name, email, password, role, organization_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [
        userData.fullName,
        userData.email,
        userData.password,
        userData.role,
        userData.organizationId,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create user", 500);
    }

    return result.rows[0];
};

exports.getUserByEmail = async ({ email }) => {
    if (!email || !email.trim()) {
        throw new CustomError("Email is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE email = $1
    `;
    const result = await query(sql, [email]);
    return result.rows[0];
};

exports.getUserById = async ({ userId }) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE id = $1
    `;
    const result = await query(sql, [userId]);

    if (!result.rows[0]) {
        throw new CustomError("User not found", 404);
    }

    return result.rows[0];
};

// Get all users for an organization
exports.getUsers = async ({ organizationId }) => {
    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE organization_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [organizationId]);
    return result.rows;
};

// Get app users for an organization by organizationId (for admin dashboard)
// Returns users with role 30, 50, 60 as they belong to organizations
exports.getAppUsers = async ({ organizationId }) => {
    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        SELECT id, email, password, role, organization_id, full_name, created_at
        FROM app_user
        WHERE organization_id = $1 AND role IN (30, 50, 60)
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [organizationId]);
    return { appUsers: result.rows };
};

// Remove user
exports.removeUser = async ({ userId, organizationId }) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    // Check if the user is an organizer (role 30)
    const checkUserSql = `SELECT role FROM app_user WHERE id = $1 AND organization_id = $2`;
    const userResult = await query(checkUserSql, [userId, organizationId]);

    if (!userResult.rows[0]) {
        throw new CustomError("User not found or access denied", 404);
    }

    const { role } = userResult.rows[0];

    // If user is an organizer, check if they are the last one
    if (role === 30) {
        const countSql = `SELECT COUNT(*) FROM app_user WHERE organization_id = $1 AND role = 30`;
        const countResult = await query(countSql, [organizationId]);
        const organizerCount = parseInt(countResult.rows[0].count, 10);

        if (organizerCount <= 1) {
            throw new CustomError("Cannot remove the last organizer from the organization", 400);
        }
    }

    const sql = `
        DELETE FROM app_user
        WHERE id = $1 AND organization_id = $2
        RETURNING *
    `;
    const result = await query(sql, [userId, organizationId]);

    if (!result.rows[0]) {
        throw new CustomError("User not found or access denied", 404);
    }

    return result.rows[0];
};

exports.updateProfile = async ({ userId, updates }) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    if (!updates || Object.keys(updates).length === 0) {
        throw new CustomError("No updates provided", 400);
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (Object.prototype.hasOwnProperty.call(updates, "fullName")) {
        fields.push(`full_name = $${index++}`);
        values.push(updates.fullName);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "email")) {
        fields.push(`email = $${index++}`);
        values.push(updates.email);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "password")) {
        fields.push(`password = $${index++}`);
        values.push(updates.password);
    }

    if (fields.length === 0) {
        throw new CustomError("No valid fields to update", 400);
    }

    values.push(userId);

    const sql = `
        UPDATE app_user
        SET ${fields.join(", ")}
        WHERE id = $${index}
        RETURNING id,
                  full_name,
                  email,
                  role,
                  organization_id,
                  verification_status,
                  id_document,
                  rejection_reason
    `;

    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("User not found", 404);
    }

    return result.rows[0];
};

exports.deleteUserById = async ({ userId }) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const sql = `
        DELETE FROM app_user
        WHERE id = $1
    `;

    const result = await query(sql, [userId]);
    return result.rowCount;
};
