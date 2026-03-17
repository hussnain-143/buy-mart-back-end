import mongoose from "mongoose";
import { CartModel as Cart } from "../models/cartCollection.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getCache, setCache, deleteCache } from "../utils/redis.util.js";
import { REDIS_KEY_USER_CART_PREFIX } from "../constant.js";

// Helper to clear cart cache
const clearCartCache = async (userId) => {
  await deleteCache(`${REDIS_KEY_USER_CART_PREFIX}${userId}`);
};

/* =====================================================
   ADD TO CART
===================================================== */
export const addToCart = asyncHandler(async (req, res) => {
    const { product_id, quantity = 1 } = req.body;
    const userId = req.user._id || req.user.id;

    if (!product_id) {
        throw new apiError(400, "Product ID is required");
    }

    let cartItem = await Cart.findOne({ user_id: userId, product_id });

    if (cartItem) {
        cartItem.quantity += parseInt(quantity);
        await cartItem.save();
    } else {
        cartItem = new Cart({
            user_id: userId,
            product_id,
            quantity: parseInt(quantity),
        });
        await cartItem.save();
    }

    await clearCartCache(userId);

    return res.status(200).json(
        new apiResponse(200, "Item added to cart", cartItem)
    );
});

/* =====================================================
   GET CART
===================================================== */
export const getCart = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const cacheKey = `${REDIS_KEY_USER_CART_PREFIX}${userId}`;

    // Try Cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        return res.status(200).json(
            new apiResponse(200, "Cart retrieved successfully (from cache)", cachedData)
        );
    }

    const allCartItems = await Cart.find({ user_id: userId }).populate({
        path: "product_id",
        populate: ["brand_id", "category_id", "images_id"]
    });

    // Filter out items where product no longer exists
    const cartItems = allCartItems.filter(item => item.product_id !== null);

    // If some items were filtered, we should probably clean them up asynchronously
    if (allCartItems.length !== cartItems.length) {
        Cart.deleteMany({
            user_id: userId,
            product_id: { $in: allCartItems.filter(i => i.product_id === null).map(i => i.product_id) }
        }).catch(err => console.error("Error cleaning up stale cart items:", err));
        // Actually the above query is wrong if product_id is null. 
        // Better:
        Cart.deleteMany({ user_id: userId, product_id: null }).catch(err => console.error(err));
    }

    // Calculate total price
    let total_price = 0;
    cartItems.forEach(item => {
        const price = item.product_id.discount_price > 0 ? item.product_id.discount_price : item.product_id.price;
        total_price += price * item.quantity;
    });

    const responseData = {
        items: cartItems,
        total_price: parseFloat(total_price.toFixed(2))
    };

    // Set Cache
    await setCache(cacheKey, responseData);

    return res.status(200).json(
        new apiResponse(200, "Cart retrieved successfully", responseData)
    );
});

/* =====================================================
   UPDATE CART ITEM
===================================================== */
export const updateCartItem = asyncHandler(async (req, res) => {
    const { id } = req.params; // Can be cart item _id OR product_id
    const { quantity } = req.body;
    const userId = req.user._id || req.user.id;

    if (quantity < 1) {
        throw new apiError(400, "Quantity must be at least 1");
    }

    // Try finding by cart item ID first, then by product ID
    let cartItem = await Cart.findOne({
        user_id: userId,
        $or: [
            { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
            { product_id: mongoose.Types.ObjectId.isValid(id) ? id : null }
        ].filter(cond => cond.$or ? true : Object.values(cond)[0] !== null)
    });

    // Fallback for simple lookup if regex/isValid filter is too complex for some mongo versions
    if (!cartItem) {
        if (mongoose.Types.ObjectId.isValid(id)) {
            cartItem = await Cart.findOne({ user_id: userId, _id: id });
            if (!cartItem) {
                cartItem = await Cart.findOne({ user_id: userId, product_id: id });
            }
        }
    }

    if (!cartItem) {
        throw new apiError(404, "Cart item not found");
    }

    cartItem.quantity = parseInt(quantity);
    await cartItem.save();

    await clearCartCache(userId);

    return res.status(200).json(
        new apiResponse(200, "Cart item updated", cartItem)
    );
});

/* =====================================================
   REMOVE FROM CART
===================================================== */
export const removeFromCart = asyncHandler(async (req, res) => {
    const { id } = req.params; // Can be cart item _id OR product_id
    const userId = req.user._id || req.user.id;

    let cartItem = await Cart.findOne({
        user_id: userId,
        $or: [
            { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
            { product_id: mongoose.Types.ObjectId.isValid(id) ? id : null }
        ].filter(cond => cond.$or ? true : Object.values(cond)[0] !== null)
    });

    if (!cartItem && mongoose.Types.ObjectId.isValid(id)) {
        cartItem = await Cart.findOne({ user_id: userId, _id: id }) || 
                   await Cart.findOne({ user_id: userId, product_id: id });
    }

    if (!cartItem) {
        throw new apiError(404, "Cart item not found");
    }

    await Cart.findByIdAndDelete(cartItem._id);

    await clearCartCache(userId);

    return res.status(200).json(
        new apiResponse(200, "Item removed from cart")
    );
});

/* =====================================================
   CLEAR CART
===================================================== */
export const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    await Cart.deleteMany({ user_id: userId });

    await clearCartCache(userId);

    return res.status(200).json(
        new apiResponse(200, "Cart cleared successfully")
    );
});
