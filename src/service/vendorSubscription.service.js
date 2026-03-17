import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { stripe } from "../utils/stripe.js";
import { createLog } from "./log.services.js";

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
/**
 * Sync subscription details from Stripe to database
 * Handles both checkout sessions and existing subscriptions
 * @param {Object} options - { sessionId, subscriptionId, userId }
 */
export const syncSubscriptionFromStripe = async ({ sessionId, subscriptionId, userId }) => {
    try {
        let stripeSubscriptionId = subscriptionId;
        let stripeCustomerId;
        let derivedUserId = userId;

        // 1. If we have a sessionId, retrieve it to get the subscription and customer IDs
        if (sessionId && !stripeSubscriptionId) {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            stripeSubscriptionId = session.subscription;
            stripeCustomerId = session.customer;
            derivedUserId = derivedUserId || session.metadata?.userId;
        }

        if (!stripeSubscriptionId) {
            throw new Error("Stripe Subscription ID is required for sync");
        }

        // 2. Retrieve full subscription details from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        stripeCustomerId = stripeCustomerId || stripeSubscription.customer;

        // 3. Calculate start and end dates
        const startDate = new Date(stripeSubscription.current_period_start * 1000);
        const endDate = new Date(stripeSubscription.current_period_end * 1000);
        const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

        // 4. Try to find existing subscription in DB
        let subscription = await VendorSubscriptionModel.findOne({ 
            stripe_subscription_id: stripeSubscriptionId 
        });

        if (!subscription) {
            // Check if user has a vendor already
            const vendor = await VendorModel.findOne({ owner: derivedUserId });

            // Create new record
            subscription = await VendorSubscriptionModel.create({
                user: derivedUserId,
                vendor: vendor ? vendor._id : null,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_customer_id: stripeCustomerId,
                plan_name: "Premium Vendor Plan",
                price: (stripeSubscription.items.data[0]?.price.unit_amount / 100) || 0,
                duration_in_days: durationInDays,
                start_date: startDate,
                end_date: endDate,
                current_period_end: endDate,
                status: stripeSubscription.status === "active" ? "active" : stripeSubscription.status,
                is_active: stripeSubscription.status === "active"
            });

            if (vendor) {
                vendor.subscription = subscription._id;
                vendor.stripe_customer_id = stripeCustomerId;
                await vendor.save();
            }

            if (derivedUserId) {
                await createLog(derivedUserId, "Vendor Subscription Created via Sync for User ID: " + derivedUserId, subscription._id);
            }
        } else {
            // Update existing record
            subscription.status = stripeSubscription.status === "active" ? "active" : stripeSubscription.status;
            subscription.is_active = stripeSubscription.status === "active";
            subscription.current_period_end = endDate;
            subscription.end_date = endDate;
            await subscription.save();

            if (derivedUserId) {
                await createLog(derivedUserId, "Vendor Subscription Updated via Sync for User ID: " + derivedUserId, subscription._id);
            }
        }

        return subscription;
    } catch (error) {
        console.error("Error syncing subscription from Stripe:", error);
        throw error;
    }
};
