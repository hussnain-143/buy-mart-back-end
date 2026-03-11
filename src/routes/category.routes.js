import { Router } from "express";
import {
    addCategory,
    getAllCategories,
    getAdminCategories,
    updateCategory,
    deleteCategory
} from "../controller/category.controller.js";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Public Routes
router.get("/", getAllCategories);

// Protected Routes
router.use(authMiddleware);
router.get("/admin", isAdmin, getAdminCategories);
router.post("/", isAdmin, addCategory);
router.put("/:id", isAdmin, updateCategory);
router.delete("/:id", isAdmin, deleteCategory);

export const categoryRoutes = router;
