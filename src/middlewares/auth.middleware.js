import jwt from "jsonwebtoken";
import { apiError } from "../utils/apiError.js";
import { getCache, setCache } from "../utils/redis.util.js";
import { UserModel as User } from "../models/user.model.js";
import { options } from "../constant.js";

/**
 * @desc Core authentication logic
 * @param {boolean} ignoreExpiration - Whether to allow expired tokens (e.g., for logout)
 */
const authenticate = async (req, next, ignoreExpiration = false) => {
  try {
    // 1. Get token from cookies
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new apiError(401, "Not authorized, access token missing");
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
      ignoreExpiration,
    });

    if (!decoded?.userId) {
      throw new apiError(401, "Invalid token");
    }

    const userId = decoded.userId;

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

/**
 * @desc Strict Auth middleware to protect private routes
 * Rejects expired tokens.
 */
export const authMiddleware = (req, res, next) => {
  authenticate(req, next, false);
};

/**
 * @desc Permissive Auth middleware for logout
 * Allows expired tokens so specific cleanup can still happen.
 */
export const logoutMiddleware = (req, res, next) => {
  authenticate(req, next, true);
};
