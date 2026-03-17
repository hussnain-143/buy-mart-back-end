import { OrderModel as Order } from "../models/orders.model.js";
import { ProductModel as Product } from "../models/product.model.js";
import { UserModel as User } from "../models/user.model.js";
import { VendorModel as Vendor } from "../models/vendor.model.js";
import { OrderItemModel as OrderItem } from "../models/order_items.model.js";
import { ActivityLogModel as Log } from "../models/activityLog.model.js";
import { BrandModel as Brand } from "../models/brand.model.js";
import { ReviewModel as Review } from "../models/review.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc Get Platform-wide Analytics (Admin Only)
 */
export const getAdminStats = asyncHandler(async (req, res) => {
    const totalVendors = await Vendor.countDocuments();
    const totalUsers = await User.countDocuments({ role: "customer" });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, totalRevenue: { $sum: "$total_amount" } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    
    // Monthly Revenue Trends (last 6 months)
    const revenueTrends = await Order.aggregate([
        {
            $match: {
                status: { $ne: "cancelled" },
                createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
            }
        },
        {
            $group: {
                _id: { 
                    month: { $month: "$createdAt" }, 
                    year: { $year: "$createdAt" } 
                },
                revenue: { $sum: "$total_amount" },
                orders: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Category Distribution
    const categoryDistribution = await Product.aggregate([
        {
            $group: {
                _id: "$category_id",
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "category"
            }
        },
        { $unwind: "$category" },
        {
            $project: {
                name: "$category.name",
                value: "$count"
            }
        }
    ]);

    // Top Selling Products
    const topProducts = await OrderItem.aggregate([
        {
            $group: {
                _id: "$product_id",
                sales: { $sum: "$quantity" },
                revenue: { $sum: "$total_price" }
            }
        },
        { $sort: { sales: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }
        },
        { $unwind: "$product" },
        {
            $project: {
                name: "$product.name",
                sales: 1,
                revenue: 1,
                stock: "$product.stock_quantity"
            }
        }
    ]);

    // Recent Activity Logs (Summary for dashboard)
    const recentLogs = await Log.find()
        .populate("user_id", "firstName lastName role")
        .sort({ createdAt: -1 })
        .limit(5);

    return res.status(200).json(
        new apiResponse(200, "Admin stats retrieved successfully", {
            totalVendors,
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            revenueTrends,
            categoryDistribution,
            topProducts,
            recentLogs
        })
    );
});

/**
 * @desc Get Vendor-specific Analytics
 */
export const getVendorStats = asyncHandler(async (req, res) => {
    const vendorId = req.user.vendor_id || (await Vendor.findOne({ owner: req.user._id }))?._id;

    if (!vendorId) {
        return res.status(404).json(
            new apiResponse(404, "Vendor account not found")
        );
    }

    const vendorProducts = await Product.find({ 
        $or: [
            { vendor_id: vendorId },
            { vendor_id: vendorId.toString() },
            { vendor_id: req.user._id },
            { vendor_id: req.user._id.toString() }
        ]
    }).select("_id");
    const productIds = vendorProducts.map(p => p._id);

    const totalProducts = productIds.length;

    // Vendor specific orders (orders containing vendor's products)
    const vendorOrderItems = await OrderItem.find({ product_id: { $in: productIds } });
    const totalOrders = new Set(vendorOrderItems.map(item => item.order_id.toString())).size;

    const totalRevenue = vendorOrderItems.reduce((acc, item) => acc + item.total_price, 0);

    // Monthly Revenue Trends for Vendor (last 6 months)
    const revenueTrends = await OrderItem.aggregate([
        {
            $match: {
                product_id: { $in: productIds }
            }
        },
        {
            $lookup: {
                from: "orders",
                localField: "order_id",
                foreignField: "_id",
                as: "order"
            }
        },
        { $unwind: "$order" },
        {
            $match: {
                "order.status": { $ne: "cancelled" },
                "order.createdAt": { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
            }
        },
        {
            $group: {
                _id: { 
                    month: { $month: "$order.createdAt" }, 
                    year: { $year: "$order.createdAt" } 
                },
                revenue: { $sum: "$total_price" },
                orders: { $addToSet: "$order_id" }
            }
        },
        {
            $project: {
                _id: 1,
                revenue: 1,
                orders: { $size: "$orders" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format trends for frontend (optional but good for consistency)
    const formattedTrends = revenueTrends.map(item => ({
        _id: item._id,
        revenue: item.revenue || 0,
        orders: item.orders || 0
    }));

    // Top Selling Products for this Vendor
    const topProducts = await OrderItem.aggregate([
        {
            $match: {
                product_id: { $in: productIds }
            }
        },
        {
            $group: {
                _id: "$product_id",
                sales: { $sum: "$quantity" },
                revenue: { $sum: "$total_price" }
            }
        },
        { $sort: { sales: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }
        },
        { $unwind: "$product" },
        {
            $project: {
                name: "$product.name",
                sales: 1,
                revenue: 1,
                stock: "$product.stock_quantity"
            }
        }
    ]);

    // Recent Activity Logs related to this Vendor's products/orders
    const recentLogs = await Log.find({
        $or: [
            { vendor_id: vendorId },
            { product_id: { $in: productIds } }
        ]
    })
        .populate("user_id", "firstName lastName role")
        .sort({ createdAt: -1 })
        .limit(5);

    return res.status(200).json(
        new apiResponse(200, "Vendor stats retrieved successfully", {
            totalProducts,
            totalOrders,
            totalRevenue,
            revenueTrends: formattedTrends,
            topProducts,
            recentLogs
        })
    );
});

/**
 * @desc Get dynamic counts for sidebar menus
 */
export const getSidebarMetrics = asyncHandler(async (req, res) => {
    const { role, _id: userId } = req.user;
    let metrics = {};

    if (role === "admin") {
        const [pendingVendors, unapprovedBrands, pendingOrders] = await Promise.all([
            Vendor.countDocuments({ is_active: false }),
            Brand.countDocuments({ is_approved: false }),
            Order.countDocuments({ status: "pending" })
        ]);

        metrics = {
            vendors: pendingVendors,
            brands: unapprovedBrands,
            orders: pendingOrders
        };
    } else if (role === "vendor") {
        const vendor = await Vendor.findOne({ owner: userId });
        const vendorId = vendor?._id;

        if (vendorId) {
            const vendorProducts = await Product.find({ 
                $or: [
                    { vendor_id: vendorId },
                    { vendor_id: vendorId.toString() },
                    { vendor_id: userId },
                    { vendor_id: userId.toString() }
                ]
            }).select("_id");
            const productIds = vendorProducts.map(p => p._id);

            const [pendingOrdersCount, reviewsCount] = await Promise.all([
                OrderItem.aggregate([
                    { $match: { product_id: { $in: productIds } } },
                    {
                        $lookup: {
                            from: "orders",
                            localField: "order_id",
                            foreignField: "_id",
                            as: "order"
                        }
                    },
                    { $unwind: "$order" },
                    { $match: { "order.status": "pending" } },
                    { $group: { _id: "$order_id" } },
                    { $count: "count" }
                ]),
                Review.countDocuments({ product_id: { $in: productIds } })
            ]);

            metrics = {
                orders: pendingOrdersCount[0]?.count || 0,
                reviews: reviewsCount,
                products: productIds.length
            };
        }
    }

    return res.status(200).json(
        new apiResponse(200, "Sidebar metrics retrieved successfully", metrics)
    );
});
