import { ProductModel as Product } from "../models/product.model.js";
import { ImageModel as Image } from "../models/product_images.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { Create_Log_Entry } from "./log.controller.js";
import { getCache, setCache, deleteCache } from "../utils/redis.util.js";
import {
    REDIS_KEY_PRODUCTS_ALL,
    ACTIVITY_LOG_ACTIONS
} from "../constant.js";
import mongoose from "mongoose";

// Helper to clear product caches
const clearProductCaches = async () => {
    await deleteCache(REDIS_KEY_PRODUCTS_ALL);
};

/* =====================================================
   ADD PRODUCT
===================================================== */
export const addProduct = asyncHandler(async (req, res) => {
    const { name, desc, price, discount_price, sku, stock_quantity, category_id, brand_id } = req.body;
    const userId = req.user._id || req.user.id;
    const vendorId = req.user.vendor_id; // Assuming vendor_id is attached to user by auth middleware or fetched

    if (!name || !desc || !price || !sku || !category_id || !brand_id) {
        throw new apiError(400, "Required fields are missing");
    }

    // Check if SKU exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
        throw new apiError(400, "Product with this SKU already exists");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const newProduct = new Product({
            name,
            desc,
            price,
            discount_price: discount_price || 0,
            sku,
            stock_quantity: stock_quantity || 0,
            vendor_id: vendorId,
            category_id,
            brand_id,
        });

        await newProduct.save({ session });

        // Handle Images
        if (req.files && req.files.length > 0) {
            const imageIds = [];
            for (const [index, file] of req.files.entries()) {
                const result = await uploadToCloudinary(file.path);
                const newImage = new Image({
                    image_url: result.secure_url,
                    product_id: newProduct._id,
                    isPrimary: index === 0, // First image is primary
                });
                await newImage.save({ session });
                imageIds.push(newImage._id);
            }
            newProduct.images_id = imageIds;
            await newProduct.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        // Clear Cache
        await clearProductCaches();

        // Activity Log
        await Create_Log_Entry({
            body: {
                user_id: userId,
                action: `${ACTIVITY_LOG_ACTIONS.PRODUCT_CREATED}: ${newProduct.name}`,
                reference_id: newProduct._id,
            },
        }, {
            status: () => ({ json: () => { } }),
        });

        return res.status(201).json(
            new apiResponse(201, "Product added successfully", newProduct)
        );
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

/* =====================================================
   GET ALL PRODUCTS (with Pagination and Filtering)
===================================================== */
export const getAllProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, category, brand, minPrice, maxPrice, search } = req.query;

    const query = { is_active: true };

    if (category) query.category_id = category;
    if (brand) query.brand_id = brand;
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
        query.$text = { $search: search };
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: ["category_id", "brand_id", "images_id"],
        sort: { createdAt: -1 },
    };

    const products = await Product.paginate(query, options);

    return res.status(200).json(
        new apiResponse(200, "Products retrieved successfully", products)
    );
});

/* =====================================================
   GET PRODUCT BY ID
===================================================== */
export const getProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let product;
    if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id).populate(["category_id", "brand_id", "images_id"]);
    } else {
        product = await Product.findOne({ sku: id }).populate(["category_id", "brand_id", "images_id"]);
    }

    if (!product) {
        throw new apiError(404, "Product not found");
    }

    return res.status(200).json(
        new apiResponse(200, "Product retrieved successfully", product)
    );
});

/* =====================================================
   AI SEARCH (Fuzzy Matching)
===================================================== */
export const aiSearch = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q) {
        throw new apiError(400, "Search query is required");
    }

    // Advanced fuzzy matching using regex for each word
    const keywords = q.split(/\s+/).filter(word => word.length > 0);
    const regexQueries = keywords.map(kw => new RegExp(kw, 'i'));

    const products = await Product.find({
        is_active: true,
        $or: [
            { name: { $in: regexQueries } },
            { desc: { $in: regexQueries } },
            { sku: { $in: regexQueries } }
        ]
    }).populate(["category_id", "brand_id", "images_id"]).limit(20);

    return res.status(200).json(
        new apiResponse(200, "AI search results retrieved", products)
    );
});

/* =====================================================
   UPDATE PRODUCT
===================================================== */
export const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user._id || req.user.id;

    const product = await Product.findById(id);
    if (!product) {
        throw new apiError(404, "Product not found");
    }

    // Verify ownership
    if (product.vendor_id.toString() !== req.user.vendor_id?.toString() && req.user.role !== 'admin') {
        throw new apiError(403, "Unauthorized to update this product");
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true }).populate(["category_id", "brand_id", "images_id"]);

    // Clear Cache
    await clearProductCaches();

    // Activity Log
    await Create_Log_Entry({
        body: {
            user_id: userId,
            action: `${ACTIVITY_LOG_ACTIONS.PRODUCT_UPDATED}: ${updatedProduct.name}`,
            reference_id: updatedProduct._id,
        },
    }, {
        status: () => ({ json: () => { } }),
    });

    return res.status(200).json(
        new apiResponse(200, "Product updated successfully", updatedProduct)
    );
});

/* =====================================================
   DELETE PRODUCT
===================================================== */
export const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const product = await Product.findById(id);
    if (!product) {
        throw new apiError(404, "Product not found");
    }

    // Verify ownership
    if (product.vendor_id.toString() !== req.user.vendor_id?.toString() && req.user.role !== 'admin') {
        throw new apiError(403, "Unauthorized to delete this product");
    }

    const productName = product.name;
    await Product.findByIdAndDelete(id);
    // Optionally delete images from Cloudinary and DB
    await ImageModel.deleteMany({ product_id: id });

    // Clear Cache
    await clearProductCaches();

    // Activity Log
    await Create_Log_Entry({
        body: {
            user_id: userId,
            action: `${ACTIVITY_LOG_ACTIONS.PRODUCT_DELETED}: ${productName}`,
            reference_id: null,
        },
    }, {
        status: () => ({ json: () => { } }),
    });

    return res.status(200).json(
        new apiResponse(200, "Product deleted successfully")
    );
});

/* =====================================================
   GET VENDOR PRODUCTS
===================================================== */
export const getVendorProducts = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    // Use aggregate to find vendor associated with user if not directly in req.user
    // But typically we should have it or we can find it.
    // Let's find vendor by owner
    const { VendorModel } = await import("../models/vendor.model.js");
    const vendor = await VendorModel.findOne({ owner: userId });

    if (!vendor) {
        throw new apiError(404, "Vendor profile not found");
    }

    const { page = 1, limit = 50 } = req.query;
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: ["category_id", "brand_id", "images_id"],
        sort: { createdAt: -1 },
    };

    const products = await Product.paginate({ vendor_id: vendor._id }, options);

    return res.status(200).json(
        new apiResponse(200, "Vendor products retrieved successfully", products)
    );
});

/* =====================================================
   GET ALL PRODUCTS (Admin Only - Includes Inactive)
===================================================== */
export const getAdminProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: ["category_id", "brand_id", "images_id"],
        sort: { createdAt: -1 },
    };

    // No is_active filter for admins
    const products = await Product.paginate({}, options);

    return res.status(200).json(
        new apiResponse(200, "All products retrieved successfully", products)
    );
});

/* =====================================================
   TOGGLE PRODUCT STATUS (Admin Only)
===================================================== */
export const toggleProductStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
        throw new apiError(404, "Product not found");
    }

    product.is_active = !product.is_active;
    await product.save();

    // Clear Cache
    await clearProductCaches();

    // Activity Log
    await Create_Log_Entry({
        body: {
            user_id: req.user._id,
            action: `${ACTIVITY_LOG_ACTIONS.PRODUCT_UPDATED}: Status toggled to ${product.is_active} for ${product.name}`,
            reference_id: product._id,
        },
    }, {
        status: () => ({ json: () => { } }),
    });

    return res.status(200).json(
        new apiResponse(200, `Product ${product.is_active ? 'activated' : 'deactivated'} successfully`, product)
    );
});
