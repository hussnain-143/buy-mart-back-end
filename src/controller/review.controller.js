import { ReviewModel as Review } from "../models/review.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Create_Log_Entry } from "./log.controller.js";
import { ACTIVITY_LOG_ACTIONS } from "../constant.js";

/* =====================================================
   ADD REVIEW
===================================================== */
export const addReview = asyncHandler(async (req, res) => {
    const { product_id, rating, comment } = req.body;
    const userId = req.user._id || req.user.id;

    if (!product_id || !rating) {
        throw new apiError(400, "Product ID and rating are required");
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ product_id, user_id: userId });
    if (existingReview) {
        throw new apiError(400, "You have already reviewed this product");
    }

    const newReview = new Review({
        product_id,
        user_id: userId,
        rating,
        comment: comment || "",
    });

    await newReview.save();

    // Activity Log
    await Create_Log_Entry({
        body: {
            user_id: userId,
            action: `${ACTIVITY_LOG_ACTIONS.REVIEW_ADDED} for Product ID ${product_id}`,
            reference_id: newReview._id,
        },
    }, {
        status: () => ({ json: () => { } }),
    });

    return res.status(201).json(
        new apiResponse(201, "Review added successfully", newReview)
    );
});

/* =====================================================
   GET PRODUCT REVIEWS
===================================================== */
export const getProductReviews = asyncHandler(async (req, res) => {
    const { product_id } = req.params;

    const reviews = await Review.find({ product_id, is_active: true })
        .populate("user_id", "userName firstName lastName profile_image")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new apiResponse(200, "Reviews retrieved successfully", reviews)
    );
});

/* =====================================================
   DELETE REVIEW
===================================================== */
export const deleteReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const review = await Review.findById(id);
    if (!review) {
        throw new apiError(404, "Review not found");
    }

    // Verify ownership or admin
    if (review.user_id.toString() !== userId.toString() && req.user.role !== 'admin') {
        throw new apiError(403, "Unauthorized to delete this review");
    }

    await Review.findByIdAndDelete(id);

    return res.status(200).json(
        new apiResponse(200, "Review deleted successfully")
    );
});

/* =====================================================
   GET ALL REVIEWS (Admin Only)
===================================================== */
export const getAllReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find()
        .populate("user_id", "userName firstName lastName")
        .populate("product_id", "name")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new apiResponse(200, "All reviews retrieved successfully", reviews)
    );
});
