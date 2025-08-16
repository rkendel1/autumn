import Stripe from "stripe";
import { CusProductService } from "@/internal/customers/cusProducts/CusProductService.js";
import {
  AppEnv,
  FullCusProduct,
  FullCustomerPrice,
  InvoiceStatus,
  Organization,
} from "@autumn/shared";
import { createStripeCli } from "../utils.js";

import { nullish } from "@/utils/genUtils.js";
import {
  getFullStripeInvoice,
  getInvoiceDiscounts,
  updateInvoiceIfExists,
} from "../stripeInvoiceUtils.js";
import { getStripeSubs } from "../stripeSubUtils.js";
import { addTaskToQueue } from "@/queue/queueUtils.js";
import { JobName } from "@/queue/JobName.js";
import { DrizzleCli } from "@/db/initDrizzle.js";
import { InvoiceService } from "@/internal/invoices/InvoiceService.js";
import { getInvoiceItems } from "@/internal/invoices/invoiceUtils.js";
import { handleInvoicePaidDiscount } from "./handleInvoicePaidDiscount.js";
import { handleInvoiceCheckoutPaid } from "@/internal/customers/attach/attachFunctions/invoiceCheckoutPaid/handleInvoiceCheckoutPaid.js";

const handleOneOffInvoicePaid = async ({
  db,
  stripeInvoice,
  logger,
}: {
  db: DrizzleCli;
  stripeInvoice: Stripe.Invoice;
  event: Stripe.Event;
  logger: any;
}) => {
  // Search for invoice
  const invoice = await InvoiceService.getByStripeId({
    db,
    stripeId: stripeInvoice.id,
  });

  if (!invoice) {
    console.log(`Invoice not found`);
    return;
  }

  // Update invoice status
  await InvoiceService.updateByStripeId({
    db,
    stripeId: stripeInvoice.id,
    updates: {
      status: stripeInvoice.status as InvoiceStatus,
      hosted_invoice_url: stripeInvoice.hosted_invoice_url,
      discounts: getInvoiceDiscounts({
        expandedInvoice: stripeInvoice,
      }),
    },
  });

  console.log(`Updated one off invoice status to ${stripeInvoice.status}`);
};

const convertToChargeAutomatically = async ({
  org,
  env,
  invoice,
  activeCusProducts,
  logger,
}: {
  org: Organization;
  env: AppEnv;
  invoice: Stripe.Invoice;
  activeCusProducts: FullCusProduct[];
  logger: any;
}) => {
  const stripeCli = createStripeCli({ org, env });

  const subs = await getStripeSubs({
    stripeCli,
    subIds: activeCusProducts.flatMap((p) => p.subscription_ids || []),
  });

  if (
    subs.every((s) => s.collection_method === "charge_automatically") ||
    nullish(invoice.payment_intent)
  ) {
    return;
  }

  // Try to attach payment method to subscription
  try {
    logger.info(`Converting to charge automatically`);
    // 1. Get payment intent
    const paymentIntent = await stripeCli.paymentIntents.retrieve(
      invoice.payment_intent as string
    );

    // 2. Get payment method
    const paymentMethod = await stripeCli.paymentMethods.retrieve(
      paymentIntent.payment_method as string
    );

    await stripeCli.paymentMethods.attach(paymentMethod.id, {
      customer: invoice.customer as string,
    });

    const batchUpdateSubs = [];
    const updateSub = async (sub: Stripe.Subscription) => {
      try {
        await stripeCli.subscriptions.update(sub.id, {
          collection_method: "charge_automatically",
          default_payment_method: paymentMethod.id,
        });
      } catch (error) {
        logger.warn(
          `Convert to charge automatically: error updating subscription ${sub.id}`
        );
        logger.warn(error);
      }
    };

    for (const sub of subs) {
      batchUpdateSubs.push(updateSub(sub));
    }

    await Promise.all(batchUpdateSubs);

    logger.info("Convert to charge automatically successful!");
  } catch (error) {
    logger.warn(`Convert to charge automatically failed: ${error}`);
  }
};

export const handleInvoicePaid = async ({
  db,
  req,
  org,
  invoiceData,
  env,
  event,
}: {
  db: DrizzleCli;
  req: any;
  org: Organization;
  invoiceData: Stripe.Invoice;
  env: AppEnv;
  event: Stripe.Event;
}) => {
  const logger = req.logtail;
  const stripeCli = createStripeCli({ org, env });
  const invoice = await getFullStripeInvoice({
    stripeCli,
    stripeId: invoiceData.id,
  });

  if (invoice.metadata?.autumn_metadata_id) {
    await handleInvoiceCheckoutPaid({
      req,
      org,
      env,
      db,
      stripeCli,
      invoice,
    });
  }

  await handleInvoicePaidDiscount({
    db,
    expandedInvoice: invoice,
    org,
    env,
    logger,
  });

  if (invoice.subscription) {
    // Get customer product
    const activeCusProducts = await CusProductService.getByStripeSubId({
      db,
      stripeSubId: invoice.subscription as string,
      orgId: org.id,
      env,
    });

    if (!activeCusProducts || activeCusProducts.length === 0) {
      // TODO: Send alert
      if (invoice.livemode) {
        logger.warn(
          `invoice.paid: customer product not found for invoice ${invoice.id}`
        );
      }
      return;
    }

    if (org.config.convert_to_charge_automatically) {
      await convertToChargeAutomatically({
        org,
        env,
        invoice,
        activeCusProducts,
        logger,
      });
    }

    let updated = await updateInvoiceIfExists({
      db,
      invoice,
    });

    if (!updated) {
      let invoiceItems = await getInvoiceItems({
        stripeInvoice: invoice,
        prices: activeCusProducts.flatMap((p) =>
          p.customer_prices.map((cpr: FullCustomerPrice) => cpr.price)
        ),
        logger,
      });

      await InvoiceService.createInvoiceFromStripe({
        db,
        stripeInvoice: invoice,
        internalCustomerId: activeCusProducts[0].internal_customer_id,
        internalEntityId: activeCusProducts[0].internal_entity_id,
        productIds: activeCusProducts.map((p) => p.product_id),
        internalProductIds: activeCusProducts.map((p) => p.internal_product_id),
        org: org,
        items: invoiceItems,
      });
    }

    for (const cusProd of activeCusProducts) {
      try {
        await addTaskToQueue({
          jobName: JobName.TriggerCheckoutReward,
          payload: {
            customer: cusProd.customer,
            product: cusProd.product,
            org,
            env: cusProd.customer!.env,
            subId: cusProd.subscription_ids?.[0],
          },
        });
      } catch (error) {
        logger.error(`invoice.paid: failed to trigger checkout reward check`);
        logger.error(error);
      }
    }
  } else {
    await handleOneOffInvoicePaid({
      db,
      stripeInvoice: invoice,
      event,
      logger,
    });
  }
};
