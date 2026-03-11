export const DB_Name = "buy-mart";
export const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production (HTTPS)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production, 'lax' for development
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

// Redis Keys
export const REDIS_KEY_BRANDS = "brands:all";
export const REDIS_KEY_USER_BRANDS_PREFIX = "brands:user:";
export const REDIS_KEY_USER_PREFIX = "user:";
export const REDIS_KEY_VENDORS_ALL = "all_vendors";
export const REDIS_KEY_CATEGORIES_ALL = "categories:all";
export const REDIS_KEY_PRODUCTS_ALL = "products:all";
export const REDIS_KEY_DEALS_ALL = "deals:all";
export const REDIS_KEY_USER_CART_PREFIX = "cart:user:";

// User Roles
export const USER_ROLES = {
    ADMIN: "admin",
    VENDOR: "vendor",
    USER: "user",
};

// Activity Log Actions
export const ACTIVITY_LOG_ACTIONS = {
    BRAND_CREATED: "Brand Created",
    BRAND_UPDATED: "Brand Updated",
    BRAND_DELETED: "Brand Deleted",
    BRAND_STATUS_TOGGLED: "Brand Status Toggled",
    BRAND_APPROVED: "Brand Approved",
    USER_REGISTRATION: "User Registration",
    USER_PROFILE_UPDATED: "User Profile Updated",
    USER_ADDRESS_UPDATED: "User Address Updated",
    USER_PASSWORD_UPDATED: "User Password Updated",
    VENDOR_CREATED: "Vendor Created",
    VENDOR_APPROVED: "Vendor Approved",
    CATEGORY_CREATED: "Category Created",
    CATEGORY_UPDATED: "Category Updated",
    CATEGORY_DELETED: "Category Deleted",
    PRODUCT_CREATED: "Product Created",
    PRODUCT_UPDATED: "Product Updated",
    PRODUCT_DELETED: "Product Deleted",
    DEAL_CREATED: "Deal Created",
    DEAL_UPDATED: "Deal Updated",
    DEAL_DELETED: "Deal Deleted",
    ORDER_CREATED: "Order Created",
    ORDER_STATUS_UPDATED: "Order Status Updated",
    REVIEW_ADDED: "Review Added",
};