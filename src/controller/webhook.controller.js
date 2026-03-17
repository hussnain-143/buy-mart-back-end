import { stripe } from "../utils/stripe.js";
import { 
    createSubscription, 
    updateSubscriptionStatus,
    syncSubscriptionFromStripe
} from "../service/vendorSubscription.service.js";
import { VendorModel } from "../models/vendor.model.js";
import { VendorSubscriptionModel } from "../models/vendor_subscription.model.js";
import { Create_Log_Entry } from "./log.controller.js";
import { createLog } from "../service/log.services.js";

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

          // Use the centralized sync service
          await syncSubscriptionFromStripe({
            sessionId: session.id,
            subscriptionId: subscriptionId,
            userId: userId
          });
          
          console.log(`✅ Subscription synced via webhook for session: ${session.id}`);
        } else if (session.mode === "payment" && session.metadata?.type === "product") {
          const userId = session.metadata.userId;
          const sessionId = session.id;

          // Check if order already exists
          const { OrderModel: Order } = await import("../models/orders.model.js");
          const { OrderItemModel: OrderItem } = await import("../models/order_items.model.js");
          const { CartModel: Cart } = await import("../models/cartCollection.model.js");
          const { ProductModel: Product } = await import("../models/product.model.js");

          let order = await Order.findOne({ stripe_session_id: sessionId });

          if (!order) {
            console.log("🛒 Creating order from webhook for session:", sessionId);
            
            // Get user cart items
            const cartItems = await Cart.find({ user_id: userId }).populate("product_id");
            
            if (cartItems.length > 0) {
              // Create Order
              order = await Order.create({
                user_id: userId,
                shipping_address: session.metadata.shippingAddress || "Stripe Checkout Address",
                payment_method: "card",
                status: "processing",
                payment_status: "paid",
                stripe_session_id: sessionId,
                total_amount: session.amount_total / 100
              });

              // Create Order Items
              for (const item of cartItems) {
                if (!item.product_id) continue;
                
                const unitPrice = item.product_id.discount_price > 0 ? item.product_id.discount_price : item.product_id.price;
                
                await OrderItem.create({
                  order_id: order._id,
                  product_id: item.product_id._id,
                  quantity: item.quantity,
                  unit_price: unitPrice,
                  total_price: unitPrice * item.quantity
                });

                // Update stock
                await Product.findByIdAndUpdate(item.product_id._id, {
                  $inc: { stock_quantity: -item.quantity }
                });
              }

              // Clear Cart
              await Cart.deleteMany({ user_id: userId });

              await createLog(userId, `Order Created & Paid via Webhook: Order ID ${order._id}`, order._id);
            }
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
        await createLog(null, "Vendor Subscription Canceled for Subscription ID: " + subscription.id, subscription.id);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoice.subscription;
          
          await syncSubscriptionFromStripe({ 
            subscriptionId: subscriptionId 
          });
          
          console.log(`✅ Subscription synced via webhook for invoice: ${invoice.id}`);
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
