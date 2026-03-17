import { Router } from "express";
import {
    createOrder,
    getOrderById,
    getUserOrders,
    updateOrderStatus,
    getVendorOrders,
    getAllOrders
} from "../controller/order.controller.js";
import { authMiddleware, isAdmin, isVendor } from "../middlewares/auth.middleware.js";

const router = Router();

// All order routes are protected
router.use(authMiddleware);

router.get("/vendor", isVendor, getVendorOrders);
router.get("/all", isAdmin, getAllOrders);
router.get("/", getUserOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.patch("/:id/status", updateOrderStatus);

export const orderRoutes = router;
