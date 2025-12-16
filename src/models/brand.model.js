import { model, Schema } from "mongoose";
import slugify from "slugify";

const BrandSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
      minlength: 2,
      maxlength: 50,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },

    logo: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// GENERATE SLUG
BrandSchema.pre("save", async function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

BrandSchema.index({ name: 1 });
BrandSchema.index({ slug: 1 });

export const BrandModel = model("Brand", BrandSchema);
