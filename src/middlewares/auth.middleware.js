import jwt from "jsonwebtoken";
import { apiError } from "../utils/apiError";
import { getCache, setCache } from "../utils/redis.util";
import User from "../models/user.model";
import { options } from "../constant";

/**
 * @desc Auth middleware to protect private routes
 * Checks accessToken in cookies, verifies it, and fetches user
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get token from cookies
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new apiError(401, "Not authorized, access token missing");
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      throw new apiError(401, "Invalid token");
    }

    const userId = decoded.id;

    // 3. Check Redis cache first
    let user = await getCache(`user:${userId}`);

    // 4. If not in cache, fetch from DB
    if (!user) {
      user = await User.findById(userId).select("-password -refreshToken");
      if (!user) {
        throw new apiError(404, "User not found");
      }

      // 5. Cache user in Redis for 5 hours
      await setCache(`user:${userId}`, user, 60 * 60 * 5);
    }

    // 6. Attach user to request object
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new apiError(401, "Access token expired"));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new apiError(401, "Invalid access token"));
    }
    next(error);
  }
};
