import { model, Schema } from "mongoose";

const PaymentSchema = new Schema(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    method: {
      type: String,
      enum: ["card", "paypal", "bank_transfer"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    transaction_id: {
      type: String,
      trim: true,
      default: "",
      unique: true,
      sparse: true, // allows null/empty values
    },
  },
  { timestamps: true }
);

// Optional index for faster queries by order
PaymentSchema.index({ order_id: 1 });

export const PaymentModel = model("Payment", PaymentSchema);
