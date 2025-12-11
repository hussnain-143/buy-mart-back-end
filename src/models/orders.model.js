import { model, Schema } from "mongoose";
import { OrderItemModel } from "./order_items.model";

const OrderSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    total_amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    shipping_address: {
      type: String,
      required: true,
    },

    billing_address: {
      type: String,
      default: null,
    },

    payment_method: {
      type: String,
      enum: ["card", "paypal", "bank_transfer"],
      required: true,
    },

    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// 🔹 Pre-save hook to calculate total_amount from OrderItems
OrderSchema.pre("save", async function (next) {
  try {
    const items = await OrderItemModel.find({ order_id: this._id });
    this.total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔹 Index for faster user queries
OrderSchema.index({ user_id: 1, createdAt: -1 });

export const OrderModel = model("Order", OrderSchema);
