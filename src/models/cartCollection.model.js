import { model, Schema } from "mongoose";

const CartSchema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

// Prevent duplicate products for same user
CartSchema.index({ product_id: 1, user_id: 1 }, { unique: true });

export const CartModel = model("Cart", CartSchema);
