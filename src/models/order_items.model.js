import { model, Schema } from "mongoose";

const OrderItemSchema = new Schema(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },

    total_price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// Prevent duplicate products in the same order
OrderItemSchema.index({ order_id: 1, product_id: 1 }, { unique: true });

// Pre-save hook to calculate total_price
OrderItemSchema.pre("save", function (next) {
  this.total_price = this.unit_price * this.quantity;
  next();
});

export const OrderItemModel = model("OrderItem", OrderItemSchema);
