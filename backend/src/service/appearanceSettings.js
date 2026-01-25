const { query } = require("../db");
const CustomError = require("../model/CustomError");

const VALID_THEMES = ["dark", "light"];

// Default color values matching vuetify.js
const DEFAULT_LIGHT_COLORS = {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'surface-variant': '#F1F5F9',
    'surface-bright': '#FFFFFF',
    primary: '#ED2939',
    'on-primary': '#FFFFFF',
    secondary: '#64748B',
    'on-secondary': '#FFFFFF',
    accent: '#0EA5E9',
    'on-accent': '#FFFFFF',
    tertiary: '#0F172A',
    'on-tertiary': '#FFFFFF',
    success: '#10B981',
    'on-success': '#FFFFFF',
    error: '#EF4444',
    'on-error': '#FFFFFF',
    warning: '#F59E0B',
    'on-warning': '#FFFFFF',
    info: '#3B82F6',
    'on-info': '#FFFFFF',
    'on-background': '#0F172A',
    'on-surface': '#0F172A',
    'on-surface-variant': '#64748B',
    outline: '#E2E8F0',
    'outline-variant': '#F1F5F9',
    'on-gradient-light': '#0F172A',
    'on-gradient-dark': '#FFFFFF',
};

const DEFAULT_DARK_COLORS = {
    background: '#383838',
    surface: '#424242',
    'surface-variant': '#4A4A4A',
    'surface-bright': '#505050',
    primary: '#ccff00',
    'on-primary': '#000000',
    secondary: '#00A1DE',
    'on-secondary': '#FFFFFF',
    accent: '#00A1DE',
    'on-accent': '#FFFFFF',
    tertiary: '#FFFFFF',
    'on-tertiary': '#383838',
    success: '#4CAF50',
    'on-success': '#FFFFFF',
    error: '#ED2939',
    'on-error': '#FFFFFF',
    warning: '#FF9800',
    'on-warning': '#FFFFFF',
    info: '#00A1DE',
    'on-info': '#FFFFFF',
    'on-background': '#FFFFFF',
    'on-surface': '#FFFFFF',
    'on-surface-variant': '#E0E0E0',
    outline: '#616161',
    'outline-variant': '#757575',
    'on-gradient-light': '#1F1F1F', // Dark text for light theme gradients (default: dark)
    'on-gradient-dark': '#FFFFFF',   // Light text for dark theme gradients (default: white)
};

const DEFAULT_LIGHT_VARIABLES = {};

const DEFAULT_DARK_VARIABLES = {
    'border-color': '#616161',
    'border-opacity': 0.12,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 0.8,
    'disabled-opacity': 0.5,
    'idle-opacity': 0.1,
    'hover-opacity': 0.08,
    'focus-opacity': 0.12,
    'selected-opacity': 0.12,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.16,
    'dragged-opacity': 0.08,
    'kbd-background-color': '#424242',
    'kbd-color': '#FFFFFF',
    'code-background-color': '#424242',
};

// Get appearance settings (public or admin)
exports.getAppearanceSettings = async () => {
    const sql = `
    SELECT
      id,
      default_theme,
      light_colors,
      light_variables,
      dark_colors,
      dark_variables,
      created_at,
      updated_at
    FROM appearance_settings
    ORDER BY id ASC
    LIMIT 1
  `;
    const result = await query(sql, []);

    if (result.rows.length === 0) {
        // Return default settings if none exist
        return {
            defaultTheme: "dark",
            lightColors: DEFAULT_LIGHT_COLORS,
            lightVariables: DEFAULT_LIGHT_VARIABLES,
            darkColors: DEFAULT_DARK_COLORS,
            darkVariables: DEFAULT_DARK_VARIABLES,
        };
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        defaultTheme: row.defaultTheme || 'dark',
        lightColors: row.lightColors || DEFAULT_LIGHT_COLORS,
        lightVariables: row.lightVariables || DEFAULT_LIGHT_VARIABLES,
        darkColors: row.darkColors || DEFAULT_DARK_COLORS,
        darkVariables: row.darkVariables || DEFAULT_DARK_VARIABLES,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

// Update appearance settings (admin only)
// Accepts camelCase, converts to snake_case for SQL only
exports.updateAppearanceSettings = async ({
    defaultTheme,
    lightColors,
    lightVariables,
    darkColors,
    darkVariables
}) => {
    // Validate defaultTheme
    if (defaultTheme && !VALID_THEMES.includes(defaultTheme)) {
        throw new CustomError(`Invalid defaultTheme. Must be one of: ${VALID_THEMES.join(", ")}`, 400);
    }

    // Validate colors are objects
    if (lightColors !== undefined && (typeof lightColors !== 'object' || Array.isArray(lightColors))) {
        throw new CustomError("lightColors must be an object", 400);
    }
    if (darkColors !== undefined && (typeof darkColors !== 'object' || Array.isArray(darkColors))) {
        throw new CustomError("darkColors must be an object", 400);
    }
    // Validate variables are objects
    if (lightVariables !== undefined && (typeof lightVariables !== 'object' || Array.isArray(lightVariables))) {
        throw new CustomError("lightVariables must be an object", 400);
    }
    if (darkVariables !== undefined && (typeof darkVariables !== 'object' || Array.isArray(darkVariables))) {
        throw new CustomError("darkVariables must be an object", 400);
    }

    // Check if settings exist
    const existing = await query("SELECT id FROM appearance_settings LIMIT 1", []);

    let result;
    if (existing.rows.length === 0) {
        // Insert new settings
        const insertSql = `
      INSERT INTO appearance_settings (
        default_theme,
        light_colors,
        light_variables,
        dark_colors,
        dark_variables
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        result = await query(insertSql, [
            defaultTheme || "dark",
            lightColors ? JSON.stringify(lightColors) : JSON.stringify(DEFAULT_LIGHT_COLORS),
            lightVariables ? JSON.stringify(lightVariables) : JSON.stringify(DEFAULT_LIGHT_VARIABLES),
            darkColors ? JSON.stringify(darkColors) : JSON.stringify(DEFAULT_DARK_COLORS),
            darkVariables ? JSON.stringify(darkVariables) : JSON.stringify(DEFAULT_DARK_VARIABLES)
        ]);
    } else {
        // Update existing settings
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (defaultTheme !== undefined) {
            updates.push(`default_theme = $${paramIndex++}`);
            values.push(defaultTheme);
        }
        if (lightColors !== undefined) {
            updates.push(`light_colors = $${paramIndex++}`);
            values.push(JSON.stringify(lightColors));
        }
        if (lightVariables !== undefined) {
            updates.push(`light_variables = $${paramIndex++}`);
            values.push(JSON.stringify(lightVariables));
        }
        if (darkColors !== undefined) {
            updates.push(`dark_colors = $${paramIndex++}`);
            values.push(JSON.stringify(darkColors));
        }
        if (darkVariables !== undefined) {
            updates.push(`dark_variables = $${paramIndex++}`);
            values.push(JSON.stringify(darkVariables));
        }

        if (updates.length === 0) {
            throw new CustomError("No fields to update", 400);
        }

        updates.push(`updated_at = NOW()`);
        values.push(existing.rows[0].id);

        const updateSql = `
      UPDATE appearance_settings
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        result = await query(updateSql, values);
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        defaultTheme: row.defaultTheme || 'dark',
        lightColors: row.lightColors || DEFAULT_LIGHT_COLORS,
        lightVariables: row.lightVariables || DEFAULT_LIGHT_VARIABLES,
        darkColors: row.darkColors || DEFAULT_DARK_COLORS,
        darkVariables: row.darkVariables || DEFAULT_DARK_VARIABLES,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

exports.VALID_THEMES = VALID_THEMES;
exports.DEFAULT_LIGHT_COLORS = DEFAULT_LIGHT_COLORS;
exports.DEFAULT_LIGHT_VARIABLES = DEFAULT_LIGHT_VARIABLES;
exports.DEFAULT_DARK_COLORS = DEFAULT_DARK_COLORS;
exports.DEFAULT_DARK_VARIABLES = DEFAULT_DARK_VARIABLES;

