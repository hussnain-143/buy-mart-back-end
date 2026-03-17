import jwt from "jsonwebtoken";
import { UserModel as User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { options, REDIS_KEY_USER_PREFIX, ACTIVITY_LOG_ACTIONS } from "../constant.js";
import { setCache, deleteCache } from "../utils/redis.util.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";

/* =====================================================
   TOKEN GENERATOR
   - Creates access & refresh tokens
   - Saves refresh token in database
===================================================== */
const generateAccessAndRefreshTokens = async (id) => {
  try {
    const user = await User.findById(id);
    if (!user) throw new apiError(404, "User not found");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Error generating tokens");
  }
};

/* =====================================================
   SIGNUP USER
===================================================== */
export const Signup_User = asyncHandler(async (req, res) => {

  const { firstName, lastName, userName, email, password, role, city, street, houseNo } = req.body;

  if (!firstName || !lastName || !userName || !email || !password || !role || !city || !street || !houseNo) {
    throw new apiError(400, "All required fields must be provided");
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { userName }],
  });
  if (existingUser) throw new apiError(409, "User already exists");

  // Parse address
  let parsedAddress = [];

  if (req.body.city && req.body.street && req.body.houseNo) {
    try {

      parsedAddress = [{
        city: req.body.city,
        street: req.body.street,
        houseNo: req.body.houseNo,
      }];
    } catch (err) {
      throw new apiError(400, "Invalid address format");
    }
  }

  // Upload profile
  let profileUrl = "";
  if (req.file?.path) {
    try {
      const uploadResult = await uploadToCloudinary(req.file.path);
      profileUrl = uploadResult?.secure_url;
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      profileUrl = `/uploads/${req.file.filename}`;
    }
  }

  const user = await User.create({
    firstName,
    lastName,
    userName,
    email,
    password,
    role,
    profileUrl,
    address: parsedAddress,
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (createdUser) {
    // Create log entry for new user registration
    await createLog(createdUser._id, `${ACTIVITY_LOG_ACTIONS.USER_REGISTRATION} with Username: ${createdUser.userName}`, null);
  }

  return res.status(201).json(
    new apiResponse(201, "User registered successfully", { user: createdUser })
  );
});

/* =====================================================
   LOGIN USER
===================================================== */
export const Login_User = asyncHandler(async (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    throw new apiError(400, "Username and password are required");
  }

  const user = await User.findOne({ userName });
  if (!user) throw new apiError(401, "Invalid credentials");

  const isMatch = await user.isPasswordMatch(password);
  if (!isMatch) throw new apiError(401, "Invalid credentials");

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshTokens(user._id);

  const tempUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .lean();

  const vendor_sub = await VendorSubscriptionModel.findOne({
    user: user._id,
  }).populate('vendor').lean();

  const loginUser = { ...tempUser, vendor_subscription: vendor_sub };

  // Cache user for 5 hours
  await setCache(`${REDIS_KEY_USER_PREFIX}${user._id}`, loginUser, 60 * 60 * 5);

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(200, "Login successful", {
        user: loginUser,
        accessToken,
        refreshToken,
      })
    );
});

/* =====================================================
   REFRESH ACCESS TOKEN
===================================================== */
export const Refresh_Access_Token = asyncHandler(async (req, res) => {
  // Try to get refresh token from cookies first (primary method)
  let incomingRefreshToken = req.cookies?.refreshToken;
  console.log("🔄 Refresh Token Request:", {
    hasCookie: !!req.cookies?.refreshToken,
    hasAuthHeader: !!req.headers.authorization,
  });

  // If not in cookies, try to get from Authorization header (fallback)
  if (!incomingRefreshToken && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      incomingRefreshToken = authHeader.slice(7); // Remove "Bearer " prefix
      console.log("📝 Using refresh token from Authorization header");
    }
  }

  if (!incomingRefreshToken) {
    console.error("❌ No refresh token found");
    throw new apiError(401, "Refresh token is required");
  }

  try {
    // Allow expired refresh tokens to be verified (they're meant to be long-lived)
    // We check the token in DB as the source of truth
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      { ignoreExpiration: true } // Allow expired tokens to be verified
    );

    console.log("✓ Refresh token decoded for user:", decoded.userId);

    if (!decoded?.userId) {
      throw new apiError(401, "Invalid refresh token structure");
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      console.error("❌ User not found:", decoded.userId);
      throw new apiError(401, "User not found");
    }

    // Check if refresh token matches the one stored in database (source of truth)
    if (incomingRefreshToken !== user.refreshToken) {
      console.error("❌ Refresh token mismatch - invalid or revoked");
      throw new apiError(401, "Refresh token is invalid or revoked");
    }

    console.log("✓ Refresh token matches DB record");

    // Verify token wasn't expired for more than 30 days (or configured expiry)
    // This prevents using very old tokens
    if (decoded.exp) {
      const tokenAge = Math.floor(Date.now() / 1000) - decoded.exp;
      const maxAllowedAge = 60 * 60 * 24 * 30; // 30 days in seconds

      if (tokenAge > maxAllowedAge) {
        console.error("❌ Refresh token too old:", tokenAge, "seconds");
        throw new apiError(401, "Refresh token has expired");
      }
    }

    // Generate new tokens
    const { accessToken, refreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    console.log("✓ New access token generated for user:", user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new apiResponse(200, "Access token refreshed successfully", {
          accessToken,
          refreshToken,
        })
      );
  } catch (error) {
    console.error("❌ Token refresh error:", error.message);

    if (error.message === "Refresh token has expired") {
      throw error; // Re-throw our custom error
    }
    if (error.name === "JsonWebTokenError") {
      throw new apiError(401, "Invalid refresh token");
    }
    if (error.isApiError) {
      throw error; // Re-throw API errors
    }

    throw new apiError(401, "Failed to refresh token");
  }
});

/* =====================================================
   GET CURRENT USER
===================================================== */
export const Get_User = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new apiResponse(200, "User profile fetched successfully", {
      user: req.user,
    })
  );
});

/* =====================================================
  LOGOUT USER
===================================================== */
export const Logout_User = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Remove user from Redis cache
  await deleteCache(`${REDIS_KEY_USER_PREFIX}${userId}`);

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res
    .status(200)
    .json(new apiResponse(200, "Logged out successfully"));
});

/* =====================================================
  UPDATE PROFILE (WITH IMAGE UPLOAD)
===================================================== */
export const Update_Profile = asyncHandler(async (req, res) => {
  const { firstName, lastName } = req.body;

  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;

  // Upload new profile image (optional)
  if (req.file?.path) {
    const uploadResult = await uploadToCloudinary(req.file.path);
    updateData.profileUrl = uploadResult?.secure_url;
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedUser) throw new apiError(404, "User not found");

  // Update Redis cache
  await setCache(`user:${req.user._id}`, updatedUser, 60 * 60 * 5);

  // Create log entry for profile update
  await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.USER_PROFILE_UPDATED} for Username: ${updatedUser.userName}`, null);

  return res.status(200).json(
    new apiResponse(200, "User profile updated successfully", {
      user: updatedUser,
    })
  );
});

/* =====================================================
   UPDATE ADDRESS
===================================================== */
export const Update_Address = asyncHandler(async (req, res) => {
  const { address } = req.body;

  if (!Array.isArray(address)) {
    throw new apiError(400, "Address array is required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { address },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedUser) throw new apiError(404, "User not found");

  // Update Redis cache
  await setCache(`user:${req.user._id}`, updatedUser, 60 * 60 * 5);

  // Create log entry for address update
  await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.USER_ADDRESS_UPDATED} for Username: ${updatedUser.userName}`, null);

  return res.status(200).json(
    new apiResponse(200, "Address updated successfully", {
      user: updatedUser,
    })
  );
});

/* =====================================================
  UPDATE PASSWORD
===================================================== */
export const Update_Password = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new apiError(400, "Old and new password are required");
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new apiError(404, "User not found");

  const isMatch = await user.isPasswordMatch(oldPassword);
  if (!isMatch) throw new apiError(401, "Old password is incorrect");

  user.password = newPassword;
  user.refreshToken = null;
  await user.save();

  // Remove cached user (force re-login)
  await deleteCache(`${REDIS_KEY_USER_PREFIX}${req.user._id}`);

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  // Create log entry for password update
  await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.USER_PASSWORD_UPDATED} for Username: ${user.userName}`, null);

  return res.status(200).json(
    new apiResponse(
      200,
      "Password updated successfully. Please login again."
    )
  );
});

/* =====================================================
   GET ALL USERS (Admin Only)
===================================================== */
export const Get_All_Users = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken").sort({ createdAt: -1 });
  return res.status(200).json(
    new apiResponse(200, "All users fetched successfully", { users })
  );
});

/* =====================================================
   TOGGLE USER STATUS (Admin Only)
===================================================== */
export const Toggle_User_Status = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  // Toggle status (assuming isActive field exists, defaulting to true if undefined)
  user.isActive = user.isActive === false ? true : false;
  await user.save({ validateBeforeSave: false }); // Skip validation for status change

  // Clear user cache to force logout or data refresh
  await deleteCache(`${REDIS_KEY_USER_PREFIX}${user._id}`);

  // If blocked, also clear refresh token to force re-login if unblocked later
  if (!user.isActive) {
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }

  // Activity Log
  await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.USER_PROFILE_UPDATED}: Status toggled to ${user.isActive ? 'Active' : 'Blocked'} for ${user.userName}`, user._id);

  return res.status(200).json(
    new apiResponse(200, `User ${user.isActive ? 'activated' : 'blocked'} successfully`, { user })
  );
});
