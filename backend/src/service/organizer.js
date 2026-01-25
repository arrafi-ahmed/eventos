const {query} = require("../db");
const CustomError = require("../model/CustomError");
const path = require("path");
const fs = require("fs");

exports.uploadIdDocument = async ({userId, filename}) => {
    if (!userId || !filename) {
        throw new CustomError("User ID and filename are required", 400);
    }

    // Get current user to delete old document if exists
    const getUserSql = `SELECT id_document FROM app_user WHERE id = $1`;
    const userResult = await query(getUserSql, [userId]);

    if (userResult.rows.length === 0) {
        throw new CustomError("User not found", 404);
    }

    const oldDocument = userResult.rows[0].id_document;

    // Update user with new document and reset verification status
    const updateSql = `
        UPDATE app_user 
        SET id_document = $1, 
            verification_status = 'pending',
            verified_by = NULL,
            verified_at = NULL,
            rejection_reason = NULL
        WHERE id = $2
        RETURNING *
    `;
    const result = await query(updateSql, [filename, userId]);

    // Delete old document if exists
    if (oldDocument) {
        const oldDocumentPath = path.join(__dirname, '../../public/id-document', oldDocument);
        if (fs.existsSync(oldDocumentPath)) {
            try {
                fs.unlinkSync(oldDocumentPath);
            } catch (error) {
                console.error("Error deleting old document:", error);
            }
        }
    }

    return result.rows[0];
};

