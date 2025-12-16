import { model, Schema } from "mongoose";

const imageSchema = new Schema(
  {
    image_url: {
      type: String,
      required: true,
      trim: true,
    },

    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Only 1 primary per product (DB-level)
imageSchema.index(
  { product_id: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } }
);

// AUTO-SWITCH logic (App-level)
imageSchema.pre("save", async function (next) {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { product_id: this.product_id, _id: { $ne: this._id } },
      { $set: { isPrimary: false } }
    );
  }
  next();
});

export const ImageModel = model("Image", imageSchema);
