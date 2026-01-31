import express from "express";
import bodyParser from "body-parser";
import { handleStripeWebhook } from "../controller/webhook.controller.js";

const router = express.Router();

router.post(
  "/stripe",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

export { router as webhookRoutes };
