import express from "express";
import { Get_User_Activity_Logs, Get_Log_Entries } from "../controller/log.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const activityLogRoutes = express.Router();

/**
 * Get current user's activity logs
 * - Requires authentication
 * - Returns paginated activity logs for the logged-in user
 */
activityLogRoutes.get("/", authMiddleware, Get_Log_Entries);
activityLogRoutes.get("/user", authMiddleware, Get_User_Activity_Logs);

/**
 * Get activity logs for a specific user (by user ID)
 * - Requires authentication
 * - Admin or user can access their own logs
 */
activityLogRoutes.get("/user/:userId", authMiddleware, Get_User_Activity_Logs);

/**
 * Get all activity logs (Admin only)
 * - Requires authentication
 * - Returns all logs from all users
 */
activityLogRoutes.get("/all", authMiddleware, Get_Log_Entries);
