const path = require("path");
const fs = require("fs");

/**
 * Middleware to handle missing images and serve default placeholders
 */
const imageFallback = (req, res, next) => {
    const folders = ['event-banner', 'product-image', 'user', 'organization-logo', 'homepage-banner'];

    // Check if the request matches one of our image folders
    const match = req.url.match(/^\/([^/]+)\/([^/]+)$/);
    if (!match) return next();

    const folder = match[1];
    const filename = match[2];

    if (!folders.includes(folder)) return next();

    const filePath = path.join(__dirname, "../../public", folder, filename);

    // If file exists, let static server handle it or send it now
    if (fs.existsSync(filePath)) {
        return next();
    }

    // Fallback logic
    let fallbackPath;
    switch (folder) {
        case 'organization-logo':
            fallbackPath = path.join(__dirname, "../../public/header-logo/header-logo.png");
            break;
        case 'product-image':
            fallbackPath = path.join(__dirname, "../../public/product-image/default-product.png");
            break;
        case 'user':
            fallbackPath = path.join(__dirname, "../../public/user/default-user.png");
            break;
        case 'event-banner':
        case 'homepage-banner':
        default:
            fallbackPath = path.join(__dirname, "../../public/event-banner/default-event.webp");
            break;
    }

    if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
    }

    next();
};

module.exports = imageFallback;
