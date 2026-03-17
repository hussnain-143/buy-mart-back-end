import { VendorModel } from "../models/vendor.model.js";
import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";
import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
import { setCache, getCache, deleteCache } from "../utils/redis.util.js";
import { REDIS_KEY_VENDORS_ALL, ACTIVITY_LOG_ACTIONS } from "../constant.js";

/**
 * Create a new vendor
 */
export const createVendor = asyncHandler(async (req, res, next) => {
  try {
    const { shop_name, description, desc } = req.body;
    const finalDesc = description || desc;

    if (!shop_name || !finalDesc) {
      console.error("❌ Missing fields - shop_name:", shop_name, "description/desc:", finalDesc);
      return next(new apiError(400, "Shop name and description are required"));
    }

    // Check if user already has a vendor
    const existingVendor = await VendorModel.findOne({ owner: req.user._id });
    if (existingVendor) {
      return next(new apiError(400, "User already has a vendor"));
    }

    // Check for active subscription
    const subscription = await VendorSubscriptionModel.findOne({
      user: req.user._id,
      is_active: true,
      status: "active",
      end_date: { $gt: new Date() },
    });

    if (!subscription) {
      return next(new apiError(403, "Active subscription required to create a vendor account"));
    }

    let profileImageUrl = "";
    let coverImageUrl = "";

    // Upload Profile Image
    if (req.files?.profile_image?.[0]) {
      try {
        const result = await uploadToCloudinary(req.files.profile_image[0].path);
        profileImageUrl = result.secure_url;
      } catch (error) {
        console.error("❌ Profile image upload failed:", error);
        return next(new apiError(500, "Failed to upload profile image"));
      }
    }

    // Upload Cover Image
    if (req.files?.cover_image?.[0]) {
      try {
        const result = await uploadToCloudinary(req.files.cover_image[0].path);
        coverImageUrl = result.secure_url;
      } catch (error) {
        console.error("❌ Cover image upload failed:", error);
        return next(new apiError(500, "Failed to upload cover image"));
      }
    }

    // Create vendor
    const newVendor = await VendorModel.create({
      shop_name,
      desc: finalDesc,
      owner: req.user._id,
      profile_image: profileImageUrl,
      cover_image: coverImageUrl,
      subscription: subscription._id,
      stripe_customer_id: subscription.stripe_customer_id,
    });

    // Update subscription with vendor ID
    subscription.vendor = newVendor._id;
    await subscription.save();

    // Log vendor creation
    await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.VENDOR_CREATED} with Shop Name: ${shop_name}`, newVendor._id);

    // Invalidate all vendors cache
    await deleteCache(REDIS_KEY_VENDORS_ALL);

    return res.status(201).json(new apiResponse(201, "Vendor created successfully", newVendor));
  } catch (error) {
    console.error("❌ Vendor creation error:", error);
    next(error);
  }
});

/**
 * Get All Vendors
 */
export const getAllVendors = asyncHandler(async (req, res, next) => {
  try {
    const cachedVendors = await getCache(REDIS_KEY_VENDORS_ALL);
    if (cachedVendors) {
      return res.status(200).json(new apiResponse(200, "Vendors retrieved successfully", cachedVendors));
    }

    const vendors = await VendorModel.find()
      .populate("owner")
      .select("-password -refreshToken")
      .exec();

    // Cache for 5 hours
    await setCache(REDIS_KEY_VENDORS_ALL, vendors, 60 * 60 * 5);

    return res.status(200).json(new apiResponse(200, "Vendors retrieved successfully", vendors));
  } catch (error) {
    console.error("❌ Get all vendors error:", error);
    next(error);
  }
});

/**
 * Approve Vendor
 */
export const approveVendor = asyncHandler(async (req, res, next) => {
  try {
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return next(new apiError(400, "Vendor ID is required"));
    }

    const vendor = await VendorModel.findById(vendor_id);
    if (!vendor) {
      return next(new apiError(404, "Vendor not found"));
    }

    if (vendor.is_active) {
      return next(new apiError(400, "Vendor is already active"));
    }

    vendor.is_active = true;
    await vendor.save();

    // Invalidate all vendors cache
    await deleteCache(REDIS_KEY_VENDORS_ALL);

    // Log vendor approval
    await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.VENDOR_APPROVED} for Shop Name: ${vendor.shop_name}`, vendor._id);

    return res.status(200).json(new apiResponse(200, "Vendor approved successfully", vendor));
  } catch (error) {
    console.error("❌ Approve vendor error:", error);
    next(error);
  }
});

/**
 * Get Vendor Strip Id
 */
export const getVendorStripeId = asyncHandler(async (req, res, next) => {
  try {
    const vendor = await VendorModel.findOne({ owner: req.user._id, is_active: true });
    if (!vendor) {
      return next(new apiError(404, "Vendor not found"));
    }

    return res.status(200).json(new apiResponse(200, "Stripe Vendor ID retrieved successfully", { stripe_vendor_id: vendor.stripe_vendor_id }));
  } catch (error) {
    console.error("❌ Get vendor Stripe ID error:", error);
    next(error);
  }
});

/**
 * Set Vendor Stripe Id
 * 
 */
export const setVendorStripeId = asyncHandler(async (req, res, next) => {
  const { stripe_vendor_id } = req.body;

  if (!stripe_vendor_id) {
    return next(new apiError(400, "Stripe Vendor ID is required"));
  }

  const updatedVendor = await VendorModel.findOneAndUpdate(
    { owner: req.user._id, is_active: true },
    { stripe_vendor_id },
    { new: true }
  );

  if (!updatedVendor) {
    return next(new apiError(404, "Vendor not found"));
  }

  return res
    .status(200)
    .json(
      new apiResponse(200, "Stripe Vendor ID updated successfully", updatedVendor)
    );
});

export const toggleVendorStatus = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const vendor = await VendorModel.findById(id);
    if (!vendor) {
      return next(new apiError(404, "Vendor not found"));
    }

    vendor.is_active = !vendor.is_active;
    await vendor.save();

    // Invalidate all vendors cache
    await deleteCache(REDIS_KEY_VENDORS_ALL);

    // Log status toggle
    await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.VENDOR_UPDATED}: Status toggled for ${vendor.shop_name} to ${vendor.is_active ? 'active' : 'inactive'}`, vendor._id);

    return res.status(200).json(new apiResponse(200, "Vendor status updated successfully", vendor));
  } catch (error) {
    console.error("❌ Toggle vendor status error:", error);
    next(error);
  }
});

/**
 * Get Own Vendor Profile
 */
export const getMyVendor = asyncHandler(async (req, res, next) => {
  try {
    const vendor = await VendorModel.findOne({ owner: req.user._id });
    if (!vendor) {
      return next(new apiError(404, "Vendor profile not found"));
    }

    return res.status(200).json(new apiResponse(200, "Vendor profile retrieved successfully", vendor));
  } catch (error) {
    console.error("❌ Get my vendor error:", error);
    next(error);
  }
});

/**
 * Update Vendor Profile
 */
export const updateVendor = asyncHandler(async (req, res, next) => {
  try {
    const { shop_name, description, desc, support_email, support_phone, shop_address, slug } = req.body;
    const finalDesc = description || desc;

    const vendor = await VendorModel.findOne({ owner: req.user._id });
    if (!vendor) {
      return next(new apiError(404, "Vendor profile not found"));
    }

    if (shop_name) vendor.shop_name = shop_name;
    if (finalDesc) vendor.desc = finalDesc;
    if (support_email) vendor.support_email = support_email;
    if (support_phone) vendor.support_phone = support_phone;
    if (shop_address) vendor.shop_address = shop_address;
    if (slug) vendor.slug = slug;

    // Handle Image Uploads
    if (req.files?.profile_image?.[0]) {
      const result = await uploadToCloudinary(req.files.profile_image[0].path);
      vendor.profile_image = result.secure_url;
    }
    if (req.files?.cover_image?.[0]) {
      const result = await uploadToCloudinary(req.files.cover_image[0].path);
      vendor.cover_image = result.secure_url;
    }

    await vendor.save();

    // Log update
    await createLog(
      req.user._id,
      `${ACTIVITY_LOG_ACTIONS.VENDOR_UPDATED}: ${vendor.shop_name}`,
      vendor._id
    );

    // Invalidate caches
    await deleteCache(REDIS_KEY_VENDORS_ALL);

    return res.status(200).json(new apiResponse(200, "Vendor profile updated successfully", vendor));
  } catch (error) {
    console.error("❌ Update vendor error:", error);
    next(error);
  }
});
