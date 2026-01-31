import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

//? Import Routes
//? Import Routes
import { userRoutes } from "./routes/user.routes.js"
import { activityLogRoutes } from "./routes/activityLog.routes.js";
import { vendorRoutes } from "./routes/vendor.routes.js";
import { stripeRoutes } from "./routes/stripe.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";


import { ConnectDB } from "./db/connectdb.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
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

app.use(errorHandler)

export const RunServer = async () => {
  const Port = process.env.PORT || 5000;

  const connect = await ConnectDB()

  if (!connect) return;

  app.listen(Port, () => {
    console.log(`App is running on URL: http://localhost:${Port}`);
  });
};
