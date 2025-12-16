import { model, Schema } from "mongoose";

const ReviewSchema = new Schema(
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

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

//  Prevent user from reviewing the same product twice
ReviewSchema.index({ product_id: 1, user_id: 1 }, { unique: true });

ReviewSchema.index({ product_id: 1 });

export const ReviewModel = model("Review", ReviewSchema);
