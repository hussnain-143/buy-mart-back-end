import express from "express";
import { createCheckoutSession, verifySession } from "../controller/stripe.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const stripeRoutes = express.Router();

// Create checkout session
stripeRoutes.post(
    "/checkout",
    authMiddleware,
    createCheckoutSession
);

// Verify session
stripeRoutes.get(
    "/verify",
    verifySession
);

export { stripeRoutes };
