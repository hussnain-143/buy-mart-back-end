import { CategoryModel as Category } from "../models/category.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
import { getCache, setCache, deleteCache } from "../utils/redis.util.js";
import {
  REDIS_KEY_CATEGORIES_ALL,
  ACTIVITY_LOG_ACTIONS
} from "../constant.js";

// Helper to clear category caches
const clearCategoryCaches = async () => {
  await deleteCache(REDIS_KEY_CATEGORIES_ALL);
};

/* =====================================================
   ADD CATEGORY
===================================================== */
export const addCategory = asyncHandler(async (req, res) => {
  const { name, parent_id } = req.body;
  const userId = req.user._id || req.user.id;

  if (!name) {
    throw new apiError(400, "Category name is required");
  }

  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory) {
    throw new apiError(400, "Category with this name already exists");
  }

  const newCategory = new Category({
    name: name.trim(),
    parent_id: parent_id || null,
    user_id: userId,
  });

  await newCategory.save();

  // Clear Cache
  await clearCategoryCaches();

  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.CATEGORY_CREATED}: ${newCategory.name}`, newCategory._id);

  return res.status(201).json(
    new apiResponse(201, "Category added successfully", newCategory)
  );
});

/* =====================================================
   GET ALL CATEGORIES (with Caching)
===================================================== */
export const getAllCategories = asyncHandler(async (req, res) => {
  console.log("🚀 [CONTROLLER] Entering getAllCategories");
  // Try to get from Cache
  const cachedCategories = await getCache(REDIS_KEY_CATEGORIES_ALL);
  if (cachedCategories) {
    console.log("CACHE HIT: All Categories retrieved from Redis");
    return res.status(200).json(
      new apiResponse(200, "Categories retrieved successfully (from cache)", cachedCategories)
    );
  }

  // Get from DB
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });

  // Set Cache
  await setCache(REDIS_KEY_CATEGORIES_ALL, categories);

  console.log("CACHE MISS: All Categories retrieved from DB");
  return res.status(200).json(
    new apiResponse(200, "Categories retrieved successfully", categories)
  );
});

/* =====================================================
   GET ADMIN CATEGORIES (All)
===================================================== */
export const getAdminCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  return res.status(200).json(
    new apiResponse(200, "All Categories retrieved successfully", categories)
  );
});

/* =====================================================
   UPDATE CATEGORY
===================================================== */
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, parent_id, isActive, is_approved } = req.body;
  const userId = req.user._id || req.user.id;

  const category = await Category.findById(id);
  if (!category) {
    throw new apiError(404, "Category not found");
  }

  if (name) category.name = name.trim();
  if (parent_id !== undefined) category.parent_id = parent_id || null;
  if (isActive !== undefined) category.isActive = isActive;
  if (is_approved !== undefined && req.user.role === 'admin') category.is_approved = is_approved;

  await category.save();

  // Clear Cache
  await clearCategoryCaches();

  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.CATEGORY_UPDATED}: ${category.name}`, category._id);

  return res.status(200).json(
    new apiResponse(200, "Category updated successfully", category)
  );
});

/* =====================================================
   DELETE CATEGORY
===================================================== */
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;

  const category = await Category.findById(id);
  if (!category) {
    throw new apiError(404, "Category not found");
  }

  const categoryName = category.name;
  await Category.findByIdAndDelete(id);

  // Clear Cache
  await clearCategoryCaches();

  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.CATEGORY_DELETED}: ${categoryName}`, null);

  return res.status(200).json(
    new apiResponse(200, "Category deleted successfully")
  );
});
