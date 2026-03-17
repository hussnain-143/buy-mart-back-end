import { Router } from "express";
import {
    addBrand,
    getAllBrands,
    getUserBrands,
    updateBrandStatus,
    approveBrand,
    deleteBrand,
    getAdminBrands
} from "../controller/brand.controller.js";
import { authMiddleware, isAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public / Protected (GET)
router.get("/", getAllBrands);

// Protected (POST/GET/PATCH/DELETE)
router.use(authMiddleware);

router.get("/user-brands", getUserBrands);
router.post("/", upload.single("logo"), addBrand);
router.patch("/status/:id", isAdmin, updateBrandStatus);
router.patch("/approve/:id", isAdmin, approveBrand);
router.get("/admin", isAdmin, getAdminBrands);
router.delete("/:id", deleteBrand);

export const brandRoutes = router;
