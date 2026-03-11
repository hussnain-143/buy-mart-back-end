/**
 * Log Controller
 * Handles logging operations for the application.
 */
import { ActivityLogModel as Log } from "../models/activityLog.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logInfo } from "../service/log.services.js";

/* =====================================================
   CREATE LOG ENTRY
===================================================== */
export const Create_Log_Entry = asyncHandler(async (req, res) => {
    const { user_id, action, reference_id } = req.body;

    if (!user_id || !action) {
        throw new apiError(400, "User ID and action are required");
    }

    const logEntry = new Log({
        user_id,
        action,
        reference_id: reference_id || null,
    });

    await logEntry.save();

    logInfo(`Log entry created for user: ${user_id}, action: ${action}`);

    return res.status(201).json(
        new apiResponse(201, "Log entry created successfully", logEntry)
    );
});

/* =====================================================
   GET ALL LOG ENTRIES (Admin)
===================================================== */
export const Get_Log_Entries = asyncHandler(async (req, res) => {
    const logs = await Log.find().populate("user_id", "userName email firstName lastName").sort({ createdAt: -1 });

    return res.status(200).json(
        new apiResponse(200, "Log entries retrieved successfully", logs)
    );
});

/* =====================================================
   GET USER ACTIVITY LOGS
===================================================== */
export const Get_User_Activity_Logs = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.params.userId;

    if (!userId) {
        throw new apiError(400, "User ID is required");
    }

    // Optional query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = { user_id: userId };

    // Optional: filter by action if provided
    if (req.query.action) {
        query.action = { $regex: req.query.action, $options: "i" };
    }

    // Get logs with pagination
    const logs = await Log.find(query)
        .populate("user_id", "userName email firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // Get total count for pagination
    const totalLogs = await Log.countDocuments(query);

    return res.status(200).json(
        new apiResponse(200, "User activity logs retrieved successfully", {
            logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalLogs / limit),
                totalLogs,
                hasNextPage: page < Math.ceil(totalLogs / limit),
                hasPrevPage: page > 1,
            },
        })
    );
});