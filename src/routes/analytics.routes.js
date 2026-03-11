import { Router } from "express";
import { getAdminStats, getVendorStats } from "../controller/analytics.controller.js";
import { authMiddleware, isAdmin, isVendor } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/admin", isAdmin, getAdminStats);
router.get("/vendor", isVendor, getVendorStats);

export const analyticsRoutes = router;
