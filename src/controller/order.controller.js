import { OrderModel as Order } from "../models/orders.model.js";
import { OrderItemModel as OrderItem } from "../models/order_items.model.js";
import { CartModel as Cart } from "../models/cartCollection.model.js";
import { ProductModel as Product } from "../models/product.model.js";
import { VendorModel as Vendor } from "../models/vendor.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";
import { ACTIVITY_LOG_ACTIONS } from "../constant.js";
import mongoose from "mongoose";

/* =====================================================
   CREATE ORDER
===================================================== */
export const createOrder = asyncHandler(async (req, res) => {
    const { shipping_address, billing_address, payment_method } = req.body;
    const userId = req.user._id || req.user.id;

    if (!shipping_address || !payment_method) {
        throw new apiError(400, "Shipping address and payment method are required");
    }

    // Get cart items
    const cartItems = await Cart.find({ user_id: userId }).populate("product_id");
    if (cartItems.length === 0) {
        throw new apiError(400, "Cart is empty");
    }

    // If stripe session is provided, check for existing order to prevent duplicates
    if (req.body.stripe_session_id) {
        const existingOrder = await Order.findOne({ stripe_session_id: req.body.stripe_session_id });
        if (existingOrder) {
            return res.status(200).json(
                new apiResponse(200, "Order already processed", existingOrder)
            );
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Create Order
        const newOrder = new Order({
            user_id: userId,
            shipping_address,
            billing_address: billing_address || shipping_address,
            payment_method,
            status: req.body.stripe_session_id ? "processing" : "pending",
            payment_status: (payment_method === "card" || req.body.stripe_session_id) ? "paid" : "pending",
            stripe_session_id: req.body.stripe_session_id || null
        });

        await newOrder.save({ session });

        // 2. Create Order Items and calculate total
        let totalAmount = 0;
        for (const item of cartItems) {
            if (!item.product_id) continue;

            const unitPrice = item.product_id.discount_price > 0 ? item.product_id.discount_price : item.product_id.price;
            const totalPrice = unitPrice * item.quantity;
            totalAmount += totalPrice;

            const orderItem = new OrderItem({
                order_id: newOrder._id,
                product_id: item.product_id._id,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: totalPrice,
            });

            await orderItem.save({ session });

            // 3. Update product stock
            await Product.findByIdAndUpdate(item.product_id._id, {
                $inc: { stock_quantity: -item.quantity }
            }, { session });
        }

        // 4. Update Order total amount
        newOrder.total_amount = totalAmount;
        await newOrder.save({ session });

        // 5. Clear Cart
        await Cart.deleteMany({ user_id: userId }, { session });

        await session.commitTransaction();
        session.endSession();

        // Activity Log
        await createLog(userId, `${ACTIVITY_LOG_ACTIONS.ORDER_CREATED}: Order ID ${newOrder._id}`, newOrder._id);

        return res.status(201).json(
            new apiResponse(201, "Order created successfully", newOrder)
        );
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

/* =====================================================
   GET ORDER BY ID
===================================================== */
export const getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await Order.findById(id).populate("user_id", "userName email firstName lastName");
    if (!order) {
        throw new apiError(404, "Order not found");
    }

    // Verify ownership or admin
    if (order.user_id._id.toString() !== userId.toString() && req.user.role !== 'admin') {
        throw new apiError(403, "Unauthorized to view this order");
    }

    const items = await OrderItem.find({ order_id: id }).populate("product_id");

    return res.status(200).json(
        new apiResponse(200, "Order retrieved successfully", { order, items })
    );
});

/* =====================================================
   GET USER ORDERS
===================================================== */
export const getUserOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { status } = req.query;

    const query = { user_id: userId };
    if (status) query.status = status;

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.status(200).json(
        new apiResponse(200, "User orders retrieved successfully", orders)
    );
});

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, payment_status } = req.body;

    const order = await Order.findById(id);
    if (!order) {
        throw new apiError(404, "Order not found");
    }

    // Role verification
    if (req.user.role !== 'admin') {
        const vendorId = req.user.vendor_id || (await Vendor.findOne({ owner: req.user._id }))?._id;
        if (!vendorId) {
            throw new apiError(403, "Only admins and assigned vendors can update order status");
        }

        const items = await OrderItem.find({ order_id: id }).populate("product_id");
        const hasVendorProduct = items.some(item =>
            item.product_id && item.product_id.vendor_id && item.product_id.vendor_id.toString() === vendorId.toString()
        );

        if (!hasVendorProduct) {
            throw new apiError(403, "You can only update orders that contain your products");
        }
    }

    if (status) order.status = status;
    if (payment_status && req.user.role === 'admin') order.payment_status = payment_status; // Only admin can update payment status directly usually

    await order.save();

    // Activity Log
    await createLog(req.user._id, `${ACTIVITY_LOG_ACTIONS.ORDER_STATUS_UPDATED}: Order ID ${order._id} to ${status || order.status}`, order._id);

    return res.status(200).json(
        new apiResponse(200, "Order status updated successfully", order)
    );
});

/* =====================================================
   GET VENDOR ORDERS
===================================================== */
export const getVendorOrders = asyncHandler(async (req, res) => {
    const vendorId = req.user.vendor_id || (await Vendor.findOne({ owner: req.user._id }))?._id;

    if (!vendorId) {
        throw new apiError(404, "Vendor not found");
    }

    const vendorProducts = await Product.find({ vendor_id: vendorId }).select("_id");
    const productIds = vendorProducts.map(p => p._id);

    const orderItems = await OrderItem.find({ product_id: { $in: productIds } })
        .populate({
            path: 'order_id',
            populate: { path: 'user_id', select: 'firstName lastName email' }
        })
        .populate("product_id");

    // Group items by order
    const ordersMap = {};
    orderItems.forEach(item => {
        if (!item.order_id) return;
        const orderId = item.order_id._id.toString();
        if (!ordersMap[orderId]) {
            ordersMap[orderId] = {
                ...item.order_id.toObject(),
                items: []
            };
        }
        ordersMap[orderId].items.push(item);
    });

    const orders = Object.values(ordersMap);

    return res.status(200).json(
        new apiResponse(200, "Vendor orders retrieved successfully", orders)
    );
});

/* =====================================================
   GET ALL ORDERS (Admin Only)
===================================================== */
export const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find().populate("user_id", "userName email firstName lastName").sort({ createdAt: -1 });
    return res.status(200).json(
        new apiResponse(200, "All orders retrieved successfully", orders)
    );
});
