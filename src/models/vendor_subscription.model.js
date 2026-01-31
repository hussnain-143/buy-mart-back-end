import { model, Schema } from "mongoose";

const VendorSubscriptionSchema = new Schema(
    {
        vendor: {
            type: Schema.Types.ObjectId,
            ref: "Vendor",
            required: false,
        },

        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        plan_name: {
            type: String,
            required: [true, "Plan name is required"],
            trim: true,
            maxlength: 100,
        },

        price: {
            type: Number,
            required: [true, "Price is required"],
            min: 0,
        },

        duration_in_days: {
            type: Number,
            required: [true, "Duration in days is required"],
            min: 1,
        },

        stripe_subscription_id: {
            type: String,
            trim: true,
            default: "",
        },

        stripe_customer_id: {
            type: String,
            trim: true,
            default: "",
        },

        status: {
            type: String,
            enum: ["active", "canceled", "past_due", "incomplete"],
            default: "active",
        },

        current_period_end: {
            type: Date,
        },

        start_date: {
            type: Date,
            required: [true, "Start date is required"],
        },

        end_date: {
            type: Date,
            required: [true, "End date is required"],
        },

        is_active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

VendorSubscriptionSchema.index({ vendor: 1 });
VendorSubscriptionSchema.index({ plan_name: 1 });

export const VendorSubscriptionModel = model("VendorSubscription", VendorSubscriptionSchema);   