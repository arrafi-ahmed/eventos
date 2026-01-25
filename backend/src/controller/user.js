const router = require("express").Router();
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager } = require("../middleware/auth");
const { query } = require("../db");

// Get cashiers (users with cashier role) for the organization
router.get("/cashiers", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const organizationId = req.query.organizationId || req.currentUser.organizationId;
        const search = req.query.search || '';

        let sql = `
            SELECT 
                u.id,
                u.email,
                u.full_name,
                u.role
            FROM app_user u
            WHERE u.organization_id = $1
            AND u.role IN (50, 30, 20)
        `;

        const params = [organizationId];

        if (search) {
            sql += ` AND (u.full_name ILIKE $2 OR u.email ILIKE $2)`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY u.full_name ASC`;

        const result = await query(sql, params);
        res.status(200).json(new ApiResponse(null, result.rows));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
