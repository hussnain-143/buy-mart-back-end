

// add brand
export const addBrand = asyncHandler(async (req, res) => {

  // 1. Validate inputs
  //    - check brand name
  //    - check logo file existsx
  // 2. Check if brand already exists
  //    - prevent duplicate brand names

  // 4. Save brand
  //    - store name
  //    - store logo URL
  //    - link brand with vendor (req.user)

  // 5. Send success response
});


// update brand (set active / non-active)
export const updateBrandStatus = asyncHandler(async (req, res) => {

  // 1. Get brand ID from params

  // 2. Find brand in database
  //    - if not found, return error

  // 3. Verify vendor ownership or admin access

  // 4. Toggle isActive status
  //    - active → inactive
  //    - inactive → active

  // 5. Save updated brand

  // 6. Send response
});


// delete brand
export const deleteBrand = asyncHandler(async (req, res) => {

  // 1. Get brand ID from params

  // 2. Find brand in database
  //    - if not found, return error

  // 3. Verify vendor ownership or admin access

  // 4. Delete brand from database
  //    - optional: also delete logo from cloud storage

  // 5. Send success response
});
