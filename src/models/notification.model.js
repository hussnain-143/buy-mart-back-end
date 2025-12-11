import { model, Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },

    is_read: {
      type: Boolean,
      default: false,
    },

    reference_id: {
      type: Schema.Types.ObjectId,
      default: null, // optional link to order, product, etc.
    },
  },
  { timestamps: true } // adds createdAt & updatedAt
);

// Optional index for faster queries by user
NotificationSchema.index({ user_id: 1, createdAt: -1 });

export const NotificationModel = model("Notification", NotificationSchema);
