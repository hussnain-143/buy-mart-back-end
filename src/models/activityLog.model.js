import { model, Schema } from "mongoose";

const ActivityLogSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    reference_id: {
      type: Schema.Types.ObjectId,
      default: null, // optional related document
    },
  },
  { timestamps: true } // adds createdAt automatically
);

// Optional: index by user for faster queries
ActivityLogSchema.index({ user_id: 1 });

export const ActivityLogModel = model("ActivityLog", ActivityLogSchema);
