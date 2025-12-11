import { model, Schema } from "mongoose";

const VendorSchema = new Schema(
  {
    shop_name: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    desc: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",   // vendor is a user
      required: true,
    },

    profile_image: {
      type: String,
      trim: true,
      default: "",
    },

    cover_image: {
      type: String,
      trim: true,
      default: "",
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 📌 Optional: Speed up find by owner
VendorSchema.index({ owner: 1 });
VendorSchema.index({ shop_name: 1 });

export const VendorModel = model("Vendor", VendorSchema);
