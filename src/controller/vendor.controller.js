import { VendorModel } from "../models/vendor.model.js";
import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { Create_Log_Entry } from "./log.controller.js";

/**
 * Create a new vendor
 */
export const createVendor = asyncHandler(async (req, res, next) => {
  try {
    console.log("📨 Request body:", req.body);
    console.log("📂 Request files:", req.files);
    console.log("👤 User:", req.user?._id);
    
    const { shop_name, description } = req.body;

    if (!shop_name || !description) {
      console.error("❌ Missing fields - shop_name:", shop_name, "description:", description);
      return next(new apiError(400, "Shop name and description are required"));
    }

    // Check if user already has a vendor
    const existingVendor = await VendorModel.findOne({ owner: req.user._id });
    if (existingVendor) {
      return next(new apiError(400, "User already has a vendor"));
    }

    let profileImageUrl = "";
    let coverImageUrl = "";

    // Upload Profile Image
    if (req.files?.profile_image?.[0]) {
      try {
        const result = await uploadToCloudinary(
          req.files.profile_image[0].path
        );
        profileImageUrl = result.secure_url;
      } catch (error) {
        console.error("Profile image upload failed:", error);
      }
    }

    // Upload Cover Image
    if (req.files?.cover_image?.[0]) {
      try {
        const result = await uploadToCloudinary(
          req.files.cover_image[0].path
        );
        coverImageUrl = result.secure_url;
      } catch (error) {
        console.error("Cover image upload failed:", error);
      }
    }

    const newVendor = await VendorModel.create({
      shop_name,
      desc: description,
      owner: req.user._id,
      profile_image: profileImageUrl,
      cover_image: coverImageUrl,
    });

    // Log vendor creation
    if (newVendor) {
      await Create_Log_Entry({
        body: {
          user_id: req.user._id,
          action: "Vendor Created with Shop Name: " + shop_name,
          reference_id: newVendor._id,
        },
      }, {
        status: () => ({ json: () => {} }),
      });
    }

    return res
      .status(201)
      .json(new apiResponse(201, "Vendor created successfully", newVendor));
  } catch (error) {
    console.error("❌ Vendor creation error:", error);
    next(error);
  }
});
