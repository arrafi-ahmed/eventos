const db = require('../db')

const getSystemSettings = async () => {
    const result = await db.query('SELECT key, value FROM system_settings')

    // Reduce rows to single object: { key: value, ... }
    const settings = result.rows.reduce((acc, row) => {
        acc[row.key] = row.value
        return acc
    }, {})

    // Ensure default structure if missing keys
    return {
        localization: settings.localization || { defaultCurrency: 'USD', defaultLanguage: 'en' },
        appearance: settings.appearance || { defaultTheme: 'dark' },
        header: settings.header || {},
        footer: settings.footer || {},
        organizer_dashboard_banner: settings.organizer_dashboard_banner || {},
        ...settings // Include any extra keys found
    }
}

const updateSystemSettings = async (section, data) => {
    // section is the key (e.g., 'localization', 'appearance')

    // Upsert the specific key
    const query = `
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    RETURNING key, value
  `
    const result = await db.query(query, [section, data])

    // Return just the updated section properly formatted if needed, or arguably the full settings if the frontend expects full refresh. 
    // Usually standard UPDATE returns the row. Here we return { [key]: value } logic? 
    // The previous implementation returned the whole object row.
    // To match previous behavior specifically for that section update, we might just return the updated data or fetch all?
    // Let's stick to returning the updated data object wrapper or refetch all?
    // The previous implementation returned `result.rows[0]` which was the whole big row.
    // If I return `result.rows[0]` here it is `{ key: '...', value: '...' }`. This might break frontend expectation if it expects `{ localization: ... }`.
    // The frontend `systemSettings` store `updateSettings` action commits `updateSection`.
    // Let's verify frontend expectation.
    // Frontend `updateSection` mutation: `state.settings[section] = data`.
    // API returns `new ApiResponse(..., updated)`.
    // So if I return just `result.rows[0].value` that implies `data`.
    // BUT, let's fetch full settings to be consistent with "return updated state" or just return the full object.

    // Let's return the full consolidated object to be safe, although slightly less efficient, it guarantees consistency.
    return await getSystemSettings()
}

const updateFullSystemSettings = async (data) => {
    // data is { localization: {...}, appearance: {...} }
    const keys = Object.keys(data)

    if (keys.length === 0) return await getSystemSettings()

    // We need to upsert multiple rows. Best to do in loop or generate huge ELSE logic. 
    // Loop is fine for low volume settings.

    // Use transaction for safety
    try {
        await db.query('BEGIN')
        for (const key of keys) {
            const query = `
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
            `
            await db.query(query, [key, data[key]])
        }
        await db.query('COMMIT')
    } catch (e) {
        await db.query('ROLLBACK')
        throw e
    }

    return await getSystemSettings()
}

module.exports = {
    getSystemSettings,
    updateSystemSettings,
    updateFullSystemSettings
}
