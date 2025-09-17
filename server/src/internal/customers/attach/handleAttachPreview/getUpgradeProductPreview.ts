import { AttachParams } from "../../cusProducts/AttachParams.js";
import {
  attachParamsToProduct,
  attachParamToCusProducts,
  paramsToCurSub,
} from "../attachUtils/convertAttachParams.js";

import { ExtendedRequest } from "@/utils/models/Request.js";
import { getLargestInterval } from "@/internal/products/prices/priceUtils/priceIntervalUtils.js";
import { getItemsForNewProduct } from "@/internal/invoices/previewItemUtils/getItemsForNewProduct.js";
import { getItemsForCurProduct } from "@/internal/invoices/previewItemUtils/getItemsForCurProduct.js";
import { getOptions } from "@/internal/api/entitled/checkUtils.js";
import { mapToProductItems } from "@/internal/products/productV2Utils.js";
import Stripe from "stripe";
import {
  AttachBranch,
  FreeTrial,
  FullCusProduct,
  PreviewLineItem,
  Price,
  UsageModel,
  AttachConfig,
  UsagePriceConfig,
  OnDecrease,
  OnIncrease,
} from "@autumn/shared";

import { freeTrialToStripeTimestamp } from "@/internal/products/free-trials/freeTrialUtils.js";
import { Decimal } from "decimal.js";
import { isFreeProduct } from "@/internal/products/productUtils.js";
import { formatUnixToDate, nullish } from "@/utils/genUtils.js";
import { isTrialing } from "@autumn/shared";
import { cusProductToPrices } from "@autumn/shared";
import { isPrepaidPrice } from "@/internal/products/prices/priceUtils/usagePriceUtils/classifyUsagePrice.js";
import {
  addIntervalToAnchor,
  getAlignedUnix,
} from "@/internal/products/prices/billingIntervalUtils2.js";

const getNextCycleAt = ({
  prices,
  sub,
  now,
  freeTrial,
  branch,
  curCusProduct,
}: {
  prices: Price[];
  sub: Stripe.Subscription;
  now?: number;
  freeTrial?: FreeTrial | null;
  branch: AttachBranch;
  curCusProduct?: FullCusProduct;
}) => {
  now = now || Date.now();

  if (
    branch == AttachBranch.NewVersion &&
    curCusProduct &&
    isTrialing({ cusProduct: curCusProduct, now })
  ) {
    return curCusProduct.trial_ends_at;
  }

  if (freeTrial) {
    return (
      freeTrialToStripeTimestamp({
        freeTrial,
        now,
      })! * 1000
    );
  }

  const largestInterval = getLargestInterval({ prices });
  if (nullish(largestInterval) || !sub.billing_cycle_anchor) return now;

  const nextCycleAt = getAlignedUnix({
    anchor: sub.billing_cycle_anchor * 1000,
    intervalConfig: largestInterval!,
    now,
  });

  return nextCycleAt;
};

const filterNoProratePrepaidItems = ({
  items,
  attachParams,
  curSameProduct,
}: {
  items: PreviewLineItem[];
  attachParams: AttachParams;
  curSameProduct?: FullCusProduct;
}) => {
  if (!curSameProduct) {
    return items;
  }

  let filteredItems = items;
  const curPrices = cusProductToPrices({ cusProduct: curSameProduct! });
  for (const option of attachParams.optionsList) {
    const { feature_id, internal_feature_id, quantity } = option;
    const prevQuantity = curSameProduct?.options.find(
      (o) => o.feature_id == feature_id
    )?.quantity;

    const curPrice = curPrices.find(
      (p) =>
        (p.config as UsagePriceConfig)?.internal_feature_id ==
          internal_feature_id && isPrepaidPrice({ price: p })
    );

    const onDecrease = curPrice?.proration_config?.on_decrease;
    const decreaseIsNone = onDecrease == OnDecrease.None;

    if (decreaseIsNone && prevQuantity && quantity < prevQuantity) {
      console.log(
        `Quantity for ${feature_id} decreased from ${prevQuantity} to ${quantity}, Removing price: ${curPrice?.id}`
      );
      filteredItems = items.filter((item) => item.price_id !== curPrice?.id);
    }

    const onIncrease = curPrice?.proration_config?.on_increase;
    if (
      onIncrease == OnIncrease.ProrateNextCycle &&
      prevQuantity &&
      quantity > prevQuantity
    ) {
      console.log(
        `Quantity for ${feature_id} increased from ${prevQuantity} to ${quantity}, Removing price: ${curPrice?.id}`
      );
      filteredItems = items.filter((item) => item.price_id !== curPrice?.id);
    }
  }
  return filteredItems;
};

export const getUpgradeProductPreview = async ({
  req,
  attachParams,
  branch,
  now,
  withPrepaid = false,
  config,
}: {
  req: ExtendedRequest;
  attachParams: AttachParams;
  branch: AttachBranch;
  now: number;
  withPrepaid?: boolean;
  config: AttachConfig;
}) => {
  const { logtail: logger } = req;

  const { curMainProduct, curSameProduct } = attachParamToCusProducts({
    attachParams,
  });

  const curCusProduct = curSameProduct || curMainProduct!;
  const sub = await paramsToCurSub({ attachParams });

  const curPreviewItems = await getItemsForCurProduct({
    sub: sub!,
    attachParams,
    branch,
    config,
    now,
    logger,
  });

  // Get prorated amounts for new product
  const newProduct = attachParamsToProduct({ attachParams });

  if (config?.disableTrial) attachParams.freeTrial = null;
  let freeTrial = attachParams.freeTrial;
  let anchor = sub ? sub.billing_cycle_anchor * 1000 : undefined;

  if (
    config?.carryTrial &&
    curCusProduct?.free_trial &&
    isTrialing({ cusProduct: curCusProduct, now })
  ) {
    freeTrial = curCusProduct.free_trial;
  }

  const newPreviewItems = await getItemsForNewProduct({
    newProduct,
    attachParams,
    now,
    freeTrial,
    sub: sub!,
    logger,
    withPrepaid,
    anchor,
  });

  let dueNextCycle = undefined;
  if (!isFreeProduct(newProduct.prices)) {
    const nextCycleAt = getNextCycleAt({
      prices: newProduct.prices,
      sub: sub!,
      now,
      freeTrial: attachParams.freeTrial,
      branch,
      curCusProduct,
    });

    let nextCycleItems = await getItemsForNewProduct({
      newProduct,
      attachParams,
      logger,
      withPrepaid,
    });

    dueNextCycle = {
      line_items: nextCycleItems,
      due_at: nextCycleAt,
    };
  }

  let items = [...curPreviewItems, ...newPreviewItems];

  for (const item of structuredClone(curPreviewItems)) {
    let priceId = item.price_id;
    let newItem = newPreviewItems.find((i) => i.price_id == priceId);

    if (!newItem) {
      continue;
    }

    let newItemAmount = new Decimal(newItem?.amount ?? 0).toDecimalPlaces(2);
    let curItemAmount = new Decimal(item.amount ?? 0).toDecimalPlaces(2);

    if (newItemAmount.add(curItemAmount).eq(0)) {
      items = items.filter((i) => i.price_id !== priceId);
    }
  }

  const dueTodayAmt = items
    .reduce((acc, item) => acc.plus(item.amount ?? 0), new Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();

  let options = getOptions({
    prodItems: mapToProductItems({
      prices: newProduct.prices,
      entitlements: newProduct.entitlements,
      features: attachParams.features,
    }),
    features: attachParams.features,
    anchor,
    now,
    freeTrial: attachParams.freeTrial,
    cusProduct: curCusProduct,
  });

  items = items.filter((item) => item.amount !== 0);

  if (branch == AttachBranch.UpdatePrepaidQuantity) {
    items = items.filter((item) => item.usage_model == UsageModel.Prepaid);
    dueNextCycle!.line_items = dueNextCycle!.line_items.filter(
      (item) => item.usage_model == UsageModel.Prepaid
    );

    items = filterNoProratePrepaidItems({
      items,
      attachParams,
      curSameProduct: curSameProduct!,
    });
  }

  let dueToday:
    | {
        line_items: PreviewLineItem[];
        total: number;
      }
    | undefined = {
    line_items: items,
    total: dueTodayAmt,
  };

  if (branch == AttachBranch.SameCustomEnts) {
    dueToday = undefined;
  }

  if (branch == AttachBranch.NewVersion && dueToday) {
    dueToday.line_items = [];
    dueToday.total = 0;
  }

  return {
    currency: attachParams.org.default_currency,
    due_today: dueToday,
    due_next_cycle: dueNextCycle,
    options,
  };
};
