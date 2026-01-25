const { query, pool } = require("../db");
const CustomError = require("../model/CustomError");

/**
 * Create a new product
 */
exports.createProduct = async ({ organizationId, name, description, price, stock, image, sku, currentUser }) => {
    const sql = `
        INSERT INTO product (organization_id, name, description, price, stock, image, sku, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;

    const values = [organizationId, name, description, price, stock || 0, image, sku, currentUser.id];
    const result = await query(sql, values);

    return result.rows[0];
};

/**
 * Update an existing product
 */
exports.updateProduct = async ({ productId, name, description, price, stock, image, sku, isActive }) => {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (price !== undefined) {
        updates.push(`price = $${paramIndex++}`);
        values.push(price);
    }
    if (stock !== undefined) {
        updates.push(`stock = $${paramIndex++}`);
        values.push(stock);
    }
    if (image !== undefined) {
        updates.push(`image = $${paramIndex++}`);
        values.push(image);
    }
    if (sku !== undefined) {
        updates.push(`sku = $${paramIndex++}`);
        values.push(sku);
    }
    if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
    }

    if (updates.length === 0) {
        throw new CustomError("No fields to update", 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(productId);

    const sql = `
        UPDATE product
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} RETURNING *
    `;

    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Product not found", 404);
    }

    return result.rows[0];
};

/**
 * Delete a product
 * Note: This will cascade delete event_product entries
 */
exports.deleteProduct = async ({ productId }) => {
    const sql = `
        DELETE
        FROM product
        WHERE id = $1 RETURNING id
    `;

    const result = await query(sql, [productId]);

    if (!result.rows[0]) {
        throw new CustomError("Product not found", 404);
    }

    return { id: result.rows[0].id, deleted: true };
};

/**
 * Get all products for an organizer/organization
 */
exports.getOrganizerProducts = async ({ organizationId }) => {
    const sql = `
        SELECT p.*,
               u.full_name                 as created_by_name,
               COUNT(DISTINCT ep.event_id) as linked_event_count
        FROM product p
                 LEFT JOIN app_user u ON p.created_by = u.id
                 LEFT JOIN event_product ep ON p.id = ep.product_id
        WHERE p.organization_id = $1
        GROUP BY p.id, u.full_name
        ORDER BY p.created_at DESC
    `;

    const result = await query(sql, [organizationId]);
    return result.rows;
};

/**
 * Get a single product by ID
 */
exports.getProductById = async ({ productId }) => {
    const sql = `
        SELECT p.*, u.full_name as created_by_name
        FROM product p
                 LEFT JOIN app_user u ON p.created_by = u.id
        WHERE p.id = $1
    `;

    const result = await query(sql, [productId]);

    if (!result.rows[0]) {
        throw new CustomError("Product not found", 404);
    }

    return result.rows[0];
};

/**
 * Deduct product stock (used during checkout)
 */
exports.deductStock = async ({ productId, quantity }) => {
    const sql = `
        UPDATE product
        SET stock      = stock - $1,
            updated_at = NOW()
        WHERE id = $2
          AND stock >= $1 RETURNING *
    `;

    const result = await query(sql, [quantity, productId]);

    if (!result.rows[0]) {
        throw new CustomError("Product not found or insufficient stock", 400);
    }

    return result.rows[0];
};

// ============================================
// EVENT-PRODUCT RELATIONSHIP OPERATIONS
// ============================================

/**
 * Get all products linked to a specific event (public view)
 */
exports.getEventProducts = async ({ eventId }) => {
    // Validate eventId
    if (!eventId || isNaN(eventId) || eventId <= 0) {
        throw new Error('Invalid event ID provided');
    }

    const sql = `
        SELECT p.*,
               ep.is_featured,
               ep.display_order,
               ep.id as event_product_id
        FROM product p
                 INNER JOIN event_product ep ON p.id = ep.product_id
        WHERE ep.event_id = $1
          AND p.is_active = true
        ORDER BY ep.display_order ASC, ep.created_at DESC
    `;

    const result = await query(sql, [eventId]);
    return result.rows;
};

/**
 * Link a product to an event
 */
exports.addProductToEvent = async ({ eventId, productId, isFeatured = false }) => {

    // Get the max display_order for this event
    const maxOrderResult = await query(
        `SELECT COALESCE(MAX(display_order), -1) as max_order
         FROM event_product
         WHERE event_id = $1`,
        [eventId]
    );

    // Handle the case where max_order might be null or invalid
    const maxOrder = maxOrderResult.rows[0]?.maxOrder;
    const displayOrder = (maxOrder && !isNaN(maxOrder)) ? maxOrder + 1 : 0;

    // Validate displayOrder is a valid number
    if (isNaN(displayOrder) || displayOrder < 0) {
        throw new Error(`Invalid display order calculated: ${displayOrder}`);
    }

    const sql = `
        INSERT INTO event_product (event_id, product_id, is_featured, display_order)
        VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, product_id) DO
        UPDATE
            SET is_featured = EXCLUDED.is_featured
            RETURNING *
    `;

    const result = await query(sql, [eventId, productId, isFeatured, displayOrder]);
    return result.rows[0];
};

/**
 * Remove a product from an event
 */
exports.removeProductFromEvent = async ({ eventId, productId }) => {
    const sql = `
        DELETE
        FROM event_product
        WHERE event_id = $1
          AND product_id = $2 RETURNING id
    `;

    const result = await query(sql, [eventId, productId]);

    if (!result.rows[0]) {
        throw new CustomError("Product not linked to this event", 404);
    }

    return { id: result.rows[0].id, removed: true };
};

/**
 * Update product display order and featured status within an event
 */
exports.updateEventProductSettings = async ({ eventId, productId, isFeatured, displayOrder }) => {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (isFeatured !== undefined) {
        updates.push(`is_featured = $${paramIndex++}`);
        values.push(isFeatured);
    }

    if (displayOrder !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(displayOrder);
    }

    if (updates.length === 0) {
        throw new CustomError("No fields to update", 400);
    }

    values.push(eventId, productId);

    const sql = `
        UPDATE event_product
        SET ${updates.join(', ')}
        WHERE event_id = $${paramIndex++}
          AND product_id = $${paramIndex++} RETURNING *
    `;

    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Product not linked to this event", 404);
    }

    return result.rows[0];
};

/**
 * Bulk reorder products for an event
 * @param {Array} productOrders - Array of {productId, displayOrder}
 */
exports.reorderEventProducts = async ({ eventId, productOrders }) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const { productId, displayOrder } of productOrders) {
            await client.query(
                `UPDATE event_product
                 SET display_order = $1
                 WHERE event_id = $2
                   AND product_id = $3`,
                [displayOrder, eventId, productId]
            );
        }

        await client.query('COMMIT');

        // Return updated products
        return await exports.getEventProducts({ eventId });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Update product stock (reduce by quantity)
 */
exports.updateStock = async ({ productId, quantity }) => {
    if (!productId) {
        throw new CustomError("Product ID is required", 400);
    }

    if (!quantity || quantity <= 0) {
        throw new CustomError("Valid quantity is required", 400);
    }

    const sql = `
        UPDATE product
        SET stock = stock - $1
        WHERE id = $2
          AND stock >= $1 RETURNING 
            id,
            name,
            description,
            price,
            stock,
            image,
            sku,
            is_active as "isActive",
            created_at as "createdAt",
            updated_at as "updatedAt"
    `;

    const result = await query(sql, [quantity, productId]);

    if (!result.rows[0]) {
        throw new CustomError("Product not found or insufficient stock", 404);
    }

    return result.rows[0];
};

/**
 * Check if product belongs to organization (for authorization)
 */
exports.isProductOwnedByOrganization = async ({ productId, organizationId }) => {
    const sql = `SELECT id
                 FROM product
                 WHERE id = $1
                   AND organization_id = $2`;
    const result = await query(sql, [productId, organizationId]);
    return result.rows.length > 0;
};

// ============================================
// CUSTOMER PURCHASE METHODS
// ============================================

/**
 * Get event by slug
 */
exports.getEventBySlug = async ({ slug }) => {
    const sql = `
        SELECT *
        FROM event
        WHERE slug = $1
          AND status = 'published'
    `;
    const result = await query(sql, [slug]);
    return result.rows[0] || null;
};

/**
 * Create payment intent for product purchase
 */
exports.createProductPaymentIntent = async ({ selectedProducts, eventSlug, totalAmount, event }) => {
    // For now, return a mock payment intent
    // In a real implementation, you would integrate with Stripe here
    const clientSecret = 'pi_mock_' + Date.now();
    const sessionId = 'session_' + Date.now();

    // Store order data (in a real app, you'd save this to database)
    // For now, we'll just return the payment intent data

    return {
        clientSecret,
        sessionId,
        orderId: 'order_' + Date.now(),
    };
};

/**
 * Process free product order
 */
exports.processFreeProductOrder = async ({ selectedProducts, eventSlug, event }) => {
    // In a real implementation, you would:
    // 1. Create an order record in the database
    // 2. Update product stock
    // 3. Send confirmation email
    // 4. Generate order confirmation

    const orderId = 'order_' + Date.now();

    // Mock order processing
    const order = {
        id: orderId,
        eventSlug,
        products: selectedProducts,
        totalAmount: 0,
        status: 'completed',
        createdAt: new Date().toISOString(),
    };

    return {
        orderId,
        order,
        message: 'Free order processed successfully',
    };
};

