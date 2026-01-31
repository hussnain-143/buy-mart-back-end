import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";

/**
 * Create a new vendor subscription
 */
export const createSubscription = async (subscriptionData) => {
    try {
        const subscription = await VendorSubscriptionModel.create(subscriptionData);
        return subscription;
    } catch (error) {
        console.error("Error creating subscription:", error);
        throw error;
    }
};

/**
 * Get active subscription for a vendor
 */
export const getActiveSubscription = async (vendorId) => {
    try {
        const subscription = await VendorSubscriptionModel.findOne({
            vendor: vendorId,
            is_active: true,
            status: "active",
            end_date: { $gt: new Date() },
        });
        return subscription;
    } catch (error) {
        console.error("Error getting active subscription:", error);
        throw error;
    }
};

/**
 * Get subscription by Stripe subscription ID
 */
export const getSubscriptionByStripeId = async (stripeSubscriptionId) => {
    try {
        const subscription = await VendorSubscriptionModel.findOne({
            stripe_subscription_id: stripeSubscriptionId,
        });
        return subscription;
    } catch (error) {
        console.error("Error getting subscription by Stripe ID:", error);
        throw error;
    }
};

/**
 * Update subscription status
 */
export const updateSubscriptionStatus = async (subscriptionId, status, currentPeriodEnd) => {
    try {
        const updateData = { status };
        if (currentPeriodEnd) {
            updateData.current_period_end = currentPeriodEnd;
            updateData.end_date = currentPeriodEnd;
        }

        const subscription = await VendorSubscriptionModel.findByIdAndUpdate(
            subscriptionId,
            updateData,
            { new: true }
        );
        return subscription;
    } catch (error) {
        console.error("Error updating subscription status:", error);
        throw error;
    }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (vendorId) => {
    try {
        const subscription = await VendorSubscriptionModel.findOneAndUpdate(
            { vendor: vendorId, is_active: true },
            { is_active: false, status: "canceled" },
            { new: true }
        );
        return subscription;
    } catch (error) {
        console.error("Error canceling subscription:", error);
        throw error;
    }
};
