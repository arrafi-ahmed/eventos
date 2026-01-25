const { query } = require("../db");
const jwt = require("jsonwebtoken");
const CustomError = require("../model/CustomError");
const organizationService = require("./organization");
const appUserService = require("./appUser");
const { hash, compare } = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const emailService = require("./email");

const generateAuthData = async (user) => {
    // Check if user has staff assignments that might give them a "higher" effective role
    // Role 40 is Attendee (lowest), 30 is Organizer, 50 is Cashier, 60 is Staff
    let effectiveRole = user.role;
    let organizationId = user.organizationId;

    if (Number(user.role) === 40) {
        // Find if they have any staff assignment
        const staffSql = `
            SELECT role, organization_id 
            FROM event_staff 
            WHERE user_id = $1 
            ORDER BY role ASC -- 50 (Cashier) is lower than 60 (Staff) in ID but both are staff roles
            LIMIT 1
        `;
        const staffResult = await query(staffSql, [user.id]);
        if (staffResult.rows.length > 0) {
            effectiveRole = staffResult.rows[0].role;
            organizationId = staffResult.rows[0].organizationId;
        }
    }

    // Note: DB wrapper converts snake_case to camelCase, so user object has camelCase fields
    const userObj = {
        id: user.id,
        email: user.email,
        role: Number(effectiveRole),
        roleId: Number(effectiveRole), // Add as alias for robustness
        organizationId: organizationId,
        fullName: user.fullName || user.full_name,
        full_name: user.fullName || user.full_name, // Include both
        // Return snake_case to match frontend expectations
        id_document: user.idDocument || user.id_document,
        verification_status: user.verificationStatus || user.verification_status,
        rejection_reason: user.rejectionReason || user.rejection_reason,
        timezone: user.timezone,
    };
    let redirect = "/";
    if (Number(effectiveRole) === 20) redirect = "/admin/dashboard";
    else if (Number(effectiveRole) === 30) redirect = "/organizer/dashboard";
    else if (Number(effectiveRole) === 40) redirect = "/my-tickets";
    else if (Number(effectiveRole) === 50) redirect = "/counter/shift-start";
    else if (Number(effectiveRole) === 60) redirect = "/staff/checkin";

    const token = jwt.sign(
        { currentUser: userObj },
        process.env.TOKEN_SECRET,
        { expiresIn: '24h' }
    );

    return {
        token,
        currentUser: userObj,
        redirect,
    };
};

exports.getCurrentUser = async ({ currentUser }) => {
    if (!currentUser || !currentUser.id) {
        throw new CustomError("User not authenticated", 401);
    }

    const user = await appUserService.getUserById({ userId: currentUser.id });
    if (!user) {
        throw new CustomError("User not found", 404);
    }

    // Role resolution (similar to generateAuthData)
    let effectiveRole = user.role;
    let organizationId = user.organizationId;

    if (Number(user.role) === 40) {
        const staffSql = `
            SELECT role, organization_id 
            FROM event_staff 
            WHERE user_id = $1 
            ORDER BY role ASC 
            LIMIT 1
        `;
        const staffResult = await query(staffSql, [user.id]);
        if (staffResult.rows.length > 0) {
            effectiveRole = staffResult.rows[0].role;
            organizationId = staffResult.rows[0].organizationId;
        }
    }

    // Return user data in the same format as generateAuthData
    // Note: DB wrapper already converts snake_case to camelCase
    return {
        id: user.id,
        email: user.email,
        role: Number(effectiveRole),
        organizationId: organizationId,
        fullName: user.fullName,
        id_document: user.idDocument,
        verification_status: user.verificationStatus,
        rejection_reason: user.rejectionReason,
        timezone: user.timezone,
    };
};

exports.updateUserTimezone = async ({ userId, timezone }) => {
    if (!timezone) return;
    const sql = `UPDATE app_user SET timezone = $1 WHERE id = $2`;
    await query(sql, [timezone, userId]);
};

exports.signin = async ({ email, password }) => {
    const user = await appUserService.getUserByEmail({ email });

    if (!user?.email) {
        throw new CustomError("User not found!", 401);
    }
    const isPasswordValid = await compare(password, user.password); // Compare hashed password

    if (!isPasswordValid) {
        throw new CustomError("Incorrect email/password!", 401);
    }

    // Update timezone if provided
    if (email && password && arguments[0].timezone) {
        await exports.updateUserTimezone({ userId: user.id, timezone: arguments[0].timezone });
        user.timezone = arguments[0].timezone;
    }

    return await generateAuthData(user);
};

exports.register = async ({ payload }) => {
    // Validate role - must be organizer (30) or attendee (40)
    const validRoles = [30, 40];
    const userRole = payload.role || 30; // Default to organizer if not provided

    if (!validRoles.includes(userRole)) {
        throw new CustomError("Invalid role! Role must be organizer (30) or attendee (40)", 400);
    }

    //create organization (only for organizers, attendees might not need an organization)
    let savedOrganization = null;
    if (userRole === 30) {
        const newOrganization = {
            name: payload.fullName,
        };
        savedOrganization = await organizationService.save({ payload: newOrganization });
    }

    const newUser = {
        ...payload,
        organizationId: savedOrganization?.id || null,
        password: await hash(payload.password, 10),
        role: userRole,
    };

    let upsertedUser = null;
    try {
        const sql = `
            INSERT INTO app_user (full_name, email, password, organization_id, role, timezone)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `;
        const values = [
            newUser.fullName,
            newUser.email,
            newUser.password,
            newUser.organizationId,
            newUser.role,
            payload.timezone || null,
        ];
        const result = await query(sql, values);
        upsertedUser = result.rows[0];
    } catch (err) {
        if (err.code === "23505") {
            if (savedOrganization?.id) {
                await organizationService.deleteOrganization({ organizationId: savedOrganization.id });
            }
            throw new CustomError("Email already taken!", 409);
        } else throw err;
    }
    // Return auth data for auto-login after registration
    return await generateAuthData(upsertedUser);
};

exports.savePasswordResetRequest = async ({ email, token }) => {
    const sql = `
        INSERT INTO password_reset_requests (email, token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW()) RETURNING *
    `;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const result = await query(sql, [email, token, expiresAt]);
    return result.rows[0];
};

exports.validateResetToken = async ({ token }) => {
    const sql = `
        SELECT *
        FROM password_reset_requests
        WHERE token = $1
          AND expires_at > NOW()
          AND used = false
    `;
    const result = await query(sql, [token]);
    return result.rows[0];
};

exports.forgotPassword = async ({ payload }) => {
    const { email } = payload;
    if (!email) {
        throw new CustomError("Email is required", 400);
    }

    const user = await appUserService.getUserByEmail({ email });
    if (!user) {
        // We don't want to leak if the email exists, but for this app's context, 
        // usually we might just say "if it exists, we sent it".
        // Returning success anyway to prevent enumeration.
        return { success: true };
    }

    const token = uuidv4();
    await exports.savePasswordResetRequest({ email, token });

    // Send email
    await emailService.sendPasswordReset({ to: email, token }).catch(err => {
        console.error("Failed to send reset email:", err);
    });

    return { success: true };
};

exports.resetPassword = async ({ payload }) => {
    const { token, password } = payload;
    if (!token || !password) {
        throw new CustomError("Token and password are required", 400);
    }

    const request = await exports.validateResetToken({ token });
    if (!request) {
        throw new CustomError("Invalid or expired reset token", 400);
    }

    const hashedPassword = await hash(password, 10);
    const updateSql = `UPDATE app_user SET password = $1 WHERE email = $2`;
    await query(updateSql, [hashedPassword, request.email]);

    // Mark token as used
    const markUsedSql = `UPDATE password_reset_requests SET used = true WHERE id = $1`;
    await query(markUsedSql, [request.id]);

    return { success: true };
};
