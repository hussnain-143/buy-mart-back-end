import { model, Schema } from "mongoose";

const DealSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Deal name is required"],
      trim: true,
      maxlength: 120,
    },
    discount: {
      type: String, // e.g., "20%" or "Flat $50"
      required: [true, "Discount details are required"],
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: false,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    banner_image: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

DealSchema.index({ vendor_id: 1 });
DealSchema.index({ is_active: 1 });
DealSchema.index({ end_date: 1 });

export const DealModel = model("Deal", DealSchema);
