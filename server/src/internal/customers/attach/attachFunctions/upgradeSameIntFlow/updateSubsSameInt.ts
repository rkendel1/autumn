import { getStripeSubs } from "@/external/stripe/stripeSubUtils.js";
import { getStripeSubItems } from "@/external/stripe/stripeSubUtils/getStripeSubItems.js";
import { subToAutumnInterval } from "@/external/stripe/utils.js";
import { AttachParams } from "@/internal/customers/cusProducts/AttachParams.js";
import { ExtendedRequest } from "@/utils/models/Request.js";
import {
  AttachConfig,
  FullCusProduct,
  intervalsSame,
  Replaceable,
} from "@autumn/shared";
import { addSubItemsToRemove } from "../attachFuncUtils.js";
import { updateStripeSub } from "../../attachUtils/updateStripeSub/updateStripeSub.js";
import { insertInvoiceFromAttach } from "@/internal/invoices/invoiceUtils.js";
import Stripe from "stripe";
import { getContUseInvoiceItems } from "../../attachUtils/getContUseItems/getContUseInvoiceItems.js";

export const updateSubsByInt = async ({
  req,
  curCusProduct,
  attachParams,
  config,
  stripeSubs,
}: {
  req: ExtendedRequest;
  curCusProduct: FullCusProduct;
  attachParams: AttachParams;
  config: AttachConfig;
  stripeSubs: Stripe.Subscription[];
}) => {
  const { db, logtail: logger } = req;

  let { replaceables, newItems } = await getContUseInvoiceItems({
    attachParams,
    cusProduct: curCusProduct!,
    stripeSubs,
    logger,
  });

  attachParams.replaceables = replaceables;

  const itemSets = await getStripeSubItems({ attachParams });

  const invoices: Stripe.Invoice[] = [];

  for (const sub of stripeSubs) {
    let subInterval = subToAutumnInterval(sub);
    let itemSet = itemSets.find((itemSet) => {
      return intervalsSame({
        intervalA: itemSet,
        intervalB: subInterval,
      });
    })!;

    await addSubItemsToRemove({
      sub,
      cusProduct: curCusProduct,
      itemSet,
    });

    const { latestInvoice } = await updateStripeSub({
      db,
      attachParams,
      config,
      stripeSubs: [sub],
      itemSet,
      logger,
      interval: itemSet.interval,
      intervalCount: itemSet.intervalCount,
    });

    if (latestInvoice) {
      invoices.push(latestInvoice);
    }

    logger.info(
      `Updated sub ${sub.id}, interval ${itemSet.interval}, intervalCount ${itemSet.intervalCount}`
    );
  }

  const batchInvUpdate = [];
  for (const invoice of invoices) {
    batchInvUpdate.push(
      insertInvoiceFromAttach({
        db,
        attachParams,
        stripeInvoice: invoice,
        logger,
      })
    );
  }

  return { replaceables, invoices };
};
