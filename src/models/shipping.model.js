import { model, Schema } from "mongoose";

const ShippingSchema = new Schema(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    carrier: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    tracking_number: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: 100,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "shipped", "in_transit", "delivered", "returned"],
      default: "pending",
    },

    estimated_delivery: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


ShippingSchema.index({ order_id: 1 });

export const ShippingModel = model("Shipping", ShippingSchema);
