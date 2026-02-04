import express from "express";
import { createVendor , getAllVendors , approveVendor } from "../controller/vendor.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const vendorRoutes = express.Router();

// create vendor - apply multer before handler
vendorRoutes.post(
  "/create",
  authMiddleware,
  (req, res, next) => {
    console.log("🔍 Vendor create route hit, processing multer...");
    upload.fields([
      { name: "profile_image", maxCount: 1 },
      { name: "cover_image", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        console.error("❌ Multer error:", err.message);
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
          errors: [],
        });
      }
      next();
    });
  },
  createVendor
);

vendorRoutes.get("/all", authMiddleware, getAllVendors);
vendorRoutes.post('/approve', authMiddleware, approveVendor);

export { vendorRoutes };