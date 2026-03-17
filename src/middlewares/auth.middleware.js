import jwt from "jsonwebtoken";
import { apiError } from "../utils/apiError.js";
import { getCache, setCache } from "../utils/redis.util.js";
import { UserModel as User } from "../models/user.model.js";
import { options, REDIS_KEY_USER_PREFIX } from "../constant.js";

/**
 * @desc Core authentication logic
 * @param {boolean} ignoreExpiration - Whether to allow expired tokens (e.g., for logout)
 */
/**
 * @desc Core authentication logic
 * @param {boolean} ignoreExpiration - Whether to allow expired tokens (e.g., for logout)
 */
const authenticate = async (req, res, next, ignoreExpiration = false) => {
  console.log(`🔍 [DEBUG] authenticate called for ${req.method} ${req.url}`);
  console.log(`🔍 [DEBUG] next is a function: ${typeof next === 'function'}`);

  try {
    // 1. Get token from cookies (primary) or Authorization header (fallback)
    let token = req.cookies?.accessToken;

    // If not in cookies, try Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7); // Remove "Bearer " prefix
      }
    }

    if (!token) {
      console.error("❌ No token found in cookies or Authorization header");
      throw new apiError(401, "Not authorized, access token missing");
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
      ignoreExpiration,
    });

    if (!decoded?.userId) {
      console.error("❌ Decoded token has no userId");
      throw new apiError(401, "Invalid token");
    }

    const userId = decoded.userId;

    // 3. Check Redis cache first
    let user = await getCache(`${REDIS_KEY_USER_PREFIX}${userId}`);

    // 4. If not in cache, fetch from DB
    if (!user) {
      user = await User.findById(userId).select("-password -refreshToken");
      if (!user) {
        console.error("❌ User not found:", userId);
        throw new apiError(404, "User not found");
      }

      // 5. Cache user in Redis for 5 hours
      await setCache(`${REDIS_KEY_USER_PREFIX}${userId}`, user, 60 * 60 * 5);
    }

    // 6. Attach user to request object
    req.user = user;
    
    if (typeof next === 'function') {
        next();
    } else {
        console.error("❌ [CRITICAL] next is not a function at end of authenticate");
        res.status(500).json({ success: false, message: "Internal Server Error: next is not a function" });
    }
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    
    if (typeof next !== 'function') {
        console.error("❌ [CRITICAL] next is not a function in authenticate catch block");
        return res.status(500).json({ success: false, message: "Internal Server Error: next is not a function" });
    }

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
export const authMiddleware = async (req, res, next) => {
  await authenticate(req, res, next, false);
};

/**
 * @desc Admin only middleware
 */
export const isAdmin = async (req, res, next) => {
  if (req.user?.role !== "admin") {
    if (typeof next === 'function') {
        return next(new apiError(403, "Access denied. Admin role required."));
    } else {
        return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
    }
  }
  if (typeof next === 'function') {
    next();
  } else {
    console.error("❌ [CRITICAL] next is not a function in isAdmin");
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * @desc Vendor only middleware
 */
export const isVendor = async (req, res, next) => {
  if (req.user?.role !== "vendor" && req.user?.role !== "admin") {
    if (typeof next === 'function') {
        return next(new apiError(403, "Access denied. Vendor role required."));
    } else {
        return res.status(403).json({ success: false, message: "Access denied. Vendor role required." });
    }
  }
  if (typeof next === 'function') {
    next();
  } else {
    console.error("❌ [CRITICAL] next is not a function in isVendor");
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * @desc Permissive Auth middleware for logout
 * Allows expired tokens so specific cleanup can still happen.
 */
export const logoutMiddleware = async (req, res, next) => {
  await authenticate(req, res, next, true);
};
