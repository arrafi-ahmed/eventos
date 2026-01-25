const { query } = require("../db");
const CustomError = require("../model/CustomError");
const stripeService = require("./stripe");

exports.save = async ({ payload }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const { id, ...sponsorshipData } = payload;

    // Validate required fields
    if (
        !sponsorshipData.sponsorData?.firstName ||
        !sponsorshipData.sponsorData.firstName.trim()
    ) {
        throw new CustomError("Sponsor first name is required", 400);
    }

    if (
        !sponsorshipData.sponsorData?.lastName ||
        !sponsorshipData.sponsorData.lastName.trim()
    ) {
        throw new CustomError("Sponsor last name is required", 400);
    }

    if (
        !sponsorshipData.sponsorData?.email ||
        !sponsorshipData.sponsorData.email.trim()
    ) {
        throw new CustomError("Sponsor email is required", 400);
    }

    if (!sponsorshipData.packageType || !sponsorshipData.packageType.trim()) {
        throw new CustomError("Package type is required", 400);
    }

    if (!sponsorshipData.eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!sponsorshipData.organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    if (!sponsorshipData.amount || sponsorshipData.amount <= 0) {
        throw new CustomError("Valid amount is required", 400);
    }

    // Extract sponsor data from payload
    const sponsorData = {
        firstName: sponsorshipData.sponsorData.firstName,
        lastName: sponsorshipData.sponsorData.lastName,
        email: sponsorshipData.sponsorData.email,
        phone: sponsorshipData.sponsorData.phone || "",
        organization: sponsorshipData.sponsorData.organization || "",
        message: sponsorshipData.sponsorData.message || "",
    };

    if (id) {
        // Update existing sponsorship
        const sql = `
            INSERT INTO sponsorship (id, sponsor_data, package_type, event_id, organization_id, payment_status, amount,
                                     currency, registration_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) ON CONFLICT (id) DO
            UPDATE SET
                sponsor_data = EXCLUDED.sponsor_data,
                package_type = EXCLUDED.package_type,
                event_id = EXCLUDED.event_id,
                organization_id = EXCLUDED.organization_id,
                payment_status = EXCLUDED.payment_status,
                amount = EXCLUDED.amount,
                currency = EXCLUDED.currency,
                registration_id = EXCLUDED.registration_id,
                updated_at = NOW()
                RETURNING *
        `;
        const values = [
            id,
            sponsorData,
            sponsorshipData.packageType,
            sponsorshipData.eventId,
            sponsorshipData.organizationId,
            sponsorshipData.paymentStatus || "pending",
            sponsorshipData.amount,
            sponsorshipData.currency || "USD",
            sponsorshipData.registrationId || null,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update sponsorship", 500);
        }

        return result.rows[0];
    } else {
        // Create new sponsorship
        const sql = `
            INSERT INTO sponsorship (sponsor_data, package_type, event_id, organization_id, payment_status, amount, currency,
                                     registration_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *
        `;
        const values = [
            sponsorData,
            sponsorshipData.packageType,
            sponsorshipData.eventId,
            sponsorshipData.organizationId,
            sponsorshipData.paymentStatus || "pending",
            sponsorshipData.amount,
            sponsorshipData.currency || "USD",
            sponsorshipData.registrationId || null,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create sponsorship", 500);
        }

        return result.rows[0];
    }
};

exports.getSponsorshipsByEventId = async ({ eventId }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship
        WHERE event_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

exports.getSponsorshipsByOrganizationId = async ({ organizationId }) => {
    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship
        WHERE organization_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [organizationId]);
    return result.rows;
};

exports.getSponsorshipById = async ({ sponsorshipId }) => {
    if (!sponsorshipId) {
        throw new CustomError("Sponsorship ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship
        WHERE id = $1
    `;
    const result = await query(sql, [sponsorshipId]);

    if (!result.rows[0]) {
        throw new CustomError("Sponsorship not found", 404);
    }

    return result.rows[0];
};

exports.updatePaymentStatus = async ({
    sponsorshipId,
    paymentStatus,
    stripePaymentIntentId = null,
}) => {
    if (!sponsorshipId) {
        throw new CustomError("Sponsorship ID is required", 400);
    }

    if (!paymentStatus || !paymentStatus.trim()) {
        throw new CustomError("Payment status is required", 400);
    }

    const sql = `
        UPDATE sponsorship
        SET payment_status           = $2,
            stripe_payment_intent_id = $3,
            updated_at               = NOW()
        WHERE id = $1 RETURNING *
    `;
    const values = [sponsorshipId, paymentStatus, stripePaymentIntentId];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Sponsorship not found", 404);
    }

    return result.rows[0];
};

exports.getSponsorshipsBySponsorId = async ({ sponsorId }) => {
    if (!sponsorId) {
        throw new CustomError("Sponsor ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship
        WHERE registration_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [sponsorId]);
    return result.rows;
};

exports.createSponsorshipPaymentIntent = async ({
    packageId,
    amount,
    currency,
    sponsorEmail,
    eventId,
}) => {
    return await stripeService.createSponsorshipPaymentIntent({
        packageId,
        amount,
        currency,
        sponsorEmail,
        eventId,
    });
};
