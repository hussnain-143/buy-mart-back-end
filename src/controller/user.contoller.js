import { UserModel as User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { options } from "../constant.js";
import { setCache, deleteCache } from "../utils/redis.util.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

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

  const { firstName, lastName, userName, email, password, role } = req.body;

  if (!firstName || !lastName || !userName || !email || !password) {
    throw new apiError(400, "All required fields must be provided");
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { userName }],
  });
  if (existingUser) throw new apiError(409, "User already exists");

  // Parse address
  let parsedAddress = [];
  if (req.body.address) {
    try {
      parsedAddress = JSON.parse(req.body.address);
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

  return res.status(201).json({
    status: 201,
    message: "User registered successfully",
    data: { user: createdUser },
  });
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

  const loginUser = await User.findById(user._id)
    .select("-password -refreshToken");

  // Cache user for 5 hours
  await setCache(`user:${user._id}`, loginUser, 60 * 60 * 5);

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
  await deleteCache(`user:${userId}`);

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
  await deleteCache(`user:${req.user._id}`);

  return res.status(200).json(
    new apiResponse(
      200,
      "Password updated successfully. Please login again."
    )
  );
});
