import { stripe } from "../utils/stripe.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiError.js";
import { syncSubscriptionFromStripe } from "../service/vendorSubscription.service.js";

/**
 * Create Stripe checkout session for vendor subscription
 */
export const createCheckoutSession = asyncHandler(async (req, res, next) => {
  try {
    const { userId, email, fullName } = req.body;

    if (!userId || !email) {
      return next(new apiError(400, "User ID and email are required"));
    }

    // Create or retrieve Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: email,
        name: fullName || "",
        metadata: {
          userId: userId,
        },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Premium Vendor Plan",
              description: "Monthly subscription for vendor access",
            },
            unit_amount: 500, // $5.00 in cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        userId,
      },
    });

    return res
      .status(200)
      .json(new apiResponse(200, "Checkout session created", {
        sessionId: session.id,
        url: session.url,
        customerId: customer.id
      }));
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return next(new apiError(500, "Failed to create checkout session"));
  }
});

/**
 * Create Stripe checkout session for product purchase
 */
export const createProductCheckoutSession = asyncHandler(async (req, res, next) => {
  try {
    const { items, shippingAddress, email, fullName } = req.body;
    const userId = req.user._id || req.user.id;

    if (!items || items.length === 0) {
      return next(new apiError(400, "Cart items are required"));
    }

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.product_id.name,
          images: [item.product_id.images?.[0]?.url || ""],
          description: item.product_id.description?.substring(0, 100),
        },
        unit_amount: Math.round((item.product_id.discount_price > 0 ? item.product_id.discount_price : item.product_id.price) * 100),
      },
      quantity: item.quantity,
    }));

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&type=product`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        userId: userId.toString(),
        shippingAddress,
        type: "product"
      },
    });

    return res
      .status(200)
      .json(new apiResponse(200, "Product checkout session created", {
        sessionId: session.id,
        url: session.url,
      }));
  } catch (error) {
    console.error("Error creating product checkout session:", error);
    return next(new apiError(500, "Failed to create product checkout session"));
  }
});

/**
 * Verify checkout session and return session details
 */
export const verifySession = asyncHandler(async (req, res, next) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return next(new apiError(400, "Session ID is required"));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (session.payment_status !== "paid") {
      return next(new apiError(400, "Payment not completed"));
    }

    // Sync subscription to database immediately to avoid race conditions with webhook
    let subscription = null;
    if (session.mode === "subscription") {
        try {
            subscription = await syncSubscriptionFromStripe({
                sessionId: session.id,
                userId: session.metadata?.userId
            });
        } catch (syncError) {
            console.error("⚠️ Background sync failed during verification:", syncError.message);
            // We don't block the response, but it might mean the user has to wait for the webhook
        }
    }

    return res
      .status(200)
      .json(new apiResponse(200, "Session verified", {
        sessionId: session.id,
        customerId: session.customer?.id,
        subscriptionId: session.subscription?.id,
        userId: session.metadata?.userId,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
        subscription: subscription // Return synced subscription details
      }));
  } catch (error) {
    console.error("Error verifying session:", error);
    return next(new apiError(500, "Failed to verify session"));
  }
});
