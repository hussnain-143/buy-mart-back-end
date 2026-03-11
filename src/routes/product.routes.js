import { Router } from "express";
import {
    addProduct,
    getAllProducts,
    getProductById,
    aiSearch,
    updateProduct,
    deleteProduct,
    getVendorProducts,
    getAdminProducts,
    toggleProductStatus
} from "../controller/product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public Routes
router.get("/", getAllProducts);
router.get("/ai-search", aiSearch);
router.get("/:id", getProductById);

// Protected Routes
router.use(authMiddleware);
router.get("/vendor", getVendorProducts);
router.post("/", upload.array("images", 5), addProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

// Admin Routes
import { isAdmin } from "../middlewares/auth.middleware.js";
router.get("/admin/all", isAdmin, getAdminProducts);
router.patch("/admin/:id/toggle-status", isAdmin, toggleProductStatus);

export const productRoutes = router;
