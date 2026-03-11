import { BrandModel as Brand } from "../models/brand.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Create_Log_Entry } from "./log.controller.js";
import { getCache, setCache, deleteCache } from "../utils/redis.util.js";
import {
  REDIS_KEY_BRANDS,
  REDIS_KEY_USER_BRANDS_PREFIX,
  ACTIVITY_LOG_ACTIONS
} from "../constant.js";

// Helper to clear brand caches
const clearBrandCaches = async (userId) => {
  // Clear global cache
  await deleteCache(REDIS_KEY_BRANDS);
  // Clear user-specific cache
  if (userId) {
    await deleteCache(`${REDIS_KEY_USER_BRANDS_PREFIX}${userId}`);
  }
};

/* =====================================================
   ADD BRAND
===================================================== */
export const addBrand = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const userId = req.user._id || req.user.id;

  if (!name) {
    throw new apiError(400, "Brand name is required");
  }

  const existingBrand = await Brand.findOne({ name: name.trim(), user_id: userId });
  if (existingBrand) {
    throw new apiError(400, "Brand with this name already exists");
  }

  const newBrand = new Brand({
    name: name.trim(),
    user_id: userId,
    logo: req.file ? req.file.path : null, // Logo is optional now
  });

  await newBrand.save();

  // Clear Caches
  await clearBrandCaches(userId);

  // Activity Log
  await Create_Log_Entry({
    body: {
      user_id: userId,
      action: `${ACTIVITY_LOG_ACTIONS.BRAND_CREATED}: ${newBrand.name}`,
      reference_id: newBrand._id,
    },
  }, {
    status: () => ({ json: () => { } }),
  });

  return res.status(201).json(
    new apiResponse(201, "Brand added successfully", newBrand)
  );
});

/* =====================================================
   GET ALL BRANDS (with Caching)
===================================================== */
export const getAllBrands = asyncHandler(async (req, res) => {
  // Try to get from Cache
  const cachedBrands = await getCache(REDIS_KEY_BRANDS);
  if (cachedBrands) {
    console.log("CACHE HIT: All Brands retrieved from Redis");
    return res.status(200).json(
      new apiResponse(200, "Brands retrieved successfully (from cache)", cachedBrands)
    );
  }

  // Get from DB
  const brands = await Brand.find({ isActive: true, is_approved: true }).sort({ name: 1 });

  // Set Cache (1 hour default)
  await setCache(REDIS_KEY_BRANDS, brands);

  console.log("CACHE MISS: All Brands retrieved from DB");
  return res.status(200).json(
    new apiResponse(200, "Brands retrieved successfully", brands)
  );
});

/* =====================================================
   GET USER BRANDS (with Caching)
===================================================== */
export const getUserBrands = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const cacheKey = `${REDIS_KEY_USER_BRANDS_PREFIX}${userId}`;

  // Try to get from Cache
  const cachedUserBrands = await getCache(cacheKey);
  if (cachedUserBrands) {
    console.log(`CACHE HIT: User Brands retrieved from Redis for user ${userId}`);
    return res.status(200).json(
      new apiResponse(200, "User brands retrieved successfully (from cache)", cachedUserBrands)
    );
  }

  // Get from DB
  const brands = await Brand.find({ user_id: userId }).sort({ createdAt: -1 });

  // Set Cache (1 hour default)
  await setCache(cacheKey, brands);

  console.log(`CACHE MISS: User Brands retrieved from DB for user ${userId}`);
  return res.status(200).json(
    new apiResponse(200, "User brands retrieved successfully", brands)
  );
});

/* =====================================================
   APPROVE BRAND (Admin Only)
===================================================== */
export const approveBrand = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  const brand = await Brand.findById(brandId);

  if (!brand) {
    throw new apiError(404, "Brand not found");
  }

  brand.is_approved = true;
  await brand.save();

  // Clear Caches (Clear both since approval affects global list)
  await clearBrandCaches(brand.user_id);

  // Activity Log
  await Create_Log_Entry({
    body: {
      user_id: req.user._id,
      action: `${ACTIVITY_LOG_ACTIONS.BRAND_APPROVED}: ${brand.name}`,
      reference_id: brand._id,
    },
  }, {
    status: () => ({ json: () => { } }),
  });

  return res.status(200).json(
    new apiResponse(200, "Brand approved successfully", brand)
  );
});

/* =====================================================
   UPDATE BRAND STATUS (Toggle Active)
===================================================== */
export const updateBrandStatus = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  const userId = req.user._id || req.user.id;

  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw new apiError(404, "Brand not found");
  }

  if (brand.user_id.toString() !== userId.toString()) {
    throw new apiError(403, "Unauthorized to update this brand");
  }

  brand.isActive = !brand.isActive;
  await brand.save();

  // Clear Caches
  await clearBrandCaches(userId);

  // Activity Log
  await Create_Log_Entry({
    body: {
      user_id: userId,
      action: `${ACTIVITY_LOG_ACTIONS.BRAND_STATUS_TOGGLED} to ${brand.isActive ? "active" : "inactive"} for ${brand.name}`,
      reference_id: brand._id,
    },
  }, {
    status: () => ({ json: () => { } }),
  });

  return res.status(200).json(
    new apiResponse(200, `Brand has been ${brand.isActive ? "activated" : "deactivated"} successfully`, brand)
  );
});

/* =====================================================
   DELETE BRAND
===================================================== */
export const deleteBrand = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  const userId = req.user._id || req.user.id;

  const brand = await Brand.findById(brandId);
  if (!brand) {
    throw new apiError(404, "Brand not found");
  }

  // Admin can delete any brand. Normal user can only delete their own.
  if (req.user.role !== 'admin' && brand.user_id.toString() !== userId.toString()) {
    throw new apiError(403, "Unauthorized to delete this brand");
  }

  const brandName = brand.name;
  const brandOwnerId = brand.user_id;

  await Brand.findByIdAndDelete(brandId);

  // Clear Caches
  await clearBrandCaches(brandOwnerId);

  // Activity Log
  await Create_Log_Entry({
    body: {
      user_id: userId,
      action: `${ACTIVITY_LOG_ACTIONS.BRAND_DELETED}: ${brandName}`,
      reference_id: null,
    },
  }, {
    status: () => ({ json: () => { } }),
  });

  return res.status(200).json(
    new apiResponse(200, "Brand deleted successfully")
  );
});

/* =====================================================
   GET ALL BRANDS (Admin Only - Includes Pending)
===================================================== */
export const getAdminBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find().populate("user_id", "firstName lastName email").sort({ createdAt: -1 });
  return res.status(200).json(
    new apiResponse(200, "All brands retrieved successfully", brands)
  );
});
