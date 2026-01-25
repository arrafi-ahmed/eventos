// Central config for upload and compress middleware
const defaultConfig = {
    prefix: null,
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedExts: ['.jpg', '.jpeg', '.png'],
    maxWidth: 1400,
    format: 'jpeg',
    quality: 80,
    dest: null,
    fieldName: null,
    maxCount: 1, // allow 0 or 1 file
}
module.exports = {
    event: {
        ...defaultConfig,
        prefix: 'event',
        dest: 'event-banner',
        fieldName: 'files',
        maxCount: 25,
    },
    organizationLogo: {
        ...defaultConfig,
        prefix: 'organizationLogo',
        dest: 'organization-logo',
        fieldName: 'files',
        maxCount: 1,
    },
    user: {
        ...defaultConfig,
        prefix: 'user',
        dest: 'user',
        fieldName: 'files',
        maxCount: 1,
        maxWidth: 400,
    },
    tmp: {
        ...defaultConfig,
        prefix: 'tmp',
        dest: 'tmp',
        fieldName: 'files',
        maxCount: 1,
    },
    product: {
        ...defaultConfig,
        prefix: 'productImage',
        dest: 'product-image',
        fieldName: 'files',
        maxCount: 1,
    },
    idDocument: {
        ...defaultConfig,
        prefix: 'id-document',
        dest: 'id-document',
        fieldName: 'files',
        maxCount: 1,
        allowedExts: ['.jpg', '.jpeg', '.png', '.pdf'],
        maxSize: 10 * 1024 * 1024, // 10MB for ID documents
    },
    homepage: {
        ...defaultConfig,
        prefix: 'homepage-banner',
        dest: 'homepage-banner',
        fieldName: 'files',
        maxCount: 1,
        maxWidth: 1920,
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    header: {
        ...defaultConfig,
        dest: 'header-logo',
        fields: [
            { name: 'logoImage', maxCount: 1 },
            { name: 'logoImageDark', maxCount: 1 }
        ],
        maxCount: 2,
        maxWidth: 500,
        maxSize: 2 * 1024 * 1024, // 2MB
    },

}; 