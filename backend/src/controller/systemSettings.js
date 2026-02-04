const express = require('express')
const router = express.Router()
const ApiResponse = require('../model/ApiResponse')
const systemSettingsService = require('../service/systemSettings')
const authMiddleware = require('../middleware/auth')

// Get all system settings or a specific section
router.get('/', async (req, res) => {
    try {
        const settings = await systemSettingsService.getSystemSettings()
        return res.status(200).json(new ApiResponse(null, settings))
    } catch (error) {
        return res.status(500).json(new ApiResponse('Error fetching settings', null, error))
    }
})

// Update header settings with file upload
// PUT /api/system-settings/header
router.put('/header', authMiddleware.isAuthenticated, authMiddleware.isAdmin, require('../middleware/upload').upload('header'), async (req, res) => {
    try {
        const updateData = { ...req.body }

        // Handle logo image uploads
        if (req.processedFiles) {
            if (req.processedFiles.logoImage) {
                updateData.logoImage = req.processedFiles.logoImage.filename;
            }
            if (req.processedFiles.logoImageDark) {
                updateData.logoImageDark = req.processedFiles.logoImageDark.filename;
            }
        }

        const updated = await systemSettingsService.updateSystemSettings('header', updateData)
        return res.status(200).json(new ApiResponse('Settings updated successfully', updated))
    } catch (error) {
        return res.status(500).json(new ApiResponse('Error updating settings', null, error))
    }
})

// Update a specific section
// PUT /api/system-settings/:section
router.put('/:section', authMiddleware.isAuthenticated, authMiddleware.isAdmin, async (req, res) => {
    try {
        const { section } = req.params
        const updated = await systemSettingsService.updateSystemSettings(section, req.body)
        return res.status(200).json(new ApiResponse('Settings updated successfully', updated))
    } catch (error) {
        return res.status(500).json(new ApiResponse('Error updating settings', null, error))
    }
})

// Update full or multiple sections
// PUT /api/system-settings
router.put('/', authMiddleware.isAuthenticated, authMiddleware.isAdmin, async (req, res) => {
    try {
        const updated = await systemSettingsService.updateFullSystemSettings(req.body)
        return res.status(200).json(new ApiResponse('Settings updated successfully', updated))
    } catch (error) {
        return res.status(500).json(new ApiResponse('Error updating settings', null, error))
    }
})

module.exports = router
