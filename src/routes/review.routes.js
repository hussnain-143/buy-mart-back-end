import { Router } from "express";
import {
    addReview,
    getProductReviews,
    deleteReview,
    getAllReviews
} from "../controller/review.controller.js";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Public Routes
router.get("/product/:product_id", getProductReviews);

// Protected Routes
router.use(authMiddleware);
router.post("/", addReview);
router.get("/all", isAdmin, getAllReviews);
router.delete("/:id", deleteReview);

export const reviewRoutes = router;
