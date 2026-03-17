import { Router } from "express";
import { getAdminStats, getVendorStats, getSidebarMetrics } from "../controller/analytics.controller.js";
import { authMiddleware, isAdmin, isVendor } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/admin", isAdmin, getAdminStats);
router.get("/vendor", isVendor, getVendorStats);
router.get("/sidebar-metrics", getSidebarMetrics);

export const analyticsRoutes = router;
