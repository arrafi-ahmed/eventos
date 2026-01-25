const router = require("express").Router();
const { auth } = require("../middleware/auth");
const ApiResponse = require("../model/ApiResponse");
const CustomError = require("../model/CustomError");
const appUserService = require("../service/appUser");
const { hash, compare } = require("bcrypt");

const formatUser = (user) => ({
    id: user.id,
    fullName: user.full_name || user.fullName,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id || user.organizationId,
    id_document: user.id_document || user.idDocument,
    verification_status: user.verification_status || user.verificationStatus,
    rejection_reason: user.rejection_reason || user.rejectionReason,
});

router.put("/", auth, async (req, res, next) => {
    try {
        const { fullName, email, newPassword, currentPassword } = req.body;

        const updates = {};
        if (typeof fullName === "string" && fullName.trim() !== "") {
            updates.fullName = fullName.trim();
        }

        if (typeof email === "string" && email.trim() !== "") {
            updates.email = email.trim();
        }

        if (typeof newPassword === "string" && newPassword.trim() !== "") {
            updates.password = newPassword.trim();
        }

        if (Object.keys(updates).length === 0) {
            throw new CustomError("Provide at least one field to update", 400);
        }

        const user = await appUserService.getUserById({ userId: req.currentUser.id });

        const requiresPasswordCheck = Boolean(updates.password) || (updates.email && updates.email !== user.email);
        if (requiresPasswordCheck) {
            if (!currentPassword) {
                throw new CustomError("Current password is required to update sensitive information", 400);
            }

            const matches = await compare(currentPassword, user.password);
            if (!matches) {
                throw new CustomError("Current password is incorrect", 401);
            }
        }

        if (updates.password) {
            if (updates.password.length < 6) {
                throw new CustomError("New password must be at least 6 characters", 400);
            }
            updates.password = await hash(updates.password, 10);
        }

        const updatedUser = await appUserService.updateProfile({
            userId: user.id,
            updates,
        });

        res
            .status(200)
            .json(new ApiResponse("Profile updated successfully", { currentUser: formatUser(updatedUser) }));
    } catch (err) {
        next(err);
    }
});

router.delete("/", auth, async (req, res, next) => {
    try {
        const { currentPassword } = req.body || {};

        if (!currentPassword) {
            throw new CustomError("Current password is required to delete your profile", 400);
        }

        const user = await appUserService.getUserById({ userId: req.currentUser.id });
        const matches = await compare(currentPassword, user.password);

        if (!matches) {
            throw new CustomError("Current password is incorrect", 401);
        }

        try {
            await appUserService.deleteUserById({ userId: user.id });
        } catch (error) {
            if (error.code === "23503") {
                throw new CustomError("Account cannot be deleted because it is linked to other records.", 409);
            }
            throw error;
        }

        res.status(200).json(new ApiResponse("Account deleted successfully", {}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

