const router = require("express").Router();
const organizerService = require("../service/organizer");
const ApiResponse = require("../model/ApiResponse");
const {auth} = require("../middleware/auth");
const {upload} = require("../middleware/upload");
const {ifOrganizer} = require("../utils/common");

// Upload ID document
router.post("/upload-id", auth, upload("idDocument"), async (req, res, next) => {
    try {
        // Check if user is organizer
        if (!ifOrganizer(req.currentUser.role)) {
            return res.status(403).json(new ApiResponse("Only organizers can upload ID documents"));
        }

        const filename = req.processedFiles && req.processedFiles[0] ? req.processedFiles[0].filename : null;

        if (!filename) {
            return res.status(400).json(new ApiResponse("No file uploaded"));
        }

        const result = await organizerService.uploadIdDocument({
            userId: req.currentUser.id,
            filename,
        });

        res.status(200).json(new ApiResponse("ID document uploaded successfully!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

