const fs = require("fs").promises;
const path = require("path");
const qr = require("qrcode");
const { API_BASE_URL, VUE_BASE_URL, ANDROID_BASE_URL, NODE_ENV } = process.env;

const appInfo = { name: "Ticketi", version: 1.0 };

const excludedSecurityURLs = [];

// HTTP Status Codes
const HTTP_STATUS = {
    TOKEN_EXPIRED: 440, // Login Time-out (custom status for token expiry)
    UNAUTHORIZED: 401,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500
};

const isProd = NODE_ENV === "production";
const ifAdmin = (role) => Number(role) === 20;
const ifOrganizer = (role) => Number(role) === 30;
const ifAttendee = (role) => Number(role) === 40;
const ifCashier = (role) => Number(role) === 50;
const ifCheckInAgent = (role) => Number(role) === 60;

const formatTime = (inputTime) => {
    const date = new Date(inputTime);
    const day = `0${date.getDate()}`.slice(-2);
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const year = date.getFullYear();
    const hour = date.getHours();
    const min = date.getMinutes();
    return `${day}/${month}/${year} ${hour}:${min}`;
};

const formatDate = (inputDate) => {
    const date = new Date(inputDate);
    const day = `0${date.getDate()}`.slice(-2);
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

function formatDateToMonDD(date) {
    const d = new Date(date); // parse string to Date
    const options = { month: "short", day: "2-digit" };
    return d.toLocaleDateString("en-US", options);
}

function formatEventDateTime(date, format = "MM/DD/YYYY HH:mm") {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // Parse format string and convert to JavaScript date formatting
    const formatMap = {
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'DD': String(d.getDate()).padStart(2, '0'),
        'YYYY': d.getFullYear(),
        'HH': String(d.getHours()).padStart(2, '0'),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'ss': String(d.getSeconds()).padStart(2, '0'),
    };

    let formatted = format;
    Object.keys(formatMap).forEach(key => {
        formatted = formatted.replace(new RegExp(key, 'g'), formatMap[key]);
    });

    return formatted;
}

const getApiPublicImgUrl = (imageName, type) =>
    `${API_BASE_URL}/${type}/${imageName}`;


const moveImage = (sourcePath, destinationPath) => {
    return new Promise((resolve, reject) => {
        fs.rename(sourcePath, destinationPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const dirMap = {
    tmp: path.join(__dirname, "..", "..", "public", "tmp"),
    user: path.join(__dirname, "..", "..", "public", "user"),
    eventBanner: path.join(__dirname, "..", "..", "public", "event-banner"),
    organizationLogo: path.join(__dirname, "..", "..", "public", "organization-logo"),
    headerLogo: path.join(__dirname, "..", "..", "public", "header-logo"),
};

const getPrefix = (filename) => {
    return filename.split("-")[0];
};

const getDirPath = (prefix) => {
    return dirMap[prefix];
};

const getFilePath = (filename, prefix) => {
    const calcPrefix = prefix || getPrefix(filename);
    return path.join(dirMap[calcPrefix], filename);
};

const removeImages = async (imageArr) => {
    if (!Array.isArray(imageArr) || imageArr.length === 0) {
        return [];
    }

    const deletionResults = await Promise.all(
        imageArr.map(async (image) => {
            const filePath = getFilePath(image);
            if (!filePath) {
                console.error("Invalid file path for image:", image);
                return false;
            }

            try {
                await fs.unlink(filePath);
                return true;
            } catch (error) {
                console.error(`Failed to delete file: ${filePath}. Error:`, error);
                return false;
            }
        }),
    );

    return deletionResults; // Array of booleans
};

// const logoSvgString = fsSync.readFileSync(
//   path.join(__dirname, "./logo.svg"),
//   "utf8"
// );

const getCurrencySymbol = ({ code, type }) => {
    const codeLower = code.toString().toLowerCase();

    const currencyMap = {
        usd: { icon: "mdi-currency-usd", symbol: "$", code: "usd" },
        gbp: { icon: "mdi-currency-gbp", symbol: "£", code: "gbp" },
        eur: { icon: "mdi-currency-eur", symbol: "€", code: "eur" },
        thb: { icon: "mdi-currency-thb", symbol: "฿", code: "thb" },
        gnf: { icon: "mdi-currency-cash", symbol: "FG", code: "gnf" },
        xof: { icon: "mdi-currency-cash", symbol: "CFA", code: "xof" },
    };

    const currencyData = currencyMap[codeLower];
    if (!currencyData) {
        return null; // Or undefined, or throw an error, depending on your desired behavior
    }
    if (type === undefined) {
        return currencyData;
    }
    return currencyData[type];
};

const defaultCurrency = getCurrencySymbol({ code: "usd" });

const generateQrData = async ({ registrationId, attendeeId, qrUuid }) => {
    const data = JSON.stringify({
        r: registrationId,
        a: attendeeId,
        q: qrUuid,
    });
    const qrCode = await qr.toDataURL(data, {
        color: {
            dark: '#000000', // Always use black for QR codes to ensure proper scanning
            light: '#FFFFFF',
        },
    });
    return qrCode.split(",")[1]; // Extract base64 data
};

const generateQrCode = async ({ id, qrUuid }) => {
    const data = JSON.stringify({
        id: id,
        qrUuid: qrUuid,
    });
    const qrCode = await qr.toDataURL(data, {
        color: {
            dark: '#000000', // Always use black for QR codes to ensure proper scanning
            light: '#FFFFFF',
        },
    });
    return qrCode.split(",")[1]; // Extract base64 data
};

const generateBase64QrCode = async (payload) => {
    const { productId, productIdentitiesId, uuid } = payload;
    if (!productId || !productIdentitiesId || !uuid) {
        return qr.toDataURL(payload, {
            color: {
                dark: '#000000', // Always use black for QR codes to ensure proper scanning
                light: '#FFFFFF',
            },
        });
    }
    const params = new URLSearchParams();
    params.append("uuid", uuid);
    params.append("scanned", 1);

    const route = `${VUE_BASE_URL}/products/${productId}/${productIdentitiesId}?${params.toString()}`;

    return qr.toDataURL(route, {
        color: {
            dark: '#000000', // Always use black for QR codes to ensure proper scanning
            light: '#FFFFFF',
        },
    }); // return with base64 prefix
};

const generatePassword = (length = 8) => {
    const charset =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/()-*&^%$#@!";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const isBcryptHash = (hash) => {
    // Regex for bcrypt hash: $2a$ or $2b$, followed by cost factor, salt, and hash
    const bcryptRegex = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    return bcryptRegex.test(hash);
};

/**
 * Get the ratio to convert from major currency units to minor units (e.g., dollars to cents)
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @returns {number} Conversion ratio (100 for most currencies, 1 for currencies without minor units)
 */
function getCurrencyMinorUnitRatio(currency) {
    const currencyMap = {
        usd: 100,
        eur: 100,
        gbp: 100,
        cad: 100,
        aud: 100,
        chf: 100,
        jpy: 1, // Japanese Yen has no minor unit
        krw: 1, // South Korean Won has no minor unit
        cny: 100,
        inr: 100,
        brl: 100,
        mxn: 100,
        sek: 100,
        nok: 100,
        dkk: 100,
        pln: 100,
        czk: 100,
        huf: 1, // Hungarian Forint has no minor unit
        rub: 100,
        try: 100,
        zar: 100,
        nzd: 100,
        sgd: 100,
        hkd: 100,
        thb: 100,
        myr: 100,
        php: 100,
        idr: 100,
        vnd: 1, // Vietnamese Dong has no minor unit
        gnf: 1, // Guinean Franc is zero-decimal
        xof: 1, // West African CFA is zero-decimal
        xaf: 1, // Central African CFA is zero-decimal
        ouv: 1, // Sandbox currency for Orange Money (often used for zero-decimal simulations)
    };

    return currencyMap[currency.toLowerCase()] || 100; // Default to 100 for unknown currencies
}

/**
 * Generate a short, URL-safe session ID (exactly 30 chars)
 * Optimized for Orange Money order_id limit (30 chars) and fast DB lookup
 * @returns {string} 30-character hex string
 */
const generateSessionId = () => {
    // 15 bytes = 30 hex characters
    return require('crypto').randomBytes(15).toString('hex');
};

module.exports = {
    API_BASE_URL,
    VUE_BASE_URL,
    ANDROID_BASE_URL,
    dirMap,
    appInfo,
    getApiPublicImgUrl,
    generateQrData,
    generateQrCode,
    generateBase64QrCode,
    getCurrencySymbol,
    moveImage,
    getPrefix,
    getDirPath,
    getFilePath,
    removeImages,
    formatDate,
    formatTime,
    ifAdmin,
    excludedSecurityURLs,
    formatDateToMonDD,
    formatEventDateTime,
    generatePassword,
    isBcryptHash,
    defaultCurrency,
    HTTP_STATUS,
    ifOrganizer,
    ifAttendee,
    ifCashier,
    ifCheckInAgent,
    getCurrencyMinorUnitRatio,
    generateSessionId,
    // logoSvgString,
};
