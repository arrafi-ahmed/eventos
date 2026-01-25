const express = require("express");
const router = express.Router();
const productService = require("../service/product");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager, isOrganizerEventAuthor, isOrganizerProductAuthor, isOrganizationMember } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const path = require("path");
const fs = require("fs");

// ============================================
// PRODUCT CRUD ROUTES
// ============================================

router.post("/create", auth, isOrganizationManager, upload("product"), async (req, res, next) => {
    try {
        const { organizationId, name, description, price, stock, sku } = req.body;

        // Get image filename if uploaded
        const image = req.processedFiles && req.processedFiles[0] ? req.processedFiles[0].filename : null;

        const result = await productService.createProduct({
            organizationId: parseInt(organizationId),
            name,
            description,
            price: parseInt(price), // Price in cents
            stock: parseInt(stock) || 0,
            image,
            sku,
            currentUser: req.currentUser,
        });

        res.status(201).json(new ApiResponse("Product created successfully!", result));
    } catch (err) {
        // Delete uploaded file if error occurs
        if (req.processedFiles && req.processedFiles[0]) {
            try {
                fs.unlinkSync(req.processedFiles[0].path);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        next(err);
    }
});

/**
 * Update an existing product
 * PUT /product/update
 */
router.put("/update", auth, isOrganizerProductAuthor, upload("product"), async (req, res, next) => {
    try {
        const { productId, name, description, price, stock, sku, isActive, removeImage } = req.body;

        // Prepare update data
        const updateData = {
            productId: parseInt(productId),
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseInt(price);
        if (stock !== undefined) updateData.stock = parseInt(stock);
        if (sku !== undefined) updateData.sku = sku;
        if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

        // Handle image update or removal
        if (req.processedFiles && req.processedFiles[0]) {
            // Get old product to delete old image
            const oldProduct = await productService.getProductById({ productId: parseInt(productId) });
            if (oldProduct.image) {
                const oldImagePath = path.join(__dirname, '../../public/product-image', oldProduct.image);
                if (fs.existsSync(oldImagePath)) {
                    try {
                        fs.unlinkSync(oldImagePath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            }
            updateData.image = req.processedFiles[0].filename;
        } else if (removeImage === 'true' || removeImage === true) {
            // Handle image removal
            const oldProduct = await productService.getProductById({ productId: parseInt(productId) });
            if (oldProduct.image) {
                const oldImagePath = path.join(__dirname, '../../public/product-image', oldProduct.image);
                if (fs.existsSync(oldImagePath)) {
                    try {
                        fs.unlinkSync(oldImagePath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            }
            updateData.image = null;
        }

        const result = await productService.updateProduct(updateData);

        res.status(200).json(new ApiResponse("Product updated successfully!", result));
    } catch (err) {
        // Delete uploaded file if error occurs
        if (req.processedFiles && req.processedFiles[0]) {
            try {
                fs.unlinkSync(req.processedFiles[0].path);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        next(err);
    }
});

/**
 * Delete a product
 * DELETE /product/delete
 */
router.delete("/delete", auth, isOrganizerProductAuthor, async (req, res, next) => {
    try {
        const { productId } = req.query;

        // Get product to delete image
        const product = await productService.getProductById({ productId: parseInt(productId) });

        const result = await productService.deleteProduct({
            productId: parseInt(productId),
        });

        // Delete image file
        if (product.image) {
            const imagePath = path.join(__dirname, '../../public/product-image', product.image);
            if (fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }

        res.status(200).json(new ApiResponse("Product deleted successfully!", result));
    } catch (err) {
        next(err);
    }
});

/**
 * Get all products for an organizer
 * GET /product/getOrganizerProducts
 */
router.get("/getOrganizerProducts", auth, isOrganizationMember, async (req, res, next) => {
    try {
        const { organizationId } = req.query;

        const results = await productService.getOrganizerProducts({
            organizationId: parseInt(organizationId),
        });

        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

/**
 * Get a single product by ID
 * GET /product/getProductById
 */
router.get("/getProductById", async (req, res, next) => {
    try {
        const { productId } = req.query;

        const result = await productService.getProductById({
            productId: parseInt(productId),
        });

        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

// ============================================
// EVENT-PRODUCT RELATIONSHIP ROUTES
// ============================================

/**
 * Get products linked to an event (public)
 * GET /product/getEventProducts
 */
router.get("/getEventProducts", async (req, res, next) => {
    try {
        const { eventId } = req.query;

        // Validate eventId
        if (!eventId) {
            return res.status(400).json(new ApiResponse('Event ID is required'));
        }

        const parsedEventId = parseInt(eventId);
        if (isNaN(parsedEventId) || parsedEventId <= 0) {
            return res.status(400).json(new ApiResponse('Invalid event ID'));
        }

        const results = await productService.getEventProducts({
            eventId: parsedEventId,
        });

        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

/**
 * Add a product to an event
 * POST /product/addToEvent
 */
router.post("/addToEvent", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const { eventId, productId, isFeatured } = req.body;

        // Validate that eventId and productId are valid numbers
        const parsedEventId = parseInt(eventId);
        const parsedProductId = parseInt(productId);

        if (isNaN(parsedEventId) || isNaN(parsedProductId)) {
            return res.status(400).json(new ApiResponse('Invalid eventId or productId'));
        }

        const result = await productService.addProductToEvent({
            eventId: parsedEventId,
            productId: parsedProductId,
            isFeatured: isFeatured || false,
        });

        res.status(200).json(new ApiResponse("Product added to event!", result));
    } catch (err) {
        next(err);
    }
});

/**
 * Remove a product from an event
 * POST /product/removeFromEvent
 */
router.post("/removeFromEvent", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const { eventId, productId } = req.body;

        const result = await productService.removeProductFromEvent({
            eventId: parseInt(eventId),
            productId: parseInt(productId),
        });

        res.status(200).json(new ApiResponse("Product removed from event!", result));
    } catch (err) {
        next(err);
    }
});

/**
 * Update product settings within an event (featured, order)
 * POST /product/updateEventProductSettings
 */
router.post("/updateEventProductSettings", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const { eventId, productId, isFeatured, displayOrder } = req.body;

        const result = await productService.updateEventProductSettings({
            eventId: parseInt(eventId),
            productId: parseInt(productId),
            isFeatured,
            displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
        });

        res.status(200).json(new ApiResponse("Product settings updated!", result));
    } catch (err) {
        next(err);
    }
});

/**
 * Bulk reorder products for an event
 * POST /product/reorderEventProducts
 */
router.post("/reorderEventProducts", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const { eventId, productOrders } = req.body;

        // productOrders should be an array of {productId, displayOrder}
        const results = await productService.reorderEventProducts({
            eventId: parseInt(eventId),
            productOrders: productOrders.map(po => ({
                productId: parseInt(po.productId),
                displayOrder: parseInt(po.displayOrder),
            })),
        });

        res.status(200).json(new ApiResponse("Products reordered successfully!", results));
    } catch (err) {
        next(err);
    }
});

// ============================================
// CUSTOMER PURCHASE ROUTES
// ============================================

/**
 * Create payment intent for product purchase
 * POST /product/create-payment-intent
 */
router.post("/create-payment-intent", async (req, res, next) => {
    try {
        const { selectedProducts, eventSlug, totalAmount } = req.body;

        // Validate required fields
        if (!selectedProducts || !Array.isArray(selectedProducts) || selectedProducts.length === 0) {
            return res.status(400).json(new ApiResponse("No products selected", null));
        }

        if (!eventSlug || !totalAmount) {
            return res.status(400).json(new ApiResponse("Missing required fields", null));
        }

        // Get event by slug
        const event = await productService.getEventBySlug(eventSlug);
        if (!event) {
            return res.status(404).json(new ApiResponse("Event not found", null));
        }

        // Create payment intent
        const result = await productService.createProductPaymentIntent({
            selectedProducts,
            eventSlug,
            totalAmount,
            event
        });

        res.status(200).json(new ApiResponse("Payment intent created successfully!", result));
    } catch (err) {
        next(err);
    }
});

/**
 * Process free product order
 * POST /product/process-free-order
 */
router.post("/process-free-order", async (req, res, next) => {
    try {
        const { selectedProducts, eventSlug, totalAmount } = req.body;

        // Validate required fields
        if (!selectedProducts || !Array.isArray(selectedProducts) || selectedProducts.length === 0) {
            return res.status(400).json(new ApiResponse("No products selected", null));
        }

        if (!eventSlug) {
            return res.status(400).json(new ApiResponse("Event slug required", null));
        }

        // Get event by slug
        const event = await productService.getEventBySlug(eventSlug);
        if (!event) {
            return res.status(404).json(new ApiResponse("Event not found", null));
        }

        // Process free order
        const result = await productService.processFreeProductOrder({
            selectedProducts,
            eventSlug,
            event
        });

        res.status(200).json(new ApiResponse("Free order processed successfully!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

