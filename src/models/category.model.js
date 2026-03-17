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
    },

    parent_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    is_approved: {
      type: Boolean,
      default: false,
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// GENERATE SLUG 
CategorySchema.pre("save", async function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true });
  }
});

export const CategoryModel = model("Category", CategorySchema);
