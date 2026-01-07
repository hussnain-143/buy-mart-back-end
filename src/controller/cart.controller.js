// add item to cart
export const addToCart = asyncHandler(async (req, res) => {

  // 1. Validate inputs
  //    - productId
  //    - quantity (default = 1)

  // 2. Get user ID from req.user

  // 3. Check if cart exists for user
  //    - if not, create new cart

  // 4. Check if product already exists in cart
  //    - if yes, increase quantity
  //    - if no, add new item

  // 5. Recalculate cart totals
  //    - item subtotal
  //    - cart total amount

  // 6. Save cart

  // 7. Send success response
});


// update cart item quantity
export const updateCartItem = asyncHandler(async (req, res) => {

  // 1. Validate inputs
  //    - cartItemId
  //    - quantity (must be >= 1)

  // 2. Find user's cart

  // 3. Find cart item
  //    - if not found, return error

  // 4. Update item quantity

  // 5. Recalculate cart totals

  // 6. Save cart

  // 7. Send response
});


// remove item from cart
export const removeFromCart = asyncHandler(async (req, res) => {

  // 1. Get cart item ID from params

  // 2. Find user's cart

  // 3. Remove item from cart items array

  // 4. Recalculate cart totals

  // 5. Save cart

  // 6. Send success response
});


// get user cart
export const getCart = asyncHandler(async (req, res) => {

  // 1. Get user ID from req.user

  // 2. Find cart by user

  // 3. Populate product details
  //    - name
  //    - price
  //    - image

  // 4. Calculate totals if needed

  // 5. Send cart response
});


// clear cart
export const clearCart = asyncHandler(async (req, res) => {

  // 1. Find user's cart

  // 2. Remove all items

  // 3. Reset totals

  // 4. Save empty cart

  // 5. Send success response
});
