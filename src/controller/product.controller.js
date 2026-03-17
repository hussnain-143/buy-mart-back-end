import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ProductModel as Product } from "../models/product.model.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { CategoryModel as Category } from "../models/category.model.js";
import { BrandModel as Brand } from "../models/brand.model.js";
import { VendorModel as Vendor } from "../models/vendor.model.js";
import { ImageModel as Image } from "../models/product_images.model.js";
import mongoose from "mongoose";

// Add Product
const addProduct = asyncHandler(async (req, res) => {
    const { 
        name, 
        desc, // Changed from description
        price, 
        discount_price, 
        stock_quantity, 
        category_id, 
        brand_id, 
        sku, 
        is_active, 
        is_featured 
    } = req.body;

    // Validation
    if ([name, desc, price, sku, category_id, brand_id].some((field) => field?.toString().trim() === "")) {
        throw new apiError(400, "All required fields must be filled");
    }

    // Check if category and brand exist
    const category = await Category.findById(category_id);
    if (!category) throw new apiError(404, "Category not found");

    const brand = await Brand.findById(brand_id);
    if (!brand) throw new apiError(404, "Brand not found");

    // Check if SKU exists
    const SKU_Exist = await Product.findOne({ sku });
    if (SKU_Exist) throw new apiError(409, "Product with this SKU already exists");

    // Handle images
    const files = req.files;
    if (!files || files.length === 0) {
        throw new apiError(400, "At least one product image is required");
    }

    // Create product first
    const product = await Product.create({
        name,
        desc,
        price,
        discount_price: discount_price || 0,
        stock_quantity,
        category_id,
        brand_id,
        sku,
        is_active: is_active !== undefined ? is_active : true,
        is_featured: is_featured || false,
        vendor_id: req.user._id
    });

    // Handle images and link back to product
    const imageUploadPromises = files.map((file) => uploadToCloudinary(file.path));
    const uploadedImages = await Promise.all(imageUploadPromises);

    const imagePromises = uploadedImages.map((img, index) => Image.create({
        image_url: img.secure_url,
        product_id: product._id,
        isPrimary: index === 0
    }));

    const createdImages = await Promise.all(imagePromises);

    // Update product with image references
    product.images_id = createdImages.map(img => img._id);
    await product.save();

    return res.status(201).json(new apiResponse(201, "Product created successfully", product));
});

// Update Product
const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) throw new apiError(404, "Product not found");

    // Check if vendor owns product
    if (product.vendor_id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        throw new apiError(403, "You do not have permission to update this product");
    }

    // If images are provided in update
    if (req.files && req.files.length > 0) {
        const imageUploadPromises = req.files.map((file) => uploadToCloudinary(file.path));
        const uploadedImages = await Promise.all(imageUploadPromises);
        
        const imagePromises = uploadedImages.map((img) => Image.create({
            image_url: img.secure_url,
            product_id: product._id,
            isPrimary: false // User can decide later
        }));
        
        const createdImages = await Promise.all(imagePromises);
        const newImageIds = createdImages.map(img => img._id);
        
        updateData.images_id = [...(product.images_id || []), ...newImageIds];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
    );

    return res.status(200).json(new apiResponse(200, "Product updated successfully", updatedProduct));
});

// Get All Products (with filters)
const getAllProducts = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search, 
        category, 
        brand, 
        minPrice, 
        maxPrice, 
        sort = "-createdAt",
        is_featured,
        is_active
    } = req.query;

    const query = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { desc: { $regex: search, $options: "i" } }
        ];
    }

    if (category) query.category_id = category;
    if (brand) query.brand_id = brand;
    if (is_featured !== undefined) query.is_featured = is_featured === "true";
    query.is_active = true; // Only active products for public view
    
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: ["category_id", "brand_id", "vendor_id"]
    };

    const products = await Product.paginate(query, options);

    return res.status(200).json(new apiResponse(200, "Products fetched successfully", products));
});

// Get Product By ID
const getProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Support both SKU and ID
    let product;
    if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id).populate(["category_id", "brand_id", "vendor_id"]);
    } else {
        product = await Product.findOne({ sku: id }).populate(["category_id", "brand_id", "vendor_id"]);
    }

    if (!product) throw new apiError(404, "Product not found");

    return res.status(200).json(new apiResponse(200, "Product fetched successfully", product));
});

// Delete Product
const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) throw new apiError(404, "Product not found");

    // Check permission
    if (product.vendor_id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        throw new apiError(403, "You do not have permission to delete this product");
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json(new apiResponse(200, "Product deleted successfully", {}));
});

// Admin All Products
const getAdminProducts = asyncHandler(async (req, res) => {
    const products = await Product.find().populate(["category_id", "brand_id", "vendor_id"]).sort("-createdAt");
    return res.status(200).json(new apiResponse(200, "Admin products fetched successfully", products));
});

// Get Vendor Products
const getVendorProducts = asyncHandler(async (req, res) => {
    const vendorId = req.user.vendor_id || (await Vendor.findOne({ owner: req.user._id }))?._id;
    if (!vendorId) {
        throw new apiError(404, "Vendor profile not found");
    }
    const products = await Product.find({ vendor_id: vendorId }).populate(["category_id", "brand_id"]).sort("-createdAt");
    return res.status(200).json(new apiResponse(200, "Vendor products fetched successfully", products));
});

// AI Search (placeholder)
const aiSearch = asyncHandler(async (req, res) => {
    // Placeholder for AI search
    return res.status(200).json(new apiResponse(200, "AI search not implemented", []));
});

// Toggle Product Status (Admin)
const toggleProductStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await Product.findById(id);
    
    if (!product) throw new apiError(404, "Product not found");

    product.is_active = !product.is_active;
    await product.save();

    return res.status(200).json(new apiResponse(200, `Product ${product.is_active ? "activated" : "deactivated"}`, product));
});

export {
    addProduct,
    getAllProducts,
    getProductById,
    aiSearch,
    updateProduct,
    deleteProduct,
    getVendorProducts,
    getAdminProducts,
    toggleProductStatus
};
