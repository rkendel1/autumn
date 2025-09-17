import { decryptData, generatePublishableKey } from "@/utils/encryptUtils.js";
import RecaseError from "@/utils/errorUtils.js";
import {
  AppEnv,
  ErrCode,
  FrontendOrg,
  Organization,
  organizations,
  OrgConfig,
} from "@autumn/shared";
import { createStripeCli } from "@/external/stripe/utils.js";
import { OrgService } from "./OrgService.js";
import { FeatureService } from "../features/FeatureService.js";
import { notNullish } from "@/utils/genUtils.js";
import Stripe from "stripe";
import { toSuccessUrl } from "./orgUtils/convertOrgUtils.js";
import { DrizzleCli } from "@/db/initDrizzle.js";
import { CacheManager } from "@/external/caching/CacheManager.js";
import { eq } from "drizzle-orm";
import { clearOrgCache } from "./orgUtils/clearOrgCache.js";

export const shouldReconnectStripe = async ({
  org,
  env,
  logger,
  stripeKey,
}: {
  org: Organization;
  env: AppEnv;
  logger: any;
  stripeKey: string;
}) => {
  if (!isStripeConnected({ org, env })) return true;

  try {
    const stripeCli = createStripeCli({ org, env: env! });
    const newKey = new Stripe(stripeKey);

    const oldAccount = await stripeCli.accounts.retrieve();
    const newAccount = await newKey.accounts.retrieve();

    return oldAccount.id !== newAccount.id;
  } catch (error) {
    logger.error("Error checking if stripe should be reconnected", { error });
    return true;
  }
};

export const isStripeConnected = ({
  org,
  env,
}: {
  org: Organization;
  env?: AppEnv;
}) => {
  if (env === AppEnv.Sandbox) {
    return notNullish(org.stripe_config?.test_api_key);
  } else if (env === AppEnv.Live) {
    return notNullish(org.stripe_config?.live_api_key);
  } else {
    return (
      notNullish(org.stripe_config?.test_api_key) &&
      notNullish(org.stripe_config?.live_api_key)
    );
  }
};

export const constructOrg = ({ id, slug }: { id: string; slug: string }) => {
  return {
    id,
    slug,
    created_at: Date.now(),
    default_currency: "usd",
    stripe_connected: false,
    stripe_config: null,
    test_pkey: generatePublishableKey(AppEnv.Sandbox),
    live_pkey: generatePublishableKey(AppEnv.Live),
    svix_config: {
      sandbox_app_id: "",
      live_app_id: "",
    },
    config: {} as any,
  };
};

export const deleteStripeWebhook = async ({
  org,
  env,
}: {
  org: Organization;
  env: AppEnv;
}) => {
  const stripeCli = createStripeCli({ org, env });
  const webhookEndpoints = await stripeCli.webhookEndpoints.list({
    limit: 100,
  });

  for (const webhook of webhookEndpoints.data) {
    if (webhook.url.includes(org.id)) {
      try {
        await stripeCli.webhookEndpoints.del(webhook.id);
      } catch (error: any) {
        console.log(`Failed to delete stripe webhook (${env}) ${webhook.url}`);
        console.log(error.message);
      }
    }
  }
};

export const getStripeWebhookSecret = (org: Organization, env: AppEnv) => {
  const webhookSecret =
    env === AppEnv.Sandbox
      ? org.stripe_config?.test_webhook_secret
      : org.stripe_config?.live_webhook_secret;

  if (!webhookSecret) {
    throw new RecaseError({
      code: ErrCode.StripeConfigNotFound,
      message: `Stripe webhook secret not found for org ${org.id}`,
      statusCode: 400,
    });
  }

  return decryptData(webhookSecret);
};

export const initDefaultConfig = () => {
  return {
    free_trial_paid_to_paid: false,

    // 1. Upgrade prorates immediately
    bill_upgrade_immediately: true,

    // 2. Convert invoice to charge automatically
    convert_to_charge_automatically: false,
  };
};

export const createOrgResponse = ({
  org,
  env,
}: {
  org: Organization;
  env: AppEnv;
}): FrontendOrg => {
  return {
    id: org.id,
    name: org.name,
    logo: org.logo,
    slug: org.slug,
    // sandbox_config: {
    //   stripe_connected: isStripeConnected({ org, env: AppEnv.Sandbox }),
    //   default_currency: org.default_currency || "USD",
    //   return_url: org.sandbox_config?.return_url || "",
    // },
    // production_config: {
    //   stripe_connected: isStripeConnected({ org, env: AppEnv.Live }),
    //   default_currency: org.default_currency || "USD",
    //   return_url: org.production_config?.return_url || "",
    // },

    success_url: toSuccessUrl({ org, env }) || "",
    default_currency: org.default_currency || "usd",
    stripe_connected: isStripeConnected({ org, env }),
    created_at: new Date(org.createdAt).getTime(),
    test_pkey: org.test_pkey,
    live_pkey: org.live_pkey,
  };
};

export const getOrgAndFeatures = async ({ req }: { req: any }) => {
  let { orgId, env } = req;

  let [org, features] = await Promise.all([
    OrgService.getFromReq(req),
    FeatureService.getFromReq(req),
  ]);

  return { org, features };
};

export const updateOrgConfig = async ({
  db,
  org,
  config,
  disconnectCache = true,
}: {
  db: DrizzleCli;
  org: Organization;
  config: Partial<OrgConfig>;
  disconnectCache?: boolean;
}) => {
  await db
    .update(organizations)
    .set({
      config: {
        ...org.config,
        ...config,
      },
    })
    .where(eq(organizations.id, org.id));

  await clearOrgCache({
    db,
    orgId: org.id,
  });

  if (disconnectCache) {
    await CacheManager.disconnect();
  }
};
