import { ReviewModel as Review } from "../models/review.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
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
    await createLog(userId, `${ACTIVITY_LOG_ACTIONS.REVIEW_ADDED} for Product ID ${product_id}`, newReview._id);

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

/* =====================================================
   GET VENDOR REVIEWS (Vendor Only)
===================================================== */
export const getVendorReviews = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    
    // 1. Find the vendor for this user
    const { VendorModel } = await import("../models/vendor.model.js");
    const vendor = await VendorModel.findOne({ owner: userId });
    
    if (!vendor) {
        throw new apiError(404, "Vendor profile not found");
    }

    // 2. Find all products belonging to this vendor
    const { ProductModel } = await import("../models/product.model.js");
    const products = await ProductModel.find({ 
        $or: [
            { vendor_id: vendor._id },
            { vendor_id: vendor._id.toString() },
            { vendor_id: userId },
            { vendor_id: userId.toString() }
        ]
    }).select("_id");
    const productIds = products.map(p => p._id);

    // 3. Find all reviews for these products
    const reviews = await Review.find({ product_id: { $in: productIds } })
        .populate("user_id", "userName firstName lastName profile_image")
        .populate({
            path: "product_id",
            select: "name images_id",
            populate: {
                path: "images_id"
            }
        })
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new apiResponse(200, "Vendor reviews retrieved successfully", reviews)
    );
});
