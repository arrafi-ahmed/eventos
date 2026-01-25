const {query} = require("../db");
const CustomError = require("../model/CustomError");

const VALID_THEMES = ["dark", "light"];
const DEFAULT_THEME = "dark";

exports.getUserSettings = async ({userId}) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const sql = `
        SELECT theme
        FROM user_settings
        WHERE user_id = $1
    `;

    const result = await query(sql, [userId]);
    if (!result.rows[0]) {
        return {theme: DEFAULT_THEME};
    }
    return result.rows[0];
};

exports.upsertTheme = async ({userId, theme}) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    if (!theme || !VALID_THEMES.includes(theme)) {
        throw new CustomError("Invalid theme selected", 400);
    }

    const sql = `
        INSERT INTO user_settings (user_id, theme, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET theme = EXCLUDED.theme,
            updated_at = NOW()
        RETURNING theme
    `;

    const result = await query(sql, [userId, theme]);
    return result.rows[0];
};

exports.VALID_THEMES = VALID_THEMES;
exports.DEFAULT_THEME = DEFAULT_THEME;

