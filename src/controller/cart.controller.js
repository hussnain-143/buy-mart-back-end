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
  const cachedCart = await getCache(cacheKey);
  if (cachedCart) {
    return res.status(200).json(
      new apiResponse(200, "Cart retrieved successfully (from cache)", cachedCart)
    );
  }

  const cartItems = await Cart.find({ user_id: userId }).populate({
    path: "product_id",
    populate: ["brand_id", "category_id", "images_id"]
  });

  // Set Cache
  await setCache(cacheKey, cartItems);

  return res.status(200).json(
    new apiResponse(200, "Cart retrieved successfully", cartItems)
  );
});

/* =====================================================
   UPDATE CART ITEM
===================================================== */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { id } = req.params; // cart item id
  const { quantity } = req.body;
  const userId = req.user._id || req.user.id;

  if (quantity < 1) {
    throw new apiError(400, "Quantity must be at least 1");
  }

  const cartItem = await Cart.findById(id);
  if (!cartItem) {
    throw new apiError(404, "Cart item not found");
  }

  if (cartItem.user_id.toString() !== userId.toString()) {
    throw new apiError(403, "Unauthorized to update this cart item");
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
  const { id } = req.params; // cart item id
  const userId = req.user._id || req.user.id;

  const cartItem = await Cart.findById(id);
  if (!cartItem) {
    throw new apiError(404, "Cart item not found");
  }

  if (cartItem.user_id.toString() !== userId.toString()) {
    throw new apiError(403, "Unauthorized to remove this cart item");
  }

  await Cart.findByIdAndDelete(id);

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
