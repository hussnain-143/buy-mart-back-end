import { model, Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const ProductSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    desc: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount_price: {
      type: Number,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      unique: true,
      required: [true, "SKU is required"],
      trim: true,
    },

    stock_quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand_id: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },

    images_id: [
      {
        type: Schema.Types.ObjectId,
        ref: "Media", // or "Image" based on your design
      }
    ],

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 📌 Add Pagination Plugin
ProductSchema.plugin(mongoosePaginate);

// 📌 Indexes for speed
ProductSchema.index({ name: "text", desc: "text" });
ProductSchema.index({ price: 1 });
ProductSchema.index({ category_id: 1 });
ProductSchema.index({ brand_id: 1 });

export const ProductModel = model("Product", ProductSchema);
