import express from "express";
import { createCheckoutSession, createProductCheckoutSession, verifySession } from "../controller/stripe.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const stripeRoutes = express.Router();

// Create subscription checkout session
stripeRoutes.post(
    "/checkout",
    authMiddleware,
    createCheckoutSession
);

// Create product checkout session
stripeRoutes.post(
    "/product-checkout",
    authMiddleware,
    createProductCheckoutSession
);

// Verify session
stripeRoutes.get(
    "/verify",
    verifySession
);

export { stripeRoutes };
