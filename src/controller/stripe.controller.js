import { stripe } from "../utils/stripe.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiError.js";

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

    return res
      .status(200)
      .json(new apiResponse(200, "Session verified", {
        sessionId: session.id,
        customerId: session.customer.id,
        subscriptionId: session.subscription?.id,
        userId: session.metadata?.userId,
        paymentStatus: session.payment_status,
      }));
  } catch (error) {
    console.error("Error verifying session:", error);
    return next(new apiError(500, "Failed to verify session"));
  }
});
