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

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

// Webhook route must be before json parser or json parser must skip it
app.use("/api/v1/webhook", webhookRoutes);

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/v1/webhook')) {
    next();
  } else {
    express.json({ limit: "50mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

//? use routes middleware
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/activity-logs", activityLogRoutes);
app.use("/api/v1/vendor", vendorRoutes);
app.use("/api/v1/stripe", stripeRoutes);
app.use("/api/v1/brand", brandRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/order", orderRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/deal", dealRoutes);

app.use(errorHandler)

export const RunServer = async () => {
  const Port = process.env.PORT || 5000;

  const connect = await ConnectDB()

  if (!connect) return;

  app.listen(Port, () => {
    console.log(`App is running on URL: http://localhost:${Port}`);
  });
};
