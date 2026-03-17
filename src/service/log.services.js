import { ActivityLogModel as Log } from "../models/activityLog.model.js";

/**
 * Log Service
 * Provides logging functionalities for the application.
 */

export const logInfo = (message) => {
    console.log(`INFO: ${message}`);
};

export const createLog = async (userId, action, referenceId = null) => {
    const logEntry = new Log({
        user_id: userId,
        action,
        reference_id: referenceId,
    });
    await logEntry.save();
    logInfo(`Log entry created for user: ${userId}, action: ${action}`);
    return logEntry;
};