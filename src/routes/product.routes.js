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
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public Routes
router.get("/", getAllProducts);
router.get("/ai-search", aiSearch);

// Admin Routes (Static first)
router.get("/admin/all", authMiddleware, isAdmin, getAdminProducts);
router.patch("/admin/:id/toggle-status", authMiddleware, isAdmin, toggleProductStatus);

// Protected Routes (Static first)
router.get("/vendor", authMiddleware, getVendorProducts);
router.post("/", authMiddleware, upload.array("images", 5), addProduct);
router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

// Public / Protected (Param based last)
router.get("/:id", getProductById);

export const productRoutes = router;
