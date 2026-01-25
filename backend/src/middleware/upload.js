const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadConfig = require('../config/uploadConfig.js');

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function upload(configKey) {
    const config = uploadConfig[configKey];
    if (!config) throw new Error(`No upload config for key: ${configKey}`);
    const dest = path.join(__dirname, '../../public', config.dest);
    ensureDirSync(dest);

    const storage = multer.memoryStorage();
    const fileFilter = (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!config.allowedExts.includes(ext)) {
            return cb(new Error(`Invalid file type: ${ext}`), false);
        }
        cb(null, true);
    };

    const uploader = multer({
        storage,
        limits: { fileSize: config.maxSize },
        fileFilter,
    });

    if (config.fields) {
        return (req, res, next) => {
            uploader.fields(config.fields)(req, res, function (err) {
                if (err) return next(err);
                if (req.files) {
                    req.processedFiles = {};
                    Object.keys(req.files).forEach(fieldName => {
                        const file = req.files[fieldName][0];
                        const ext = path.extname(file.originalname).toLowerCase();
                        let filename;

                        if (configKey === 'header') {
                            filename = `${fieldName === 'logoImageDark' ? 'header-logo-dark' : 'header-logo'}${ext}`;
                            // Delete old versions with different extensions
                            const oldExtensions = ['.jpg', '.jpeg', '.png'];
                            oldExtensions.forEach(oldExt => {
                                if (oldExt !== ext) {
                                    const oldPath = path.join(dest, `${fieldName === 'logoImageDark' ? 'header-logo-dark' : 'header-logo'}${oldExt}`);
                                    if (fs.existsSync(oldPath)) {
                                        try { fs.unlinkSync(oldPath); } catch (e) { }
                                    }
                                }
                            });
                        } else {
                            filename = `${config.prefix || fieldName}-${Date.now()}${ext}`;
                        }

                        const destPath = path.join(dest, filename);
                        fs.writeFileSync(destPath, file.buffer);
                        req.processedFiles[fieldName] = {
                            filename,
                            path: destPath,
                            originalname: file.originalname,
                            mimetype: file.mimetype,
                            size: file.size
                        };
                    });
                }
                next();
            });
        };
    }

    if (config.maxCount === 1) {
        return (req, res, next) => {
            uploader.single(config.fieldName || 'file')(req, res, function (err) {
                if (err) {
                    return next(err);
                }
                // Save file to disk if present
                if (req.file) {
                    const ext = path.extname(req.file.originalname).toLowerCase();
                    // For header logo, use fixed filename to replace old one
                    let filename;
                    if (configKey === 'header') {
                        // Use fixed filename: header-logo.jpg (or .png)
                        filename = `header-logo${ext}`;
                        // Delete old logo if it exists (different extension)
                        const oldExtensions = ['.jpg', '.jpeg', '.png'];
                        oldExtensions.forEach(oldExt => {
                            if (oldExt !== ext) {
                                const oldPath = path.join(dest, `header-logo${oldExt}`);
                                if (fs.existsSync(oldPath)) {
                                    try {
                                        fs.unlinkSync(oldPath);
                                    } catch (error) {
                                        // Ignore errors
                                    }
                                }
                            }
                        });
                    } else {
                        // For other uploads, use timestamp
                        filename = `${config.prefix || 'file'}-${Date.now()}${ext}`;
                    }
                    const destPath = path.join(dest, filename);
                    fs.writeFileSync(destPath, req.file.buffer);
                    req.processedFiles = [{
                        filename,
                        path: destPath,
                        originalname: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size
                    }];
                }
                next();
            });
        };
    } else {
        return (req, res, next) => {
            uploader.array(config.fieldName || 'file', config.maxCount || 5)(req, res, function (err) {
                if (err) {
                    return next(err);
                }
                next();
            });
        };
    }
}

module.exports = { upload };
