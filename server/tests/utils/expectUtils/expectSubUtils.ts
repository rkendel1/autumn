import { DrizzleCli } from "@/db/initDrizzle.js";
import { getStripeSubs } from "@/external/stripe/stripeSubUtils.js";
import {
  findStripeItemForPrice,
  isLicenseItem,
} from "@/external/stripe/stripeSubUtils/stripeSubItemUtils.js";
import { cusProductToPrices } from "@autumn/shared";
import { CusService } from "@/internal/customers/CusService.js";
import { getBillingType } from "@/internal/products/prices/priceUtils.js";
import { isV4Usage } from "@/internal/products/prices/priceUtils/usagePriceUtils/classifyUsagePrice.js";
import { isFreeProductV2 } from "@/internal/products/productUtils/classifyProduct.js";
import { notNullish, nullish } from "@/utils/genUtils.js";
import {
  AppEnv,
  BillingType,
  CusProductStatus,
  FullCusProduct,
  Organization,
  ProductV2,
  UsagePriceConfig,
} from "@autumn/shared";
import { expect } from "chai";
import { getDate } from "date-fns";

import Stripe from "stripe";

export const getSubsFromCusId = async ({
  stripeCli,
  customerId,
  productId,
  db,
  org,
  env,
  withExpired = false,
}: {
  stripeCli: Stripe;
  customerId: string;
  productId: string;
  db: DrizzleCli;
  org: Organization;
  env: AppEnv;
  withExpired?: boolean;
}) => {
  const fullCus = await CusService.getFull({
    db,
    idOrInternalId: customerId,
    orgId: org.id,
    env,
    inStatuses: withExpired
      ? [
          CusProductStatus.Active,
          CusProductStatus.Expired,
          CusProductStatus.PastDue,
          CusProductStatus.Scheduled,
        ]
      : undefined,
  });

  const cusProduct = fullCus.customer_products.find(
    (cp: FullCusProduct) => cp.product.id == productId
  )!;

  const subs: Stripe.Subscription[] = await getStripeSubs({
    stripeCli,
    subIds: cusProduct?.subscription_ids,
  });

  return {
    fullCus,
    cusProduct,
    subs,
  };
};

// export const expectSubAnchorsSame = async ({
//   stripeCli,
//   customerId,
//   productId,
//   db,
//   org,
//   env,
// }: {
//   stripeCli: Stripe;
//   customerId: string;
//   productId: string;
//   db: DrizzleCli;
//   org: Organization;
//   env: AppEnv;
// }) => {
//   const fullCus = await CusService.getFull({
//     db,
//     idOrInternalId: customerId,
//     orgId: org.id,
//     env,
//   });

//   const cusProduct = fullCus.customer_products.find(
//     (cp: FullCusProduct) => cp.product.id == productId
//   );

//   const sub = await cusProductToSub({
//     cusProduct,
//     stripeCli,
//   });

//   // const subs: Stripe.Subscription[] = await getStripeSubs({
//   //   stripeCli,
//   //   subIds: cusProduct?.subscription_ids,
//   // });

//   // let periodEnd = subs[0].current_period_end * 1000;
//   // let firstDate = getDate(periodEnd);

//   // for (const sub of subs.slice(1)) {
//   //   let dateOfAnchor = getDate(sub.current_period_end * 1000);
//   //   expect(dateOfAnchor).to.equal(
//   //     firstDate,
//   //     `subscription anchors are the same`,
//   //   );
//   // }

//   return {
//     fullCus,
//     // subs,
//   };
// };

const subIsCanceled = ({ sub }: { sub: Stripe.Subscription }) => {
  return (
    notNullish(sub.canceled_at) ||
    notNullish(sub.cancel_at) ||
    sub.cancel_at_period_end
  );
};

export const expectSubItemsCorrect = async ({
  stripeCli,
  customerId,
  product,
  db,
  org,
  env,
  subCanceled = false,
  isCanceled = false,
  entityId,
}: {
  stripeCli: Stripe;
  customerId: string;
  product: ProductV2;
  db: DrizzleCli;
  org: Organization;
  env: AppEnv;
  subCanceled?: boolean;
  isCanceled?: boolean;
  entityId?: string;
}) => {
  const fullCus = await CusService.getFull({
    db,
    idOrInternalId: customerId,
    orgId: org.id,
    env,
    withEntities: true,
  });

  let entity = entityId ? fullCus.entities.find((e) => e.id == entityId) : null;

  const productId = product.id;
  const cusProduct = fullCus.customer_products.find(
    (cp: FullCusProduct) =>
      cp.product.id == productId &&
      (entity ? cp.internal_entity_id == entity.internal_id : true)
  )!;

  if (isCanceled) {
    expect(
      cusProduct.canceled_at,
      `cus product ${cusProduct.product.id} have field 'canceled_at' set`
    ).to.exist;
    expect(
      cusProduct.canceled,
      `cus product ${cusProduct.product.id} have field 'canceled' set to true`
    ).to.be.true;
  } else {
    expect(
      cusProduct.canceled_at,
      `cus product ${cusProduct.product.id} should not have field 'canceled_at' set`
    ).to.not.exist;
    expect(
      cusProduct.canceled,
      `cus product ${cusProduct.product.id} should not have field 'canceled' set`
    ).to.be.false;
  }

  if (isFreeProductV2({ product })) {
    expect(
      cusProduct.subscription_ids,
      `cus product should have no subs for free product: ${product.name}`
    ).to.be.empty;
    return {
      fullCus,
    };
  }

  const subs: Stripe.Subscription[] = await getStripeSubs({
    stripeCli,
    subIds: cusProduct?.subscription_ids,
  });

  for (const sub of subs) {
    if (subCanceled) {
      expect(subIsCanceled({ sub }), "sub should be canceled").to.be.true;
    } else {
      expect(subIsCanceled({ sub }), "sub should not be canceled").to.be.false;
    }
  }

  const subItems = subs.flatMap((sub) => sub.items.data);
  const prices = cusProductToPrices({ cusProduct });

  let missingUsageCount = 0;

  for (const price of prices) {
    const subItem = findStripeItemForPrice({
      stripeItems: subItems,
      price,
    }) as Stripe.SubscriptionItem;

    // 1. If usage + v4 + internalEntityId
    if (isV4Usage({ price, cusProduct })) {
      if (nullish(subItem)) {
        missingUsageCount++;
      }

      const usagePriceConfig = price.config as UsagePriceConfig;

      expect(
        nullish(subItem) ||
          (subItem?.quantity === 0 &&
            isLicenseItem({ stripeItem: subItem! })) ||
          subItem?.price.id == usagePriceConfig.stripe_empty_price_id
      ).to.be.true;
      continue;
    } else {
      expect(
        subItem,
        `sub item for price: ${(price.config as any).internal_feature_id || price.config.interval} should exist`
      ).to.exist;
    }

    // 2. If prepaid...
    let billingType = getBillingType(price.config);
    if (billingType == BillingType.UsageInAdvance) {
      const featureId = (price.config as any).feature_id;
      const options = cusProduct.options.find((o) => o.feature_id == featureId);

      expect(
        options,
        `options should exist for prepaid price (featureId: ${featureId})`
      ).to.exist;

      const expectedQuantity = options?.upcoming_quantity || options?.quantity;
      expect(
        subItem?.quantity,
        `sub item quantity for prepaid price (featureId: ${featureId}) should be ${expectedQuantity}`
      ).to.equal(expectedQuantity);
      continue;
    }
  }

  expect(
    prices.length - missingUsageCount,
    "number of sub items equivalent to number of prices"
  ).to.equal(subItems.length);

  // Expect sub anchors to be the same
  // let periodEnd = subs[0].current_period_end * 1000;
  // let firstDate = getDate(periodEnd);

  // for (const sub of subs.slice(1)) {
  //   let dateOfAnchor = getDate(sub.current_period_end * 1000);
  //   expect(dateOfAnchor).to.approximately(
  //     firstDate,
  //     5000,
  //     `subscription anchors are the same, +/- 5s`
  //   );
  // }

  return {
    fullCus,

    cusProduct,
  };
};
