const { query } = require("../db");
const emailService = require("./email");
const eventService = require("./event");
const tempRegistrationService = require("./tempRegistration");
const CustomError = require("../model/CustomError");
const { VUE_BASE_URL } = process.env;

/**
 * Get abandoned carts that need reminder emails
 * Criteria:
 * - Cart created at least 1 hour ago (created_at + 1 hour < NOW())
 * - Email not sent yet (reminder_email_sent_at IS NULL)
 * - Has valid email address
 */
exports.getAbandonedCartsForReminder = async () => {
    try {
        // First check if reminder_email_sent_at column exists (migration might not be run)
        const checkColumnSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'temp_registration' 
            AND column_name = 'reminder_email_sent_at'
        `;
        const columnCheck = await query(checkColumnSql);

        if (columnCheck.rows.length === 0) {
            console.error("[Abandoned Cart] ERROR: reminder_email_sent_at column does not exist. Please run migration: backend/migration/add-reminder-email-sent-to-temp-registration.sql");
            return [];
        }

        const sql = `
            SELECT 
                tr.session_id,
                tr.attendees,
                tr.selected_tickets,
                tr.selected_products,
                tr.orders,
                tr.event_id,
                tr.created_at,
                tr.expires_at,
                tr.reminder_email_sent_at,
                -- Extract primary attendee email from JSONB
                tr.attendees->0->>'email' as primary_email,
                tr.attendees->0->>'firstName' as first_name,
                tr.attendees->0->>'lastName' as last_name,
                -- Optional: Check if user is logged-in (for stats only)
                au.id as user_id,
                au.full_name as user_full_name,
                au.email as user_email
            FROM temp_registration tr
            -- Left join to optionally identify logged-in users (for stats)
            LEFT JOIN app_user au ON tr.attendees->0->>'email' = au.email
            -- Exclude carts where email already has converted visitor (already purchased)
            LEFT JOIN event_visitor ev ON LOWER(ev.email) = LOWER(tr.attendees->0->>'email')
                AND ev.event_id = tr.event_id
                AND ev.converted = true
            WHERE tr.created_at + INTERVAL '1 hour' < NOW()
                AND tr.reminder_email_sent_at IS NULL
                AND tr.attendees->0->>'email' IS NOT NULL
                AND tr.attendees->0->>'email' != ''
                AND ev.id IS NULL  -- No converted visitor found (hasn't purchased yet)
            ORDER BY tr.created_at ASC
        `;

        const result = await query(sql);

        // Debug: Check total carts in database
        const totalCartsSql = `SELECT COUNT(*) as total FROM temp_registration`;
        const totalCarts = await query(totalCartsSql);
        console.log(`[Abandoned Cart] Total carts in database: ${totalCarts.rows[0]?.total || 0}`);

        // Debug: Check carts with emails
        const cartsWithEmailSql = `
            SELECT COUNT(*) as total 
            FROM temp_registration 
            WHERE attendees->0->>'email' IS NOT NULL 
            AND attendees->0->>'email' != ''
        `;
        const cartsWithEmail = await query(cartsWithEmailSql);
        console.log(`[Abandoned Cart] Carts with valid email: ${cartsWithEmail.rows[0]?.total || 0}`);

        // Debug: Check carts older than 1 hour
        const cartsOldEnoughSql = `
            SELECT COUNT(*) as total 
            FROM temp_registration 
            WHERE created_at + INTERVAL '1 hour' < NOW()
        `;
        const cartsOldEnough = await query(cartsOldEnoughSql);
        console.log(`[Abandoned Cart] Carts older than 1 hour: ${cartsOldEnough.rows[0]?.total || 0}`);

        return result.rows;
    } catch (error) {
        console.error("Error fetching abandoned carts for reminder:", error);
        throw error;
    }
};

/**
 * Process abandoned carts: send reminder emails
 * @param {Object} options - Processing options
 * @param {number} options.batchSize - Number of carts to process at once (default: 50)
 * @param {boolean} options.dryRun - If true, don't send emails or update (default: false)
 */
exports.processAbandonedCarts = async ({ batchSize = 50, dryRun = false } = {}) => {
    try {
        // Get abandoned carts that need reminder emails
        // Criteria: created_at + 1 hour < NOW() AND reminder_email_sent_at IS NULL
        const abandonedCarts = await exports.getAbandonedCartsForReminder();

        console.log(`[Abandoned Cart] Found ${abandonedCarts.length} carts needing reminder emails`);

        if (abandonedCarts.length === 0) {
            console.log(`[Abandoned Cart] No carts found matching criteria (created_at + 1 hour < NOW() AND reminder_email_sent_at IS NULL)`);
            return {
                processed: 0,
                emailsSent: 0,
                skipped: 0,
                errors: [],
                message: "No abandoned carts found matching criteria",
            };
        }

        const results = {
            processed: 0,
            emailsSent: 0,
            skipped: 0,
            errors: [],
        };

        // Process in batches to avoid overwhelming the system
        for (let i = 0; i < abandonedCarts.length; i += batchSize) {
            const batch = abandonedCarts.slice(i, i + batchSize);

            // Process batch in parallel
            const batchPromises = batch.map(async (cart) => {
                try {
                    // Get event details
                    const event = await eventService.getEventById({
                        eventId: cart.eventId,
                    });

                    if (!event) {
                        console.warn(`Event ${cart.eventId} not found for cart ${cart.sessionId}`);
                        return { success: false, error: "Event not found" };
                    }

                    // Check if abandoned cart emails are enabled for this event
                    // Fix: typeof null is 'object', so we must check for null explicitly
                    const eventConfig = (event.config && typeof event.config === 'object') ? event.config : (event.config ? JSON.parse(event.config) : {});
                    const isAbandonedCartEmailsEnabled = eventConfig.enableAbandonedCartEmails === true;

                    if (!isAbandonedCartEmailsEnabled) {
                        // Event has abandoned cart emails disabled, skip this cart
                        console.log(`Abandoned cart emails disabled for event ${cart.eventId}, skipping email for session ${cart.sessionId}`);
                        results.skipped++;
                        results.processed++;
                        return { success: true, skipped: true, reason: "Abandoned cart emails disabled for this event" };
                    }

                    // Parse cart data
                    const attendees = Array.isArray(cart.attendees) ? cart.attendees : JSON.parse(cart.attendees || "[]");
                    const selectedTickets = Array.isArray(cart.selectedTickets) ? cart.selectedTickets : JSON.parse(cart.selectedTickets || "[]");
                    const selectedProducts = Array.isArray(cart.selectedProducts) ? cart.selectedProducts : JSON.parse(cart.selectedProducts || "[]");
                    const orders = typeof cart.orders === "object" ? cart.orders : JSON.parse(cart.orders || "{}");

                    // Get primary attendee
                    const primaryAttendee = attendees[0];
                    if (!primaryAttendee || !primaryAttendee.email) {
                        console.warn(`No primary attendee email found for cart ${cart.sessionId}`);
                        return { success: false, error: "No primary attendee email" };
                    }

                    // Send email to anyone who filled out the form (has email address)
                    if (!dryRun) {
                        console.log(`[Abandoned Cart] Sending reminder email to ${primaryAttendee.email} for session ${cart.sessionId}`);

                        // Send abandoned cart reminder email
                        await emailService.sendAbandonedCartReminder({
                            to: primaryAttendee.email,
                            firstName: primaryAttendee.firstName || cart.userFullName || "there",
                            event: event,
                            selectedTickets: selectedTickets,
                            selectedProducts: selectedProducts,
                            totalAmount: orders.totalAmount || 0,
                            currency: event.currency || "USD",
                            sessionId: cart.sessionId,
                        });

                        console.log(`[Abandoned Cart] Email sent successfully to ${primaryAttendee.email}`);

                        // Mark email as sent and extend expiration to 7 days from now
                        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                        const updateSql = `
                            UPDATE temp_registration
                            SET reminder_email_sent_at = NOW(),
                                expires_at = $1
                            WHERE session_id = $2
                        `;
                        await query(updateSql, [newExpiresAt, cart.sessionId]);

                        console.log(`[Abandoned Cart] Updated session ${cart.sessionId}: reminder_email_sent_at set, expires_at extended to 7 days`);

                        results.emailsSent++;
                    } else {
                        console.log(`[Abandoned Cart] DRY RUN: Would send email to ${primaryAttendee.email} for session ${cart.sessionId}`);
                    }

                    results.processed++;
                    return { success: true };
                } catch (error) {
                    console.error(`Error processing abandoned cart ${cart.sessionId}:`, error);
                    results.errors.push({
                        sessionId: cart.sessionId,
                        error: error.message,
                    });
                    return { success: false, error: error.message };
                }
            });

            await Promise.allSettled(batchPromises);
        }

        const summary = {
            ...results,
            message: `Processed ${results.processed} abandoned carts. Sent ${results.emailsSent} emails, skipped ${results.skipped} carts.`,
        };

        console.log(`[Abandoned Cart] Job completed:`, summary);
        return summary;
    } catch (error) {
        console.error("Error processing abandoned carts:", error);
        throw error;
    }
};


/**
 * Get statistics about abandoned carts
 */
exports.getAbandonedCartStats = async () => {
    try {
        const sql = `
            SELECT 
                COUNT(*) FILTER (WHERE tr.reminder_email_sent_at IS NULL AND tr.created_at + INTERVAL '1 hour' < NOW()) as pending_reminders,
                COUNT(*) FILTER (WHERE tr.reminder_email_sent_at IS NOT NULL) as reminders_sent,
                COUNT(*) FILTER (WHERE tr.expires_at < NOW()) as expired_carts,
                COUNT(DISTINCT tr.event_id) as events_affected,
                COUNT(DISTINCT tr.attendees->0->>'email') as total_with_emails,
                COUNT(DISTINCT au.id) as logged_in_users,
                SUM((tr.orders->>'totalAmount')::int) FILTER (WHERE tr.expires_at < NOW()) as total_abandoned_value,
                AVG((tr.orders->>'totalAmount')::int) FILTER (WHERE tr.expires_at < NOW()) as avg_abandoned_value
            FROM temp_registration tr
            LEFT JOIN app_user au ON tr.attendees->0->>'email' = au.email
            WHERE tr.attendees->0->>'email' IS NOT NULL
                AND tr.attendees->0->>'email' != ''
        `;

        const result = await query(sql);
        return result.rows[0] || {};
    } catch (error) {
        console.error("Error getting abandoned cart stats:", error);
        throw error;
    }
};

/**
 * Cleanup expired temp registrations (expires_at < NOW())
 * This should be run periodically to delete old entries
 *
 * Note: Must clear session_id from attendees first to avoid foreign key constraint violation
 */
exports.cleanupExpiredCarts = async () => {
    try {
        // First, get all expired session_ids
        const expiredSessionsQuery = `
            SELECT session_id
            FROM temp_registration
            WHERE expires_at < NOW()
        `;
        const expiredSessionsResult = await query(expiredSessionsQuery);
        const expiredSessionIds = expiredSessionsResult.rows.map(row => row.sessionId);

        let attendeesCleared = 0;
        if (expiredSessionIds.length > 0) {
            // Clear session_id from attendees for all expired sessions
            // This prevents foreign key constraint violation when deleting temp_registration
            const clearSessionIdsQuery = `
                UPDATE attendees 
                SET session_id = NULL 
                WHERE session_id = ANY($1::varchar[])
            `;
            const clearResult = await query(clearSessionIdsQuery, [expiredSessionIds]);
            attendeesCleared = clearResult.rowCount || 0;
        }

        // Now safely delete expired temp_registration entries
        const deleteSql = `
            DELETE FROM temp_registration
            WHERE expires_at < NOW()
        `;

        const result = await query(deleteSql);
        return {
            deleted: result.rowCount || 0,
            attendeesCleared: attendeesCleared,
            message: `Cleaned up ${result.rowCount || 0} expired cart entries and cleared session_id from ${attendeesCleared} attendees`
        };
    } catch (error) {
        console.error("Error cleaning up expired carts:", error);
        throw error;
    }
};

