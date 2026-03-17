import { Router } from "express";
import {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart
} from "../controller/cart.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// All cart routes are protected
router.use(authMiddleware);

router.get("/", getCart);
router.post("/", addToCart);
router.put("/:id", updateCartItem);
router.delete("/:id", removeFromCart);
router.delete("/clear", clearCart);

export const cartRoutes = router;
