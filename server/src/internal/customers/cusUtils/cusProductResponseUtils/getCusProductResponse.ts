import {
  getPriceOptions,
  getUsageTier,
} from "@/internal/products/prices/priceUtils.js";
import { BREAK_API_VERSION } from "@/utils/constants.js";
import { notNullish } from "@/utils/genUtils.js";
import {
  FullCusProduct,
  Organization,
  Subscription,
  PriceType,
  FixedPriceConfig,
  UsagePriceConfig,
  TierInfinite,
  APIVersion,
  CusProductResponseSchema,
  CusProductStatus,
  Entity,
  Feature,
} from "@autumn/shared";

import Stripe from "stripe";
import { getRelatedCusEnt } from "../../cusProducts/cusPrices/cusPriceUtils.js";
import { fullCusProductToProduct } from "../../cusProducts/cusProductUtils.js";
import {
  getProductItemResponse,
  getProductResponse,
} from "@/internal/products/productUtils/productResponseUtils/getProductResponse.js";

const getQuantityData = ({ cusProduct }: { cusProduct: FullCusProduct }) => {
  return {
    prepaid_quantities: cusProduct.options.map((o) => {
      return {
        quantity: o.quantity,
        feature_id: o.feature_id,
      };
    }),
  };
};
export const getCusProductResponse = async ({
  cusProduct,
  subs,
  org,
  entities = [],
  apiVersion,
  features,
}: {
  cusProduct: FullCusProduct;
  org: Organization;
  subs?: Subscription[];
  entities?: Entity[];
  apiVersion: number;
  features: Feature[];
}) => {
  // Process prices

  const prices = cusProduct.customer_prices.map((cp) => {
    let price = cp.price;

    if (price.config?.type == PriceType.Fixed) {
      let config = price.config as FixedPriceConfig;
      return {
        amount: config.amount,
        interval: config.interval,
      };
    } else {
      let config = price.config as UsagePriceConfig;
      let priceOptions = getPriceOptions(price, cusProduct.options);
      let usageTier = getUsageTier(price, priceOptions?.quantity!);
      let cusEnt = getRelatedCusEnt({
        cusPrice: cp,
        cusEnts: cusProduct.customer_entitlements,
      });

      let ent = cusEnt?.entitlement;

      let singleTier = ent?.allowance == 0 && config.usage_tiers.length == 1;

      if (singleTier) {
        return {
          amount: usageTier.amount,
          interval: config.interval,
          quantity: priceOptions?.quantity,
        };
      } else {
        // Add allowance to tiers
        let allowance = ent?.allowance;
        let tiers;

        if (notNullish(allowance) && allowance! > 0) {
          tiers = [
            {
              to: allowance,
              amount: 0,
            },
            ...config.usage_tiers.map((tier) => {
              let isLastTier = tier.to == -1 || tier.to == TierInfinite;
              return {
                to: isLastTier ? tier.to : Number(tier.to) + allowance!,
                amount: tier.amount,
              };
            }),
          ];
        } else {
          tiers = config.usage_tiers.map((tier) => {
            let isLastTier = tier.to == -1 || tier.to == TierInfinite;
            return {
              to: isLastTier ? tier.to : Number(tier.to) + allowance!,
              amount: tier.amount,
            };
          });
        }

        return {
          tiers: tiers,
          name: "",
          quantity: priceOptions?.quantity,
        };
      }
    }
  });

  const trialing =
    cusProduct.trial_ends_at && cusProduct.trial_ends_at > Date.now();

  const subIds = cusProduct.subscription_ids;
  let stripeSubData = {};

  if (
    subIds &&
    subIds.length > 0 &&
    org.config.api_version >= BREAK_API_VERSION
  ) {
    let baseSub = subs?.find(
      (s) => s.id == subIds[0] || (s as Subscription).stripe_id == subIds[0]
    );
    stripeSubData = {
      current_period_end: baseSub?.current_period_end
        ? baseSub.current_period_end * 1000
        : null,
      current_period_start: baseSub?.current_period_start
        ? baseSub.current_period_start * 1000
        : null,
    };
  }

  if (!subIds && trialing) {
    stripeSubData = {
      current_period_start: cusProduct.starts_at,
      current_period_end: cusProduct.trial_ends_at,
    };
  }

  if (apiVersion >= APIVersion.v1_1) {
    if ((!subIds || subIds.length == 0) && trialing) {
      stripeSubData = {
        current_period_start: cusProduct.starts_at,
        current_period_end: cusProduct.trial_ends_at,
      };
    }

    const fullProduct = fullCusProductToProduct(cusProduct);
    const v2Product = await getProductResponse({
      product: fullProduct,
      features,
      withDisplay: false,
      options: cusProduct.options,
    });

    return CusProductResponseSchema.parse({
      id: fullProduct.id,
      name: fullProduct.name,
      group: fullProduct.group || null,
      status: trialing ? CusProductStatus.Trialing : cusProduct.status,
      canceled_at: cusProduct.canceled_at || null,

      // canceled: cusProduct.canceled || false,
      // trialing: trialing ? true : false,

      is_default: fullProduct.is_default || false,
      is_add_on: fullProduct.is_add_on || false,
      version: fullProduct.version,
      quantity: cusProduct.quantity,

      // stripe_subscription_ids: cusProduct.subscription_ids || [],
      started_at: cusProduct.starts_at,
      entity_id: cusProduct.internal_entity_id
        ? entities?.find(
            (e: Entity) => e.internal_id == cusProduct.internal_entity_id
          )?.id
        : cusProduct.entity_id || undefined,

      ...stripeSubData,
      items: v2Product.items,
    });
  } else {
    let cusProductResponse = {
      id: cusProduct.product.id,
      name: cusProduct.product.name,
      group: cusProduct.product.group,
      status: trialing ? CusProductStatus.Trialing : cusProduct.status,
      created_at: cusProduct.created_at,
      canceled_at: cusProduct.canceled_at,
      processor: {
        type: cusProduct.processor?.type,
        subscription_id: cusProduct.processor?.subscription_id || null,
      },
      subscription_ids: cusProduct.subscription_ids || [],
      prices: prices,
      starts_at: cusProduct.starts_at,

      ...stripeSubData,
    };

    return cusProductResponse;
  }
};
