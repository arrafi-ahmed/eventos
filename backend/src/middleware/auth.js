const jwt = require("jsonwebtoken");
const { getEventByEventIdnOrganizationId } = require("../service/event");
const { ifAdmin, ifOrganizer, ifCashier, ifCheckInAgent, HTTP_STATUS } = require("../utils/common");
const ApiResponse = require("../model/ApiResponse");
const { query } = require("../db");

const auth = (req, res, next) => {
    const token = req.header("authorization");
    if (!token) {
        return res.status(401).json(new ApiResponse('Access denied'));
    }
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        req.currentUser = decoded.currentUser;
        next();
    } catch (error) {
        if (error?.name === 'TokenExpiredError') {
            return res.status(HTTP_STATUS.TOKEN_EXPIRED).json(new ApiResponse('Token expired, Please login again!'));
        }
        return res.status(401).json(new ApiResponse('Invalid token'));
    }
};

const isAdmin = (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    try {
        if (ifAdmin(currentUser.role)) return next();
        return res.status(403).json(new ApiResponse('Access denied - Admin role required'));
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isOrganizer = (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    try {
        if (ifOrganizer(currentUser.role)) return next();
        return res.status(403).json(new ApiResponse('Access denied - Organizer role required'));
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAdminOrOrganizer = (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    try {
        if (ifAdmin(currentUser.role) || ifOrganizer(currentUser.role)) {
            return next();
        }
        return res.status(403).json(new ApiResponse('Access denied - Admin or Organizer role required'));
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isOrganizerEventAuthor = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifAdmin(currentUser.role)) return next();

    const eventId =
        req.query?.eventId || req.query?.event?.id || req.body?.eventId || req.body?.event?.id || req.body?.payload?.eventId;

    const organizationId = currentUser.organizationId;

    try {
        const event = await getEventByEventIdnOrganizationId({
            eventId,
            organizationId,
            currentUser,
        });
        if (!event || !event.id) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isOrganizationManager = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifAdmin(currentUser.role)) return next();

    // Check if user is organizer (role = 30)
    if (!ifOrganizer(currentUser.role)) {
        return res.status(401).json(new ApiResponse('Access denied - Organizer role required'));
    }

    const inputOrganizationId =
        req.query?.organizationId || req.body?.organizationId || req.body?.payload?.organizationId || req.headers['x-organization-id'];

    const organizationId = currentUser.organizationId;
    try {
        if (inputOrganizationId && organizationId && inputOrganizationId.toString() !== organizationId.toString()) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }

        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isOrganizationMember = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifAdmin(currentUser.role)) return next();

    // Check if user is organizer, cashier, or check-in agent
    if (!ifOrganizer(currentUser.role) && !ifCashier(currentUser.role) && !ifCheckInAgent(currentUser.role)) {
        return res.status(401).json(new ApiResponse('Access denied - Organization role required'));
    }

    const inputOrganizationId =
        req.query?.organizationId || req.body?.organizationId || req.body?.payload?.organizationId || req.headers['x-organization-id'];

    const organizationId = currentUser.organizationId;
    try {
        // If specific organization requested, must match user's organization
        if (inputOrganizationId && inputOrganizationId != organizationId) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }

        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAuthenticated = (req, res, next) => {
    try {
        const token = req.header("authorization");
        if (!token) throw new Error();
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        req.currentUser = decoded.currentUser;
        req.isLoggedIn = true;
    } catch (error) {
        req.isLoggedIn = false;
    } finally {
        next();
    }
};

// Middleware to check if user is authorized to manage products
const isOrganizerProductAuthor = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifAdmin(currentUser.role)) return next();

    const productId = req.query?.productId || req.body?.productId || req.headers['x-product-id'];
    const organizationId = currentUser.organizationId;

    // Import product service dynamically to avoid circular dependency
    const productService = require('../service/product');

    try {
        const isOwned = await productService.isProductOwnedByOrganization({ productId, organizationId });
        if (!isOwned) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

// Middleware to check if organizer is verified (for event publishing and other sensitive operations)
const isOrganizerVerified = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }

    // Admins don't need verification
    if (ifAdmin(currentUser.role)) {
        return next();
    }

    // Only check verification for organizers
    if (ifOrganizer(currentUser.role)) {
        try {
            const userSql = `SELECT verification_status FROM app_user WHERE id = $1`;
            const userResult = await query(userSql, [currentUser.id]);

            if (userResult.rows.length === 0) {
                return res.status(404).json(new ApiResponse('User not found'));
            }

            const verificationStatus = userResult.rows[0].verificationStatus;
            if (verificationStatus !== 'approved') {
                return res.status(403).json(new ApiResponse('You must verify your identity before publishing events. Please upload your ID document and wait for admin approval.'));
            }
        } catch (error) {
            console.error('Error checking organizer verification:', error);
            return res.status(500).json(new ApiResponse('Error checking verification status'));
        }
    }

    next();
};

const isAuthorizedStaff = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifAdmin(currentUser.role)) return next();

    const eventId =
        req.query?.eventId || req.query?.event?.id || req.body?.eventId || req.body?.event?.id || req.body?.payload?.eventId;

    if (!eventId) {
        return res.status(400).json(new ApiResponse('Event ID is required'));
    }

    // Organizers can see any event in their organization
    if (ifOrganizer(currentUser.role)) {
        try {
            const event = await getEventByEventIdnOrganizationId({
                eventId,
                organizationId: currentUser.organizationId,
                currentUser,
            });
            if (event && event.id) return next();
        } catch (error) {
            // fall through to staff check
        }
    }

    // Staff check: must be assigned to this specific event
    try {
        const { isStaffAssignedToEvent } = require("../service/eventStaff");
        const isAssigned = await isStaffAssignedToEvent({
            userId: currentUser.id,
            eventId,
        });
        if (isAssigned) return next();
    } catch (error) {
        console.error('Staff authorization check failed:', error);
    }

    return res.status(403).json(new ApiResponse('Access denied - Unauthorized staff member'));
};

module.exports = {
    auth,
    isAdmin,
    isOrganizer,
    isAdminOrOrganizer,
    isAuthenticated,
    isOrganizerEventAuthor,
    isAuthorizedStaff,
    isOrganizationManager,
    isOrganizerProductAuthor,
    isOrganizerVerified,
    isOrganizationMember,
    // Keep old names for backward compatibility during migration        
};
