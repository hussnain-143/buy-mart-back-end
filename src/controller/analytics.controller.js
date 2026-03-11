import { OrderModel as Order } from "../models/orders.model.js";
import { ProductModel as Product } from "../models/product.model.js";
import { UserModel as User } from "../models/user.model.js";
import { VendorModel as Vendor } from "../models/vendor.model.js";
import { OrderItemModel as OrderItem } from "../models/order_items.model.js";
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

    // Monthly Order Trends (last 6 months)
    const orderTrends = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
            }
        },
        {
            $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    return res.status(200).json(
        new apiResponse(200, "Admin stats retrieved successfully", {
            totalVendors,
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            orderTrends
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

    const vendorProducts = await Product.find({ vendor_id: vendorId }).select("_id");
    const productIds = vendorProducts.map(p => p._id);

    const totalProducts = productIds.length;

    // Vendor specific orders (orders containing vendor's products)
    const vendorOrderItems = await OrderItem.find({ product_id: { $in: productIds } });
    const totalOrders = new Set(vendorOrderItems.map(item => item.order_id.toString())).size;

    const totalRevenue = vendorOrderItems.reduce((acc, item) => acc + item.total_price, 0);

    return res.status(200).json(
        new apiResponse(200, "Vendor stats retrieved successfully", {
            totalProducts,
            totalOrders,
            totalRevenue
        })
    );
});
