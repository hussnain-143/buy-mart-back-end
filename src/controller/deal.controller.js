import { DealModel as Deal } from "../models/deal.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
import { deleteCache } from "../utils/redis.util.js";
import { REDIS_KEY_DEALS_ALL, ACTIVITY_LOG_ACTIONS } from "../constant.js";
import { VendorModel } from "../models/vendor.model.js";

const clearDealCaches = async () => {
  await deleteCache(REDIS_KEY_DEALS_ALL);
};

export const addDeal = asyncHandler(async (req, res) => {
  const { name, discount, description, category_id, product_id, start_date, end_date } = req.body;
  const userId = req.user._id || req.user.id;

  const vendor = await VendorModel.findOne({ owner: userId });
  if (!vendor) {
    throw new apiError(404, "Vendor profile not found");
  }

  if (!name || !discount || !description || !start_date || !end_date) {
    throw new apiError(400, "Required fields are missing");
  }

  let bannerImageUrl = "";
  if (req.file) {
    const result = await uploadToCloudinary(req.file.path);
    bannerImageUrl = result.secure_url;
  }

  const newDeal = await Deal.create({
    name,
    discount,
    description,
    category_id: category_id || null,
    product_id: product_id || null,
    vendor_id: vendor._id,
    start_date,
    end_date,
    banner_image: bannerImageUrl,
  });

  await clearDealCaches();
  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.DEAL_CREATED}: ${newDeal.name}`, newDeal._id);

  return res.status(201).json(new apiResponse(201, "Deal added successfully", newDeal));
});

export const getAllDeals = asyncHandler(async (req, res) => {
  const deals = await Deal.find({ is_active: true, end_date: { $gte: new Date() } })
    .populate("category_id")
    .populate("product_id")
    .populate("vendor_id")
    .sort({ createdAt: -1 });

  return res.status(200).json(new apiResponse(200, "Deals retrieved successfully", deals));
});

export const getVendorDeals = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const vendor = await VendorModel.findOne({ owner: userId });

  if (!vendor) {
    throw new apiError(404, "Vendor profile not found");
  }

  const deals = await Deal.find({ vendor_id: vendor._id })
    .populate("category_id")
    .populate("product_id")
    .sort({ createdAt: -1 });

  return res.status(200).json(new apiResponse(200, "Vendor deals retrieved successfully", deals));
});

export const updateDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user._id || req.user.id;

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new apiError(404, "Deal not found");
  }

  const vendor = await VendorModel.findOne({ owner: userId });
  if (!vendor || (deal.vendor_id.toString() !== vendor._id.toString() && req.user.role !== 'admin')) {
    throw new apiError(403, "Unauthorized to update this deal");
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.path);
    updates.banner_image = result.secure_url;
  }

  const updatedDeal = await Deal.findByIdAndUpdate(id, updates, { new: true });

  await clearDealCaches();
  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.DEAL_UPDATED}: ${updatedDeal.name}`, updatedDeal._id);

  return res.status(200).json(new apiResponse(200, "Deal updated successfully", updatedDeal));
});

export const deleteDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new apiError(404, "Deal not found");
  }

  const vendor = await VendorModel.findOne({ owner: userId });
  if (!vendor || (deal.vendor_id.toString() !== vendor._id.toString() && req.user.role !== 'admin')) {
    throw new apiError(403, "Unauthorized to delete this deal");
  }

  const dealName = deal.name;
  await Deal.findByIdAndDelete(id);

  await clearDealCaches();
  // Activity Log
  await createLog(userId, `${ACTIVITY_LOG_ACTIONS.DEAL_DELETED}: ${dealName}`, null);

  return res.status(200).json(new apiResponse(200, "Deal deleted successfully"));
});
