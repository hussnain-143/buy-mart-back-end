import { stripe } from "../utils/stripe.js";
import { createSubscription, updateSubscriptionStatus } from "../service/vendorSubscription.service.js";
import { VendorModel } from "../models/vendor.model.js";
import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Ensure this is a subscription mode checkout
        if (session.mode === "subscription") {
          const userId = session.metadata.userId;
          const subscriptionId = session.subscription;
          const customerId = session.customer;

          // Retrieve full subscription details from Stripe to get dates
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

          // Calculate start and end dates
          const startDate = new Date(stripeSubscription.current_period_start * 1000);
          const endDate = new Date(stripeSubscription.current_period_end * 1000);
          const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

          // Check if subscription already exists (idempotency)
          let subscription = await VendorSubscriptionModel.findOne({ stripe_subscription_id: subscriptionId });

          if (!subscription) {
            // Create new subscription
            // Try to find vendor for this user
            const vendor = await VendorModel.findOne({ owner: userId });

            subscription = await VendorSubscriptionModel.create({
              user: userId,
              vendor: vendor ? vendor._id : null,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              plan_name: "Premium Vendor Plan",
              price: session.amount_total / 100, // Convert from cents
              duration_in_days: durationInDays,
              start_date: startDate,
              end_date: endDate,
              current_period_end: endDate,
              status: "active",
              is_active: true
            });

            // If vendor exists, link subscription to vendor as well
            if (vendor) {
              vendor.subscription = subscription._id;
              vendor.stripe_customer_id = customerId;
              await vendor.save();

              await Create_Log_Entry({
                    body: {
                      user_id: userId,
                      action: "Vendor Subscription Created for User: " + vendor.userName,
                      reference_id: subscription._id,
                    },
                  }, {
                    status: () => ({ json: () => {} }),
                  });
            }
          } else {
            // Update existing
            subscription.status = "active";
            subscription.is_active = true;
            subscription.current_period_end = endDate;
            subscription.end_date = endDate;
            await subscription.save();

            await Create_Log_Entry({
                  body: {
                    user_id: userId,
                    action: "Vendor Subscription Updated for User: " + (vendor ? vendor.userName : "Unknown"),
                    reference_id: subscription._id,
                  },
                }, {
                  status: () => ({ json: () => {} }),
                });
          }
        }

        
        
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await VendorSubscriptionModel.findOneAndUpdate(
          { stripe_subscription_id: subscription.id },
          { status: "canceled", is_active: false }
        );
        await Create_Log_Entry({
              body: {
                user_id: null,
                action: "Vendor Subscription Canceled for Subscription ID: " + subscription.id,
                reference_id: subscription.id,
              },
            }, {
              status: () => ({ json: () => {} }),
            })
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoice.subscription;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

          await VendorSubscriptionModel.findOneAndUpdate(
            { stripe_subscription_id: subscriptionId },
            {
              status: "active",
              is_active: true,
              current_period_end: currentPeriodEnd,
              end_date: currentPeriodEnd
            }
          );
            await Create_Log_Entry({
                    body: {
                        user_id: null,
                        action: "Vendor Subscription Payment Succeeded for Subscription ID: " + subscriptionId,
                        reference_id: subscriptionId,
                    },
                }, {
                    status: () => ({ json: () => {} }),
                })
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
