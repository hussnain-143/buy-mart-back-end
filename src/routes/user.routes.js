import express from "express";
import {
  Signup_User,
  Login_User,
  Logout_User,
  Get_User,
  Update_Profile,
  Update_Password,
  Update_Address,
} from "../controller/user.contoller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

// Create router for all user-related APIs
export const userRoutes = express.Router();

/* ============================
   AUTHENTICATION ROUTES
   ============================ */

/**
 * Signup user
 * - Creates a new user account
 * - Supports profile image upload
 */
userRoutes.post("/signup", upload.single("profile"), Signup_User);

/**
 * Login user
 * - Verifies username & password
 * - Returns access & refresh tokens
 */
userRoutes.post("/login", Login_User);

/**
 * Logout user
 * - Clears cookies / tokens
 * - Requires authentication
 */
userRoutes.post("/logout", authMiddleware, Logout_User);

/* ============================
   USER PROFILE ROUTES
   ============================ */

/**
 * Get logged-in user details
 * - Returns current user's profile
 */
userRoutes.get("/me", authMiddleware, Get_User);

/**
 * Update basic profile information
 * - firstName, lastName, userName, email
 */
userRoutes.put("/update-profile", upload.single("profile"), authMiddleware, Update_Profile);

/**
 * Update user password
 * - Requires old password
 * - Sets new password securely
 */
userRoutes.put("/update-password", authMiddleware, Update_Password);

/**
 * Update user address
 * - Updates shipping / billing address
 */
userRoutes.put("/update-address", authMiddleware, Update_Address);
