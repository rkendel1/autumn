import { apiAuthMiddleware } from "@/middleware/apiAuthMiddleware.js";
import { Router } from "express";
import { eventsRouter } from "./events/eventRouter.js";
import { cusRouter } from "../customers/cusRouter.js";
import { productBetaRouter, productRouter } from "../products/productRouter.js";

import { featureRouter } from "../features/featureRouter.js";
import { checkRouter } from "./entitled/checkRouter.js";
import { attachRouter } from "../customers/attach/attachRouter.js";
import { pricingMiddleware } from "@/middleware/pricingMiddleware.js";
import { usageRouter } from "./events/usageRouter.js";
import { invoiceRouter } from "./invoiceRouter.js";
import { entityRouter } from "./entities/entityRouter.js";
import { migrationRouter } from "../migrations/migrationRouter.js";

import { redemptionRouter, referralRouter } from "./rewards/referralRouter.js";
import { rewardProgramRouter } from "./rewards/rewardProgramRouter.js";
import { componentRouter } from "./components/componentRouter.js";
import { analyticsMiddleware } from "@/middleware/analyticsMiddleware.js";

import rewardRouter from "./rewards/rewardRouter.js";
import cancelRouter from "../customers/cancel/cancelRouter.js";
import { handleSetupPayment } from "../customers/attach/handleSetupPayment.js";
import { internalFeatureRouter } from "../features/internalFeatureRouter.js";
import { analyticsRouter } from "../analytics/analyticsRouter.js";
import { handleConnectStripe } from "../orgs/handlers/handleConnectStripe.js";
import { handleDeleteStripe } from "../orgs/handlers/handleDeleteStripe.js";

import { refreshCacheMiddleware } from "@/middleware/refreshCacheMiddleware.js";
import { platformRouter } from "../platform/platformRouter.js";
import { batchRouter } from "./batch/batchRouter.js";
import { handleGetOrg } from "../orgs/handlers/handleGetOrg.js";

const apiRouter: Router = Router();

apiRouter.use(apiAuthMiddleware);
apiRouter.use(pricingMiddleware);
apiRouter.use(analyticsMiddleware);
apiRouter.use(refreshCacheMiddleware);

apiRouter.use("/customers", cusRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/products_beta", productBetaRouter);
apiRouter.use("/components", componentRouter);
apiRouter.use("/rewards", rewardRouter);
apiRouter.use("/features", featureRouter);
apiRouter.use("/internal_features", internalFeatureRouter);

apiRouter.use("/usage", usageRouter);
apiRouter.use("/entities", entityRouter);
apiRouter.use("/migrations", migrationRouter);

// REWARDS
apiRouter.use("/reward_programs", rewardProgramRouter);
apiRouter.use("/referrals", referralRouter);
apiRouter.use("/redemptions", redemptionRouter);

// Cus Product
apiRouter.use("", attachRouter);
apiRouter.use("/cancel", cancelRouter);
apiRouter.use("/entitled", checkRouter);
apiRouter.use("/check", checkRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/track", eventsRouter);
apiRouter.post("/setup_payment", handleSetupPayment);

// Analytics
apiRouter.use("/query", analyticsRouter);
apiRouter.use("/platform", platformRouter);

// Used for tests...
apiRouter.post("/organization/stripe", handleConnectStripe);
apiRouter.delete("/organization/stripe", handleDeleteStripe);
apiRouter.get("/organization", handleGetOrg);

export { apiRouter };
