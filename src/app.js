import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

//? Import Routes
import { userRoutes } from "./routes/user.routes.js"
import { activityLogRoutes } from "./routes/activityLog.routes.js";
import { vendorRoutes } from "./routes/vendor.routes.js";
import { stripeRoutes } from "./routes/stripe.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";
import { brandRoutes } from "./routes/brand.routes.js";
import { categoryRoutes } from "./routes/category.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { cartRoutes } from "./routes/cart.routes.js";
import { orderRoutes } from "./routes/order.routes.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import dealRoutes from "./routes/deal.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";


import { ConnectDB } from "./db/connectdb.js";

const app = express();

app.use((req, res, next) => {
  console.log(`🔍 [DEBUG] Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Webhook route must be before json parser
app.use("/api/v1/webhook", webhookRoutes);

// Global middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

//? use routes middleware
app.use("/api/v1/user", (req, res, next) => { console.log("➡️ User Route Hit"); next(); }, userRoutes);
app.use("/api/v1/logs", (req, res, next) => { console.log("➡️ Log Route Hit"); next(); }, activityLogRoutes);
app.use("/api/v1/vendor", (req, res, next) => { console.log("➡️ Vendor Route Hit"); next(); }, vendorRoutes);
app.use("/api/v1/stripe", (req, res, next) => { console.log("➡️ Stripe Route Hit"); next(); }, stripeRoutes);
app.use("/api/v1/brand", (req, res, next) => { console.log("➡️ Brand Route Hit"); next(); }, brandRoutes);
app.use("/api/v1/category", (req, res, next) => { console.log("➡️ Category Route Hit"); next(); }, categoryRoutes);
app.use("/api/v1/product", (req, res, next) => { console.log("➡️ Product Route Hit"); next(); }, productRoutes);
app.use("/api/v1/cart", (req, res, next) => { console.log("➡️ Cart Route Hit"); next(); }, cartRoutes);
app.use("/api/v1/order", (req, res, next) => { console.log("➡️ Order Route Hit"); next(); }, orderRoutes);
app.use("/api/v1/review", (req, res, next) => { console.log("➡️ Review Route Hit"); next(); }, reviewRoutes);
app.use("/api/v1/analytics", (req, res, next) => { console.log("➡️ Analytics Route Hit"); next(); }, analyticsRoutes);
app.use("/api/v1/deal", (req, res, next) => { console.log("➡️ Deal Route Hit"); next(); }, dealRoutes);

app.use(errorHandler)

export const RunServer = async () => {
  const Port = process.env.PORT || 5000;

  const connect = await ConnectDB();

  if (!connect) {
    console.error("❌ Database connection failed, server cannot start.");
    return;
  }

  app.listen(Port, () => {
    console.log(`✅ App is running on URL: http://localhost:${Port}`);
  });
};
