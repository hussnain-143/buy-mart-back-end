import { model, Schema } from "mongoose";
import slugify from "slugify";

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
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

    parent_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// GENERATE SLUG 
CategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

CategorySchema.index({ name: 1, slug: 1 });

export const CategoryModel = model("Category", CategorySchema);
