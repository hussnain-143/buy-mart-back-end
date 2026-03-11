import { Router } from "express";
import {
  addDeal,
  getAllDeals,
  getVendorDeals,
  updateDeal,
  deleteDeal,
} from "../controller/deal.controller.js";
import { authMiddleware, isVendor } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.get("/all", getAllDeals);

// Protected routes (Vendor/Admin)
router.use(authMiddleware);

router.post("/add", isVendor, upload.single("banner_image"), addDeal);
router.get("/vendor", isVendor, getVendorDeals);
router.put("/update/:id", isVendor, upload.single("banner_image"), updateDeal);
router.delete("/delete/:id", isVendor, deleteDeal);

export default router;
