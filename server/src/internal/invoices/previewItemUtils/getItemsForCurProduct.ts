import Stripe from "stripe";

import { attachParamToCusProducts } from "@/internal/customers/attach/attachUtils/convertAttachParams.js";
import { cusProductToPrices } from "@autumn/shared";
import { AttachParams } from "@/internal/customers/cusProducts/AttachParams.js";

import { getBillingType } from "@/internal/products/prices/priceUtils.js";
import {
  AttachBranch,
  AttachConfig,
  BillingType,
  PreviewLineItem,
} from "@autumn/shared";

import { formatAmount } from "@/utils/formatUtils.js";

import { getCusPriceUsage } from "@/internal/customers/cusProducts/cusPrices/cusPriceUtils.js";
import { priceToUsageModel } from "@/internal/products/prices/priceUtils/convertPrice.js";
import { getContUseInvoiceItems } from "@/internal/customers/attach/attachUtils/getContUseItems/getContUseInvoiceItems.js";

import {
  isArrearPrice,
  isContUsePrice,
} from "@/internal/products/prices/priceUtils/usagePriceUtils/classifyUsagePrice.js";
import { priceToUnusedPreviewItem } from "@/internal/customers/attach/attachPreviewUtils/priceToUnusedPreviewItem.js";

export const getItemsForCurProduct = async ({
  sub,
  attachParams,
  branch,
  config,
  now,
  logger,
}: {
  sub?: Stripe.Subscription;
  attachParams: AttachParams;
  branch: AttachBranch;
  config: AttachConfig;
  now: number;
  logger: any;
}) => {
  const { curMainProduct, curSameProduct } = attachParamToCusProducts({
    attachParams,
  });

  const curCusProduct = curSameProduct || curMainProduct!;

  let items: PreviewLineItem[] = [];
  const subItems = sub?.items.data || [];
  const curPrices = cusProductToPrices({ cusProduct: curCusProduct });

  for (const price of curPrices) {
    if (isArrearPrice({ price }) || isContUsePrice({ price })) {
      continue;
    }

    const previewLineItem = priceToUnusedPreviewItem({
      price,
      stripeItems: subItems,
      cusProduct: curCusProduct,
      org: attachParams.org,
      now,
      latestInvoice: sub?.latest_invoice as Stripe.Invoice,
      subDiscounts: sub?.discounts as Stripe.Discount[],
    });

    if (!previewLineItem) continue;

    items.push(previewLineItem);
  }

  // console.log("items: ", items);

  let { oldItems } = await getContUseInvoiceItems({
    sub,
    attachParams,
    logger,
    cusProduct: curCusProduct,
  });

  items = [...items, ...oldItems];

  for (const price of curPrices) {
    let billingType = getBillingType(price.config);

    if (billingType == BillingType.UsageInArrear) {
      const { amount, description } = getCusPriceUsage({
        price,
        cusProduct: curCusProduct,
        logger,
      });

      if (!amount || amount <= 0) continue;

      items.push({
        price: formatAmount({
          org: attachParams.org,
          amount,
        }),
        description,
        amount,
        price_id: price.id!,
        usage_model: priceToUsageModel(price),
      });
    }
  }

  return items;
};
